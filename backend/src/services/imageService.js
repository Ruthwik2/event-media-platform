const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const generateThumbnail = async (inputPath, outputDir = 'uploads/thumbnails') => {
  try {
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
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
    return { width: metadata.width, height: metadata.height, format: metadata.format, size: metadata.size };
  } catch (error) {
    return {};
  }
};

function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const addWatermark = async (input, watermarkInfo = {}) => {
  try {
    const metadata = await sharp(input).metadata();
    const { width, height } = metadata;

    const clubName  = escapeXml(watermarkInfo.clubName  || 'EventMedia');
    const eventName = escapeXml(watermarkInfo.eventName || '');
    const username  = escapeXml(watermarkInfo.username  || '');
    const role      = escapeXml((watermarkInfo.userRole || '').toUpperCase());

    const downloadDate = new Date().toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });

    const line1 = eventName ? `${clubName}  \u2022  ${eventName}` : clubName;
    const line2Parts = [username ? `@${username}` : null, downloadDate, role || null].filter(Boolean);
    const line2 = line2Parts.join('  \u00b7  ');

    const fontSize1 = Math.min(52, Math.max(20, Math.floor(width / 32)));
    const fontSize2 = Math.round(fontSize1 * 0.70);

    const w1 = line1.length * fontSize1 * 0.55;
    const w2 = line2.length * fontSize2 * 0.55;
    const innerW = Math.max(w1, w2, fontSize1 * 8);

    const padX   = fontSize1 * 0.9;
    const padY   = fontSize1 * 0.7;
    const sepGap = fontSize1 * 0.2;

    const iconSize = fontSize1 * 1.1;
    const iconGap  = fontSize1 * 0.45;

    const badgeW = iconGap + iconSize + iconGap * 0.5 + innerW + padX;
    const badgeH = padY + fontSize1 + sepGap + 1 + sepGap + fontSize2 + padY;

    const marginR = Math.round(width  * 0.02);
    const marginB = Math.round(height * 0.02);

    const bx = Math.round(width  - badgeW - marginR);
    const by = Math.round(height - badgeH - marginB);
    const rx = Math.round(fontSize1 * 0.25);

    const ibx  = bx + iconGap;
    const iby  = by + (badgeH - iconSize) / 2;
    const iR   = Math.round(iconSize * 0.18);
    const icx  = ibx + iconSize * 0.30;
    const icy  = iby + iconSize * 0.50;
    const icR  = iconSize * 0.20;
    const tCX  = ibx + iconSize * 0.72;
    const tCY  = iby + iconSize * 0.50;
    const tH   = iconSize * 0.30;
    const tW   = iconSize * 0.24;

    const tx   = bx + iconGap + iconSize + iconGap * 0.6;
    const y1   = by + padY + fontSize1;
    const sepY = y1 + sepGap;
    const y2   = sepY + 1 + sepGap + fontSize2;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs>
        <linearGradient id="badgeBg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="#ffffff" stop-opacity="0.96"/>
          <stop offset="100%" stop-color="#e8edf2" stop-opacity="0.97"/>
        </linearGradient>
        <linearGradient id="iconGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stop-color="#111111"/>
          <stop offset="100%" stop-color="#333333"/>
        </linearGradient>
        <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000000" flood-opacity="0.25"/>
        </filter>
      </defs>
      <rect x="${bx}" y="${by}" width="${badgeW}" height="${badgeH}"
            rx="${rx}" ry="${rx}" fill="url(#badgeBg)" filter="url(#shadow)"/>
      <rect x="${ibx}" y="${iby}" width="${iconSize}" height="${iconSize}"
            rx="${iR}" ry="${iR}" fill="url(#iconGrad)"/>
      <circle cx="${icx}" cy="${icy}" r="${icR}"
              fill="none" stroke="white" stroke-width="${iconSize * 0.08}"/>
      <circle cx="${icx}" cy="${icy}" r="${icR * 0.38}" fill="white"/>
      <polygon points="${tCX - tW/2},${tCY + tH/2} ${tCX + tW/2},${tCY} ${tCX - tW/2},${tCY - tH/2}"
               fill="white"/>
      <line x1="${ibx + iconSize + iconGap * 0.3}" y1="${iby + iconSize * 0.12}"
            x2="${ibx + iconSize + iconGap * 0.3}" y2="${iby + iconSize * 0.88}"
            stroke="#cccccc" stroke-width="1"/>
      <text x="${tx}" y="${y1}"
            font-family="monospace"
            font-size="${fontSize1}px"
            font-weight="bold"
            fill="#111111"
            xml:space="preserve">${line1}</text>
      <line x1="${tx}" y1="${sepY}"
            x2="${bx + badgeW - padX * 0.5}" y2="${sepY}"
            stroke="#bbbbbb" stroke-width="1"/>
      <text x="${tx + innerW / 2}" y="${y2}"
            font-family="monospace"
            font-size="${fontSize2}px"
            font-weight="normal"
            fill="#444444"
            text-anchor="middle"
            xml:space="preserve">${line2}</text>
    </svg>`;

    const outputBuffer = await sharp(input)
      .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
      .jpeg({ quality: 92 })
      .toBuffer();

    return outputBuffer;
  } catch (error) {
    console.error('Error adding watermark:', error);
    if (Buffer.isBuffer(input)) return input;
    return fs.readFileSync(input);
  }
};

module.exports = { generateThumbnail, compressImage, getImageMetadata, addWatermark };
