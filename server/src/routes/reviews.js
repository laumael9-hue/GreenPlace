const express = require('express');
const router = express.Router();
const { authenticate, optionalAuth } = require('../middleware/auth');
const { requireBusiness } = require('../middleware/rbac');
const {
  getBusinessReviews,
  getListingReviews,
  getMyBusinessReviews,
  getMyListingReviews,
  getMyReviews,
  checkMyReview,
  createReview,
  updateReview,
  deleteReview,
  replyToReview,
} = require('../controllers/reviewController');

// Public routes
router.get('/business/:businessId', optionalAuth, getBusinessReviews);
router.get('/listing/:listingId', optionalAuth, getListingReviews);
router.get('/check', optionalAuth, checkMyReview);

// Authenticated routes
router.get('/my', authenticate, getMyReviews);
router.post('/', authenticate, createReview);
router.patch('/:id', authenticate, updateReview);
router.delete('/:id', authenticate, deleteReview);
router.post('/:id/reply', authenticate, replyToReview);

// Seller routes
router.get('/for-my-business', authenticate, requireBusiness, getMyBusinessReviews);
router.get('/for-my-listings', authenticate, getMyListingReviews);

module.exports = router;
