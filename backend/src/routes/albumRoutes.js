const express = require('express');
const router = express.Router();
const { authenticate, optionalAuth } = require('../middleware/auth');
const {
  createAlbum, getAlbums, getAlbum, updateAlbum, deleteAlbum, getAlbumQR, addCollaborator,
} = require('../controllers/albumController');

router.get('/', optionalAuth, getAlbums);
router.get('/:id', optionalAuth, getAlbum);
router.get('/:id/qr', optionalAuth, getAlbumQR);
router.post('/', authenticate, createAlbum);
router.put('/:id', authenticate, updateAlbum);
router.delete('/:id', authenticate, deleteAlbum);
router.post('/:id/collaborators', authenticate, addCollaborator);


module.exports = router;