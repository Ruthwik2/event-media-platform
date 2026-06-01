
const {
  DetectLabelsCommand,
  IndexFacesCommand,
  SearchFacesByImageCommand,
  CreateCollectionCommand,
  ListCollectionsCommand,
  DetectModerationLabelsCommand,
  DeleteFacesCommand,
} = require('@aws-sdk/client-rekognition');
const { rekognitionClient } = require('../config/aws');
const logger = require('../config/logger');

const COLLECTION_ID = process.env.REKOGNITION_COLLECTION_ID || 'event-media-faces';

// ─── helpers ────────────────────────────────────────────────────────────────

const isS3Url = (url) => typeof url === 'string' && url.includes('amazonaws.com');

/**
 * Extract the raw S3 key from a virtual-hosted or path-style S3 URL.
 * Decodes URL-encoded characters so the key matches what is stored in S3.
 *
 * Virtual-hosted: https://bucket.s3.region.amazonaws.com/folder/file.jpg
 * Path-style:     https://s3.region.amazonaws.com/bucket/folder/file.jpg
 */
const extractS3Key = (imageUrl) => {
  try {
    // Build a safe URL — replace any raw spaces first so new URL() doesn't throw
    const safeUrl = imageUrl.replace(/ /g, '%20');
    const url = new URL(safeUrl);
    // Decode so the key matches the actual object name stored in S3
    const decoded = decodeURIComponent(url.pathname.slice(1)); // strip leading "/"

    // For virtual-hosted URLs the pathname is already just the key
    // For path-style URLs the pathname is /bucket/key — strip the bucket prefix
    const hostname = url.hostname;
    if (hostname.startsWith('s3.') && !hostname.includes('.s3.')) {
      // path-style: https://s3.region.amazonaws.com/bucketname/key
      const bucket = process.env.AWS_S3_BUCKET || '';
      return decoded.startsWith(bucket + '/') ? decoded.slice(bucket.length + 1) : decoded;
    }

    return decoded; // virtual-hosted: pathname IS the key
  } catch (err) {
    logger.error('extractS3Key: failed to parse URL', { imageUrl, err: err.message });
    return null;
  }
};

// ─── ensureCollection ────────────────────────────────────────────────────────

const ensureCollection = async () => {
  const { CollectionIds } = await rekognitionClient.send(new ListCollectionsCommand({}));
  if (!CollectionIds.includes(COLLECTION_ID)) {
    await rekognitionClient.send(new CreateCollectionCommand({ CollectionId: COLLECTION_ID }));
    logger.info(`Created Rekognition collection: ${COLLECTION_ID}`);
  }
};

// ─── indexFace ───────────────────────────────────────────────────────────────

/**
 * Index a face from an S3 image into the Rekognition collection.
 *
 * Returns:
 *   { faceId: string }   – face indexed successfully
 *   { noFace: true }     – Rekognition connected but found no face in the image
 *   { error: string }    – AWS / config error (permissions, missing collection, etc.)
 */
const indexFace = async (imageUrl, userId) => {
  if (!process.env.AWS_ACCESS_KEY_ID) {
    return { error: 'AWS credentials not configured (AWS_ACCESS_KEY_ID missing).' };
  }
  if (!isS3Url(imageUrl)) {
    return { error: 'Selfie is not on S3. Make sure USE_S3=true is set and S3 upload succeeded.' };
  }

  const bucket = process.env.AWS_S3_BUCKET;
  const key = extractS3Key(imageUrl);

  if (!key) {
    return { error: `Could not extract S3 key from URL: ${imageUrl}` };
  }

  logger.info('indexFace: attempting', { bucket, key, collection: COLLECTION_ID });

  try {
    // Make sure the collection exists — let errors propagate so we see them
    await ensureCollection();
  } catch (err) {
    const msg = `Failed to create/verify Rekognition collection "${COLLECTION_ID}": ${err.message}`;
    logger.error(msg, { code: err.name });
    return { error: msg };
  }

  try {
    const safeExternalId = String(userId).replace(/[^a-zA-Z0-9_.\-:]/g, '_');

    const response = await rekognitionClient.send(new IndexFacesCommand({
      CollectionId: COLLECTION_ID,
      Image: { S3Object: { Bucket: bucket, Name: key } },
      ExternalImageId: safeExternalId,
      DetectionAttributes: ['DEFAULT'],
      MaxFaces: 1,
      QualityFilter: 'NONE', // NONE = accept any quality; AUTO rejects slightly angled photos
    }));

    if (response.FaceRecords && response.FaceRecords.length > 0) {
      const faceId = response.FaceRecords[0].Face.FaceId;
      logger.info('indexFace: success', { userId, faceId });
      return { faceId };
    }

    logger.warn('indexFace: no faces detected', { bucket, key });
    return { noFace: true };

  } catch (err) {
    // Surface the real AWS error
    const code = err.name || err.Code || 'UnknownError';
    const msg = err.message || String(err);
    logger.error('indexFace: Rekognition error', { code, msg, bucket, key });

    if (code === 'InvalidParameterException') {
      return { noFace: true }; // image has no detectable face content at all
    }

    // Return the real error so the caller can report it properly
    return { error: `Rekognition error [${code}]: ${msg}` };
  }
};

// ─── searchFacesByImage ──────────────────────────────────────────────────────

const searchFacesByImage = async (imageUrl) => {
  try {
    if (!process.env.AWS_ACCESS_KEY_ID) return [];
    if (!isS3Url(imageUrl)) return [];

    const bucket = process.env.AWS_S3_BUCKET;
    const key = extractS3Key(imageUrl);
    if (!key) return [];

    const response = await rekognitionClient.send(new SearchFacesByImageCommand({
      CollectionId: COLLECTION_ID,
      Image: { S3Object: { Bucket: bucket, Name: key } },
      MaxFaces: 20,
      FaceMatchThreshold: 80,
    }));

    return response.FaceMatches?.map(match => ({
      faceId: match.Face.FaceId,
      userId: match.Face.ExternalImageId,
      similarity: match.Similarity,
    })) || [];
  } catch (err) {
    if (err.name === 'InvalidParameterException') return [];
    logger.error('searchFacesByImage error:', { message: err.message, imageUrl });
    return [];
  }
};

// ─── detectLabels ────────────────────────────────────────────────────────────

const detectLabels = async (imageUrl) => {
  try {
    if (!process.env.AWS_ACCESS_KEY_ID) return ['event', 'people', 'indoor', 'celebration'];
    if (!isS3Url(imageUrl)) return ['event', 'photo'];

    const bucket = process.env.AWS_S3_BUCKET;
    const key = extractS3Key(imageUrl);
    if (!key) return [];

    const response = await rekognitionClient.send(new DetectLabelsCommand({
      Image: { S3Object: { Bucket: bucket, Name: key } },
      MaxLabels: 15,
      MinConfidence: 70,
    }));

    return response.Labels.map(label => label.Name.toLowerCase());
  } catch (err) {
    logger.error('detectLabels error:', err.message);
    return [];
  }
};

// ─── moderateContent ─────────────────────────────────────────────────────────

const moderateContent = async (imageUrl) => {
  try {
    if (!process.env.AWS_ACCESS_KEY_ID) return { safe: true, labels: [] };
    if (!isS3Url(imageUrl)) return { safe: true, labels: [] };

    const bucket = process.env.AWS_S3_BUCKET;
    const key = extractS3Key(imageUrl);
    if (!key) return { safe: true, labels: [] };

    const response = await rekognitionClient.send(new DetectModerationLabelsCommand({
      Image: { S3Object: { Bucket: bucket, Name: key } },
      MinConfidence: 75,
    }));

    const labels = response.ModerationLabels || [];
    return { safe: labels.length === 0, labels: labels.map(l => l.Name) };
  } catch (err) {
    logger.error('moderateContent error:', err.message);
    return { safe: true, labels: [] };
  }
};
const deleteFace = async (faceId) => {
  try {
    await rekognitionClient.send(new DeleteFacesCommand({
      CollectionId: COLLECTION_ID,
      FaceIds: [faceId],
    }));
    logger.info('deleteFace: removed', { faceId });
  } catch (err) {
    logger.error('deleteFace: error', { faceId, err: err.message });
  }
};
module.exports = { detectLabels, indexFace, searchFacesByImage, moderateContent, ensureCollection, deleteFace };