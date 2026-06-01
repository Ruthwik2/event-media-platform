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

    const line1 = eventName ? `${clubName}  •  ${eventName}` : clubName;
    const line2Parts = [username ? `@${username}` : null, downloadDate, role || null].filter(Boolean);
    const line2 = line2Parts.join('  ·  ');

    const fontSize1 = Math.min(44, Math.max(18, Math.floor(width / 36)));
    const fontSize2 = Math.round(fontSize1 * 0.72);
    const monoW1 = fontSize1 * 0.58;
    const monoW2 = fontSize2 * 0.58;

    const innerW = Math.max(line1.length * monoW1, line2.length * monoW2);
    const padX   = fontSize1 * 1.0;
    const padY   = fontSize1 * 0.75;
    const gap    = fontSize1 * 0.55;
    const sepGap = fontSize1 * 0.22;

    const iconBoxSize = fontSize1 * 1.15;
    const iconPad     = fontSize1 * 0.5;

    const badgeW = iconPad + iconBoxSize + iconPad * 0.5 + innerW + padX;
    const badgeH = fontSize1 + fontSize2 + padY * 2 + gap + sepGap * 2 + 1;
    const marginR = Math.round(width  * 0.018);
    const marginB = Math.round(height * 0.018);

    // BOTTOM-RIGHT positioning
    const bx = Math.round(width - badgeW - marginR);
    const by = Math.round(height - badgeH - marginB);
    const rx = Math.round(fontSize1 * 0.3);

    const textX = bx + iconPad + iconBoxSize + iconPad * 0.55;
    const y1    = by + padY + fontSize1;
    const sepY  = y1 + sepGap + 1;
    const y2    = sepY + sepGap + fontSize2;

    const ibs = iconBoxSize;
    const ibx = bx + iconPad;
    const iby = by + (badgeH - ibs) / 2;
    const iRad = ibs * 0.18;
    const iCR  = ibs * 0.22;
    const icx  = ibx + ibs * 0.28;
    const icy  = iby + ibs * 0.5;
    const tCX  = ibx + ibs * 0.70;
    const tCY  = iby + ibs * 0.5;
    const tH   = ibs * 0.32;
    const tW   = ibs * 0.26;
    const t1x  = tCX - tW / 2, t1y = tCY + tH / 2;
    const t2x  = tCX + tW / 2, t2y = tCY;
    const t3x  = tCX - tW / 2, t3y = tCY - tH / 2;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="#ffffff" stop-opacity="0.95"/>
          <stop offset="100%" stop-color="#f1f5f9" stop-opacity="0.97"/>
        </linearGradient>
        <linearGradient id="iconBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stop-color="#1d1d1d"/>
          <stop offset="100%" stop-color="#3a3a3a"/>
        </linearGradient>
      </defs>
      <rect x="${bx}" y="${by}" width="${badgeW}" height="${badgeH}"
            rx="${rx}" ry="${rx}" fill="url(#bg)" opacity="0.95"/>
      <rect x="${ibx}" y="${iby}" width="${ibs}" height="${ibs}"
            rx="${iRad}" ry="${iRad}" fill="url(#iconBg)"/>
      <circle cx="${icx}" cy="${icy}" r="${iCR}"
              fill="none" stroke="white" stroke-width="${ibs * 0.07}"/>
      <circle cx="${icx}" cy="${icy}" r="${iCR * 0.35}" fill="white"/>
      <polygon points="${t1x},${t1y} ${t2x},${t2y} ${t3x},${t3y}" fill="white"/>
      <line x1="${ibx + ibs + iconPad * 0.3}" y1="${iby + ibs * 0.15}"
            x2="${ibx + ibs + iconPad * 0.3}" y2="${iby + ibs * 0.85}"
            stroke="rgba(0,0,0,0.12)" stroke-width="1"/>
      <text x="${textX}" y="${y1}"
            text-anchor="start"
            font-family="'Helvetica Neue', Helvetica, Arial, sans-serif"
            font-size="${fontSize1}px" font-weight="700" letter-spacing="0.3"
            fill="#1a1a1a">${line1}</text>
      <line x1="${textX}" y1="${sepY}" x2="${textX + innerW}" y2="${sepY}"
            stroke="rgba(0,0,0,0.18)" stroke-width="0.8"/>
      <text x="${textX + innerW / 2}" y="${y2}"
            text-anchor="middle"
            font-family="'Helvetica Neue', Helvetica, Arial, sans-serif"
            font-size="${fontSize2}px" font-weight="400" letter-spacing="0.5"
            fill="#555555">${line2}</text>
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
