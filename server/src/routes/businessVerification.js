const express = require('express');
const multer = require('multer');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireBusinessOwner } = require('../middleware/rbac');
const {
  getMyDocuments,
  uploadMyDocument,
  submitForReview,
} = require('../controllers/businessVerificationController');
const { ALLOWED_MIME_TYPES, MAX_DOC_BYTES } = require('../services/businessVerification');

const uploadDoc = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_DOC_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type "${file.mimetype}" is not allowed. Accepted: PDF, JPG, PNG.`));
    }
  },
});

const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File is too large. The maximum size is 5 MB.' });
    }
    return res.status(400).json({ error: err.message || 'File upload error' });
  }
  if (err) {
    return res.status(400).json({ error: err.message || 'File upload failed' });
  }
  next();
};

// Owner-scoped: the business is resolved from the signed-in user, never from the request
router.get('/documents', authenticate, requireBusinessOwner, getMyDocuments);
router.post('/documents', authenticate, requireBusinessOwner, uploadDoc.single('file'), handleMulterError, uploadMyDocument);
router.post('/submit-for-review', authenticate, requireBusinessOwner, submitForReview);

module.exports = router;
