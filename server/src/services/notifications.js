const { supabaseAdmin } = require('../config/supabase');

const NOTIFICATION_TYPES = ['order', 'message', 'drop_off', 'forum', 'review', 'system', 'business'];

// Fire-and-forget: a notification failure must never break the main flow
const createNotification = async ({ userId, type, title, body, data = null }) => {
  try {
    if (!userId || !title || !body) return;

    await supabaseAdmin.from('notifications').insert({
      user_id: userId,
      type: NOTIFICATION_TYPES.includes(type) ? type : 'system',
      title,
      body,
      data,
    });
  } catch (err) {
    console.error('Notification error:', err);
  }
};

module.exports = { createNotification };
