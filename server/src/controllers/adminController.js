const { supabaseAdmin } = require('../config/supabase');

// ============================================================
// Constants & helpers
// ============================================================

// Whitelisted system_settings keys with their expected types.
// Anything not listed here can never be written via the API.
const SETTING_TYPES = {
  site_name: 'string',
  site_tagline: 'string',
  default_currency: 'string',
  max_upload_size_mb: 'int',
  business_auto_approve: 'bool',
  maintenance_mode: 'bool',
  min_drop_off_weight_kg: 'int',
  forum_max_posts_per_day: 'int',
  listing_max_images: 'int',
  review_min_length: 'int',
  notification_retention_days: 'int',
  paymongo_test_mode: 'bool',
};

const coerceValue = (raw, type) => {
  if (type === 'int') {
    const parsed = parseInt(String(raw).trim(), 10);
    if (!Number.isInteger(parsed) || parsed < 0) return { ok: false };
    return { ok: true, value: String(parsed) };
  }
  if (type === 'bool') {
    const normalized = String(raw).trim().toLowerCase();
    if (!['true', 'false'].includes(normalized)) return { ok: false };
    return { ok: true, value: normalized };
  }
  const value = String(raw).trim();
  if (!value) return { ok: false };
  return { ok: true, value };
};

const logAuditAction = async (adminId, action, details = {}) => {
  try {
    await supabaseAdmin.from('admin_audit_log').insert({
      admin_id: adminId,
      action,
      target_type: 'system',
      details,
    });
  } catch (err) {
    console.error('Audit log error:', err);
  }
};

// Count helper: returns 0 on any failure so one bad stat never breaks the dashboard
const countRows = async (table, filters = []) => {
  try {
    let query = supabaseAdmin.from(table).select('*', { count: 'exact', head: true });
    filters.forEach(([op, ...args]) => {
      query = query[op](...args);
    });
    const { count, error } = await query;
    if (error) return 0;
    return count || 0;
  } catch {
    return 0;
  }
};

const countsByStatus = async (table, column) => {
  try {
    const { data, error } = await supabaseAdmin.from(table).select(column);
    if (error || !data) return {};
    return data.reduce((acc, row) => {
      const key = row[column] || 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  } catch {
    return {};
  }
};

// ============================================================
// PLATFORM STATISTICS
// ============================================================

const getPlatformStats = async (req, res) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [
      totalUsers, activeUsers, pendingDeletionUsers,
      residents, businesses, admins,
      businessStatus, listingStatus, orderStatus, dropOffStatus,
      totalThreads, totalPosts,
      pendingReports, pendingDocuments, pendingRefunds,
      ordersLast30Days,
    ] = await Promise.all([
      countRows('profiles'),
      countRows('profiles', [['eq', 'is_active', true]]),
      countRows('profiles', [['not', 'pending_deletion_at', 'is', null]]),
      countRows('profiles', [['eq', 'role', 'resident']]),
      countRows('profiles', [['eq', 'role', 'business']]),
      countRows('profiles', [['eq', 'role', 'admin']]),
      countsByStatus('businesses', 'status'),
      countsByStatus('listings', 'status'),
      countsByStatus('orders', 'status'),
      countsByStatus('drop_offs', 'status'),
      countRows('forum_threads'),
      countRows('forum_posts'),
      countRows('reports', [['eq', 'status', 'pending']]),
      countRows('business_documents', [['eq', 'verification_status', 'pending']]),
      countRows('refunds', [['eq', 'status', 'pending']]),
      countRows('orders', [['gte', 'created_at', thirtyDaysAgo]]),
    ]);

    res.json({
      stats: {
        users: {
          total: totalUsers,
          active: activeUsers,
          inactive: totalUsers - activeUsers,
          pendingDeletion: pendingDeletionUsers,
          byRole: { residents, businesses, admins },
        },
        businesses: {
          total: Object.values(businessStatus).reduce((a, b) => a + b, 0),
          byStatus: {
            pending: businessStatus.pending || 0,
            approved: businessStatus.approved || 0,
            rejected: businessStatus.rejected || 0,
            suspended: businessStatus.suspended || 0,
          },
        },
        listings: {
          total: Object.values(listingStatus).reduce((a, b) => a + b, 0),
          byStatus: listingStatus,
        },
        orders: {
          total: Object.values(orderStatus).reduce((a, b) => a + b, 0),
          last30Days: ordersLast30Days,
          byStatus: orderStatus,
        },
        dropOffs: {
          total: Object.values(dropOffStatus).reduce((a, b) => a + b, 0),
          byStatus: dropOffStatus,
        },
        forum: { threads: totalThreads, posts: totalPosts },
        queues: {
          pendingReports,
          pendingDocuments,
          pendingRefunds,
          pendingBusinesses: businessStatus.pending || 0,
        },
      },
    });
  } catch (err) {
    console.error('Get platform stats error:', err);
    res.status(500).json({ error: 'Failed to fetch platform statistics' });
  }
};

// ============================================================
// SYSTEM SETTINGS
// ============================================================

const getSettings = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .select('key, value, description, updated_by, updated_at')
      .order('key');

    if (error) {
      console.error('Get settings error:', error);
      return res.status(400).json({ error: error.message });
    }

    res.json({ settings: data || [] });
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
};

const updateSettings = async (req, res) => {
  try {
    const { settings } = req.body || {};

    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      return res.status(400).json({ error: 'Settings object is required' });
    }

    const unknownKeys = Object.keys(settings).filter((key) => !(key in SETTING_TYPES));
    if (unknownKeys.length > 0) {
      return res.status(400).json({ error: `Unknown settings: ${unknownKeys.join(', ')}` });
    }

    const updates = {};
    for (const [key, rawValue] of Object.entries(settings)) {
      const result = coerceValue(rawValue, SETTING_TYPES[key]);
      if (!result.ok) {
        return res.status(400).json({ error: `Invalid value for "${key}"` });
      }
      updates[key] = result.value;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No settings to update' });
    }

    const rows = Object.entries(updates).map(([key, value]) => ({
      key,
      value,
      updated_by: req.user.id,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabaseAdmin
      .from('system_settings')
      .upsert(rows, { onConflict: 'key' });

    if (error) {
      console.error('Update settings error:', error);
      return res.status(400).json({ error: error.message });
    }

    await logAuditAction(req.user.id, 'update_settings', { updated: Object.keys(updates) });

    res.json({ message: 'Settings updated successfully' });
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
};

module.exports = {
  getPlatformStats,
  getSettings,
  updateSettings,
};
