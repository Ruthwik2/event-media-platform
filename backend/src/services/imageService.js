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

    if (!width || !height) throw new Error('Could not read image dimensions');

    // ── Sanitise text fields ──────────────────────────────────────────────────
    const clubName  = escapeXml(watermarkInfo.clubName  || 'EventMedia');
    const eventName = escapeXml(watermarkInfo.eventName || '');
    const username  = escapeXml(watermarkInfo.username  || '');
    // Format role: CLUB_MEMBER → Club Member
    const rawRole   = (watermarkInfo.userRole || '').replace(/_/g, ' ');
    const role      = escapeXml(rawRole.charAt(0).toUpperCase() + rawRole.slice(1).toLowerCase());

    const downloadDate = new Date().toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });

    // ── Typography ────────────────────────────────────────────────────────────
    // Scale font to image size; cap so it never overwhelms a small image.
    const baseFontSize = Math.min(48, Math.max(18, Math.round(Math.min(width, height) / 30)));
    const subFontSize  = Math.round(baseFontSize * 0.72);
    const lineGap      = Math.round(baseFontSize * 0.45);

    // ── Strip geometry (full-width bar at the bottom) ─────────────────────────
    const padV    = Math.round(baseFontSize * 0.75);  // vertical padding inside strip
    const stripH  = padV + baseFontSize + lineGap + subFontSize + padV;
    const stripY  = height - stripH;                  // top of the strip (always in bounds)
    const cx      = Math.round(width / 2);            // horizontal centre

    // ── Text lines ────────────────────────────────────────────────────────────
    // Line 1 (bold): ClubName  •  EventName
    const line1 = eventName ? `${clubName}  \u2022  ${eventName}` : clubName;

    // Line 2 (regular): Role  |  @username  |  Date
    const line2Parts = [
      role      || null,
      username  ? `@${username}` : null,
      downloadDate,
    ].filter(Boolean);
    const line2 = line2Parts.join('  \u2502  ');   // │ separator

    // Vertical anchors for the two text baselines
    const y1 = stripY + padV + baseFontSize;
    const y2 = y1 + lineGap + subFontSize;

    // ── Separator line between line1 and line2 ────────────────────────────────
    const sepY    = y1 + Math.round(lineGap * 0.45);
    const sepPadX = Math.round(width * 0.06);       // inset from strip edges

    // ── SVG overlay (same pixel dimensions as the image) ─────────────────────
    //  • Dark semi-transparent strip  → guaranteed visible on any image content
    //  • White text + subtle shadow   → readable regardless of strip colour
    //  • Uses "DejaVu Sans" (installed in the Docker image) with Arial/sans-serif
    //    fallbacks → librsvg always resolves a real font and renders the text
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs>
        <linearGradient id="stripGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="#000000" stop-opacity="0.68"/>
          <stop offset="100%" stop-color="#111111" stop-opacity="0.82"/>
        </linearGradient>
        <filter id="txtShadow" x="-2%" y="-10%" width="104%" height="130%">
          <feDropShadow dx="0" dy="1" stdDeviation="2"
                        flood-color="#000000" flood-opacity="0.9"/>
        </filter>
      </defs>

      <!-- Dark banner strip -->
      <rect x="0" y="${stripY}" width="${width}" height="${stripH}"
            fill="url(#stripGrad)"/>

      <!-- Thin top-edge accent line -->
      <line x1="0" y1="${stripY}" x2="${width}" y2="${stripY}"
            stroke="#ffffff" stroke-opacity="0.20" stroke-width="1"/>

      <!-- Line 1: Club  •  Event -->
      <text x="${cx}" y="${y1}"
            font-family="DejaVu Sans, Arial, Helvetica, sans-serif"
            font-size="${baseFontSize}px"
            font-weight="bold"
            fill="#ffffff"
            text-anchor="middle"
            filter="url(#txtShadow)">${line1}</text>

      <!-- Thin separator -->
      <line x1="${sepPadX}" y1="${sepY}" x2="${width - sepPadX}" y2="${sepY}"
            stroke="#ffffff" stroke-opacity="0.25" stroke-width="1"/>

      <!-- Line 2: Role  |  @user  |  Date -->
      <text x="${cx}" y="${y2}"
            font-family="DejaVu Sans, Arial, Helvetica, sans-serif"
            font-size="${subFontSize}px"
            font-weight="normal"
            fill="#e0e0e0"
            text-anchor="middle"
            filter="url(#txtShadow)">${line2}</text>
    </svg>`;

    const outputBuffer = await sharp(input)
      .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
      .jpeg({ quality: 92 })
      .toBuffer();

    return outputBuffer;
  } catch (error) {
    console.error('Error adding watermark:', error);
    // Return the original image unchanged rather than crashing the download
    if (Buffer.isBuffer(input)) return input;
    return fs.readFileSync(input);
  }
};

module.exports = { generateThumbnail, compressImage, getImageMetadata, addWatermark };