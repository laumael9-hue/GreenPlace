const express = require('express');
const multer = require('multer');
const router = express.Router();
const { authenticate, optionalAuth } = require('../middleware/auth');
const { requireAdmin, requireBusiness } = require('../middleware/rbac');
const {
  createBusiness,
  getMyBusiness,
  updateBusiness,
  deleteBusiness,
  getBusinessHours,
  updateBusinessHours,
  getBusinessMaterials,
  updateBusinessMaterials,
  uploadDocument,
  getBusinessDocuments,
  deleteDocument,
  uploadBusinessLogo,
  uploadBusinessCover,
  getAllBusinesses,
  getBusinessById,
  approveBusiness,
  rejectBusiness,
  suspendBusiness,
  reactivateBusiness,
  getBusinessStats,
  getPublicBusinesses,
  getPublicBusinessBySlug,
} = require('../controllers/businessController');

const ALLOWED_DOC_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
  'application/pdf',
];

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

const uploadDoc = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_DOC_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type "${file.mimetype}" is not allowed. Accepted: JPG, PNG, WebP, PDF.`));
    }
  },
});

const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type "${file.mimetype}" is not allowed. Accepted: JPG, PNG, WebP.`));
    }
  },
});

const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File is too large. Please check the size limit.' });
    }
    return res.status(400).json({ error: err.message || 'File upload error' });
  }
  if (err) {
    return res.status(400).json({ error: err.message || 'File upload failed' });
  }
  next();
};

// Public routes
router.get('/public', getPublicBusinesses);
router.get('/public/slug/:slug', optionalAuth, getPublicBusinessBySlug);

// Admin routes
router.get('/admin/stats', authenticate, requireAdmin, getBusinessStats);
router.get('/admin', authenticate, requireAdmin, getAllBusinesses);
router.get('/admin/:id', authenticate, requireAdmin, getBusinessById);
router.patch('/admin/:id/approve', authenticate, requireAdmin, approveBusiness);
router.patch('/admin/:id/reject', authenticate, requireAdmin, rejectBusiness);
router.patch('/admin/:id/suspend', authenticate, requireAdmin, suspendBusiness);
router.patch('/admin/:id/reactivate', authenticate, requireAdmin, reactivateBusiness);

// Business owner routes
router.post('/', authenticate, requireBusiness, createBusiness);
router.get('/my', authenticate, requireBusiness, getMyBusiness);
router.put('/:id', authenticate, requireBusiness, updateBusiness);
router.delete('/:id', authenticate, requireBusiness, deleteBusiness);

// Hours
router.get('/:id/hours', authenticate, getBusinessHours);
router.put('/:id/hours', authenticate, requireBusiness, updateBusinessHours);

// Materials
router.get('/:id/materials', authenticate, getBusinessMaterials);
router.put('/:id/materials', authenticate, requireBusiness, updateBusinessMaterials);

// Documents
router.get('/:id/documents', authenticate, getBusinessDocuments);
router.post('/:id/documents', authenticate, requireBusiness, uploadDoc.single('document'), handleMulterError, uploadDocument);
router.delete('/:id/documents/:docId', authenticate, requireBusiness, deleteDocument);

// Images
router.post('/:id/logo', authenticate, requireBusiness, uploadImage.single('logo'), handleMulterError, uploadBusinessLogo);
router.post('/:id/cover', authenticate, requireBusiness, uploadImage.single('cover'), handleMulterError, uploadBusinessCover);

module.exports = router;
