const express = require('express');
const multer = require('multer');
const router = express.Router();
const { authenticate, optionalAuth } = require('../middleware/auth');
const { requireBusiness, requireResident } = require('../middleware/rbac');
const {
  getCategories,
  getCategoryBySlug,
  getListings,
  getListingBySlug,
  getListingById,
  createListing,
  updateListing,
  deleteListing,
  publishListing,
  getMyListings,
  uploadListingImage,
  deleteListingImage,
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  getCartCount,
} = require('../controllers/marketplaceController');

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

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
      return res.status(400).json({ error: 'File is too large. Max 5MB.' });
    }
    return res.status(400).json({ error: err.message || 'File upload error' });
  }
  if (err) {
    return res.status(400).json({ error: err.message || 'File upload failed' });
  }
  next();
};

// Public routes
router.get('/categories', getCategories);
router.get('/categories/:slug', getCategoryBySlug);
router.get('/listings', getListings);
router.get('/listings/slug/:slug', optionalAuth, getListingBySlug);
router.get('/listings/:id', optionalAuth, getListingById);

// Seller routes (business users)
router.post('/listings', authenticate, requireBusiness, createListing);
router.put('/listings/:id', authenticate, updateListing);
router.delete('/listings/:id', authenticate, deleteListing);
router.patch('/listings/:id/publish', authenticate, publishListing);
router.get('/my-listings', authenticate, getMyListings);

// Listing images
router.post('/listings/:id/images', authenticate, uploadImage.single('image'), handleMulterError, uploadListingImage);
router.delete('/listings/:id/images/:imageId', authenticate, deleteListingImage);

// Cart routes (authenticated users)
router.get('/cart', authenticate, getCart);
router.post('/cart', authenticate, addToCart);
router.patch('/cart/:id', authenticate, updateCartItem);
router.delete('/cart/:id', authenticate, removeFromCart);
router.delete('/cart', authenticate, clearCart);
router.get('/cart/count', authenticate, getCartCount);

module.exports = router;
