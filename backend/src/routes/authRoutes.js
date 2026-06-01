const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { avatarUpload, selfieUpload } = require('../middleware/upload');
const {
  register, login, getProfile, updateProfile, uploadSelfie, getAllUsers, deleteUser, changePassword,
} = require('../controllers/authController');


router.post('/register', register);
router.post('/login', login);
router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, avatarUpload.single('avatar'), updateProfile);
router.post('/selfie', authenticate, selfieUpload.single('selfie'), uploadSelfie);
router.get('/users', authenticate, getAllUsers);
router.delete('/users/:userId', authenticate, deleteUser);
router.put('/password', authenticate, changePassword);

module.exports = router;