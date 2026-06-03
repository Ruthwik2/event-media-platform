const prisma = require('../config/database');
const QRCode = require('qrcode');
const { uploadToS3, deleteFromS3 } = require('../services/s3Service');
const { randomBytes } = require('crypto');

// ── Permission helper ─────────────────────────────────────────────────────────
function canAccessEvent(user, event) {
  if (event.visibility === 'PUBLIC') return true;
  if (!user) return false;
  if (user.role === 'ADMIN' || user.role === 'CLUB_MEMBER') return true;
  if (user.role === 'PHOTOGRAPHER') return event.creatorId === user.id;
  return false;
}
// ─────────────────────────────────────────────────────────────────────────────

const createEvent = async (req, res) => {
try {
const { name, description, category, startDate, endDate, location, visibility } =
req.body;
if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
return res
.status(400)
.json({ success: false, message: 'End date cannot be before the start date' });
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
creator: {
select: { id: true, username: true, fullName: true, avatar: true },
},
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
search,
category,
sortBy = 'createdAt',
sortOrder = 'desc',
page = 1,
limit = 12,
visibility,
myEvents,
} = req.query;
const skip = (parseInt(page) - 1) * parseInt(limit);
const where = {};
if (myEvents === 'true' && req.user) {
where.creatorId = req.user.id;
} else if (
!req.user ||
req.user.role === 'VIEWER'
) {
where.visibility = 'PUBLIC';
} else if (req.user.role === 'CLUB_MEMBER') {
// Club members see all events (public + private) — no filter
if (visibility) where.visibility = visibility;
} else if (req.user.role === 'PHOTOGRAPHER') {
// Photographers can see ALL events (public + private) so they can request access.
// Access control is enforced per-event when they click into it.
if (visibility) where.visibility = visibility;
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
creator: {
select: { id: true, username: true, fullName: true, avatar: true },
},
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
creator: {
select: { id: true, username: true, fullName: true, avatar: true },
},
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
if (
!req.user ||
req.user.role === 'VIEWER'
) {
return res
.status(403)
.json({ success: false, message: 'Access denied' });
}
if (req.user.role === 'PHOTOGRAPHER' && event.creatorId !== req.user.id) {
const approvedAccess = await prisma.accessRequest.findFirst({
where: {
userId: req.user.id,
targetId: event.id,
type: 'EVENT',
status: 'APPROVED',
},
});
if (!approvedAccess) {
// Return current request status so the frontend can show the right UI
const anyRequest = await prisma.accessRequest.findUnique({
where: {
userId_targetId_type: {
userId: req.user.id,
targetId: event.id,
type: 'EVENT',
},
},
});
return res.status(403).json({
success: false,
message: 'Access denied',
requestStatus: anyRequest?.status || null,
});
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
return res
.status(403)
.json({ success: false, message: 'Not authorized' });
}
const updateData = { ...req.body };
if (req.body.startDate) updateData.startDate = new Date(req.body.startDate);
if (req.body.endDate) updateData.endDate = new Date(req.body.endDate);
const resolvedStart = updateData.startDate || event.startDate;
const resolvedEnd = updateData.endDate || event.endDate;
if (resolvedStart && resolvedEnd && resolvedEnd < resolvedStart) {
return res
.status(400)
.json({ success: false, message: 'End date cannot be before the start date' });
}
if (req.file) {
if (event.coverImage) await deleteFromS3(event.coverImage);
updateData.coverImage = await uploadToS3(req.file, 'covers');
}
const updatedEvent = await prisma.event.update({
where: { id: req.params.id },
data: updateData,
include: {
creator: {
select: { id: true, username: true, fullName: true, avatar: true },
},
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
return res
.status(403)
.json({ success: false, message: 'Not authorized' });
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
res.json({ success: true, data: categories.map((c) => c.category) });
} catch (error) {
res.status(500).json({ success: false, message: error.message });
}
};
/**
* POST /events/:id/request-access  (PHOTOGRAPHER only)
*/
const requestAccess = async (req, res) => {
try {
const { id } = req.params;
const existing = await prisma.accessRequest.findUnique({
where: {
userId_targetId_type: { userId: req.user.id, targetId: id, type: 'EVENT' },
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
data: { userId: req.user.id, targetId: id, type: 'EVENT' },
});
}
// Notify all admins
try {
const event = await prisma.event.findUnique({
where: { id },
select: { name: true },
});
const { notifyAccessRequest } = require('../services/notificationService');
await notifyAccessRequest(
req.user.id,
id,
'EVENT',
event?.name || 'Unknown Event'
);
} catch (e) {
console.error('Notification error:', e);
}
res.json({ success: true, message: 'Request sent successfully' });
} catch (error) {
res.status(500).json({ success: false, message: error.message });
}
};
/**
* GET /events/access-requests  (admin only)
*/
const getEventAccessRequests = async (req, res) => {
try {
const { status = 'PENDING' } = req.query;
const whereStatus = status === 'ALL' ? {} : { status };
const requests = await prisma.accessRequest.findMany({
where: { type: 'EVENT', ...whereStatus },
include: {
user: {
select: { id: true, username: true, fullName: true, avatar: true },
},
},
orderBy: { createdAt: 'desc' },
});
const enriched = await Promise.all(
requests.map(async (r) => {
try {
const event = await prisma.event.findUnique({
where: { id: r.targetId },
select: { id: true, name: true, category: true },
});
return { ...r, target: event, targetType: 'EVENT' };
} catch {
return { ...r, target: null, targetType: 'EVENT' };
}
})
);
res.json({ success: true, data: enriched });
} catch (error) {
res.status(500).json({ success: false, message: error.message });
}
};
/**
* PATCH /events/access-requests/:rid  (admin only)
*/
const approveRejectEventRequest = async (req, res) => {
try {
const { rid } = req.params;
const { status } = req.body;
if (!['APPROVED', 'REJECTED'].includes(status)) {
return res
.status(400)
.json({ success: false, message: 'Invalid status' });
}
const request = await prisma.accessRequest.findFirst({
where: { id: rid, type: 'EVENT' },
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
// Notify photographer of decision
try {
const { notifyAccessResponse } = require('../services/notificationService');
await notifyAccessResponse(
req.user.id,
request.userId,
request.targetId,
'EVENT',
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
/**
* GET /events/my-access-requests  (PHOTOGRAPHER only)
* Returns ALL access requests (both EVENT and ALBUM types) for the logged-in photographer.
*/
const getMyAccessRequests = async (req, res) => {
try {
const { status } = req.query;
const whereStatus = status && status !== 'ALL' ? { status } : {};
const requests = await prisma.accessRequest.findMany({
where: { userId: req.user.id, ...whereStatus },
orderBy: { createdAt: 'desc' },
});
// Enrich with target name
const enriched = await Promise.all(
requests.map(async (r) => {
try {
if (r.type === 'EVENT') {
const event = await prisma.event.findUnique({
where: { id: r.targetId },
select: { id: true, name: true, category: true, visibility: true },
});
return { ...r, target: event };
} else {
const album = await prisma.album.findUnique({
where: { id: r.targetId },
select: {
id: true,
name: true,
visibility: true,
event: { select: { id: true, name: true } },
},
});
return { ...r, target: album };
}
} catch {
return { ...r, target: null };
}
})
);
res.json({ success: true, data: enriched });
} catch (error) {
res.status(500).json({ success: false, message: error.message });
}
};
/**
 * PATCH /events/:id/rename  (creator or ADMIN)
 * Renames the event — validates uniqueness like the original create.
 */
const renameEvent = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }
    const trimmed = name.trim();
    const event = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    if (event.creatorId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    // Skip uniqueness check if name hasn't changed
    if (trimmed !== event.name) {
      const conflict = await prisma.event.findUnique({ where: { name: trimmed } });
      if (conflict) {
        return res.status(409).json({ success: false, message: 'An event with that name already exists' });
      }
    }
    const updated = await prisma.event.update({
      where: { id: req.params.id },
      data: { name: trimmed },
      include: {
        creator: { select: { id: true, username: true, fullName: true, avatar: true } },
        _count: { select: { albums: true } },
      },
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Event Share Token ─────────────────────────────────────────────────────────

/**
 * GET /events/:id/qr  (optionalAuth)
 * Returns the share URL and security metadata. QR image is generated client-side.
 * shareToken is fetched in a separate query so a pending DB migration won't crash
 * the whole endpoint.
 */
const getEventQR = async (req, res) => {
  try {
    // Step 1 — fetch core fields (always safe, no optional columns)
    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true, visibility: true, creatorId: true },
    });
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    // Step 2 — access check
    if (event.visibility === 'PRIVATE') {
      if (!req.user || req.user.role === 'VIEWER') {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
      if (req.user.role === 'PHOTOGRAPHER' && event.creatorId !== req.user.id) {
        const approved = await prisma.accessRequest.findFirst({
          where: { userId: req.user.id, targetId: event.id, type: 'EVENT', status: 'APPROVED' },
        });
        if (!approved) {
          return res.status(403).json({ success: false, message: 'Access denied' });
        }
      }
    }

    // Step 3 — try to read shareToken in a separate query.
    // If the migration adding this column hasn't been applied yet the query
    // throws; we catch it silently and fall back to no share token.
    let shareToken = null;
    try {
      const row = await prisma.event.findUnique({
        where: { id: req.params.id },
        select: { shareToken: true },
      });
      shareToken = row?.shareToken ?? null;
    } catch {
      // column not yet in DB — treat as null
    }

    // Step 4 — build URL (QR image rendered client-side, not here)
    const baseUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
    const qrUrl = (event.visibility === 'PRIVATE' && shareToken)
      ? `${baseUrl}/events/share/${shareToken}`
      : `${baseUrl}/events/${event.id}`;

    res.json({
      success: true,
      data: {
        url: qrUrl,
        visibility: event.visibility,
        hasShareToken: !!shareToken,
        guestAccessEnabled: event.visibility === 'PRIVATE' && !!shareToken,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /events/:id/share-token  (creator or ADMIN)
 * Generates a guest-access token for a PRIVATE event.
 */
const generateEventShareToken = async (req, res) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    if (event.creatorId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    if (event.visibility !== 'PRIVATE') {
      return res.status(400).json({
        success: false,
        message: 'Share tokens are only for private events. Public events are accessible by everyone.',
      });
    }
    const token = randomBytes(32).toString('hex');
    await prisma.event.update({ where: { id: event.id }, data: { shareToken: token } });
    const shareUrl = `${process.env.FRONTEND_URL}/events/share/${token}`;
    res.json({ success: true, data: { shareToken: token, shareUrl } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /events/:id/share-token  (creator or ADMIN)
 * Revokes the guest share token.
 */
const revokeEventShareToken = async (req, res) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    if (event.creatorId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    await prisma.event.update({ where: { id: event.id }, data: { shareToken: null } });
    res.json({ success: true, message: 'Share link revoked.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /events/by-token/:token  (no auth — public endpoint)
 * Returns event + albums when a valid shareToken is presented.
 */
const getEventByShareToken = async (req, res) => {
  try {
    const { token } = req.params;
    if (!/^[a-f0-9]{64}$/.test(token)) {
      return res.status(404).json({ success: false, message: 'Invalid share link' });
    }
    const event = await prisma.event.findUnique({
      where: { shareToken: token },
      include: {
        creator: { select: { id: true, username: true, fullName: true, avatar: true } },
        albums: {
          include: { _count: { select: { media: true } } },
        },
        _count: { select: { albums: true } },
      },
    });
    if (!event) {
      return res.status(404).json({ success: false, message: 'Share link not found or has been revoked' });
    }
    if (event.visibility !== 'PRIVATE') {
      return res.status(400).json({
        success: false,
        message: 'This event is public — no token needed',
        redirectId: event.id,
      });
    }
    const { shareToken: _token, ...eventData } = event;
    res.json({ success: true, data: eventData, guestAccess: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
createEvent,
getEvents,
getEvent,
updateEvent,
deleteEvent,
getCategories,
renameEvent,
getEventQR,
generateEventShareToken,
revokeEventShareToken,
getEventByShareToken,
requestAccess,
getEventAccessRequests,
approveRejectEventRequest,
getMyAccessRequests,
};