const prisma = require('../config/database');
const { uploadToS3, deleteFromS3 } = require('../services/s3Service');

const createEvent = async (req, res) => {
  try {
    const { name, description, category, startDate, endDate, location, visibility } = req.body;

    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      return res.status(400).json({ success: false, message: 'End date cannot be before the start date' });
    }

    let coverImage = null;
    if (req.file) {
      coverImage = await uploadToS3(req.file, 'covers');
    }

    const event = await prisma.event.create({
      data: {
        name,
        description,
        category,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        location,
        visibility: visibility || 'PUBLIC',
        coverImage,
        creatorId: req.user.id,
      },
      include: {
        creator: { select: { id: true, username: true, fullName: true, avatar: true } },
        _count: { select: { albums: true } },
      },
    });

    res.status(201).json({ success: true, message: 'Event created', data: event });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getEvents = async (req, res) => {
  try {
    const {
      search, category, sortBy = 'createdAt',
      sortOrder = 'desc', page = 1, limit = 12,
      visibility, myEvents,
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};

    if (myEvents === 'true' && req.user) {
      where.creatorId = req.user.id;
    } else if (!req.user || req.user.role === 'VIEWER' || req.user.role === 'CLUB_MEMBER') {
      where.visibility = 'PUBLIC';
    } else if (req.user.role === 'PHOTOGRAPHER') {
      if (visibility === 'PRIVATE') {
        where.visibility = 'PRIVATE';
        where.creatorId = req.user.id;
      } else if (visibility === 'PUBLIC') {
        where.visibility = 'PUBLIC';
      } else {
        where.OR = [
          { visibility: 'PUBLIC' },
          { visibility: 'PRIVATE', creatorId: req.user.id },
        ];
      }
    } else if (req.user.role === 'ADMIN') {
      if (visibility) where.visibility = visibility;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (category) where.category = category;

    const validSortFields = ['name', 'startDate', 'createdAt'];
    const orderBy = validSortFields.includes(sortBy)
      ? { [sortBy]: sortOrder === 'asc' ? 'asc' : 'desc' }
      : { createdAt: 'desc' };

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        include: {
          creator: { select: { id: true, username: true, fullName: true, avatar: true } },
          _count: { select: { albums: true } },
        },
        orderBy,
        skip,
        take: parseInt(limit),
      }),
      prisma.event.count({ where }),
    ]);

    res.json({
      success: true,
      data: events,
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

const getEvent = async (req, res) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
      include: {
        creator: { select: { id: true, username: true, fullName: true, avatar: true } },
        albums: {
          include: {
            _count: { select: { media: true } },
          },
        },
        _count: { select: { albums: true } },
      },
    });

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    if (event.visibility === 'PRIVATE') {
      if (!req.user || req.user.role === 'VIEWER' || req.user.role === 'CLUB_MEMBER') {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
      if (req.user.role === 'PHOTOGRAPHER' && event.creatorId !== req.user.id) {
        const approvedAccess = await prisma.accessRequest.findFirst({
          where: { userId: req.user.id, targetId: event.id, type: 'EVENT', status: 'APPROVED' }
        });
        
        if (!approvedAccess) {
          return res.status(403).json({ success: false, message: 'Access denied' });
        }
      }
    }

    res.json({ success: true, data: event });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateEvent = async (req, res) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id } });

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    if (event.creatorId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const updateData = { ...req.body };
    if (req.body.startDate) updateData.startDate = new Date(req.body.startDate);
    if (req.body.endDate) updateData.endDate = new Date(req.body.endDate);

    const resolvedStart = updateData.startDate || event.startDate;
    const resolvedEnd = updateData.endDate || event.endDate;
    if (resolvedStart && resolvedEnd && resolvedEnd < resolvedStart) {
      return res.status(400).json({ success: false, message: 'End date cannot be before the start date' });
    }

    if (req.file) {
      if (event.coverImage) await deleteFromS3(event.coverImage);
      updateData.coverImage = await uploadToS3(req.file, 'covers');
    }

    const updatedEvent = await prisma.event.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        creator: { select: { id: true, username: true, fullName: true, avatar: true } },
      },
    });

    res.json({ success: true, message: 'Event updated', data: updatedEvent });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteEvent = async (req, res) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id } });

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    if (event.creatorId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (event.coverImage) await deleteFromS3(event.coverImage);

    await prisma.event.delete({ where: { id: req.params.id } });

    res.json({ success: true, message: 'Event deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getCategories = async (req, res) => {
  try {
    const categories = await prisma.event.findMany({
      select: { category: true },
      distinct: ['category'],
    });

    res.json({ success: true, data: categories.map(c => c.category) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const requestAccess = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.accessRequest.findUnique({
      where: { userId_targetId_type: { userId: req.user.id, targetId: id, type: 'EVENT' } }
    });

    if (existing) {
      return res.status(400).json({ success: false, message: 'Access already requested' });
    }

    await prisma.accessRequest.create({
      data: { userId: req.user.id, targetId: id, type: 'EVENT' }
    });

    res.json({ success: true, message: 'Request sent successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { createEvent, getEvents, getEvent, updateEvent, deleteEvent, getCategories, requestAccess };