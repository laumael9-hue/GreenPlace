const { supabaseAdmin } = require('../config/supabase');
const crypto = require('crypto');

const VALID_REACTIONS = ['thumbs_up', 'heart', 'celebrate', 'insightful', 'funny'];
const BUCKET_FORUM = 'forum-images';
const MAX_IMAGES = 4;

// ============================================================
// UTILITY: Generate Slug
// ============================================================

const generateSlug = (text) => {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 200);
  const suffix = crypto.randomBytes(3).toString('hex');
  return `${base}-${suffix}`;
};

// ============================================================
// UTILITY: Validate images array from request body
// Returns { images } on success or { error } on failure
// ============================================================

const validateImages = (raw) => {
  if (raw === undefined || raw === null) return { images: [] };
  let images = raw;
  if (typeof images === 'string') {
    try { images = JSON.parse(images); } catch { return { error: 'Invalid images format' }; }
  }
  if (!Array.isArray(images)) return { error: 'Images must be an array' };
  if (images.length > MAX_IMAGES) return { error: `A maximum of ${MAX_IMAGES} images is allowed` };
  for (const url of images) {
    if (typeof url !== 'string' || !url.startsWith('http')) {
      return { error: 'Invalid image URL' };
    }
  }
  return { images };
};

// ============================================================
// UTILITY: Remove images from storage (called on delete)
// ============================================================

const removeStoredImages = async (imageUrls) => {
  if (!Array.isArray(imageUrls) || imageUrls.length === 0) return;
  const paths = imageUrls
    .map(url => {
      try {
        const parts = new URL(url).pathname.split('/').filter(Boolean);
        const idx = parts.indexOf(BUCKET_FORUM);
        if (idx === -1) return null;
        return parts.slice(idx + 1).join('/');
      } catch { return null; }
    })
    .filter(Boolean);
  if (paths.length > 0) {
    await supabaseAdmin.storage.from(BUCKET_FORUM).remove(paths);
  }
};

// ============================================================
// IMAGE UPLOAD
// ============================================================

const uploadForumImage = async (req, res) => {
  try {
    const userId = req.user.id;
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.file;
    const ext = (file.originalname.split('.').pop() || 'jpg').toLowerCase();
    const filePath = `forum/${userId}/${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET_FORUM)
      .upload(filePath, file.buffer, { contentType: file.mimetype, upsert: false });

    if (uploadError) {
      console.error('Forum image upload error:', uploadError);
      return res.status(400).json({ error: 'Failed to upload image' });
    }

    const { data: urlData } = supabaseAdmin.storage.from(BUCKET_FORUM).getPublicUrl(filePath);

    res.status(201).json({ message: 'Image uploaded successfully', image_url: urlData.publicUrl });
  } catch (err) {
    console.error('Upload forum image error:', err);
    res.status(500).json({ error: 'Failed to upload image' });
  }
};

// ============================================================
// UTILITY: Recalculate reaction_counts for a post
// ============================================================

const recalculateReactions = async (postId) => {
  const { data: reactions } = await supabaseAdmin
    .from('forum_reactions')
    .select('reaction_type')
    .eq('post_id', postId);

  const counts = {};
  (reactions || []).forEach(r => {
    counts[r.reaction_type] = (counts[r.reaction_type] || 0) + 1;
  });

  await supabaseAdmin
    .from('forum_posts')
    .update({ reaction_counts: counts })
    .eq('id', postId);

  return counts;
};

// ============================================================
// THREADS - FEED
// ============================================================

const getThreads = async (req, res) => {
  try {
    const {
      page = 1, limit = 20, search = '',
      sort = 'newest',
    } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabaseAdmin
      .from('forum_threads')
      .select(`
        id, title, slug, body, images, is_pinned, is_locked,
        view_count, reply_count, last_reply_at, created_at, updated_at,
        author:profiles(id, first_name, last_name, avatar_url)
      `, { count: 'exact' });

    if (search) {
      query = query.or(`title.ilike.%${search}%,body.ilike.%${search}%`);
    }

    let orderColumn = 'created_at';
    let orderAsc = false;
    switch (sort) {
      case 'oldest':
        orderAsc = true;
        break;
      case 'popular':
        orderColumn = 'view_count';
        break;
      case 'most_replies':
        orderColumn = 'reply_count';
        break;
      case 'trending':
        orderColumn = 'last_reply_at';
        break;
      default:
        orderColumn = 'created_at';
    }

    const { data: threads, count, error } = await query
      .order('is_pinned', { ascending: false })
      .order(orderColumn, { ascending: orderAsc })
      .range(offset, offset + parseInt(limit) - 1);

    if (error) {
      console.error('Supabase error (getThreads):', error);
      return res.status(400).json({ error: error.message });
    }

    res.json({
      threads: threads || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('Get threads error:', err);
    res.status(500).json({ error: 'Failed to fetch threads' });
  }
};

const getThreadBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const userId = req.user?.id;

    const { data: thread, error } = await supabaseAdmin
      .from('forum_threads')
      .select(`
        id, title, slug, body, images, is_pinned, is_locked,
        view_count, reply_count, created_at, updated_at,
        author:profiles(id, first_name, last_name, avatar_url)
      `)
      .eq('slug', slug)
      .single();

    if (error || !thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    await supabaseAdmin
      .from('forum_threads')
      .update({ view_count: (thread.view_count || 0) + 1 })
      .eq('id', thread.id);

    let isBookmarked = false;
    if (userId) {
      const { data: bm } = await supabaseAdmin
        .from('forum_bookmarks')
        .select('id')
        .eq('user_id', userId)
        .eq('thread_id', thread.id)
        .single();
      isBookmarked = !!bm;
    }

    const { page = 1, limit = 30 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { data: posts, count: postCount } = await supabaseAdmin
      .from('forum_posts')
      .select(`
        id, body, images, is_edited, reaction_counts, parent_id, created_at, updated_at,
        author:profiles(id, first_name, last_name, avatar_url)
      `, { count: 'exact' })
      .eq('thread_id', thread.id)
      .is('parent_id', null)
      .order('created_at', { ascending: true })
      .range(offset, offset + parseInt(limit) - 1);

    const rootPostIds = (posts || []).map(p => p.id);
    let childPosts = [];
    if (rootPostIds.length > 0) {
      const { data: children } = await supabaseAdmin
        .from('forum_posts')
        .select(`
          id, body, images, is_edited, reaction_counts, parent_id, created_at, updated_at,
          author:profiles(id, first_name, last_name, avatar_url)
        `)
        .in('parent_id', rootPostIds)
        .order('created_at', { ascending: true });
      childPosts = children || [];
    }

    let userReactions = {};
    if (userId) {
      const allPostIds = [...rootPostIds, ...childPosts.map(p => p.id)];
      if (allPostIds.length > 0) {
        const { data: reactions } = await supabaseAdmin
          .from('forum_reactions')
          .select('post_id, reaction_type')
          .eq('user_id', userId)
          .in('post_id', allPostIds);
        (reactions || []).forEach(r => {
          userReactions[r.post_id] = r.reaction_type;
        });
      }
    }

    const postsWithReplies = (posts || []).map(post => ({
      ...post,
      userReaction: userReactions[post.id] || null,
      replies: (childPosts || []).map(c => ({
        ...c,
        userReaction: userReactions[c.id] || null,
      })).filter(c => c.parent_id === post.id),
    }));

    res.json({
      thread: { ...thread, view_count: (thread.view_count || 0) + 1, isBookmarked },
      posts: postsWithReplies,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: postCount,
        pages: Math.ceil(postCount / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('Get thread error:', err);
    res.status(500).json({ error: 'Failed to fetch thread' });
  }
};

// ============================================================
// THREADS - CREATE / UPDATE / DELETE
// ============================================================

const createThread = async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, body } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }
    if (!body || !body.trim()) {
      return res.status(400).json({ error: 'Body is required' });
    }

    const imgResult = validateImages(req.body.images);
    if (imgResult.error) return res.status(400).json({ error: imgResult.error });

    const slug = generateSlug(title);

    const { data: thread, error } = await supabaseAdmin
      .from('forum_threads')
      .insert({
        author_id: userId,
        title: title.trim(),
        slug,
        body: body.trim(),
        images: imgResult.images,
      })
      .select(`
        id, title, slug, body, images, is_pinned, is_locked,
        view_count, reply_count, created_at,
        author:profiles(id, first_name, last_name, avatar_url)
      `)
      .single();

    if (error) {
      console.error('Create thread error:', error);
      return res.status(400).json({ error: 'Failed to create thread' });
    }

    res.status(201).json({ thread });
  } catch (err) {
    console.error('Create thread error:', err);
    res.status(500).json({ error: 'Failed to create thread' });
  }
};

const updateThread = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { title, body } = req.body;

    const { data: thread, error: fetchError } = await supabaseAdmin
      .from('forum_threads')
      .select('author_id')
      .eq('id', id)
      .single();

    if (fetchError || !thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    if (thread.author_id !== userId && req.user.profile.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to update this thread' });
    }

    const updates = {};
    if (title && title.trim()) updates.title = title.trim();
    if (body && body.trim()) updates.body = body.trim();

    if (req.body.images !== undefined) {
      const imgResult = validateImages(req.body.images);
      if (imgResult.error) return res.status(400).json({ error: imgResult.error });
      updates.images = imgResult.images;
    }

    if (updates.title) {
      updates.slug = generateSlug(updates.title);
    }

    const { data: updated, error } = await supabaseAdmin
      .from('forum_threads')
      .update(updates)
      .eq('id', id)
      .select(`
        id, title, slug, body, images, is_pinned, is_locked,
        view_count, reply_count, created_at, updated_at,
        author:profiles(id, first_name, last_name, avatar_url)
      `)
      .single();

    if (error) {
      return res.status(400).json({ error: 'Failed to update thread' });
    }

    res.json({ thread: updated });
  } catch (err) {
    console.error('Update thread error:', err);
    res.status(500).json({ error: 'Failed to update thread' });
  }
};

const deleteThread = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const { data: thread, error: fetchError } = await supabaseAdmin
      .from('forum_threads')
      .select('author_id, images')
      .eq('id', id)
      .single();

    if (fetchError || !thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    if (thread.author_id !== userId && req.user.profile.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to delete this thread' });
    }

    const { error } = await supabaseAdmin
      .from('forum_threads')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(400).json({ error: 'Failed to delete thread' });
    }

    await removeStoredImages(thread.images);

    res.json({ message: 'Thread deleted successfully' });
  } catch (err) {
    console.error('Delete thread error:', err);
    res.status(500).json({ error: 'Failed to delete thread' });
  }
};

// ============================================================
// POSTS - CREATE / UPDATE / DELETE
// ============================================================

const createPost = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: threadId } = req.params;
    const { body, parentId } = req.body;

    if (!body || !body.trim()) {
      return res.status(400).json({ error: 'Body is required' });
    }

    const imgResult = validateImages(req.body.images);
    if (imgResult.error) return res.status(400).json({ error: imgResult.error });

    const { data: thread, error: threadError } = await supabaseAdmin
      .from('forum_threads')
      .select('id, is_locked, reply_count, last_reply_at')
      .eq('id', threadId)
      .single();

    if (threadError || !thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    if (thread.is_locked) {
      return res.status(403).json({ error: 'This thread is locked' });
    }

    if (parentId) {
      const { data: parentPost } = await supabaseAdmin
        .from('forum_posts')
        .select('id')
        .eq('id', parentId)
        .eq('thread_id', threadId)
        .single();

      if (!parentPost) {
        return res.status(400).json({ error: 'Invalid parent post' });
      }
    }

    const { data: post, error } = await supabaseAdmin
      .from('forum_posts')
      .insert({
        thread_id: threadId,
        author_id: userId,
        parent_id: parentId || null,
        body: body.trim(),
        images: imgResult.images,
      })
      .select(`
        id, body, images, is_edited, reaction_counts, parent_id, created_at,
        author:profiles(id, first_name, last_name, avatar_url)
      `)
      .single();

    if (error) {
      console.error('Create post error:', error);
      return res.status(400).json({ error: 'Failed to create post' });
    }

    await supabaseAdmin
      .from('forum_threads')
      .update({
        reply_count: (thread.reply_count || 0) + 1,
        last_reply_at: new Date().toISOString(),
        last_reply_by: userId,
      })
      .eq('id', threadId);

    res.status(201).json({ post });
  } catch (err) {
    console.error('Create post error:', err);
    res.status(500).json({ error: 'Failed to create post' });
  }
};

const updatePost = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { body } = req.body;

    if (!body || !body.trim()) {
      return res.status(400).json({ error: 'Body is required' });
    }

    const { data: post, error: fetchError } = await supabaseAdmin
      .from('forum_posts')
      .select('author_id')
      .eq('id', id)
      .single();

    if (fetchError || !post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (post.author_id !== userId && req.user.profile.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to update this post' });
    }

    const updates = { body: body.trim(), is_edited: true };
    if (req.body.images !== undefined) {
      const imgResult = validateImages(req.body.images);
      if (imgResult.error) return res.status(400).json({ error: imgResult.error });
      updates.images = imgResult.images;
    }

    const { data: updated, error } = await supabaseAdmin
      .from('forum_posts')
      .update(updates)
      .eq('id', id)
      .select(`
        id, body, images, is_edited, reaction_counts, parent_id, created_at, updated_at,
        author:profiles(id, first_name, last_name, avatar_url)
      `)
      .single();

    if (error) {
      return res.status(400).json({ error: 'Failed to update post' });
    }

    res.json({ post: updated });
  } catch (err) {
    console.error('Update post error:', err);
    res.status(500).json({ error: 'Failed to update post' });
  }
};

const deletePost = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const { data: post, error: fetchError } = await supabaseAdmin
      .from('forum_posts')
      .select('author_id, thread_id, images')
      .eq('id', id)
      .single();

    if (fetchError || !post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (post.author_id !== userId && req.user.profile.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to delete this post' });
    }

    const { error } = await supabaseAdmin
      .from('forum_posts')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(400).json({ error: 'Failed to delete post' });
    }

    await removeStoredImages(post.images);

    const { data: thread } = await supabaseAdmin
      .from('forum_threads')
      .select('reply_count')
      .eq('id', post.thread_id)
      .single();

    if (thread && thread.reply_count > 0) {
      await supabaseAdmin
        .from('forum_threads')
        .update({ reply_count: thread.reply_count - 1 })
        .eq('id', post.thread_id);
    }

    res.json({ message: 'Post deleted successfully' });
  } catch (err) {
    console.error('Delete post error:', err);
    res.status(500).json({ error: 'Failed to delete post' });
  }
};

// ============================================================
// REACTIONS
// ============================================================

const toggleReaction = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: postId } = req.params;
    const { type } = req.body;

    if (!type || !VALID_REACTIONS.includes(type)) {
      return res.status(400).json({ error: 'Invalid reaction type' });
    }

    const { data: post, error: fetchError } = await supabaseAdmin
      .from('forum_posts')
      .select('id')
      .eq('id', postId)
      .single();

    if (fetchError || !post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const { data: existing } = await supabaseAdmin
      .from('forum_reactions')
      .select('id, reaction_type')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .single();

    if (existing) {
      if (existing.reaction_type === type) {
        await supabaseAdmin
          .from('forum_reactions')
          .delete()
          .eq('id', existing.id);

        const counts = await recalculateReactions(postId);
        res.json({ reacted: false, type: null, reactionCounts: counts });
      } else {
        await supabaseAdmin
          .from('forum_reactions')
          .update({ reaction_type: type })
          .eq('id', existing.id);

        const counts = await recalculateReactions(postId);
        res.json({ reacted: true, type, reactionCounts: counts });
      }
    } else {
      await supabaseAdmin
        .from('forum_reactions')
        .insert({ post_id: postId, user_id: userId, reaction_type: type });

      const counts = await recalculateReactions(postId);
      res.json({ reacted: true, type, reactionCounts: counts });
    }
  } catch (err) {
    console.error('Toggle reaction error:', err);
    res.status(500).json({ error: 'Failed to toggle reaction' });
  }
};

// ============================================================
// BOOKMARKS
// ============================================================

const toggleBookmark = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: threadId } = req.params;

    const { data: thread, error: fetchError } = await supabaseAdmin
      .from('forum_threads')
      .select('id')
      .eq('id', threadId)
      .single();

    if (fetchError || !thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    const { data: existing } = await supabaseAdmin
      .from('forum_bookmarks')
      .select('id')
      .eq('user_id', userId)
      .eq('thread_id', threadId)
      .single();

    if (existing) {
      await supabaseAdmin
        .from('forum_bookmarks')
        .delete()
        .eq('id', existing.id);
      res.json({ bookmarked: false });
    } else {
      await supabaseAdmin
        .from('forum_bookmarks')
        .insert({ user_id: userId, thread_id: threadId });
      res.json({ bookmarked: true });
    }
  } catch (err) {
    console.error('Toggle bookmark error:', err);
    res.status(500).json({ error: 'Failed to toggle bookmark' });
  }
};

const getBookmarkedThreads = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { data: bookmarks, count, error } = await supabaseAdmin
      .from('forum_bookmarks')
      .select(`
        id, created_at,
        thread:forum_threads(
          id, title, slug, body, images, is_pinned, is_locked,
          view_count, reply_count, last_reply_at, created_at,
          author:profiles(id, first_name, last_name, avatar_url)
        )
      `, { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const threads = (bookmarks || [])
      .map(b => b.thread ? { ...b.thread, bookmarked_at: b.created_at } : null)
      .filter(Boolean);

    res.json({
      threads,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('Get bookmarks error:', err);
    res.status(500).json({ error: 'Failed to fetch bookmarks' });
  }
};

// ============================================================
// SEARCH
// ============================================================

const searchForum = async (req, res) => {
  try {
    const { q = '', page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    if (!q.trim()) {
      return res.json({ threads: [], posts: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } });
    }

    const searchPattern = `%${q}%`;

    const { data: threads, count: threadCount } = await supabaseAdmin
      .from('forum_threads')
      .select(`
        id, title, slug, body, images, view_count, reply_count, created_at,
        author:profiles(id, first_name, last_name, avatar_url)
      `, { count: 'exact' })
      .or(`title.ilike.${searchPattern},body.ilike.${searchPattern}`)
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    const { data: posts, count: postCount } = await supabaseAdmin
      .from('forum_posts')
      .select(`
        id, body, images, reaction_counts, created_at,
        author:profiles(id, first_name, last_name, avatar_url),
        thread:forum_threads(id, title, slug)
      `, { count: 'exact' })
      .ilike('body', searchPattern)
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    res.json({
      threads: threads || [],
      posts: posts || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: threadCount + postCount,
        pages: Math.ceil((threadCount + postCount) / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('Search forum error:', err);
    res.status(500).json({ error: 'Failed to search forum' });
  }
};

// ============================================================
// REPORTING
// ============================================================

const reportContent = async (req, res) => {
  try {
    const userId = req.user.id;
    const { targetType, targetId, reason, description } = req.body;

    const validTypes = ['thread', 'post'];
    if (!targetType || !validTypes.includes(targetType)) {
      return res.status(400).json({ error: 'Invalid target type' });
    }
    if (!targetId) {
      return res.status(400).json({ error: 'Target ID is required' });
    }
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Reason is required' });
    }

    let exists = false;
    if (targetType === 'thread') {
      const { data } = await supabaseAdmin
        .from('forum_threads')
        .select('id')
        .eq('id', targetId)
        .single();
      exists = !!data;
    } else {
      const { data } = await supabaseAdmin
        .from('forum_posts')
        .select('id')
        .eq('id', targetId)
        .single();
      exists = !!data;
    }

    if (!exists) {
      return res.status(404).json({ error: 'Content not found' });
    }

    const { data: report, error } = await supabaseAdmin
      .from('reports')
      .insert({
        reporter_id: userId,
        target_type: 'post',
        target_id: targetId,
        reason: reason.trim(),
        description: description ? description.trim() : null,
      })
      .select('id, reason, status, created_at')
      .single();

    if (error) {
      console.error('Report error:', error);
      return res.status(400).json({ error: 'Failed to submit report' });
    }

    res.status(201).json({ report });
  } catch (err) {
    console.error('Report content error:', err);
    res.status(500).json({ error: 'Failed to submit report' });
  }
};

// ============================================================
// MODERATION (ADMIN)
// ============================================================

const moderateThread = async (req, res) => {
  try {
    const { id } = req.params;
    const { isPinned, isLocked } = req.body;

    const { data: thread, error: fetchError } = await supabaseAdmin
      .from('forum_threads')
      .select('id')
      .eq('id', id)
      .single();

    if (fetchError || !thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    const updates = {};
    if (typeof isPinned === 'boolean') updates.is_pinned = isPinned;
    if (typeof isLocked === 'boolean') updates.is_locked = isLocked;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No moderation action provided' });
    }

    const { data: updated, error } = await supabaseAdmin
      .from('forum_threads')
      .update(updates)
      .eq('id', id)
      .select(`
        id, title, slug, is_pinned, is_locked,
        author:profiles(id, first_name, last_name, avatar_url)
      `)
      .single();

    if (error) {
      return res.status(400).json({ error: 'Failed to moderate thread' });
    }

    res.json({ thread: updated });
  } catch (err) {
    console.error('Moderate thread error:', err);
    res.status(500).json({ error: 'Failed to moderate thread' });
  }
};

const moderatePost = async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body;

    const { data: post, error: fetchError } = await supabaseAdmin
      .from('forum_posts')
      .select('id, thread_id')
      .eq('id', id)
      .single();

    if (fetchError || !post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (action === 'delete') {
      const { data: fullPost } = await supabaseAdmin
        .from('forum_posts')
        .select('images')
        .eq('id', id)
        .single();

      const { error } = await supabaseAdmin
        .from('forum_posts')
        .delete()
        .eq('id', id);

      if (error) {
        return res.status(400).json({ error: 'Failed to delete post' });
      }

      await removeStoredImages(fullPost?.images);

      const { data: thread } = await supabaseAdmin
        .from('forum_threads')
        .select('reply_count')
        .eq('id', post.thread_id)
        .single();

      if (thread && thread.reply_count > 0) {
        await supabaseAdmin
          .from('forum_threads')
          .update({ reply_count: thread.reply_count - 1 })
          .eq('id', post.thread_id);
      }

      res.json({ message: 'Post deleted successfully' });
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (err) {
    console.error('Moderate post error:', err);
    res.status(500).json({ error: 'Failed to moderate post' });
  }
};

const getReports = async (req, res) => {
  try {
    const { page = 1, limit = 20, status = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabaseAdmin
      .from('reports')
      .select(`
        id, target_type, target_id, reason, description,
        status, resolution_note, reviewed_at, created_at,
        reporter:profiles!reports_reporter_id_fkey(id, first_name, last_name, avatar_url),
        reviewer:profiles!reports_reviewed_by_fkey(id, first_name, last_name)
      `, { count: 'exact' })
      .eq('target_type', 'post');

    if (status) {
      query = query.eq('status', status);
    }

    const { data: reports, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (error) {
      console.error('Get reports error:', error);
      return res.status(400).json({ error: error.message });
    }

    const enriched = await Promise.all((reports || []).map(async (report) => {
      let target = null;
      if (report.target_type === 'post') {
        const { data } = await supabaseAdmin
          .from('forum_posts')
          .select(`
            id, body, images, created_at,
            author:profiles(id, first_name, last_name),
            thread:forum_threads(id, title, slug)
          `)
          .eq('id', report.target_id)
          .single();
        target = data;
      }
      return { ...report, target };
    }));

    res.json({
      reports: enriched,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('Get reports error:', err);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
};

const resolveReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolutionNote } = req.body;

    const validStatuses = ['reviewed', 'resolved', 'dismissed'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const { data: report, error: fetchError } = await supabaseAdmin
      .from('reports')
      .select('id')
      .eq('id', id)
      .single();

    if (fetchError || !report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const { data: updated, error } = await supabaseAdmin
      .from('reports')
      .update({
        status,
        resolution_note: resolutionNote || null,
        reviewed_by: req.user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, status, resolution_note, reviewed_at')
      .single();

    if (error) {
      return res.status(400).json({ error: 'Failed to resolve report' });
    }

    res.json({ report: updated });
  } catch (err) {
    console.error('Resolve report error:', err);
    res.status(500).json({ error: 'Failed to resolve report' });
  }
};

module.exports = {
  uploadForumImage,
  getThreads,
  getThreadBySlug,
  createThread,
  updateThread,
  deleteThread,
  createPost,
  updatePost,
  deletePost,
  toggleReaction,
  toggleBookmark,
  getBookmarkedThreads,
  searchForum,
  reportContent,
  moderateThread,
  moderatePost,
  getReports,
  resolveReport,
};
