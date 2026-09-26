const { supabaseAdmin } = require('../config/supabase');
const { attachNotificationImages } = require('../services/notifications');

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ============================================================
// LIST: Current user's notifications (newest first)
// ============================================================

const getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT));
    const unreadOnly = req.query.unread === 'true';
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('notifications')
      .select('id, type, title, body, data, is_read, read_at, created_at', { count: 'exact' })
      .eq('user_id', userId);

    if (unreadOnly) query = query.eq('is_read', false);

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Get notifications error:', error);
      return res.status(500).json({ error: 'Failed to load notifications' });
    }

    const notifications = await attachNotificationImages(data || []);

    res.json({
      notifications,
      pagination: { page, limit, total: count || 0, pages: Math.ceil((count || 0) / limit) },
    });
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ error: 'Failed to load notifications' });
  }
};

// ============================================================
// UNREAD COUNT
// ============================================================

const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;

    const { count, error } = await supabaseAdmin
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      console.error('Unread count error:', error);
      return res.status(500).json({ error: 'Failed to load unread count' });
    }

    res.json({ count: count || 0 });
  } catch (err) {
    console.error('Unread count error:', err);
    res.status(500).json({ error: 'Failed to load unread count' });
  }
};

// ============================================================
// MARK ONE AS READ
// ============================================================

const markAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    if (!UUID_RE.test(id)) return res.status(400).json({ error: 'Invalid notification id' });

    const { data: notification } = await supabaseAdmin
      .from('notifications')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!notification) return res.status(404).json({ error: 'Notification not found' });

    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      console.error('Mark notification read error:', error);
      return res.status(400).json({ error: 'Failed to update notification' });
    }

    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    console.error('Mark notification read error:', err);
    res.status(500).json({ error: 'Failed to update notification' });
  }
};

// ============================================================
// MARK ALL AS READ
// ============================================================

const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      console.error('Mark all read error:', error);
      return res.status(400).json({ error: 'Failed to update notifications' });
    }

    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error('Mark all read error:', err);
    res.status(500).json({ error: 'Failed to update notifications' });
  }
};

// ============================================================
// DELETE
// ============================================================

const deleteNotification = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    if (!UUID_RE.test(id)) return res.status(400).json({ error: 'Invalid notification id' });

    const { data: notification } = await supabaseAdmin
      .from('notifications')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!notification) return res.status(404).json({ error: 'Notification not found' });

    const { error } = await supabaseAdmin
      .from('notifications')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('Delete notification error:', error);
      return res.status(400).json({ error: 'Failed to delete notification' });
    }

    res.json({ message: 'Notification deleted' });
  } catch (err) {
    console.error('Delete notification error:', err);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};
