const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const { requireResident } = require('../middleware/rbac');
const {
  createCheckout,
  handleWebhook,
  getPaymentStatus,
  expirePayment,
  uploadRefundImage,
  requestRefund,
  editRefund,
  processRefund,
  cancelRefund,
  getRefunds,
} = require('../controllers/paymentController');

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

router.post('/checkout', authenticate, requireResident, createCheckout);

router.post('/webhook', handleWebhook);

router.get('/status/:orderId', authenticate, getPaymentStatus);

router.post('/expire/:id', authenticate, expirePayment);

router.post('/refund-image', authenticate, requireResident, uploadImage.single('image'), handleMulterError, uploadRefundImage);

router.post('/refund/:orderId', authenticate, requireResident, requestRefund);
router.put('/refund/:orderId', authenticate, requireResident, editRefund);

router.post('/refund/:refundId/process', authenticate, processRefund);

router.post('/refund/:refundId/cancel', authenticate, requireResident, cancelRefund);

router.get('/refunds', authenticate, getRefunds);

module.exports = router;
