const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.profile) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.profile.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: roles,
        current: req.user.profile.role,
      });
    }

    next();
  };
};

const requireAdmin = requireRole('admin');

const requireBusiness = requireRole('business', 'admin');

// Business accounts keep resident capabilities (layered model):
// shopping, checkout, order history and drop-offs stay available after conversion.
const requireResident = requireRole('resident', 'business', 'admin');

// Owner-scoped business routes: any account may touch its own business record
// (including residents with a pending/rejected application).
// Controllers enforce ownership via owner_id checks.
const requireBusinessOwner = requireRole('resident', 'business', 'admin');

module.exports = {
  requireRole,
  requireAdmin,
  requireBusiness,
  requireResident,
  requireBusinessOwner,
};
