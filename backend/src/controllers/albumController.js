const prisma = require('../config/database');
const QRCode = require('qrcode');
const { uploadToS3 } = require('../services/s3Service');
const { randomBytes } = require('crypto');
// ── Permission helpers ────────────────────────────────────────────────────────
function canAccessAlbum(user, album) {
  const isApprovedMember = user && user.role === 'CLUB_MEMBER' && user.isApproved === true;

  // ── Step 1: check parent event visibility ──────────────────────────────────
  const eventIsPrivate = album.event && album.event.visibility === 'PRIVATE';
  if (eventIsPrivate) {
    if (!user) return false;
    if (user.role === 'ADMIN') return true;
    if (isApprovedMember) return true;
    if (user.role === 'PHOTOGRAPHER') {
      const isEventCreator = album.event.creatorId === user.id;
      const collaborators = album.collaborators || [];
      const isCollaborator = collaborators.some(
        (c) => (c.userId || (c.user && c.user.id)) === user.id
      );
      return isEventCreator || isCollaborator;
    }
    return false;
  }

  // ── Step 2: event is public — check album-level visibility ─────────────────
  if (album.visibility === 'PUBLIC') return true;
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  if (isApprovedMember) return true;
  if (user.role === 'PHOTOGRAPHER') {
    const isEventCreator = album.event && album.event.creatorId === user.id;
    const collaborators = album.collaborators || [];
    const isCollaborator = collaborators.some(
      (c) => (c.userId || (c.user && c.user.id)) === user.id
    );
    return isEventCreator || isCollaborator;
  }
  return false;
}
function canAccessMedia(user, media) {
const album = media.album || null;
if (album && album.visibility === 'PRIVATE') {
if (!canAccessAlbum(user, album)) return false;
}
if (media.visibility === 'PUBLIC') return true;
if (!user) return false;
if (user.role === 'ADMIN') return true;
if (user.role === 'CLUB_MEMBER' && user.isApproved === true) return true;
if (user.role === 'PHOTOGRAPHER') return media.uploaderId === user.id;
return false;
}
// ─────────────────────────────────────────────────────────────────────────────
const createAlbum = async (req, res) => {
try {
const { name, description, visibility, eventId } = req.body;
const event = await prisma.event.findUnique({ where: { id: eventId } });
if (!event) {
return res.status(404).json({ success: false, message: 'Event not found' });
}
if (
event.creatorId !== req.user.id &&
req.user.role !== 'ADMIN' &&
req.user.role !== 'PHOTOGRAPHER'
) {
return res.status(403).json({ success: false, message: 'Not authorized' });
}
const shareUrl = `${process.env.FRONTEND_URL}/albums/`;
const qrCode = await QRCode.toDataURL(shareUrl + 'placeholder');
const album = await prisma.album.create({
data: {
name,
description,
visibility: visibility || 'PUBLIC',
eventId,
qrCode,
},
include: {
event: { select: { id: true, name: true } },
_count: { select: { media: true } },
},
});
const actualQr = await QRCode.toDataURL(
`${process.env.FRONTEND_URL}/albums/${album.id}`
);
await prisma.album.update({
where: { id: album.id },
data: { qrCode: actualQr },
});
res.status(201).json({ success: true, data: { ...album, qrCode: actualQr } });
} catch (error) {
res.status(500).json({ success: false, message: error.message });
}
};
const getAlbums = async (req, res) => {
try {
const { eventId, page = 1, limit = 12, myAlbums } = req.query;
const skip = (parseInt(page) - 1) * parseInt(limit);
let where = {};
if (eventId) where.eventId = eventId;
if (myAlbums === 'true' && req.user) {
where = {
...where,
OR: [
{ event: { creatorId: req.user.id } },
{ collaborators: { some: { userId: req.user.id } } },
],
};
} else if (!req.user || req.user.role === 'VIEWER') {
where.visibility = 'PUBLIC';
} else if (req.user.role === 'CLUB_MEMBER') {
// no visibility filter — sees all
} else if (req.user.role === 'PHOTOGRAPHER') {
// Photographers can see ALL albums so they can discover private ones and request access.
// Access control is enforced per-album when they click into it.
}
const [albums, total] = await Promise.all([
prisma.album.findMany({
where,
include: {
event: { select: { id: true, name: true, category: true } },
_count: { select: { media: true } },
},
skip,
take: parseInt(limit),
orderBy: { createdAt: 'desc' },
}),
prisma.album.count({ where }),
]);
res.json({
success: true,
data: albums,
pagination: { total, page: parseInt(page), limit: parseInt(limit) },
});
} catch (error) {
res.status(500).json({ success: false, message: error.message });
}
};
const getAlbum = async (req, res) => {
try {
const album = await prisma.album.findUnique({
where: { id: req.params.id },
include: {
event: {
select: {
id: true,
name: true,
category: true,
visibility: true,
creatorId: true, // needed for canAccessAlbum
},
},
collaborators: {
include: {
user: {
select: { id: true, username: true, fullName: true, avatar: true },
},
},
},
_count: { select: { media: true } },
},
});
if (!album) {
return res.status(404).json({ success: false, message: 'Album not found' });
}
if (!canAccessAlbum(req.user, album)) {
// For photographers, also return their current request status
let requestStatus = null;
if (req.user && req.user.role === 'PHOTOGRAPHER') {
const existingRequest = await prisma.accessRequest.findUnique({
where: {
userId_targetId_type: {
userId: req.user.id,
targetId: album.id,
type: 'ALBUM',
},
},
});
requestStatus = existingRequest?.status || null;
}
return res.status(403).json({
success: false,
message: 'Access denied',
requestStatus,
});
}
res.json({ success: true, data: album });
} catch (error) {
res.status(500).json({ success: false, message: error.message });
}
};
const updateAlbum = async (req, res) => {
try {
const { name, description, visibility } = req.body;
const album = await prisma.album.findUnique({
where: { id: req.params.id },
include: { event: true },
});
if (!album) {
return res.status(404).json({ success: false, message: 'Album not found' });
}
if (album.event.creatorId !== req.user.id && req.user.role !== 'ADMIN') {
return res.status(403).json({ success: false, message: 'Not authorized' });
}
const updated = await prisma.album.update({
where: { id: req.params.id },
data: { name, description, visibility },
});
res.json({ success: true, data: updated });
} catch (error) {
res.status(500).json({ success: false, message: error.message });
}
};
const deleteAlbum = async (req, res) => {
try {
const album = await prisma.album.findUnique({
where: { id: req.params.id },
include: { event: true },
});
if (!album) {
return res.status(404).json({ success: false, message: 'Album not found' });
}
if (album.event.creatorId !== req.user.id && req.user.role !== 'ADMIN') {
return res.status(403).json({ success: false, message: 'Not authorized' });
}
await prisma.album.delete({ where: { id: req.params.id } });
res.json({ success: true, message: 'Album deleted' });
} catch (error) {
res.status(500).json({ success: false, message: error.message });
}
};
const getAlbumQR = async (req, res) => {
try {
const album = await prisma.album.findUnique({
where: { id: req.params.id },
include: {
event: { select: { creatorId: true } },
collaborators: { select: { userId: true } },
},
});
if (!album) {
return res.status(404).json({ success: false, message: 'Album not found' });
}
if (!canAccessAlbum(req.user, album)) {
return res.status(403).json({ success: false, message: 'Access denied' });
}
const qrUrl = `${process.env.FRONTEND_URL}/albums/${album.id}`;
const qrCode = await QRCode.toDataURL(qrUrl);
res.json({ success: true, data: { qrCode, url: qrUrl } });
} catch (error) {
res.status(500).json({ success: false, message: error.message });
}
};
const addCollaborator = async (req, res) => {
try {
const { userId } = req.body;
const album = await prisma.album.findUnique({
where: { id: req.params.id },
include: { event: true },
});
if (!album) {
return res.status(404).json({ success: false, message: 'Album not found' });
}
if (album.event.creatorId !== req.user.id && req.user.role !== 'ADMIN') {
return res.status(403).json({ success: false, message: 'Not authorized' });
}
await prisma.albumCollaborator.upsert({
where: { albumId_userId: { albumId: album.id, userId } },
update: {},
create: { albumId: album.id, userId },
});
res.json({ success: true, message: 'Collaborator added' });
} catch (error) {
res.status(500).json({ success: false, message: error.message });
}
};
// ── Access Request Functions ──────────────────────────────────────────────────
/**
* POST /albums/:id/request-access
* Photographer requests access to a private album.
*/
const requestAlbumAccess = async (req, res) => {
try {
const { id } = req.params;
const album = await prisma.album.findUnique({
where: { id },
include: {
event: { select: { creatorId: true, name: true } },
collaborators: { select: { userId: true } },
},
});
if (!album) {
return res.status(404).json({ success: false, message: 'Album not found' });
}
if (album.visibility !== 'PRIVATE') {
return res
.status(400)
.json({ success: false, message: 'Album is not private' });
}
// Already has access?
const isCollaborator = album.collaborators.some(
(c) => c.userId === req.user.id
);
if (isCollaborator || album.event.creatorId === req.user.id) {
return res
.status(400)
.json({ success: false, message: 'You already have access' });
}
const existing = await prisma.accessRequest.findUnique({
where: {
userId_targetId_type: { userId: req.user.id, targetId: id, type: 'ALBUM' },
},
});
if (existing) {
if (existing.status === 'PENDING') {
return res
.status(400)
.json({ success: false, message: 'Access request already pending' });
}
if (existing.status === 'APPROVED') {
return res
.status(400)
.json({ success: false, message: 'You already have access' });
}
// REJECTED → allow re-request
await prisma.accessRequest.update({
where: { id: existing.id },
data: { status: 'PENDING' },
});
} else {
await prisma.accessRequest.create({
data: { userId: req.user.id, targetId: id, type: 'ALBUM' },
});
}
// Notify all admins
try {
const { notifyAccessRequest } = require('../services/notificationService');
await notifyAccessRequest(req.user.id, id, 'ALBUM', album.name);
} catch (e) {
console.error('Notification error:', e);
}
res.json({ success: true, message: 'Access request sent successfully' });
} catch (error) {
res.status(500).json({ success: false, message: error.message });
}
};
/**
* GET /albums/access-requests  (admin only)
*/
const getAlbumAccessRequests = async (req, res) => {
try {
const { status = 'PENDING' } = req.query;
const whereStatus = status === 'ALL' ? {} : { status };
const requests = await prisma.accessRequest.findMany({
where: { type: 'ALBUM', ...whereStatus },
include: {
user: {
select: { id: true, username: true, fullName: true, avatar: true },
},
},
orderBy: { createdAt: 'desc' },
});
// Enrich each request with album + event info
const enriched = await Promise.all(
requests.map(async (r) => {
try {
const album = await prisma.album.findUnique({
where: { id: r.targetId },
select: {
id: true,
name: true,
event: { select: { id: true, name: true } },
},
});
return { ...r, target: album, targetType: 'ALBUM' };
} catch {
return { ...r, target: null, targetType: 'ALBUM' };
}
})
);
res.json({ success: true, data: enriched });
} catch (error) {
res.status(500).json({ success: false, message: error.message });
}
};
/**
* PATCH /albums/access-requests/:rid  (admin only)
*/
const approveRejectAlbumRequest = async (req, res) => {
try {
const { rid } = req.params;
const { status } = req.body;
if (!['APPROVED', 'REJECTED'].includes(status)) {
return res
.status(400)
.json({ success: false, message: 'Invalid status' });
}
const request = await prisma.accessRequest.findFirst({
where: { id: rid, type: 'ALBUM' },
});
if (!request) {
return res
.status(404)
.json({ success: false, message: 'Request not found' });
}
const updated = await prisma.accessRequest.update({
where: { id: rid },
data: { status },
});
// If approved → add as collaborator so canAccessAlbum passes
if (status === 'APPROVED') {
await prisma.albumCollaborator.upsert({
where: {
albumId_userId: { albumId: request.targetId, userId: request.userId },
},
update: {},
create: { albumId: request.targetId, userId: request.userId },
});
}
// Notify photographer of decision
try {
const { notifyAccessResponse } = require('../services/notificationService');
await notifyAccessResponse(
req.user.id,
request.userId,
request.targetId,
'ALBUM',
status
);
} catch (e) {
console.error('Notification error:', e);
}
res.json({
success: true,
data: updated,
message: `Request ${status.toLowerCase()}`,
});
} catch (error) {
res.status(500).json({ success: false, message: error.message });
}
};
// ── Share Token Functions ─────────────────────────────────────────────────────
/**
 * POST /albums/:id/share-token
 * Creator or ADMIN generates a guest-access token for a PRIVATE album.
 * Anyone with the resulting URL can view the album without logging in.
 * Only meaningful for PRIVATE albums; public albums don't need tokens.
 */
const generateShareToken = async (req, res) => {
  try {
    const album = await prisma.album.findUnique({
      where: { id: req.params.id },
      include: { event: { select: { creatorId: true, visibility: true } } },
    });
    if (!album) {
      return res.status(404).json({ success: false, message: 'Album not found' });
    }
    // Only creator or admin may generate tokens
    if (album.event.creatorId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    if (album.visibility !== 'PRIVATE') {
      return res.status(400).json({
        success: false,
        message: 'Share tokens are only for private albums. Public albums are accessible by everyone.',
      });
    }
    // Generate a cryptographically random token (32 bytes → 64 hex chars)
    const token = randomBytes(32).toString('hex');
    await prisma.album.update({
      where: { id: album.id },
      data: { shareToken: token },
    });
    const shareUrl = `${process.env.FRONTEND_URL}/albums/share/${token}`;
    res.json({ success: true, data: { shareToken: token, shareUrl } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /albums/:id/share-token
 * Revokes the guest share token — all existing share links immediately stop working.
 */
const revokeShareToken = async (req, res) => {
  try {
    const album = await prisma.album.findUnique({
      where: { id: req.params.id },
      include: { event: { select: { creatorId: true } } },
    });
    if (!album) {
      return res.status(404).json({ success: false, message: 'Album not found' });
    }
    if (album.event.creatorId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    await prisma.album.update({
      where: { id: album.id },
      data: { shareToken: null },
    });
    res.json({ success: true, message: 'Share link revoked. Existing QR codes no longer work.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /albums/by-token/:token  (no auth required — public endpoint)
 * Returns album + media when a valid shareToken is presented.
 * This is how event guests access a private album via QR scan.
 * 
 * Security notes:
 *  - Only works for PRIVATE albums with shareToken set
 *  - Token must be an exact match (32-byte random hex — ~2^256 space)
 *  - Does NOT expose the album's internal ID in the response URL, only the token
 *  - Revoke at any time via DELETE /albums/:id/share-token
 */
const getAlbumByShareToken = async (req, res) => {
  try {
    const { token } = req.params;
    // Basic token sanity check — must be 64 hex chars
    if (!/^[a-f0-9]{64}$/.test(token)) {
      return res.status(404).json({ success: false, message: 'Invalid share link' });
    }
    const album = await prisma.album.findUnique({
      where: { shareToken: token },
      include: {
        event: {
          select: { id: true, name: true, category: true, visibility: true, creatorId: true },
        },
        collaborators: {
          include: {
            user: { select: { id: true, username: true, fullName: true, avatar: true } },
          },
        },
        _count: { select: { media: true } },
      },
    });
    if (!album) {
      return res.status(404).json({ success: false, message: 'Share link not found or has been revoked' });
    }
    // Tokens are only valid for PRIVATE albums
    if (album.visibility !== 'PRIVATE') {
      return res.status(400).json({
        success: false,
        message: 'This album is public — no token needed',
        redirectId: album.id,
      });
    }
    // Fetch media for this album
    const media = await prisma.media.findMany({
      where: { albumId: album.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        url: true,
        thumbnailUrl: true,
        mediaType: true,
        caption: true,
        width: true,
        height: true,
        createdAt: true,
        uploader: { select: { id: true, username: true, fullName: true, avatar: true } },
      },
    });
    // Strip out the shareToken and internal IDs from the response
    const { shareToken: _token, ...albumData } = album;
    res.json({ success: true, data: { album: albumData, media }, guestAccess: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /albums/:id/qr  (updated)
 * Returns QR code. For private albums with a shareToken, the QR encodes
 * the guest-access URL. Otherwise it encodes the direct album URL.
 */
const getAlbumQREnhanced = async (req, res) => {
  try {
    const album = await prisma.album.findUnique({
      where: { id: req.params.id },
      include: {
        event: { select: { creatorId: true, visibility: true } },
        collaborators: { select: { userId: true } },
      },
    });
    if (!album) {
      return res.status(404).json({ success: false, message: 'Album not found' });
    }
    if (!canAccessAlbum(req.user, album)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    // Decide which URL to encode in the QR:
    //  - Private album WITH shareToken → guest-access URL (scannable by anyone)
    //  - Private album WITHOUT shareToken → direct URL (login required to view)
    //  - Public album → direct URL
    let qrUrl;
    if (album.visibility === 'PRIVATE' && album.shareToken) {
      qrUrl = `${process.env.FRONTEND_URL}/albums/share/${album.shareToken}`;
    } else {
      qrUrl = `${process.env.FRONTEND_URL}/albums/${album.id}`;
    }
    const qrCode = await QRCode.toDataURL(qrUrl, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 400,
    });
    res.json({
      success: true,
      data: {
        qrCode,
        url: qrUrl,
        visibility: album.visibility,
        hasShareToken: !!album.shareToken,
        guestAccessEnabled: album.visibility === 'PRIVATE' && !!album.shareToken,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PATCH /albums/:id/rename  (creator or ADMIN)
 * Renames the album — validates uniqueness within the event.
 */
const renameAlbum = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }
    const trimmed = name.trim();
    const album = await prisma.album.findUnique({
      where: { id: req.params.id },
      include: { event: true },
    });
    if (!album) {
      return res.status(404).json({ success: false, message: 'Album not found' });
    }
    if (album.event.creatorId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    if (trimmed !== album.name) {
      const conflict = await prisma.album.findUnique({
        where: { name_eventId: { name: trimmed, eventId: album.eventId } },
      });
      if (conflict) {
        return res.status(409).json({ success: false, message: 'An album with that name already exists in this event' });
      }
    }
    const updated = await prisma.album.update({
      where: { id: req.params.id },
      data: { name: trimmed },
      include: {
        event: { select: { id: true, name: true } },
        _count: { select: { media: true } },
      },
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createAlbum,
  getAlbums,
  getAlbum,
  updateAlbum,
  renameAlbum,
  deleteAlbum,
  getAlbumQR: getAlbumQREnhanced,
  addCollaborator,
  requestAlbumAccess,
  getAlbumAccessRequests,
  approveRejectAlbumRequest,
  generateShareToken,
  revokeShareToken,
  getAlbumByShareToken,
};