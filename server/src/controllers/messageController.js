const { supabaseAdmin } = require('../config/supabase');
const { createNotification } = require('../services/notifications');

const MAX_BODY_LENGTH = 2000;
const PREVIEW_LENGTH = 100;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PROFILE_FIELDS = 'id, first_name, last_name, avatar_url, city, role';
const CONVERSATION_SELECT = `
  id, participant_1_id, participant_2_id, last_message_at, last_message_preview, created_at,
  p1:profiles!conversations_participant_1_id_fkey(${PROFILE_FIELDS}),
  p2:profiles!conversations_participant_2_id_fkey(${PROFILE_FIELDS})
`;

// ============================================================
// UTILITY: Canonical participant pair (matches chk_participant_order)
// ============================================================

const canonicalPair = (a, b) => (a < b ? [a, b] : [b, a]);

// ============================================================
// UTILITY: Shape a conversation row for API responses
// ============================================================

const shapeConversation = (conv, userId) => {
  const other = conv.p1?.id === userId ? conv.p2 : conv.p1;
  return {
    id: conv.id,
    last_message_at: conv.last_message_at,
    last_message_preview: conv.last_message_preview,
    created_at: conv.created_at,
    other: other || null,
    unread_count: conv.unread_count || 0,
  };
};

// ============================================================
// UTILITY: Per-conversation unread counts for the current user
// ============================================================

const fetchUnreadCounts = async (conversationIds, userId) => {
  const counts = {};
  if (!conversationIds.length) return counts;

  const { data } = await supabaseAdmin
    .from('messages')
    .select('conversation_id')
    .in('conversation_id', conversationIds)
    .eq('is_read', false)
    .neq('sender_id', userId);

  (data || []).forEach((m) => {
    counts[m.conversation_id] = (counts[m.conversation_id] || 0) + 1;
  });
  return counts;
};

// ============================================================
// UTILITY: Load a conversation and verify the user participates
// Returns { conversation, other } or { error: { status, message } }
// ============================================================

const loadConversation = async (conversationId, userId) => {
  if (!UUID_RE.test(conversationId)) {
    return { error: { status: 400, message: 'Invalid conversation id' } };
  }

  const { data: conversation, error } = await supabaseAdmin
    .from('conversations')
    .select(CONVERSATION_SELECT)
    .eq('id', conversationId)
    .single();

  if (error || !conversation) {
    return { error: { status: 404, message: 'Conversation not found' } };
  }
  if (conversation.participant_1_id !== userId && conversation.participant_2_id !== userId) {
    return { error: { status: 403, message: 'You are not a participant of this conversation' } };
  }

  const other = conversation.p1?.id === userId ? conversation.p2 : conversation.p1;
  return { conversation, other };
};

// ============================================================
// LIST: Conversations for the current user
// ============================================================

const getConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
    const offset = (page - 1) * limit;

    const { data, count, error } = await supabaseAdmin
      .from('conversations')
      .select(CONVERSATION_SELECT, { count: 'exact' })
      .or(`participant_1_id.eq.${userId},participant_2_id.eq.${userId}`)
      .order('last_message_at', { ascending: false, nullsFirst: true })
      .range(offset, offset + limit - 1);

    if (error) return res.status(400).json({ error: error.message });

    const rows = data || [];
    const unread = await fetchUnreadCounts(rows.map((c) => c.id), userId);

    res.json({
      conversations: rows.map((c) => shapeConversation({ ...c, unread_count: unread[c.id] || 0 }, userId)),
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (err) {
    console.error('Get conversations error:', err);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
};

// ============================================================
// GET: Single conversation (with unread count)
// ============================================================

const getConversation = async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversation, other, error } = await loadConversation(req.params.id, userId);
    if (error) return res.status(error.status).json({ error: error.message });

    const unread = await fetchUnreadCounts([conversation.id], userId);

    res.json({
      conversation: shapeConversation({
        ...conversation,
        unread_count: unread[conversation.id] || 0,
      }, userId),
      other,
    });
  } catch (err) {
    console.error('Get conversation error:', err);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
};

// ============================================================
// CREATE: Find or start a conversation
// Body: { recipientId } or { businessId }
// ============================================================

const createConversation = async (req, res) => {
  try {
    const userId = req.user.id;
    let { recipientId, businessId } = req.body || {};

    if (businessId) {
      if (!UUID_RE.test(businessId)) {
        return res.status(400).json({ error: 'Invalid business id' });
      }
      const { data: business } = await supabaseAdmin
        .from('businesses')
        .select('id, owner_id, name')
        .eq('id', businessId)
        .is('deleted_at', null)
        .single();

      if (!business) return res.status(404).json({ error: 'Business not found' });
      if (!business.owner_id) return res.status(400).json({ error: 'This business has no owner to message' });
      recipientId = business.owner_id;
    }

    if (!recipientId) return res.status(400).json({ error: 'Recipient is required' });
    if (!UUID_RE.test(recipientId)) return res.status(400).json({ error: 'Invalid recipient id' });
    if (recipientId === userId) return res.status(400).json({ error: 'You cannot message yourself' });

    const { data: recipient } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', recipientId)
      .single();

    if (!recipient) return res.status(404).json({ error: 'Recipient not found' });

    const [p1, p2] = canonicalPair(userId, recipientId);

    const { data: existing } = await supabaseAdmin
      .from('conversations')
      .select(CONVERSATION_SELECT)
      .eq('participant_1_id', p1)
      .eq('participant_2_id', p2)
      .maybeSingle();

    if (existing) {
      const unread = await fetchUnreadCounts([existing.id], userId);
      return res.json({
        conversation: shapeConversation({ ...existing, unread_count: unread[existing.id] || 0 }, userId),
      });
    }

    const { data: created, error: insertError } = await supabaseAdmin
      .from('conversations')
      .insert({ participant_1_id: p1, participant_2_id: p2 })
      .select(CONVERSATION_SELECT)
      .single();

    if (insertError || !created) {
      // Unique violation from a concurrent insert — fall back to the existing row
      const { data: raced } = await supabaseAdmin
        .from('conversations')
        .select(CONVERSATION_SELECT)
        .eq('participant_1_id', p1)
        .eq('participant_2_id', p2)
        .maybeSingle();

      if (raced) {
        return res.json({ conversation: shapeConversation({ ...raced, unread_count: 0 }, userId) });
      }
      console.error('Create conversation error:', insertError);
      return res.status(400).json({ error: 'Failed to start conversation' });
    }

    res.status(201).json({ conversation: shapeConversation({ ...created, unread_count: 0 }, userId) });
  } catch (err) {
    console.error('Create conversation error:', err);
    res.status(500).json({ error: 'Failed to start conversation' });
  }
};

// ============================================================
// LIST: Messages in a conversation (newest page first)
// ============================================================

const getMessages = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
    const offset = (page - 1) * limit;

    const { conversation, error } = await loadConversation(req.params.id, userId);
    if (error) return res.status(error.status).json({ error: error.message });

    // Incremental poll: return only messages newer than `after` (ISO timestamp)
    if (req.query.after !== undefined) {
      const after = req.query.after;
      if (!after || Number.isNaN(Date.parse(after))) {
        return res.status(400).json({ error: 'Invalid after timestamp' });
      }
      const { data, error: pollError } = await supabaseAdmin
        .from('messages')
        .select('id, conversation_id, sender_id, body, is_read, read_at, created_at')
        .eq('conversation_id', conversation.id)
        .gt('created_at', after)
        .order('created_at', { ascending: true });

      if (pollError) return res.status(400).json({ error: pollError.message });
      return res.json({ messages: data || [] });
    }

    const { data, count, error: msgError } = await supabaseAdmin
      .from('messages')
      .select('id, conversation_id, sender_id, body, is_read, read_at, created_at', { count: 'exact' })
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (msgError) return res.status(400).json({ error: msgError.message });

    // Return ascending (oldest first) so clients can render top-to-bottom;
    // page 1 is the newest window, older pages prepend.
    const messages = [...(data || [])].reverse();

    res.json({
      messages,
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
};

// ============================================================
// SEND: Add a message and update conversation preview
// ============================================================

const sendMessage = async (req, res) => {
  try {
    const userId = req.user.id;
    const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';

    if (!body) return res.status(400).json({ error: 'Message body is required' });
    if (body.length > MAX_BODY_LENGTH) {
      return res.status(400).json({ error: `Message must be ${MAX_BODY_LENGTH} characters or fewer` });
    }

    const { conversation, other, error } = await loadConversation(req.params.id, userId);
    if (error) return res.status(error.status).json({ error: error.message });

    // Only notify when this is the first unread message from this sender
    let hasPriorUnread = false;
    if (other?.id) {
      const unreadCounts = await fetchUnreadCounts([conversation.id], userId);
      hasPriorUnread = (unreadCounts[conversation.id] || 0) > 0;
    }

    const { data: message, error: insertError } = await supabaseAdmin
      .from('messages')
      .insert({ conversation_id: conversation.id, sender_id: userId, body })
      .select('id, conversation_id, sender_id, body, is_read, read_at, created_at')
      .single();

    if (insertError || !message) {
      console.error('Send message error:', insertError);
      return res.status(400).json({ error: 'Failed to send message' });
    }

    await supabaseAdmin
      .from('conversations')
      .update({
        last_message_at: message.created_at,
        last_message_preview: body.slice(0, PREVIEW_LENGTH),
      })
      .eq('id', conversation.id);

    if (other?.id && other.id !== userId && !hasPriorUnread) {
      const senderName = req.user.profile?.first_name || 'Someone';
      await createNotification({
        userId: other.id,
        type: 'message',
        title: `New message from ${senderName}`,
        body: body.slice(0, PREVIEW_LENGTH),
        data: { link: `/dashboard/messages/${conversation.id}` },
      });
    }

    res.status(201).json({ message });
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
};

// ============================================================
// READ: Mark messages from the other participant as read
// ============================================================

const markConversationRead = async (req, res) => {
  try {
    const userId = req.user.id;

    const { conversation, error } = await loadConversation(req.params.id, userId);
    if (error) return res.status(error.status).json({ error: error.message });

    const { error: updateError } = await supabaseAdmin
      .from('messages')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('conversation_id', conversation.id)
      .neq('sender_id', userId)
      .eq('is_read', false);

    if (updateError) {
      console.error('Mark read error:', updateError);
      return res.status(400).json({ error: 'Failed to mark conversation as read' });
    }

    res.json({ message: 'Conversation marked as read' });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ error: 'Failed to mark conversation as read' });
  }
};

// ============================================================
// UNREAD: Total unread messages across my conversations
// ============================================================

const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: conversations } = await supabaseAdmin
      .from('conversations')
      .select('id')
      .or(`participant_1_id.eq.${userId},participant_2_id.eq.${userId}`);

    const ids = (conversations || []).map((c) => c.id);
    if (!ids.length) return res.json({ count: 0 });

    const { count, error } = await supabaseAdmin
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .in('conversation_id', ids)
      .eq('is_read', false)
      .neq('sender_id', userId);

    if (error) return res.status(400).json({ error: error.message });

    res.json({ count: count || 0 });
  } catch (err) {
    console.error('Get unread count error:', err);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
};

module.exports = {
  getConversations,
  getConversation,
  createConversation,
  getMessages,
  sendMessage,
  markConversationRead,
  getUnreadCount,
};
