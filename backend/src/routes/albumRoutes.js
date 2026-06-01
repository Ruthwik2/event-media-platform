const express = require('express');
const router = express.Router();
const { authenticate, optionalAuth, authorize } = require('../middleware/auth');
const {
  createAlbum,
  getAlbums,
  getAlbum,
  updateAlbum,
  deleteAlbum,
  getAlbumQR,
  addCollaborator,
  requestAlbumAccess,
  getAlbumAccessRequests,
  approveRejectAlbumRequest,
} = require('../controllers/albumController');
 
// ── Static routes FIRST (must come before /:id to avoid conflicts) ────────────
router.get(
  '/access-requests',
  authenticate,
  authorize('ADMIN'),
  getAlbumAccessRequests
);
router.patch(
  '/access-requests/:rid',
  authenticate,
  authorize('ADMIN'),
  approveRejectAlbumRequest
);
 
// ── Collection & item routes ──────────────────────────────────────────────────
router.get('/', optionalAuth, getAlbums);
router.post('/', authenticate, createAlbum);
 
router.get('/:id', optionalAuth, getAlbum);
router.put('/:id', authenticate, updateAlbum);
router.delete('/:id', authenticate, deleteAlbum);
 
router.get('/:id/qr', optionalAuth, getAlbumQR);
router.post('/:id/collaborators', authenticate, addCollaborator);
router.post(
  '/:id/request-access',
  authenticate,
  authorize('PHOTOGRAPHER'),
  requestAlbumAccess
);
 
module.exports = router;