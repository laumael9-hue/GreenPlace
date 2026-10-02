const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/rbac');
const {
  getPlatformStats,
  getSettings,
  updateSettings,
} = require('../controllers/adminController');

// Platform statistics (admin dashboard)
router.get('/stats', authenticate, requireAdmin, getPlatformStats);

// System settings
router.get('/settings', authenticate, requireAdmin, getSettings);
router.put('/settings', authenticate, requireAdmin, updateSettings);

module.exports = router;
