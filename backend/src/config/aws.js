const { S3Client } = require('@aws-sdk/client-s3');
const { RekognitionClient } = require('@aws-sdk/client-rekognition');

const REGION = process.env.AWS_REGION;

// Warn instead of crash — missing AWS vars should not take down the whole server
if (!REGION) {
  console.warn('[aws.js] WARNING: AWS_REGION is not set. S3/Rekognition features will be disabled.');
}

const credentials = REGION && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
  ? {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
  : undefined;

const s3Client = REGION
  ? new S3Client({ region: REGION, credentials })
  : null;

const rekognitionClient = REGION
  ? new RekognitionClient({ region: REGION, credentials })
  : null;

module.exports = { s3Client, rekognitionClient };