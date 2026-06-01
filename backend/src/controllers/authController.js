const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const prisma = require('../config/database');
const { uploadToS3, deleteFromS3 } = require('../services/s3Service');
const { indexFace, searchFacesByImage, deleteFace } = require('../services/rekognitionService');
const logger = require('../config/logger');

const deleteLocalFileFromUrl = (fileUrl) => {
  if (!fileUrl) return;
  try {
    let pathname = '';
    try {
      const url = new URL(fileUrl);
      pathname = url.pathname || '';
    } catch {
      pathname = fileUrl;
    }

    const uploadsIndex = pathname.indexOf('/uploads/');
    if (uploadsIndex === -1) return;

    const relativePath = pathname.slice(uploadsIndex + '/uploads/'.length);
    if (!relativePath) return;

    const filePath = path.resolve('uploads', relativePath);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error('Failed to delete local file:', error.message);
  }
};

const generateTokens = (userId) => {
  const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
  return { accessToken };
};

const register = async (req, res) => {
  try {
    const { email, username, password, fullName, role } = req.body;

    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: existingUser.email === email ? 'Email already in use' : 'Username already taken',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const allowedRoles = ['VIEWER', 'CLUB_MEMBER', 'PHOTOGRAPHER'];
    const userRole = allowedRoles.includes(role) ? role : 'VIEWER';

    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        fullName,
        role: userRole,
        isEmailVerified: true, // Auto-verify for demo
      },
      select: {
        id: true, email: true, username: true,
        fullName: true, role: true, avatar: true, createdAt: true,
      },
    });

    const { accessToken } = generateTokens(user.id);

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: { user, accessToken },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const { accessToken } = generateTokens(user.id);

    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      message: 'Login successful',
      data: { user: userWithoutPassword, accessToken },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true, email: true, username: true, fullName: true,
        role: true, avatar: true, bio: true, referenceSelfie: true,
        createdAt: true,
        _count: {
          select: {
            mediaUploads: true,
            events: true,
          },
        },
      },
    });

    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { fullName, bio, username } = req.body;

    const updateData = {};
    if (fullName) updateData.fullName = fullName;
    if (bio !== undefined) updateData.bio = bio;
    if (username) {
      const existing = await prisma.user.findFirst({
        where: { username, NOT: { id: req.user.id } },
      });
      if (existing) {
        return res.status(409).json({ success: false, message: 'Username taken' });
      }
      updateData.username = username;
    }

    if (req.file) {
      const avatarUrl = await uploadToS3(req.file, 'avatars');
      updateData.avatar = avatarUrl;
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      select: {
        id: true, email: true, username: true,
        fullName: true, role: true, avatar: true, bio: true,
      },
    });

    res.json({ success: true, message: 'Profile updated', data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const uploadSelfie = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No selfie uploaded' });
    }
    const existingUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { faceId: true, referenceSelfie: true },
    });

    if (existingUser?.faceId) {
      await deleteFace(existingUser.faceId);
    }
    if (existingUser?.referenceSelfie) {
      await deleteFromS3(existingUser.referenceSelfie);
    }

    // Upload selfie to S3 (selfieStorage is always diskStorage; uploadToS3 moves it to S3)
    const selfieUrl = await uploadToS3(req.file, 'selfies');

    // If S3 is not configured, save locally and skip Rekognition
    if (!selfieUrl.includes('amazonaws.com')) {
      await prisma.user.update({
        where: { id: req.user.id },
        data: { referenceSelfie: selfieUrl, faceId: null },
      });
      return res.json({
        success: true,
        message: 'Selfie saved locally. Face recognition requires USE_S3=true and AWS Rekognition.',
        data: { referenceSelfie: selfieUrl, faceId: null },
      });
    }

    // ── Call Rekognition ────────────────────────────────────────────────────
    // indexFace now returns one of:
    //   { faceId: string }  – success
    //   { noFace: true }    – Rekognition worked but no face found in image
    //   { error: string }   – AWS / config / permissions problem
    const result = await indexFace(selfieUrl, req.user.id);

    if (result.error) {
      // AWS-level error — save the selfie URL but don't store a faceId
      await prisma.user.update({
        where: { id: req.user.id },
        data: { referenceSelfie: selfieUrl, faceId: null },
      });
      logger.error('uploadSelfie: Rekognition error', { error: result.error });
      return res.status(500).json({
        success: false,
        // Return the real AWS error so it's visible in the browser/app
        message: `AWS Rekognition error: ${result.error}`,
        data: { referenceSelfie: selfieUrl, faceId: null },
      });
    }

    const faceId = result.faceId || null;

    await prisma.user.update({
      where: { id: req.user.id },
      data: { referenceSelfie: selfieUrl, faceId },
    });

    // Back-scan existing S3-hosted photos in the background
    if (faceId) {
      (async () => {
        try {
          const allPhotos = await prisma.media.findMany({
            where: {
              mediaType: 'PHOTO',
              url: { contains: 'amazonaws.com' },
            },
            select: { id: true, url: true, faceIds: true },
          });

          for (const photo of allPhotos) {
            if (photo.faceIds && photo.faceIds.includes(faceId)) continue;
            const matches = await searchFacesByImage(photo.url);
            const matchedIds = matches.map(m => m.faceId);
            if (matchedIds.includes(faceId)) {
              const existing = photo.faceIds || [];
              await prisma.media.update({
                where: { id: photo.id },
                data: { faceIds: [...new Set([...existing, faceId])] },
              });
            }
          }
          logger.info(`Background face scan complete for user ${req.user.id}`);
        } catch (scanErr) {
          logger.error('Background face scan error:', scanErr);
        }
      })();
    }

    res.json({
      success: true,
      message: faceId
        ? 'Selfie uploaded! Scanning existing photos in the background.'
        : 'No face detected in your selfie. Please use a clear, front-facing photo with good lighting.',
      data: { referenceSelfie: selfieUrl, faceId },
    });
  } catch (error) {
    logger.error('uploadSelfie: unexpected error', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const { search, role, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { fullName: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (role) where.role = role;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true, username: true, fullName: true,
          avatar: true, role: true, bio: true, email: true, createdAt: true,
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      success: true,
      data: users,
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

const deleteUser = async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Only admins can delete users' });
    }

    const { userId } = req.params;

    if (req.user.id === userId) {
      return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
    }

    const userToDelete = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!userToDelete) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (userToDelete.role === 'ADMIN') {
      return res.status(400).json({ success: false, message: 'Cannot delete admin accounts' });
    }

    const eventsCount = await prisma.event.count({ where: { creatorId: userId } });
    if (eventsCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'User owns events. Transfer or delete events before deleting this user.',
      });
    }

    const mediaToDelete = await prisma.media.findMany({
      where: { uploaderId: userId },
      select: { id: true, url: true, thumbnailUrl: true },
    });

    await prisma.$transaction([
      prisma.like.deleteMany({ where: { userId } }),
      prisma.favourite.deleteMany({ where: { userId } }),
      prisma.comment.deleteMany({ where: { userId } }),
      prisma.download.deleteMany({ where: { userId } }),
      prisma.mediaTag.deleteMany({
        where: {
          OR: [{ taggedUserId: userId }, { taggerUserId: userId }],
        },
      }),
      prisma.notification.deleteMany({ where: { recipientId: userId } }),
      prisma.media.deleteMany({ where: { uploaderId: userId } }),
      prisma.user.delete({ where: { id: userId } }),
    ]);

    for (const media of mediaToDelete) {
      if (media.url) {
        await deleteFromS3(media.url);
        deleteLocalFileFromUrl(media.url);
      }
      if (media.thumbnailUrl) {
        await deleteFromS3(media.thumbnailUrl);
        deleteLocalFileFromUrl(media.thumbnailUrl);
      }
    }

    res.json({
      success: true,
      message: `User "${userToDelete.fullName}" deleted successfully`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Both current and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    const hashed = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashed },
    });

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
module.exports = { register, login, getProfile, updateProfile, uploadSelfie, getAllUsers, deleteUser, changePassword };