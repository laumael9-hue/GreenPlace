const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireBusiness, requireResident } = require('../middleware/rbac');
const {
  checkout,
  createWalkInOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder,
  reschedulePickup,
  getBusinessOrders,
} = require('../controllers/orderController');

// Buyer routes (resident + admin)
router.post('/checkout', authenticate, requireResident, checkout);
router.get('/', authenticate, requireResident, getOrders);

// Business routes
router.post('/walk-in', authenticate, requireBusiness, createWalkInOrder);
router.get('/business', authenticate, requireBusiness, getBusinessOrders);

// Shared routes (buyer or business owner)
router.get('/:id', authenticate, getOrderById);
router.patch('/:id/status', authenticate, requireBusiness, updateOrderStatus);
router.post('/:id/cancel', authenticate, cancelOrder);
router.patch('/:id/pickup', authenticate, requireResident, reschedulePickup);

module.exports = router;
