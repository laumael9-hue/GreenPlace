const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireBusiness, requireResident } = require('../middleware/rbac');
const {
  checkout,
  getOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder,
  getBusinessOrders,
} = require('../controllers/orderController');

// Buyer routes (resident + admin)
router.post('/checkout', authenticate, requireResident, checkout);
router.get('/', authenticate, requireResident, getOrders);

// Business routes
router.get('/business', authenticate, requireBusiness, getBusinessOrders);

// Shared routes (buyer or business owner)
router.get('/:id', authenticate, getOrderById);
router.patch('/:id/status', authenticate, requireBusiness, updateOrderStatus);
router.post('/:id/cancel', authenticate, cancelOrder);

module.exports = router;
