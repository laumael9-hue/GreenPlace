const express = require('express');
const router = express.Router();
const { authenticate, optionalAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/rbac');
const {
  getCategories,
  getCategoryBySlug,
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

// Public routes
router.get('/categories', getCategories);
router.get('/categories/:slug', getCategoryBySlug);
router.get('/threads', getThreads);
router.get('/threads/:slug', optionalAuth, getThreadBySlug);
router.get('/search', searchForum);

// Authenticated routes
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
