const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/rbac');
const {
  getPlatformStats,
  getSettings,
  updateSettings,
} = require('../controllers/adminController');
const {
  approveBusiness,
  rejectBusiness,
  verifyDocument,
} = require('../controllers/businessController');
const {
  getPendingBusinesses,
  getBusinessDocumentsForReview,
} = require('../controllers/businessVerificationController');

// Platform statistics (admin dashboard)
router.get('/stats', authenticate, requireAdmin, getPlatformStats);

// System settings
router.get('/settings', authenticate, requireAdmin, getSettings);
router.put('/settings', authenticate, requireAdmin, updateSettings);

// Business verification (3 required documents)
router.get('/businesses/pending', authenticate, requireAdmin, getPendingBusinesses);
router.get('/businesses/:id/documents', authenticate, requireAdmin, getBusinessDocumentsForReview);
router.post('/businesses/:id/approve', authenticate, requireAdmin, approveBusiness);
router.post('/businesses/:id/reject', authenticate, requireAdmin, rejectBusiness);
router.patch('/documents/:docId', authenticate, requireAdmin, verifyDocument);

module.exports = router;
