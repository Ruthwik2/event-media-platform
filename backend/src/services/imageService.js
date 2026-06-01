const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { uploadBufferToS3 } = require('./s3Service');

const generateThumbnail = async (inputPath, outputDir = 'uploads/thumbnails') => {
 try {
 if (!fs.existsSync(outputDir)) {
 fs.mkdirSync(outputDir, { recursive: true });
 }

 const thumbnailFilename = `thumb-${uuidv4()}.jpg`;
 const thumbnailPath = path.join(outputDir, thumbnailFilename);
 
    await sharp(inputPath)
      .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toFile(thumbnailPath);
 
    return thumbnailPath;
  } catch (error) {
    console.error('Error generating thumbnail:', error);
    return null;
  }
};
 
const compressImage = async (inputPath, quality = 85) => {
  try {
    const ext = path.extname(inputPath).toLowerCase();
    const outputPath = inputPath.replace(ext, `-compressed${ext}`);
 
    await sharp(inputPath)
      .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality })
      .toFile(outputPath);
 
    return outputPath;
  } catch (error) {
    console.error('Error compressing image:', error);
    return inputPath;
  }
};
 
const getImageMetadata = async (inputPath) => {
  try {
    const metadata = await sharp(inputPath).metadata();
    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: metadata.size,
    };
  } catch (error) {
    return {};
  }
};
 
const addWatermark = async (inputPath, watermarkText) => {
  try {
    const metadata = await sharp(inputPath).metadata();
    const { width, height } = metadata;
 
    const fontSize = Math.max(20, Math.floor(width / 30));
    const svgText = `
      <svg width="${width}" height="${height}">
        <defs>
          <style>
            .watermark { 
              fill: rgba(255,255,255,0.6); 
              font-size: ${fontSize}px; 
              font-family: Arial, sans-serif;
              font-weight: bold;
            }
          </style>
        </defs>
        <text 
          x="${width / 2}" 
          y="${height - 30}" 
          text-anchor="middle" 
          class="watermark"
          transform="rotate(-15, ${width / 2}, ${height / 2})"
        >${watermarkText}</text>
        <text 
          x="${width - 20}" 
          y="${height - 15}" 
          text-anchor="end" 
          class="watermark"
          style="font-size: ${Math.floor(fontSize * 0.7)}px"
        >© EventMedia Platform</text>
      </svg>`;
 
    const svgBuffer = Buffer.from(svgText);
    const outputBuffer = await sharp(inputPath)
      .composite([{ input: svgBuffer, top: 0, left: 0 }])
 .jpeg({ quality: 90 })
 .toBuffer();
 
    return outputBuffer;
  } catch (error) {
    console.error('Error adding watermark:', error);
    return fs.readFileSync(inputPath);
  }
};
 
module.exports = { generateThumbnail, compressImage, getImageMetadata, addWatermark };