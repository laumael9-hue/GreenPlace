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

const requireResident = requireRole('resident', 'admin');

module.exports = { requireRole, requireAdmin, requireBusiness, requireResident };
