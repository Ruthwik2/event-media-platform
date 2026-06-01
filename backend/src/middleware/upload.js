const multer = require('multer');
const multerS3 = require('multer-s3');
const { s3Client } = require('../config/aws');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const USE_S3 = process.env.USE_S3 === 'true' && !!process.env.AWS_S3_BUCKET;

// Ensure upload directories exist
['uploads', 'uploads/avatars', 'uploads/thumbnails', 'uploads/selfies', 'uploads/covers', 'uploads/media'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const allowedMimeTypes = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
  'image/webp', 'video/mp4', 'video/mpeg', 'video/quicktime',
  'video/x-msvideo', 'video/webm',
];

const fileFilter = (req, file, cb) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} not allowed`), false);
  }
};

// S3 Storage
const s3Storage = multerS3({
  s3: s3Client,
  bucket: process.env.AWS_S3_BUCKET,
  contentType: multerS3.AUTO_CONTENT_TYPE,
  metadata: (req, file, cb) => {
    cb(null, { fieldName: file.fieldname, uploadedBy: req.user?.id || 'anonymous' });
  },
  key: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const key = `media/${req.user?.id || 'anonymous'}/${uuidv4()}${ext}`;
    cb(null, key);
  },
});

// Local storage for general media
const localMediaStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/media/');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage: USE_S3 ? s3Storage : localMediaStorage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
    files: 20,
  },
});

// Avatar upload — always local
const avatarStorage = multer.diskStorage({
  destination: 'uploads/avatars/',
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `avatar-${req.user?.id}-${Date.now()}${ext}`);
  },
});

const avatarUpload = multer({
  storage: avatarStorage,
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files allowed for avatar'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Selfie upload — always local (uploadToS3 handles moving it to S3 if needed)
const selfieStorage = multer.diskStorage({
  destination: 'uploads/selfies/',
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `selfie-${req.user?.id}-${Date.now()}${ext}`);
  },
});

const selfieUpload = multer({
  storage: selfieStorage,
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files allowed for selfie'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Cover image upload — always local
const coverStorage = multer.diskStorage({
  destination: 'uploads/covers/',
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `cover-${uuidv4()}${ext}`);
  },
});

const coverUpload = multer({
  storage: coverStorage,
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files allowed for cover'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

module.exports = { upload, avatarUpload, selfieUpload, coverUpload, USE_S3 };