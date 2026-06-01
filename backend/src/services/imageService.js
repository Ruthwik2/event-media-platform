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

/**
 * Adds a professional bottom-right corner watermark badge.
 *
 * Badge layout:
 *   ┌─────────────────────────────────────┐
 *   │  📷  Photography Club • Event Name  │
 *   │      @username  ·  02 Jun 2026      │
 *   └─────────────────────────────────────┘
 *
 * @param {Buffer|string} input       - File path or raw image buffer
 * @param {object}        watermarkInfo - { clubName, eventName, userRole, username }
 * @returns {Promise<Buffer>}         - JPEG buffer of watermarked image
 */
const addWatermark = async (input, watermarkInfo = {}) => {
  try {
    const metadata = await sharp(input).metadata();
    const { width, height } = metadata;

    // ── Text content ──────────────────────────────────────────────────────────
    const clubName  = escapeXml(watermarkInfo.clubName  || 'EventMedia');
    const eventName = escapeXml(watermarkInfo.eventName || '');
    const username  = escapeXml(watermarkInfo.username  || '');
    const role      = escapeXml(watermarkInfo.userRole  || '');

    const downloadDate = new Date().toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });

    // Line 1:  "Photography Club • Freshers Night 2025"
    const line1 = eventName ? `${clubName} \u2022 ${eventName}` : clubName;

    // Line 2:  "@aditya  ·  02 Jun 2026  ·  PHOTOGRAPHER"
    const line2Parts = [
      username ? `@${username}` : null,
      downloadDate,
      role ? role : null,
    ].filter(Boolean);
    const line2 = line2Parts.join('  \u00b7  ');

    // ── Sizing — scale with image ─────────────────────────────────────────────
    const fontSize1 = Math.min(36, Math.max(13, Math.floor(width / 45)));
    const fontSize2 = Math.round(fontSize1 * 0.75);

    // Approx character width for monospace-ish sans-serif
    const charW1 = fontSize1 * 0.60;
    const charW2 = fontSize2 * 0.60;

    const innerW   = Math.max(line1.length * charW1, line2.length * charW2);
    const padX     = fontSize1 * 0.9;
    const padY     = fontSize1 * 0.7;
    const gap      = fontSize1 * 0.45;       // gap between lines
    const badgeW   = innerW + padX * 2;
    const badgeH   = fontSize1 + fontSize2 + padY * 2 + gap;
    const marginR  = Math.round(width  * 0.015);
    const marginB  = Math.round(height * 0.015);
    const rx       = Math.round(fontSize1 * 0.45);

    // Badge top-left corner
    const bx = Math.round(width  - badgeW - marginR);
    const by = Math.round(height - badgeH - marginB);

    // Text Y positions (baseline)
    const y1 = by + padY + fontSize1;
    const y2 = y1 + gap + fontSize2;
    const cx = bx + badgeW / 2;      // horizontal centre of badge

    // ── Accent stripe colour — thin top edge ─────────────────────────────────
    const accentH = Math.max(2, Math.round(fontSize1 * 0.12));

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs>
        <!-- Subtle gradient on the badge -->
        <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="#0f0f0f" stop-opacity="0.78"/>
          <stop offset="100%" stop-color="#1a1a1a" stop-opacity="0.88"/>
        </linearGradient>
        <!-- Blue accent for stripe -->
        <linearGradient id="stripe" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stop-color="#3b82f6" stop-opacity="0.9"/>
          <stop offset="100%" stop-color="#60a5fa" stop-opacity="0.9"/>
        </linearGradient>
      </defs>

      <!-- Badge background -->
      <rect x="${bx}" y="${by}" width="${badgeW}" height="${badgeH}"
            rx="${rx}" ry="${rx}" fill="url(#bg)"/>

      <!-- Blue accent stripe at top of badge -->
      <rect x="${bx + rx}" y="${by}" width="${badgeW - rx * 2}" height="${accentH}"
            fill="url(#stripe)"/>

      <!-- Camera icon dot (decorative) -->
      <circle cx="${bx + padX * 0.55}" cy="${y1 - fontSize1 * 0.3}"
              r="${fontSize1 * 0.18}" fill="#3b82f6" opacity="0.9"/>

      <!-- Line 1: Club • Event (bold, white) -->
      <text x="${cx}" y="${y1}"
            text-anchor="middle"
            font-family="sans-serif"
            font-size="${fontSize1}px"
            font-weight="bold"
            fill="white"
            opacity="0.97">${line1}</text>

      <!-- Thin separator rule -->
      <line x1="${bx + padX}" y1="${y1 + gap * 0.35}"
            x2="${bx + badgeW - padX}" y2="${y1 + gap * 0.35}"
            stroke="rgba(255,255,255,0.15)" stroke-width="1"/>

      <!-- Line 2: @username · date · role (lighter) -->
      <text x="${cx}" y="${y2}"
            text-anchor="middle"
            font-family="sans-serif"
            font-size="${fontSize2}px"
            font-weight="normal"
            fill="#cbd5e1"
            opacity="0.92">${line2}</text>
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