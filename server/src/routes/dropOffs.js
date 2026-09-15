const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireBusiness, requireResident } = require('../middleware/rbac');
const {
  createDropOff,
  getBusinessDropOffs,
  getMyDropOffs,
  getDropOffById,
  completeDropOff,
  cancelDropOff,
  getBusinessMaterials,
} = require('../controllers/dropOffController');

// Business routes
router.post('/', authenticate, requireBusiness, createDropOff);
router.get('/business', authenticate, requireBusiness, getBusinessDropOffs);
router.get('/materials', authenticate, requireBusiness, getBusinessMaterials);
router.patch('/:id/complete', authenticate, requireBusiness, completeDropOff);
router.patch('/:id/cancel', authenticate, requireBusiness, cancelDropOff);

// Resident routes
router.get('/my', authenticate, requireResident, getMyDropOffs);

// Shared (business owner or resident)
router.get('/:id', authenticate, getDropOffById);

module.exports = router;
