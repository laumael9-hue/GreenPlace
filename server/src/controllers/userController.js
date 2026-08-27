const { supabase, supabaseAdmin } = require('../config/supabase');

const BUCKET = 'profile-images';
const GRACE_PERIOD_DAYS = 30;

const logAuditAction = async (adminId, action, targetId, details = {}) => {
  try {
    await supabaseAdmin.from('admin_audit_log').insert({
      admin_id: adminId,
      action,
      target_id: targetId,
      target_type: 'user',
      details,
    });
  } catch (err) {
    console.error('Audit log error:', err);
  }
};

const revokeAllSessions = async (userId) => {
  try {
    await supabaseAdmin.auth.admin.signOut(userId, 'global');
  } catch (err) {
    console.error('Session revocation error:', err);
  }
};

const anonymizeUser = async (userId, performedBy = null) => {
  const anonymizedEmail = `deleted-${userId.toString().slice(0, 8)}@deleted.local`;

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      first_name: 'DELETED',
      last_name: 'USER',
      phone: null,
      avatar_url: null,
      address: null,
      bio: null,
      deleted_at: new Date().toISOString(),
      deleted_by: performedBy,
      is_active: false,
      email_verified: false,
    })
    .eq('id', userId);

  if (error) {
    throw error;
  }

  try {
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      email: anonymizedEmail,
      password: require('crypto').randomBytes(32).toString('hex'),
      email_confirm: true,
      user_metadata: {},
    });
  } catch (err) {
    console.error('Auth user anonymization error (non-blocking):', err);
  }
};

const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', role = '', sort = 'created_at', order = 'desc' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact' })
      .is('deleted_at', null);

    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    if (role) {
      query = query.eq('role', role);
    }

    const { data: users, count, error } = await query
      .order(sort, { ascending: order === 'asc' })
      .range(offset, offset + parseInt(limit) - 1);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('Get all users error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !profile) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(id);

    res.json({
      user: {
        ...profile,
        email: profile.deleted_at ? '[redacted]' : (authUser?.user?.email || ''),
      },
    });
  } catch (err) {
    console.error('Get user by id error:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};

const toggleUserActive = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};

    const { data: profile, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('is_active, deleted_at, pending_deletion_at')
      .eq('id', id)
      .single();

    if (fetchError || !profile) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (profile.deleted_at) {
      return res.status(400).json({ error: 'Cannot modify a deleted account' });
    }

    if (profile.pending_deletion_at) {
      return res.status(400).json({ error: 'Cannot modify an account pending deletion. Reactivate it first.' });
    }

    const newStatus = !profile.is_active;

    const updateData = { is_active: newStatus };
    if (!newStatus) {
      updateData.suspension_reason = reason || null;
      updateData.suspended_at = new Date().toISOString();
      updateData.suspended_by = req.user.id;
    } else {
      updateData.suspension_reason = null;
      updateData.suspended_at = null;
      updateData.suspended_by = null;
    }

    const { data: updated, error } = await supabaseAdmin
      .from('profiles')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (!newStatus) {
      await revokeAllSessions(id);
    }

    await logAuditAction(req.user.id, newStatus ? 'activate_user' : 'deactivate_user', id, {
      reason: reason || null,
    });

    res.json({
      message: `User ${newStatus ? 'activated' : 'deactivated'} successfully`,
      user: updated,
    });
  } catch (err) {
    console.error('Toggle user active error:', err);
    res.status(500).json({ error: 'Failed to update user status' });
  }
};

const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role || !['resident', 'business', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be resident, business, or admin' });
    }

    if (id === req.user.id) {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }

    const { data: existing } = await supabaseAdmin
      .from('profiles')
      .select('deleted_at, pending_deletion_at')
      .eq('id', id)
      .single();

    if (existing?.deleted_at) {
      return res.status(400).json({ error: 'Cannot modify a deleted account' });
    }

    if (existing?.pending_deletion_at) {
      return res.status(400).json({ error: 'Cannot modify an account pending deletion' });
    }

    const { data: updated, error } = await supabaseAdmin
      .from('profiles')
      .update({ role })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    await logAuditAction(req.user.id, 'change_role', id, { new_role: role });

    res.json({
      message: 'Role updated successfully',
      user: updated,
    });
  } catch (err) {
    console.error('Update user role error:', err);
    res.status(500).json({ error: 'Failed to update user role' });
  }
};

const checkDeletionDependencies = async (userId) => {
  const deps = { orders: 0, dropOffs: 0, listings: 0, forumThreads: 0, forumPosts: 0 };

  const { count: orders } = await supabaseAdmin
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('buyer_id', userId)
    .in('status', ['pending', 'confirmed', 'processing']);

  const { count: dropOffs } = await supabaseAdmin
    .from('drop_offs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('status', ['scheduled', 'in_transit']);

  const { count: listings } = await supabaseAdmin
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('seller_id', userId)
    .eq('status', 'active');

  const { count: forumThreads } = await supabaseAdmin
    .from('forum_threads')
    .select('*', { count: 'exact', head: true })
    .eq('author_id', userId);

  const { count: forumPosts } = await supabaseAdmin
    .from('forum_posts')
    .select('*', { count: 'exact', head: true })
    .eq('author_id', userId);

  deps.orders = orders || 0;
  deps.dropOffs = dropOffs || 0;
  deps.listings = listings || 0;
  deps.forumThreads = forumThreads || 0;
  deps.forumPosts = forumPosts || 0;

  return deps;
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { immediate } = req.body || {};

    if (id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('deleted_at, pending_deletion_at')
      .eq('id', id)
      .single();

    if (!profile) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (profile.deleted_at) {
      return res.status(400).json({ error: 'Account is already deleted' });
    }

    if (immediate) {
      const deps = await checkDeletionDependencies(id);

      if (Object.values(deps).some(v => v > 0)) {
        await supabaseAdmin
          .from('orders')
          .update({ status: 'cancelled' })
          .eq('buyer_id', id)
          .in('status', ['pending', 'confirmed', 'processing']);

        await supabaseAdmin
          .from('drop_offs')
          .update({ status: 'cancelled' })
          .eq('user_id', id)
          .in('status', ['scheduled', 'in_transit']);

        await supabaseAdmin
          .from('listings')
          .update({ status: 'archived' })
          .eq('seller_id', id)
          .eq('status', 'active');
      }

      await revokeAllSessions(id);
      await anonymizeUser(id, req.user.id);

      await logAuditAction(req.user.id, 'delete_user_immediate', id, {
        dependencies: deps,
      });

      return res.json({
        message: 'User permanently deleted',
        immediate: true,
        dependencies: deps,
      });
    }

    await supabaseAdmin
      .from('profiles')
      .update({
        pending_deletion_at: new Date().toISOString(),
        is_active: false,
      })
      .eq('id', id);

    await revokeAllSessions(id);

    await logAuditAction(req.user.id, 'delete_user_pending', id, {
      grace_period_days: GRACE_PERIOD_DAYS,
    });

    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + GRACE_PERIOD_DAYS);

    res.json({
      message: `Account scheduled for deletion. Will be permanently deleted on ${deletionDate.toLocaleDateString()}. Contact support to reverse.`,
      immediate: false,
      pending_deletion_at: new Date().toISOString(),
      deletion_date: deletionDate.toISOString(),
      grace_period_days: GRACE_PERIOD_DAYS,
    });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

const selfDeleteAccount = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('deleted_at, pending_deletion_at')
      .eq('id', userId)
      .single();

    if (profile?.deleted_at) {
      return res.status(400).json({ error: 'Account is already deleted' });
    }

    if (profile?.pending_deletion_at) {
      return res.status(400).json({ error: 'Account is already pending deletion. Contact support to reverse.' });
    }

    await supabaseAdmin
      .from('profiles')
      .update({
        pending_deletion_at: new Date().toISOString(),
        is_active: false,
      })
      .eq('id', userId);

    await revokeAllSessions(userId);

    await logAuditAction(userId, 'self_delete_pending', userId, {
      grace_period_days: GRACE_PERIOD_DAYS,
    });

    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + GRACE_PERIOD_DAYS);

    res.json({
      message: `Account scheduled for deletion. You have ${GRACE_PERIOD_DAYS} days to contact support to reverse this. After that, your data will be permanently anonymized.`,
      pending_deletion_at: new Date().toISOString(),
      deletion_date: deletionDate.toISOString(),
      grace_period_days: GRACE_PERIOD_DAYS,
    });
  } catch (err) {
    console.error('Self delete error:', err);
    res.status(500).json({ error: 'Failed to delete account' });
  }
};

const reactivateDeletedAccount = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('deleted_at, pending_deletion_at')
      .eq('id', id)
      .single();

    if (!profile) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (profile.deleted_at) {
      return res.status(400).json({ error: 'Account is already permanently deleted and anonymized. Cannot reactivate.' });
    }

    if (!profile.pending_deletion_at) {
      return res.status(400).json({ error: 'Account is not pending deletion' });
    }

    const { data: updated, error } = await supabaseAdmin
      .from('profiles')
      .update({
        pending_deletion_at: null,
        is_active: true,
        suspension_reason: null,
        suspended_at: null,
        suspended_by: null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    await logAuditAction(req.user.id, 'reactivate_deleted_account', id, {});

    res.json({
      message: 'Account reactivated successfully',
      user: updated,
    });
  } catch (err) {
    console.error('Reactivate deleted account error:', err);
    res.status(500).json({ error: 'Failed to reactivate account' });
  }
};

const processExpiredDeletions = async (req, res) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - GRACE_PERIOD_DAYS);

    const { data: expiredUsers, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .not('pending_deletion_at', 'is', null)
      .is('deleted_at', null)
      .lte('pending_deletion_at', cutoffDate.toISOString());

    if (fetchError) {
      return res.status(400).json({ error: fetchError.message });
    }

    if (!expiredUsers || expiredUsers.length === 0) {
      return res.json({
        message: 'No expired deletions to process',
        processed: 0,
      });
    }

    let processed = 0;
    let failed = 0;

    for (const user of expiredUsers) {
      try {
        await supabaseAdmin
          .from('orders')
          .update({ status: 'cancelled' })
          .eq('buyer_id', user.id)
          .in('status', ['pending', 'confirmed', 'processing']);

        await supabaseAdmin
          .from('drop_offs')
          .update({ status: 'cancelled' })
          .eq('user_id', user.id)
          .in('status', ['scheduled', 'in_transit']);

        await supabaseAdmin
          .from('listings')
          .update({ status: 'archived' })
          .eq('seller_id', user.id)
          .eq('status', 'active');

        await revokeAllSessions(user.id);
        await anonymizeUser(user.id, null);

        await logAuditAction(null, 'auto_delete_expired', user.id, {
          grace_period_days: GRACE_PERIOD_DAYS,
        });

        processed++;
      } catch (err) {
        console.error(`Failed to process deletion for user ${user.id}:`, err);
        failed++;
      }
    }

    res.json({
      message: `Processed ${processed} expired deletions (${failed} failed)`,
      processed,
      failed,
    });
  } catch (err) {
    console.error('Process expired deletions error:', err);
    res.status(500).json({ error: 'Failed to process expired deletions' });
  }
};

const getDeletionDependencies = async (req, res) => {
  try {
    const { id } = req.params;
    const deps = await checkDeletionDependencies(id);
    res.json({ dependencies: deps });
  } catch (err) {
    console.error('Get deletion dependencies error:', err);
    res.status(500).json({ error: 'Failed to check dependencies' });
  }
};

const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const userId = req.user.id;
    const file = req.file;
    const ext = file.originalname.split('.').pop();
    const filePath = `avatars/${userId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return res.status(400).json({ error: 'Failed to upload image' });
    }

    const { data: urlData } = supabaseAdmin.storage
      .from(BUCKET)
      .getPublicUrl(filePath);

    const avatarUrl = urlData.publicUrl;

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ avatar_url: avatarUrl })
      .eq('id', userId)
      .select()
      .single();

    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }

    res.json({
      message: 'Avatar uploaded successfully',
      avatar_url: avatarUrl,
      profile: updated,
    });
  } catch (err) {
    console.error('Upload avatar error:', err);
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
};

const removeAvatar = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('avatar_url')
      .eq('id', userId)
      .single();

    if (profile?.avatar_url) {
      const urlParts = profile.avatar_url.split('/');
      const bucketIndex = urlParts.indexOf(BUCKET);
      if (bucketIndex !== -1) {
        const filePath = urlParts.slice(bucketIndex + 1).join('/');
        await supabaseAdmin.storage.from(BUCKET).remove([filePath]);
      }
    }

    const { data: updated, error } = await supabaseAdmin
      .from('profiles')
      .update({ avatar_url: null })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      message: 'Avatar removed successfully',
      profile: updated,
    });
  } catch (err) {
    console.error('Remove avatar error:', err);
    res.status(500).json({ error: 'Failed to remove avatar' });
  }
};

const getUserStats = async (req, res) => {
  try {
    const { count: totalUsers } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null);

    const { count: activeUsers } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .is('deleted_at', null)
      .is('pending_deletion_at', null);

    const { count: inactiveUsers } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', false)
      .is('deleted_at', null)
      .is('pending_deletion_at', null);

    const { count: pendingDeletionUsers } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .not('pending_deletion_at', 'is', null)
      .is('deleted_at', null);

    const { count: deletedUsers } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .not('deleted_at', 'is', null);

    res.json({
      total: totalUsers || 0,
      active: activeUsers || 0,
      inactive: inactiveUsers || 0,
      pendingDeletion: pendingDeletionUsers || 0,
      deleted: deletedUsers || 0,
    });
  } catch (err) {
    console.error('Get user stats error:', err);
    res.status(500).json({ error: 'Failed to fetch user stats' });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  toggleUserActive,
  updateUserRole,
  deleteUser,
  selfDeleteAccount,
  reactivateDeletedAccount,
  processExpiredDeletions,
  getDeletionDependencies,
  uploadAvatar,
  removeAvatar,
  getUserStats,
};
