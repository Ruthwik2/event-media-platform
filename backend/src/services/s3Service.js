const {
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { s3Client } = require('../config/aws');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

// S3 is only active when USE_S3=true AND a bucket is configured
const USE_S3 = process.env.USE_S3 === 'true' && !!process.env.AWS_S3_BUCKET;
const BUCKET = process.env.AWS_S3_BUCKET;

const uploadToS3 = async (file, folder = 'media') => {
  if (!USE_S3) {
    // Local storage — file.path exists from diskStorage, file.filename is the saved name
    const filename = file.filename || file.originalname;
    const subfolder = folder === 'media' ? '' : folder + '/';
    return `${process.env.BACKEND_URL}/uploads/${subfolder}${filename}`;
  }

  const safeName = file.originalname.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._\-]/g, '');
  const key = `${folder}/${uuidv4()}-${safeName}`;
  const fileContent = fs.readFileSync(file.path);

  await s3Client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: fileContent,
    ContentType: file.mimetype,
  }));

  // Clean up local temp file
  if (file.path && fs.existsSync(file.path)) {
    fs.unlinkSync(file.path);
  }

  return `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
};

const uploadBufferToS3 = async (buffer, filename, mimetype, folder = 'media') => {
  if (!USE_S3) {
    // Save buffer locally
    const dir = path.join('uploads', folder === 'media' ? '' : folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const savedName = `${uuidv4()}-${filename}`;
    const savedPath = path.join(dir, savedName);
    fs.writeFileSync(savedPath, buffer);
    const subfolder = folder === 'media' ? '' : folder + '/';
    return `${process.env.BACKEND_URL}/uploads/${subfolder}${savedName}`;
  }

  const key = `${folder}/${uuidv4()}-${filename}`;

  await s3Client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimetype,
  }));

  return `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
};

const deleteFromS3 = async (url) => {
  if (!USE_S3 || !url || !url.includes('amazonaws.com')) {
    // Delete local file
    if (url && url.includes('/uploads/')) {
      try {
        const localPath = url.replace(process.env.BACKEND_URL || '', '');
        const fullPath = path.join(__dirname, '../../', localPath);
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      } catch (_) { }
    }
    return;
  }

  const key = url.split('.amazonaws.com/')[1];
  if (!key) return;

  await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
};

const getSignedDownloadUrl = async (url, expiresIn = 3600) => {
  if (!USE_S3 || !url || !url.includes('amazonaws.com')) return url;

  const key = url.split('.amazonaws.com/')[1];
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3Client, command, { expiresIn });
};

const getS3ObjectStream = async ({ url, bucket, key }) => {
  try {
    if (!USE_S3 && !bucket) return null;

    let resolvedBucket = bucket || BUCKET;
    let resolvedKey = key || '';

    if (!resolvedKey && url && url.includes('amazonaws.com/')) {
      resolvedKey = url.split('.amazonaws.com/')[1];
    }

    if (!resolvedBucket || !resolvedKey) return null;

    const command = new GetObjectCommand({ Bucket: resolvedBucket, Key: resolvedKey });
    const response = await s3Client.send(command);
    return response.Body || null;
  } catch (error) {
    return null;
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

module.exports = { uploadToS3, uploadBufferToS3, deleteFromS3, getSignedDownloadUrl, getS3ObjectStream, USE_S3 };