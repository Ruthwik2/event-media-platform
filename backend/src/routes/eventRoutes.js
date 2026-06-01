const express = require('express');
const router = express.Router();
const { authenticate, optionalAuth, authorize } = require('../middleware/auth');
const { coverUpload } = require('../middleware/upload');
const {
  createEvent, getEvents, getEvent, updateEvent, deleteEvent, getCategories,
} = require('../controllers/eventController');

router.get('/', optionalAuth, getEvents);
router.get('/categories', getCategories);
router.get('/:id', optionalAuth, getEvent);
router.post('/', authenticate, authorize('ADMIN', 'PHOTOGRAPHER'), coverUpload.single('coverImage'), createEvent);
router.put('/:id', authenticate, coverUpload.single('coverImage'), updateEvent);
router.delete('/:id', authenticate, deleteEvent);

module.exports = router;