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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
});

router.get('/stats', authenticate, requireAdmin, getUserStats);
router.get('/', authenticate, requireAdmin, getAllUsers);
router.get('/:id', authenticate, requireAdmin, getUserById);
router.get('/:id/dependencies', authenticate, requireAdmin, getDeletionDependencies);
router.patch('/:id/toggle-active', authenticate, requireAdmin, toggleUserActive);
router.patch('/:id/role', authenticate, requireAdmin, updateUserRole);
router.patch('/:id/reactivate', authenticate, requireAdmin, reactivateDeletedAccount);
router.delete('/:id', authenticate, requireAdmin, deleteUser);

router.post('/avatar', authenticate, upload.single('avatar'), uploadAvatar);
router.delete('/avatar', authenticate, removeAvatar);

router.post('/self-delete', authenticate, selfDeleteAccount);
router.post('/process-expired-deletions', authenticate, requireAdmin, processExpiredDeletions);

module.exports = router;
