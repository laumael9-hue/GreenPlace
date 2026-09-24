const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getConversations,
  getConversation,
  createConversation,
  getMessages,
  sendMessage,
  markConversationRead,
  getUnreadCount,
} = require('../controllers/messageController');

// Conversations
router.get('/conversations', authenticate, getConversations);
router.post('/conversations', authenticate, createConversation);
router.get('/conversations/:id', authenticate, getConversation);

// Messages
router.get('/conversations/:id/messages', authenticate, getMessages);
router.post('/conversations/:id/messages', authenticate, sendMessage);
router.post('/conversations/:id/read', authenticate, markConversationRead);

// Unread state
router.get('/unread-count', authenticate, getUnreadCount);

module.exports = router;
