const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/rbac');
const {
  uploadForumImage,
  getThreads,
  getThreadBySlug,
  createThread,
  updateThread,
  deleteThread,
  createPost,
  updatePost,
  deletePost,
  toggleReaction,
  toggleBookmark,
  getBookmarkedThreads,
  searchForum,
  reportContent,
  moderateThread,
  moderatePost,
  getReports,
  resolveReport,
} = require('../controllers/forumController');

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'));
    }
  },
});

const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size must be less than 5MB' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message || 'File upload failed' });
  }
  next();
};

// Public routes
router.get('/threads', getThreads);
router.get('/threads/:slug', optionalAuth, getThreadBySlug);
router.get('/search', searchForum);

// Authenticated routes
router.post('/upload-image', authenticate, uploadImage.single('image'), handleMulterError, uploadForumImage);
router.post('/threads', authenticate, createThread);
router.put('/threads/:id', authenticate, updateThread);
router.delete('/threads/:id', authenticate, deleteThread);
router.post('/threads/:id/posts', authenticate, createPost);
router.put('/posts/:id', authenticate, updatePost);
router.delete('/posts/:id', authenticate, deletePost);
router.post('/posts/:id/reaction', authenticate, toggleReaction);
router.post('/threads/:id/bookmark', authenticate, toggleBookmark);
router.get('/bookmarks', authenticate, getBookmarkedThreads);
router.post('/report', authenticate, reportContent);

// Admin moderation
router.put('/threads/:id/moderate', authenticate, requireAdmin, moderateThread);
router.put('/posts/:id/moderate', authenticate, requireAdmin, moderatePost);
router.get('/admin/reports', authenticate, requireAdmin, getReports);
router.put('/admin/reports/:id', authenticate, requireAdmin, resolveReport);

module.exports = router;
