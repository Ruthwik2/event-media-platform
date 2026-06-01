const prisma = require('../config/database');
const path = require('path');
const fs = require('fs');
const { uploadToS3, deleteFromS3, getSignedDownloadUrl } = require('../services/s3Service');
const { detectLabels, searchFacesByImage } = require('../services/rekognitionService');
const { generateThumbnail, getImageMetadata, addWatermark } = require('../services/imageService');
const { notifyLike, notifyComment, notifyTag } = require('../services/notificationService');

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


const uploadMedia = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    const { albumId, caption, visibility } = req.body;

    const album = await prisma.album.findUnique({
      where: { id: albumId },
      include: { event: true },
    });

    if (!album) {
      return res.status(404).json({ success: false, message: 'Album not found' });
    }

    const uploadedMedia = [];

    for (const file of req.files) {
      const isImage = file.mimetype.startsWith('image/');
      const isVideo = file.mimetype.startsWith('video/');

      let fileUrl = file.location || `${process.env.BACKEND_URL}/uploads/${file.filename}`;
      let thumbnailUrl = null;
      let tags = [];
      let width, height;
      let faceIds = [];

      // Process image (metadata and thumbnail — requires local file)
      if (isImage && file.path) {
        // Get dimensions from local file before it may be deleted by uploadToS3
        const metadata = await getImageMetadata(file.path);
        width = metadata.width;
        height = metadata.height;

        // Generate thumbnail from local file (must happen before S3 upload deletes the local copy)
        const thumbPath = await generateThumbnail(file.path);

        // Upload thumbnail after main file (local copy of thumb is independent)
        if (thumbPath) {
          if (process.env.USE_S3 === 'true') {
            thumbnailUrl = await uploadToS3(
              { path: thumbPath, originalname: `thumb-${file.originalname}`, mimetype: 'image/jpeg' },
              'thumbnails'
            );
          } else {
            thumbnailUrl = `${process.env.BACKEND_URL}/uploads/thumbnails/${path.basename(thumbPath)}`;
          }
        }

        // Upload main file to S3 if not already there (local-storage case)
        if (!file.location && process.env.USE_S3 === 'true') {
          fileUrl = await uploadToS3(file, 'media');
        }
      }

      if (!file.location && process.env.USE_S3 === 'true' && isVideo) {
        fileUrl = await uploadToS3(file, 'media');
      }

      // ── AI tagging and face detection ────────────────────────────────────
      // Works for both local-upload + S3 and direct multer-S3 uploads
      // fileUrl is either from file.location (multer-S3) or set by uploadToS3 above
      if (isImage && fileUrl?.includes('amazonaws.com')) {
        tags = await detectLabels(fileUrl);
        const faceMatches = await searchFacesByImage(fileUrl);
        faceIds = faceMatches.map(m => m.faceId);
      }

      const media = await prisma.media.create({
        data: {
          filename: file.filename || file.key || file.originalname,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          url: fileUrl,
          thumbnailUrl,
          mediaType: isImage ? 'PHOTO' : 'VIDEO',
          width,
          height,
          visibility: visibility || 'PUBLIC',
          caption,
          tags,
          faceIds,
          albumId,
          uploaderId: req.user.id,
        },
        include: {
          uploader: { select: { id: true, username: true, fullName: true, avatar: true } },
          _count: { select: { likes: true, comments: true } },
        },
      });

      uploadedMedia.push(media);
    }

    res.status(201).json({
      success: true,
      message: `${uploadedMedia.length} file(s) uploaded successfully`,
      data: uploadedMedia,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getMedia = async (req, res) => {
  try {
    const {
      albumId, search, tags, mediaType,
      page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc',
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};

    if (albumId) {
      // Gate on album-level access first
      const album = await prisma.album.findUnique({
        where: { id: albumId },
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
      where.albumId = albumId;
    }
    if (mediaType) where.mediaType = mediaType;

    // Media-level visibility filter
    if (!req.user || req.user.role === 'VIEWER') {
      // Viewers and unauthenticated: public media only
      where.visibility = 'PUBLIC';
    } else if (req.user.role === 'PHOTOGRAPHER') {
      // Photographers: public media OR media they uploaded
      where.OR = [
        { visibility: 'PUBLIC' },
        { visibility: 'PRIVATE', uploaderId: req.user.id },
      ];
    }
    // ADMIN and CLUB_MEMBER: see all media (no visibility filter)

    if (search) {
      const searchOR = [
        { originalName: { contains: search, mode: 'insensitive' } },
        { caption: { contains: search, mode: 'insensitive' } },
        { aiCaption: { contains: search, mode: 'insensitive' } },
        { tags: { has: search.toLowerCase() } },
      ];
      // If a visibility OR clause already exists (e.g. for PHOTOGRAPHER), combine
      // the two OR arrays with AND so neither overwrites the other.
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: searchOR }];
        delete where.OR;
      } else {
        where.OR = searchOR;
      }
    }

    if (tags) {
      const tagArray = tags.split(',').map(t => t.trim().toLowerCase());
      where.tags = { hasSome: tagArray };
    }

    const orderByField = ['createdAt', 'size', 'originalName'].includes(sortBy)
      ? sortBy : 'createdAt';

    const [mediaItems, total] = await Promise.all([
      prisma.media.findMany({
        where,
        include: {
          uploader: { select: { id: true, username: true, fullName: true, avatar: true } },
          _count: { select: { likes: true, comments: true, downloads: true } },
          ...(req.user && {
            likes: { where: { userId: req.user.id }, select: { id: true } },
            favourites: { where: { userId: req.user.id }, select: { id: true } },
          }),
        },
        orderBy: { [orderByField]: sortOrder },
        skip,
        take: parseInt(limit),
      }),
      prisma.media.count({ where }),
    ]);

    const enriched = mediaItems.map(item => ({
      ...item,
      isLiked: req.user ? item.likes?.length > 0 : false,
      isFavourited: req.user ? item.favourites?.length > 0 : false,
      likes: undefined,
      favourites: undefined,
    }));

    res.json({
      success: true,
      data: enriched,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getMediaItem = async (req, res) => {
  try {
    const media = await prisma.media.findUnique({
      where: { id: req.params.id },
      include: {
        uploader: { select: { id: true, username: true, fullName: true, avatar: true } },
        album: { include: { event: { select: { id: true, name: true, category: true, creatorId: true } }, collaborators: { select: { userId: true } } } },
        taggedUsers: {
          include: {
            taggedUser: { select: { id: true, username: true, fullName: true, avatar: true } },
          },
        },
        _count: { select: { likes: true, comments: true, downloads: true } },
        ...(req.user && {
          likes: { where: { userId: req.user.id } },
          favourites: { where: { userId: req.user.id } },
        }),
      },
    });

    if (!media) {
      return res.status(404).json({ success: false, message: 'Media not found' });
    }

    if (!canAccessMedia(req.user, media)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.json({
      success: true,
      data: {
        ...media,
        isLiked: req.user ? media.likes?.length > 0 : false,
        isFavourited: req.user ? media.favourites?.length > 0 : false,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteMedia = async (req, res) => {
  try {
    const media = await prisma.media.findUnique({ where: { id: req.params.id } });

    if (!media) {
      return res.status(404).json({ success: false, message: 'Media not found' });
    }

    if (media.uploaderId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await deleteFromS3(media.url);
    if (media.thumbnailUrl) await deleteFromS3(media.thumbnailUrl);

    await prisma.media.delete({ where: { id: req.params.id } });

    res.json({ success: true, message: 'Media deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const likeMedia = async (req, res) => {
  try {
    const media = await prisma.media.findUnique({
      where: { id: req.params.id },
      select: { id: true, uploaderId: true },
    });

    if (!media) {
      return res.status(404).json({ success: false, message: 'Media not found' });
    }

    const existingLike = await prisma.like.findUnique({
      where: { userId_mediaId: { userId: req.user.id, mediaId: req.params.id } },
    });

    if (existingLike) {
      await prisma.like.delete({
        where: { userId_mediaId: { userId: req.user.id, mediaId: req.params.id } },
      });
      const count = await prisma.like.count({ where: { mediaId: req.params.id } });
      return res.json({ success: true, liked: false, count });
    } else {
      await prisma.like.create({
        data: { userId: req.user.id, mediaId: req.params.id },
      });

      await notifyLike(req.user.id, req.params.id, media.uploaderId);
      const count = await prisma.like.count({ where: { mediaId: req.params.id } });
      return res.json({ success: true, liked: true, count });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const commentOnMedia = async (req, res) => {
  try {
    const { content, parentId } = req.body;

    const media = await prisma.media.findUnique({
      where: { id: req.params.id },
      select: { id: true, uploaderId: true },
    });

    if (!media) {
      return res.status(404).json({ success: false, message: 'Media not found' });
    }

    const comment = await prisma.comment.create({
      data: {
        content,
        userId: req.user.id,
        mediaId: req.params.id,
        parentId: parentId || null,
      },
      include: {
        user: { select: { id: true, username: true, fullName: true, avatar: true } },
      },
    });

    await notifyComment(req.user.id, req.params.id, media.uploaderId, content);

    res.status(201).json({ success: true, data: comment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getComments = async (req, res) => {
  try {
    const comments = await prisma.comment.findMany({
      where: { mediaId: req.params.id, parentId: null },
      include: {
        user: { select: { id: true, username: true, fullName: true, avatar: true } },
        replies: {
          include: {
            user: { select: { id: true, username: true, fullName: true, avatar: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: comments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const toggleFavourite = async (req, res) => {
  try {
    const existing = await prisma.favourite.findUnique({
      where: { userId_mediaId: { userId: req.user.id, mediaId: req.params.id } },
    });

    if (existing) {
      await prisma.favourite.delete({
        where: { userId_mediaId: { userId: req.user.id, mediaId: req.params.id } },
      });
      return res.json({ success: true, favourited: false });
    } else {
      await prisma.favourite.create({
        data: { userId: req.user.id, mediaId: req.params.id },
      });
      return res.json({ success: true, favourited: true });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const tagUser = async (req, res) => {
  try {
    const { taggedUserId } = req.body;

    const media = await prisma.media.findUnique({ where: { id: req.params.id } });
    if (!media) {
      return res.status(404).json({ success: false, message: 'Media not found' });
    }

    await prisma.mediaTag.upsert({
      where: { mediaId_taggedUserId: { mediaId: req.params.id, taggedUserId } },
      update: {},
      create: {
        mediaId: req.params.id,
        taggedUserId,
        taggerUserId: req.user.id,
      },
    });

    await notifyTag(req.user.id, req.params.id, taggedUserId);

    res.json({ success: true, message: 'User tagged' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const downloadMedia = async (req, res) => {
  try {
    const media = await prisma.media.findUnique({
      where: { id: req.params.id },
      include: {
        album: { include: { event: true } },
        uploader: { select: { username: true } },
      },
    });

    if (!media) {
      return res.status(404).json({ success: false, message: 'Media not found' });
    }

    // Log download
    await prisma.download.create({
      data: { userId: req.user.id, mediaId: media.id },
    });

    // Generate watermark text
    const watermarkText = `${media.album.event.name} | ${media.album.event.category} | ${req.user.role}`;

    if (media.mediaType === 'PHOTO') {
      const isLocalFile = media.url.includes('/uploads/');

      if (isLocalFile) {
        const localPath = path.join(__dirname, '../../', media.url.replace(process.env.BACKEND_URL || '', ''));

        if (fs.existsSync(localPath)) {
          const watermarkedBuffer = await addWatermark(localPath, watermarkText);
          res.setHeader('Content-Type', 'image/jpeg');
          res.setHeader('Content-Disposition', `attachment; filename="${media.originalName}"`);
          return res.send(watermarkedBuffer);
        }
      }
    }

    // Fallback: redirect to signed URL or direct URL
    const downloadUrl = await getSignedDownloadUrl(media.url);
    res.json({ success: true, data: { downloadUrl, filename: media.originalName } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getFavourites = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [favourites, total] = await Promise.all([
      prisma.favourite.findMany({
        where: { userId: req.user.id },
        include: {
          media: {
            include: {
              uploader: { select: { id: true, username: true, fullName: true, avatar: true } },
              _count: { select: { likes: true, comments: true } },
            },
          },
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.favourite.count({ where: { userId: req.user.id } }),
    ]);

    res.json({
      success: true,
      data: favourites.map(f => f.media),
      pagination: { total, page: parseInt(page), limit: parseInt(limit) },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const findMyPhotos = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { faceId: true, referenceSelfie: true },
    });

    // Always include media the user personally uploaded
    const uploadedMedia = await prisma.media.findMany({
      where: { uploaderId: req.user.id, mediaType: 'PHOTO', faceIds: { has: user?.faceId || '' }, },
      include: {
        uploader: { select: { id: true, username: true, fullName: true, avatar: true } },
        album: { include: { event: { select: { id: true, name: true } } } },
        _count: { select: { likes: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Face-recognition results — query by stored faceId regardless of current
    // USE_S3 env value; faceIds were populated at upload time when S3 was active.
    let faceMedia = [];
    if (user?.faceId) {
      faceMedia = await prisma.media.findMany({
        where: {
          faceIds: { has: user.faceId },
          // Exclude photos the user uploaded (already in uploadedMedia)
          // uploaderId: { not: req.user.id },
        },
        include: {
          uploader: { select: { id: true, username: true, fullName: true, avatar: true } },
          album: { include: { event: { select: { id: true, name: true } } } },
          _count: { select: { likes: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    // Tagged media (manual tags by other users)
    const taggedMedia = await prisma.mediaTag.findMany({
      where: { taggedUserId: req.user.id },
      include: {
        media: {
          include: {
            uploader: { select: { id: true, username: true, fullName: true, avatar: true } },
            album: { include: { event: { select: { id: true, name: true } } } },
            _count: { select: { likes: true } },
          },
        },
      },
    });

    const taggedMediaItems = taggedMedia.map(t => t.media);
    const allMedia = [...uploadedMedia, ...faceMedia, ...taggedMediaItems];

    // Deduplicate by id
    const uniqueMedia = allMedia.filter((item, index, self) =>
      index === self.findIndex(m => m.id === item.id)
    );

    // faceRecognitionEnabled = true when the user has a stored faceId,
    // meaning at least one selfie was successfully indexed by Rekognition.
    const faceRecognitionEnabled = !!user?.faceId;
    // hasSelfie = true when a selfie was uploaded but face indexing may have failed
    const hasSelfie = !!user?.referenceSelfie;

    res.json({
      success: true,
      data: uniqueMedia,
      count: uniqueMedia.length,
      faceRecognitionEnabled,
      hasSelfie,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const searchMedia = async (req, res) => {
  try {
    const { q, tags, eventName, uploadDate, username, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (!req.user || req.user.role === 'VIEWER') {
      // Viewers/unauthenticated: public media in public albums only
      where.visibility = 'PUBLIC';
      where.album = { visibility: 'PUBLIC' };
    } else if (req.user.role === 'PHOTOGRAPHER') {
      // Photographers: public media OR their own private uploads; only in accessible albums
      where.OR = [
        { visibility: 'PUBLIC', album: { OR: [{ visibility: 'PUBLIC' }, { visibility: 'PRIVATE', event: { creatorId: req.user.id } }, { visibility: 'PRIVATE', collaborators: { some: { userId: req.user.id } } }] } },
        { visibility: 'PRIVATE', uploaderId: req.user.id },
      ];
    }
    // ADMIN and CLUB_MEMBER: no visibility filter — see everything

    const conditions = [];

    if (q) {
      conditions.push(
        { originalName: { contains: q, mode: 'insensitive' } },
        { caption: { contains: q, mode: 'insensitive' } },
        { tags: { has: q.toLowerCase() } },
        // BUG FIX #3: include the event name in the general-query OR conditions so that
        // typing an event name in the main search bar (e.g. "Annual") actually returns
        // photos that belong to a matching event.
        { album: { event: { name: { contains: q, mode: 'insensitive' } } } }
      );
    }

    if (tags) {
      const tagArray = tags.split(',').map(t => t.trim().toLowerCase());
      where.tags = { hasSome: tagArray };
    }

    if (uploadDate) {
      const date = new Date(uploadDate);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      where.createdAt = { gte: date, lt: nextDay };
    }

    if (eventName) {
      where.album = { event: { name: { contains: eventName, mode: 'insensitive' } } };
    }

    if (username) {
      where.uploader = { username: { contains: username, mode: 'insensitive' } };
    }

    if (conditions.length > 0) {
      where.OR = conditions;
    }

    const [results, total] = await Promise.all([
      prisma.media.findMany({
        where,
        include: {
          uploader: { select: { id: true, username: true, fullName: true, avatar: true } },
          album: { include: { event: { select: { id: true, name: true } } } },
          _count: { select: { likes: true, comments: true } },
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.media.count({ where }),
    ]);

    res.json({
      success: true,
      data: results,
      pagination: { total, page: parseInt(page), limit: parseInt(limit) },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getAnalytics = async (req, res) => {
  try {
    const [
      totalMedia, totalEvents, totalAlbums, totalUsers,
      topLiked, recentUploads, mediaByType,
    ] = await Promise.all([
      prisma.media.count(),
      prisma.event.count(),
      prisma.album.count(),
      prisma.user.count(),
      prisma.media.findMany({
        orderBy: { likes: { _count: 'desc' } },
        take: 5,
        include: {
          _count: { select: { likes: true } },
          uploader: { select: { username: true } },
        },
      }),
      prisma.media.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, thumbnailUrl: true, url: true, originalName: true, createdAt: true },
      }),
      prisma.media.groupBy({
        by: ['mediaType'],
        _count: { id: true },
      }),
    ]);

    res.json({
      success: true,
      data: {
        totals: { media: totalMedia, events: totalEvents, albums: totalAlbums, users: totalUsers },
        topLiked,
        recentUploads,
        mediaByType,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  uploadMedia, getMedia, getMediaItem, deleteMedia,
  likeMedia, commentOnMedia, getComments, toggleFavourite,
  tagUser, downloadMedia, getFavourites, findMyPhotos,
  searchMedia, getAnalytics,
};