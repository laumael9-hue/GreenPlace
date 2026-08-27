const express = require('express');
const multer = require('multer');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/rbac');
const {
  getAllUsers,
  getUserById,
  toggleUserActive,
  updateUserRole,
  deleteUser,
  selfDeleteAccount,
  reactivateDeletedAccount,
  processExpiredDeletions,
  getDeletionDependencies,
  uploadAvatar,
  removeAvatar,
  getUserStats,
} = require('../controllers/userController');

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

const upload = multer({
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
      return res.status(400).json({ error: 'File is too large. Max 5MB.' });
    }
    return res.status(400).json({ error: err.message || 'File upload error' });
  }
  if (err) {
    return res.status(400).json({ error: err.message || 'File upload failed' });
  }
  next();
};

router.get('/stats', authenticate, requireAdmin, getUserStats);
router.get('/', authenticate, requireAdmin, getAllUsers);
router.get('/:id', authenticate, requireAdmin, getUserById);
router.get('/:id/dependencies', authenticate, requireAdmin, getDeletionDependencies);
router.patch('/:id/toggle-active', authenticate, requireAdmin, toggleUserActive);
router.patch('/:id/role', authenticate, requireAdmin, updateUserRole);
router.patch('/:id/reactivate', authenticate, requireAdmin, reactivateDeletedAccount);
router.delete('/:id', authenticate, requireAdmin, deleteUser);

router.post('/avatar', authenticate, upload.single('avatar'), handleMulterError, uploadAvatar);
router.delete('/avatar', authenticate, removeAvatar);

router.post('/self-delete', authenticate, selfDeleteAccount);
router.post('/process-expired-deletions', authenticate, requireAdmin, processExpiredDeletions);

module.exports = router;
