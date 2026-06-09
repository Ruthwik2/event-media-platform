const prisma = require('../config/database');
const path = require('path');
const fs = require('fs');
const { uploadToS3, deleteFromS3, getS3ObjectStream } = require('../services/s3Service');
const { detectLabels, searchFacesByImage, moderateContent, generateCaption } = require('../services/rekognitionService');
const { generateThumbnail, getImageMetadata, addWatermark } = require('../services/imageService');
const { notifyLike, notifyComment, notifyTag } = require('../services/notificationService');

// Access-control helpers — single source of truth in utils/permissions.js
const { canAccessAlbum, canAccessMedia, mediaVisibilityWhere } = require('../utils/permissions');
const { hasApprovedEventAccess } = require('../utils/accessRequests');
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
      let aiCaption = null;
      let flagged = false;
      let moderationLabels = [];

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

      // ── AI tagging, captioning, moderation, and face detection ────────────
      // Works for both local-upload + S3 and direct multer-S3 uploads
      // fileUrl is either from file.location (multer-S3) or set by uploadToS3 above
      if (isImage && fileUrl?.includes('amazonaws.com')) {
        tags = await detectLabels(fileUrl);

        // AI caption synthesized from the detected labels
        aiCaption = await generateCaption(fileUrl, tags);

        // Content moderation — flag unsafe images so admins can review/remove them
        const moderation = await moderateContent(fileUrl);
        flagged = !moderation.safe;
        moderationLabels = moderation.labels;
        if (flagged) {
          console.warn(`Media flagged by moderation: ${file.originalname} → ${moderationLabels.join(', ')}`);
        }

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
          aiCaption,
          tags,
          faceIds,
          flagged,
          moderationLabels,
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
          event: { select: { creatorId: true, visibility: true } },
          collaborators: { select: { userId: true } },
        },
      });
      if (!album) {
        return res.status(404).json({ success: false, message: 'Album not found' });
      }
      const hasEventAccess = await hasApprovedEventAccess(req.user, album.eventId);
      if (!canAccessAlbum(req.user, album, hasEventAccess)) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
      where.albumId = albumId;
    }
    if (mediaType) where.mediaType = mediaType;

    // Media-level + album-level + event-level visibility filter.
    // When browsing the general feed (no albumId) we must block:
    //   1. media whose own visibility is PRIVATE (for viewers/unauthed)
    //   2. media inside a PRIVATE album (for viewers/unauthed)
    //   3. media inside an album whose parent EVENT is PRIVATE (for viewers/unauthed)
    if (!albumId) {
      if (!req.user || req.user.role === 'VIEWER') {
        // Only public media inside public albums of public events
        where.visibility = 'PUBLIC';
        where.album = { visibility: 'PUBLIC', event: { visibility: 'PUBLIC' } };
      } else if (req.user.role === 'PHOTOGRAPHER') {
        // Photographers see:
        //   - public media in public albums of public events
        //   - any media in albums/events they own or collaborate on
        //   - their own uploaded media (regardless of visibility)
        where.OR = [
          // Public feed: public album in a public event
          {
            visibility: 'PUBLIC',
            album: { visibility: 'PUBLIC', event: { visibility: 'PUBLIC' } },
          },
          // Private event they created → all media visible
          {
            album: { event: { creatorId: req.user.id } },
          },
          // Private album they collaborate on → all media visible
          {
            album: { collaborators: { some: { userId: req.user.id } } },
          },
          // Their own uploads (any album/event)
          { uploaderId: req.user.id },
        ];
      }
      // ADMIN and CLUB_MEMBER: see all media (no filter)
    } else {
      // albumId already gated by canAccessAlbum above; only media-level filter needed
      if (!req.user || req.user.role === 'VIEWER') {
        where.visibility = 'PUBLIC';
      } else if (req.user.role === 'PHOTOGRAPHER') {
        where.OR = [
          { visibility: 'PUBLIC' },
          { visibility: 'PRIVATE', uploaderId: req.user.id },
        ];
      }
      // ADMIN and CLUB_MEMBER: see all media in this album
    }

    if (search) {
      const searchOR = [
        { originalName: { contains: search, mode: 'insensitive' } },
        { caption: { contains: search, mode: 'insensitive' } },
        { aiCaption: { contains: search, mode: 'insensitive' } },
        { tags: { has: search.toLowerCase() } },
        { album: { name: { contains: search, mode: 'insensitive' } } },
        { album: { event: { name: { contains: search, mode: 'insensitive' } } } },
        { uploader: { username: { contains: search, mode: 'insensitive' } } },
        { uploader: { fullName: { contains: search, mode: 'insensitive' } } },
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
          taggedUsers: {
            include: { taggedUser: { select: { id: true, username: true, fullName: true, avatar: true } } },
          },
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
        album: { include: { event: { select: { id: true, name: true, category: true, creatorId: true, visibility: true } }, collaborators: { select: { userId: true } } } },
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

    const hasEventAccess = await hasApprovedEventAccess(req.user, media.album?.event?.id);
    if (!canAccessMedia(req.user, media, hasEventAccess)) {
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

    // Only the photo's uploader (or an admin) may tag people in it.
    if (media.uploaderId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Only the uploader can tag people in this photo' });
    }

    const taggedUser = await prisma.user.findUnique({
      where: { id: taggedUserId },
      select: { allowTagging: true },
    });
    if (!taggedUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (!taggedUser.allowTagging) {
      return res.status(403).json({ success: false, message: 'This user does not allow tagging' });
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

// Remove a tag. Allowed for the tagged user (untag themselves), the person who
// added the tag, the media's uploader, or an admin.
const untagUser = async (req, res) => {
  try {
    const { id, taggedUserId } = req.params;

    const tag = await prisma.mediaTag.findUnique({
      where: { mediaId_taggedUserId: { mediaId: id, taggedUserId } },
      include: { media: { select: { uploaderId: true } } },
    });
    if (!tag) {
      return res.status(404).json({ success: false, message: 'Tag not found' });
    }

    const canRemove =
      req.user.role === 'ADMIN' ||
      req.user.id === taggedUserId ||
      req.user.id === tag.taggerUserId ||
      req.user.id === tag.media.uploaderId;
    if (!canRemove) {
      return res.status(403).json({ success: false, message: 'Not allowed to remove this tag' });
    }

    await prisma.mediaTag.delete({
      where: { mediaId_taggedUserId: { mediaId: id, taggedUserId } },
    });

    res.json({ success: true, message: 'Tag removed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const downloadMedia = async (req, res) => {
  try {
    const media = await prisma.media.findUnique({
      where: { id: req.params.id },
      include: {
        album: {
          include: {
            event: {
              include: {
                creator: { select: { fullName: true } },
              },
            },
          },
        },
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

    const safeFilename = (media.originalName || 'download')
      .replace(/[\\/\r\n]/g, '_')
      .replace(/"/g, "'");

    // ── Watermark info ────────────────────────────────────────────────────────
    // clubName  → club name set by admin in settings (falls back to 'EventMedia')
    // eventName → the event this media belongs to
    // userRole  → role of the person downloading
    const watermarkInfo = {
      clubName:  (await prisma.clubSettings.findUnique({ where: { id: 'singleton' } }))?.clubName || 'EventMedia',
      eventName: media.album?.event?.name || '',
      userRole:  req.user.role,
      username:  req.user.username || req.user.fullName || '',
    };

    // ── Helper: collect a stream into a Buffer ────────────────────────────────
    const streamToBuffer = (stream) =>
      new Promise((resolve, reject) => {
        const chunks = [];
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end',  () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
      });

    // ── PHOTO: apply watermark regardless of storage location ─────────────────
    if (media.mediaType === 'PHOTO') {
      let imageBuffer = null;

      // 1) Try local file first
      if (media.url.includes('/uploads/')) {
        const localPath = path.join(
          __dirname, '../../',
          media.url.replace(process.env.BACKEND_URL || '', '')
        );
        if (fs.existsSync(localPath)) {
          imageBuffer = fs.readFileSync(localPath);
        }
      }

      // 2) Fall back to S3 stream → buffer
      if (!imageBuffer) {
        const s3Object = await getS3ObjectStream({ url: media.url });
        if (s3Object && s3Object.body) {
          imageBuffer = await streamToBuffer(s3Object.body);
        }
      }

      if (imageBuffer) {
        const watermarkedBuffer = await addWatermark(imageBuffer, watermarkInfo);
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
        return res.send(watermarkedBuffer);
      }
    }

    // ── VIDEO / other: serve as-is (no watermark for non-photos) ─────────────
    if (media.url.includes('/uploads/')) {
      const localPath = path.join(
        __dirname, '../../',
        media.url.replace(process.env.BACKEND_URL || '', '')
      );
      if (fs.existsSync(localPath)) {
        return res.download(localPath, safeFilename);
      }
    }

    const s3Object = await getS3ObjectStream({ url: media.url });
    if (s3Object && s3Object.body) {
      res.setHeader('Content-Type', s3Object.contentType || media.mimeType || 'application/octet-stream');
      if (s3Object.contentLength) {
        res.setHeader('Content-Length', s3Object.contentLength.toString());
      }
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
      s3Object.body.on('error', () => res.status(500).end());
      return s3Object.body.pipe(res);
    }

    return res.status(404).json({ success: false, message: 'File not available' });
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
              likes: { where: { userId: req.user.id }, select: { id: true } },
            },
          },
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.favourite.count({ where: { userId: req.user.id } }),
    ]);

    // Every item here is, by definition, one of the caller's favourites — so
    // tag each with isFavourited:true (and the per-user isLiked) so the
    // lightbox opened from this page shows the bookmark/heart already filled.
    res.json({
      success: true,
      data: favourites.map(f => ({
        ...f.media,
        isLiked: f.media.likes?.length > 0,
        isFavourited: true,
        likes: undefined,
      })),
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

    // ── Role-based visibility filter ─────────────────────────────────────────
    // Applied to face-match and tagged results so VIEWERs / PHOTOGRAPHERs
    // cannot see private media they have no business accessing.
    // Own uploads are always shown — no visibility gate needed there.
    let visibilityFilter = null;
    if (req.user.role === 'VIEWER') {
      visibilityFilter = {
        visibility: 'PUBLIC',
        album: { visibility: 'PUBLIC', event: { visibility: 'PUBLIC' } },
      };
    } else if (req.user.role === 'PHOTOGRAPHER') {
      visibilityFilter = {
        OR: [
          { visibility: 'PUBLIC', album: { visibility: 'PUBLIC', event: { visibility: 'PUBLIC' } } },
          { album: { event: { creatorId: req.user.id } } },
          { album: { collaborators: { some: { userId: req.user.id } } } },
          { uploaderId: req.user.id },
        ],
      };
    }
    // ADMIN and CLUB_MEMBER: visibilityFilter stays null — see everything

    const mediaInclude = {
      uploader: { select: { id: true, username: true, fullName: true, avatar: true } },
      album: { include: { event: { select: { id: true, name: true } } } },
      _count: { select: { likes: true } },
    };

    // ── Face-recognition matches ONLY ────────────────────────────────────────
    // My Photos shows only photos where the user's face was detected via
    // AWS Rekognition — not their own uploads or manually tagged photos.
    let uniqueMedia = [];
    if (user?.faceId) {
      const faceWhere = {
        faceIds: { has: user.faceId },
        ...(visibilityFilter || {}),
      };
      uniqueMedia = await prisma.media.findMany({
        where: faceWhere,
        include: mediaInclude,
        orderBy: { createdAt: 'desc' },
      });
    }

    const faceRecognitionEnabled = !!user?.faceId;
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
    const { q, tags, eventName, albumName, uploadDate, username, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};

    // ── 1. Visibility gate (always AND-ed — never widened by a filter match) ──
    // A media item matching one search filter must still pass the visibility
    // rules for the caller; otherwise OR-ing filters would leak private media.
    let visibilityOR = null;
    if (!req.user || req.user.role === 'VIEWER') {
      // Public media in public albums of public events only.
      visibilityOR = [
        { visibility: 'PUBLIC', album: { visibility: 'PUBLIC', event: { visibility: 'PUBLIC' } } },
      ];
    } else if (req.user.role === 'PHOTOGRAPHER') {
      visibilityOR = [
        { visibility: 'PUBLIC', album: { visibility: 'PUBLIC', event: { visibility: 'PUBLIC' } } },
        { album: { event: { creatorId: req.user.id } } },
        { album: { collaborators: { some: { userId: req.user.id } } } },
        { uploaderId: req.user.id },
      ];
    }
    // ADMIN and CLUB_MEMBER: no visibility filter — see everything

    // ── 2. Search filters — each filled field is AND-ed (intersection) ────────
    // A media item must match EVERY filled-in filter (Tags AND Event AND Album
    // AND Date AND Username AND free-text q). An empty field adds no constraint,
    // so it can be anything.
    const filterAND = [];

    if (tags) {
      const tagArray = tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
      // Each comma-separated tag must be present (intersection within Tags too).
      if (tagArray.length > 0) filterAND.push({ tags: { hasEvery: tagArray } });
    }

    if (eventName) {
      filterAND.push({ album: { event: { name: { contains: eventName, mode: 'insensitive' } } } });
    }

    if (albumName) {
      filterAND.push({ album: { name: { contains: albumName, mode: 'insensitive' } } });
    }

    if (uploadDate) {
      const date = new Date(uploadDate);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      filterAND.push({ createdAt: { gte: date, lt: nextDay } });
    }

    if (username) {
      filterAND.push({
        uploader: {
          OR: [
            { username: { contains: username, mode: 'insensitive' } },
            { fullName: { contains: username, mode: 'insensitive' } },
          ],
        },
      });
    }

    // Free-text query (q) — fans out across many columns (OR internally), but
    // the whole match is one more AND constraint alongside the other filters.
    if (q) {
      filterAND.push({
        OR: [
          { originalName: { contains: q, mode: 'insensitive' } },
          { caption: { contains: q, mode: 'insensitive' } },
          { aiCaption: { contains: q, mode: 'insensitive' } },
          { tags: { has: q.toLowerCase() } },
          { album: { name: { contains: q, mode: 'insensitive' } } },
          { album: { event: { name: { contains: q, mode: 'insensitive' } } } },
          { uploader: { username: { contains: q, mode: 'insensitive' } } },
          { uploader: { fullName: { contains: q, mode: 'insensitive' } } },
        ],
      });
    }

    // ── 3. Combine: visibility (AND) × each filled filter (AND) ───────────────
    const andClauses = [];
    if (visibilityOR) andClauses.push({ OR: visibilityOR });
    andClauses.push(...filterAND);
    if (andClauses.length > 0) where.AND = andClauses;

    const [results, total] = await Promise.all([
      prisma.media.findMany({
        where,
        include: {
          uploader: { select: { id: true, username: true, fullName: true, avatar: true } },
          album: { include: { event: { select: { id: true, name: true } } } },
          _count: { select: { likes: true, comments: true } },
          // Bug was: isLiked / isFavourited never populated — heart state always wrong
          ...(req.user && {
            likes: { where: { userId: req.user.id }, select: { id: true } },
            favourites: { where: { userId: req.user.id }, select: { id: true } },
          }),
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.media.count({ where }),
    ]);

    const enriched = results.map(item => ({
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

const getAnalytics = async (req, res) => {
  try {
    // Visibility gate applied to the media lists returned below (counts stay
    // global — they're aggregate totals, not browsable items).
    const visibilityWhere = mediaVisibilityWhere(req.user);

    const [
      totalMedia, totalEvents, totalAlbums, totalUsers,
      topLiked, recentUploads, mediaByType,
    ] = await Promise.all([
      prisma.media.count(),
      prisma.event.count(),
      prisma.album.count(),
      prisma.user.count(),
      prisma.media.findMany({
        // Never surface media the caller isn't allowed to see (private media,
        // or media in private albums/events) in analytics-driven UI.
        where: { ...(visibilityWhere || {}) },
        orderBy: { likes: { _count: 'desc' } },
        // Fetch a deeper pool than the homepage shows in any single section, so
        // the hero collage and the Trending grid can draw non-overlapping slices.
        take: 12,
        include: {
          _count: { select: { likes: true } },
          uploader: { select: { username: true } },
        },
      }),
      prisma.media.findMany({
        where: { ...(visibilityWhere || {}) },
        orderBy: { createdAt: 'desc' },
        take: 8,
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
  tagUser, untagUser, downloadMedia, getFavourites, findMyPhotos,
  searchMedia, getAnalytics,
};