const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  register,
  login,
  logout,
  forgotPassword,
  resetPassword,
  refreshSession,
  getProfile,
  updateProfile,
} = require('../controllers/authController');

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/session', authenticate, refreshSession);
router.get('/me', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);

module.exports = router;
