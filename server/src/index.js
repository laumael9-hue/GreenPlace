require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

if (isProd && !process.env.CLIENT_URL) {
  throw new Error('CLIENT_URL must be set in production');
}

if (isProd) app.set('trust proxy', 1);

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(morgan(isProd ? 'combined' : 'dev'));

// Raw body for PayMongo webhook signature verification (must be before express.json)
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'GreenPlace API'
  });
});

// API routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const businessRoutes = require('./routes/business');
const marketplaceRoutes = require('./routes/marketplace');
const orderRoutes = require('./routes/orders');
const paymentRoutes = require('./routes/payments');
const dropOffRoutes = require('./routes/dropOffs');
const forumRoutes = require('./routes/forum');
const messageRoutes = require('./routes/messages');
const notificationRoutes = require('./routes/notifications');
const reviewRoutes = require('./routes/reviews');
const adminRoutes = require('./routes/admin');
const { runExpiredDeletions } = require('./controllers/userController');
// Throttle credential endpoints against brute force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later' },
});
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/businesses', businessRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/drop-offs', dropOffRoutes);
app.use('/api/forum', forumRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/admin', adminRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Anonymize accounts whose 30-day deletion grace period has ended
const DELETION_SWEEP_MS = 60 * 60 * 1000;
const sweepExpiredDeletions = async () => {
  try {
    const { processed, failed } = await runExpiredDeletions();
    if (processed || failed) {
      console.log(`Deletion sweep: ${processed} anonymized, ${failed} failed`);
    }
  } catch (err) {
    console.error('Deletion sweep error:', err);
  }
};

app.listen(PORT, () => {
  console.log(`GreenPlace API server running on port ${PORT}`);
  if (process.env.DISABLE_DELETION_SWEEP !== 'true') {
    sweepExpiredDeletions();
    setInterval(sweepExpiredDeletions, DELETION_SWEEP_MS).unref();
  }
});

module.exports = app;