const prisma = require('../config/database');
const QRCode = require('qrcode');
const { uploadToS3 } = require('../services/s3Service');

// ── Permission helpers ────────────────────────────────────────────────────────
/**
 * Determines whether a requesting user may access a given album.
 *
 * Rules:
 *  ADMIN       – always allowed
 *  CLUB_MEMBER – always allowed (public and private albums)
 *  PHOTOGRAPHER – public albums always; private albums only if they are the
 *                 event creator OR a collaborator on the album
 *  VIEWER / unauthenticated – public albums only
 */
function canAccessAlbum(user, album) {
  if (album.visibility === 'PUBLIC') return true;
  // album is PRIVATE from here
  if (!user) return false;
  if (user.role === 'ADMIN' || user.role === 'CLUB_MEMBER') return true;
  if (user.role === 'PHOTOGRAPHER') {
    const isEventCreator = album.event && album.event.creatorId === user.id;
    const collaborators = album.collaborators || [];
    const isCollaborator = collaborators.some(c => (c.userId || (c.user && c.user.id)) === user.id);
    return isEventCreator || isCollaborator;
  }
  return false; // VIEWER
}

/**
 * Determines whether a requesting user may access a given media item.
 *
 * Rules:
 *  ADMIN / CLUB_MEMBER – always allowed
 *  PHOTOGRAPHER        – always allowed for public media;
 *                        for private media only if they uploaded it;
 *                        media inside a private album follows album rules
 *  VIEWER / unauthenticated – public media only, and only in public albums
 */
function canAccessMedia(user, media) {
  const album = media.album || null;

  // If the parent album is private, apply album-level check first
  if (album && album.visibility === 'PRIVATE') {
    if (!canAccessAlbum(user, album)) return false;
  }

  // Now check media-level visibility
  if (media.visibility === 'PUBLIC') return true;
  // media is PRIVATE from here
  if (!user) return false;
  if (user.role === 'ADMIN' || user.role === 'CLUB_MEMBER') return true;
  if (user.role === 'PHOTOGRAPHER') return media.uploaderId === user.id;
  return false; // VIEWER
}
// ─────────────────────────────────────────────────────────────────────────────


const createAlbum = async (req, res) => {
  try {
    const { name, description, visibility, eventId } = req.body;

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    if (event.creatorId !== req.user.id && req.user.role !== 'ADMIN' && req.user.role !== 'PHOTOGRAPHER') {
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

    // Update QR code with actual album ID
    const actualQr = await QRCode.toDataURL(`${process.env.FRONTEND_URL}/albums/${album.id}`);
    const updatedAlbum = await prisma.album.update({
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
      // Return albums the user can upload to (event creator or collaborator)
      where = {
        ...where,
        OR: [
          { event: { creatorId: req.user.id } },
          { collaborators: { some: { userId: req.user.id } } },
        ],
      };
    } else if (!req.user || req.user.role === 'VIEWER') {
      // Unauthenticated users and VIEWERs: public albums only
      where.visibility = 'PUBLIC';
    } else if (req.user.role === 'CLUB_MEMBER') {
      // CLUB_MEMBERs can see all albums (public and private)
      // no visibility filter — no-op
    } else if (req.user.role === 'PHOTOGRAPHER') {
      // PHOTOGRAPHERs: public albums + private albums on their own events + albums they collaborate on
      where.OR = [
        { visibility: 'PUBLIC' },
        { visibility: 'PRIVATE', event: { creatorId: req.user.id } },
        { visibility: 'PRIVATE', collaborators: { some: { userId: req.user.id } } },
      ];
    }
    // ADMINs see all albums (no extra filter)

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
        event: { select: { id: true, name: true, category: true, visibility: true } },
        collaborators: {
          include: {
            user: { select: { id: true, username: true, fullName: true, avatar: true } },
          },
        },
        _count: { select: { media: true } },
      },
    });

    if (!album) {
      return res.status(404).json({ success: false, message: 'Album not found' });
    }

    if (!canAccessAlbum(req.user, album)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
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

module.exports = { createAlbum, getAlbums, getAlbum, updateAlbum, deleteAlbum, getAlbumQR, addCollaborator };