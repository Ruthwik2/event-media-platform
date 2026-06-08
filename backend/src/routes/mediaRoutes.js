const express = require('express');
const router = express.Router();
const { authenticate, optionalAuth, authorize } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const {
  uploadMedia, getMedia, getMediaItem, deleteMedia,
  likeMedia, commentOnMedia, getComments, toggleFavourite,
  tagUser, untagUser, downloadMedia, getFavourites, findMyPhotos,
  searchMedia, getAnalytics,
} = require('../controllers/mediaController');

router.get('/search', optionalAuth, searchMedia);
router.get('/favourites', authenticate, getFavourites);
router.get('/my-photos', authenticate, findMyPhotos);
router.get('/analytics', authenticate, getAnalytics);
router.get('/', optionalAuth, getMedia);
router.get('/:id', optionalAuth, getMediaItem);
router.get('/:id/comments', optionalAuth, getComments);
router.get('/:id/download', authenticate, downloadMedia);

router.post('/upload', authenticate, authorize('ADMIN', 'PHOTOGRAPHER'), upload.array('files', 20), uploadMedia);
router.delete('/:id', authenticate, authorize('ADMIN', 'PHOTOGRAPHER'), deleteMedia);
router.post('/:id/like', authenticate, likeMedia);
router.post('/:id/comment', authenticate, commentOnMedia);
router.post('/:id/favourite', authenticate, toggleFavourite);
router.post('/:id/tag', authenticate, tagUser);
router.delete('/:id/tag/:taggedUserId', authenticate, untagUser);

module.exports = router;