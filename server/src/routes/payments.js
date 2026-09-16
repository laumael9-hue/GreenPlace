const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireResident } = require('../middleware/rbac');
const {
  createCheckout,
  handleWebhook,
  getPaymentStatus,
  expirePayment,
} = require('../controllers/paymentController');

router.post('/checkout', authenticate, requireResident, createCheckout);

router.post('/webhook', handleWebhook);

router.get('/status/:orderId', authenticate, getPaymentStatus);

router.post('/expire/:id', authenticate, expirePayment);

module.exports = router;
