const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getClubSettings, updateClubSettings } = require('../controllers/settingsController');

router.get('/club', getClubSettings);
router.put('/club', authenticate, updateClubSettings);

module.exports = router;
