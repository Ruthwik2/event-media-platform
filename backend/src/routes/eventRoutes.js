const express = require('express');
const router = express.Router();
const { authenticate, optionalAuth, authorize } = require('../middleware/auth');
const { coverUpload } = require('../middleware/upload');
const {
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
} = require('../controllers/eventController');

// ── Static routes FIRST ───────────────────────────────────────────────────────
router.get('/categories', getCategories);
router.get(
  '/access-requests',
  authenticate,
  authorize('ADMIN'),
  getEventAccessRequests
);
router.patch(
  '/access-requests/:rid',
  authenticate,
  authorize('ADMIN'),
  approveRejectEventRequest
);
// Photographer: view their own requests (EVENT + ALBUM)
router.get(
  '/my-access-requests',
  authenticate,
  authorize('PHOTOGRAPHER'),
  getMyAccessRequests
);

// ── Share token public endpoint (no auth — guests scanning QR land here) ─────
router.get('/by-token/:token', getEventByShareToken);

// ── Collection & item routes ──────────────────────────────────────────────────
router.get('/', optionalAuth, getEvents);
router.post(
  '/',
  authenticate,
  authorize('ADMIN', 'PHOTOGRAPHER'),
  coverUpload.single('coverImage'),
  createEvent
);
router.get('/:id', optionalAuth, getEvent);
router.put('/:id', authenticate, coverUpload.single('coverImage'), updateEvent);
router.delete('/:id', authenticate, deleteEvent);

// ── Rename ────────────────────────────────────────────────────────────────────
router.patch('/:id/rename', authenticate, renameEvent);

// ── QR & sharing ─────────────────────────────────────────────────────────────
router.get('/:id/qr', optionalAuth, getEventQR);
router.post('/:id/share-token', authenticate, generateEventShareToken);
router.delete('/:id/share-token', authenticate, revokeEventShareToken);

// ── Access requests ───────────────────────────────────────────────────────────
router.post(
  '/:id/request-access',
  authenticate,
  authorize('PHOTOGRAPHER'),
  requestAccess
);

module.exports = router;