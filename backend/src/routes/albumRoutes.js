const express = require('express');
const router = express.Router();
const { authenticate, optionalAuth, authorize } = require('../middleware/auth');
const {
  createAlbum,
  getAlbums,
  getAlbum,
  updateAlbum,
  renameAlbum,
  deleteAlbum,
  getAlbumQR,
  addCollaborator,
  requestAlbumAccess,
  getAlbumAccessRequests,
  approveRejectAlbumRequest,
  generateShareToken,
  revokeShareToken,
  getAlbumByShareToken,
} = require('../controllers/albumController');

// ── Static routes FIRST (must come before /:id to avoid conflicts) ────────────
router.get('/access-requests', authenticate, authorize('ADMIN'), getAlbumAccessRequests);
router.patch('/access-requests/:rid', authenticate, authorize('ADMIN'), approveRejectAlbumRequest);

// ── Share token public endpoint (no auth — guests scanning QR land here) ──────
router.get('/by-token/:token', getAlbumByShareToken);

// ── Collection & item routes ──────────────────────────────────────────────────
router.get('/', optionalAuth, getAlbums);
router.post('/', authenticate, createAlbum);
router.get('/:id', optionalAuth, getAlbum);
router.put('/:id', authenticate, updateAlbum);
router.delete('/:id', authenticate, deleteAlbum);

// ── Rename ────────────────────────────────────────────────────────────────────
router.patch('/:id/rename', authenticate, renameAlbum);

// ── QR & sharing ─────────────────────────────────────────────────────────────
router.get('/:id/qr', optionalAuth, getAlbumQR);
router.post('/:id/share-token', authenticate, generateShareToken);
router.delete('/:id/share-token', authenticate, revokeShareToken);

// ── Collaboration & access requests ──────────────────────────────────────────
router.post('/:id/collaborators', authenticate, addCollaborator);
router.post('/:id/request-access', authenticate, authorize('PHOTOGRAPHER'), requestAlbumAccess);

module.exports = router;