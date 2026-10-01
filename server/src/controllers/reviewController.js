const { supabaseAdmin } = require('../config/supabase');
const { createNotification } = require('../services/notifications');

// ============================================================
// Constants & helpers
// ============================================================

const DEFAULT_MIN_LENGTH = 10;
const MAX_REVIEW_LENGTH = 2000;
const MAX_TITLE_LENGTH = 255;
const MAX_REPLY_LENGTH = 1000;

const REVIEW_SELECT = `
  id, reviewer_id, business_id, listing_id, order_id, drop_off_id,
  rating, title, body, is_anonymous,
  business_reply, business_replied_at, is_visible,
  created_at, updated_at,
  reviewer:profiles!reviews_reviewer_id_fkey(id, first_name, last_name, avatar_url)
`;

const REVIEWABLE_DROP_OFF_STATUSES = ['received', 'processed'];

const getMinReviewLength = async () => {
  try {
    const { data } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('key', 'review_min_length')
      .maybeSingle();

    const parsed = parseInt(data?.value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_MIN_LENGTH;
  } catch {
    return DEFAULT_MIN_LENGTH;
  }
};

// Anonymous reviewers are masked for everyone except themselves
const serializeReview = (review, viewerId = null) => {
  if (!review) return null;
  const { reviewer, ...rest } = review;
  const masked = review.is_anonymous && review.reviewer_id !== viewerId;
  return {
    ...rest,
    reviewer: masked
      ? { id: null, first_name: 'Anonymous', last_name: '', avatar_url: null }
      : (reviewer || null),
  };
};

const isValidInt = (value, min, max) =>
  Number.isInteger(value) && value >= min && value <= max;

// Attach order / drop-off reference numbers for "verified" context badges
const hydrateContext = async (reviews) => {
  if (!reviews || reviews.length === 0) return reviews || [];

  const orderIds = reviews.filter((r) => r.order_id).map((r) => r.order_id);
  const dropOffIds = reviews.filter((r) => r.drop_off_id).map((r) => r.drop_off_id);

  const [orders, dropOffs] = await Promise.all([
    orderIds.length
      ? supabaseAdmin.from('orders').select('id, order_number').in('id', orderIds)
      : Promise.resolve({ data: [] }),
    dropOffIds.length
      ? supabaseAdmin.from('drop_offs').select('id, reference_number').in('id', dropOffIds)
      : Promise.resolve({ data: [] }),
  ]);

  const orderMap = Object.fromEntries((orders.data || []).map((o) => [o.id, o.order_number]));
  const dropOffMap = Object.fromEntries((dropOffs.data || []).map((d) => [d.id, d.reference_number]));

  return reviews.map((review) => ({
    ...review,
    source_order: review.order_id ? orderMap[review.order_id] || null : null,
    source_drop_off: review.drop_off_id ? dropOffMap[review.drop_off_id] || null : null,
  }));
};

// ============================================================
// Rating aggregation summary (per-star breakdown + average)
// ============================================================

const buildSummary = (entity, rows) => {
  const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  (rows || []).forEach((row) => {
    if (breakdown[row.rating] !== undefined) breakdown[row.rating] += 1;
  });

  return {
    avg: parseFloat(entity?.rating_avg || 0) || 0,
    count: entity?.rating_count ?? (rows ? rows.length : 0),
    breakdown,
  };
};

const getRatingSummary = async (businessId) => {
  const [{ data: business }, { data: rows }] = await Promise.all([
    supabaseAdmin
      .from('businesses')
      .select('rating_avg, rating_count')
      .eq('id', businessId)
      .maybeSingle(),
    supabaseAdmin
      .from('reviews')
      .select('rating')
      .eq('business_id', businessId)
      .eq('is_visible', true),
  ]);

  return buildSummary(business, rows);
};

const getListingRatingSummary = async (listingId) => {
  const [{ data: listing }, { data: rows }] = await Promise.all([
    supabaseAdmin
      .from('listings')
      .select('rating_avg, rating_count')
      .eq('id', listingId)
      .maybeSingle(),
    supabaseAdmin
      .from('reviews')
      .select('rating')
      .eq('listing_id', listingId)
      .eq('is_visible', true),
  ]);

  return buildSummary(listing, rows);
};

// ============================================================
// Shared list query (public profile + dashboards)
// ============================================================

const listScopedReviews = async (column, value, queryParams, viewerId, summaryPromise) => {
  const {
    page = 1,
    limit = 10,
    rating = '',
    sort = 'newest',
  } = queryParams;

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);
  const offset = (pageNum - 1) * limitNum;
  const ratingNum = rating !== '' ? parseInt(rating, 10) : null;

  let query = supabaseAdmin
    .from('reviews')
    .select(REVIEW_SELECT, { count: 'exact' })
    .eq(column, value)
    .eq('is_visible', true);

  if (ratingNum !== null && isValidInt(ratingNum, 1, 5)) {
    query = query.eq('rating', ratingNum);
  }

  const orderColumn = ['highest', 'lowest'].includes(sort) ? 'rating' : 'created_at';
  query = query.order(orderColumn, { ascending: sort === 'lowest' });
  if (orderColumn !== 'created_at') {
    query = query.order('created_at', { ascending: false });
  }

  const [{ data: reviews, count, error }, summary] = await Promise.all([
    query.range(offset, offset + limitNum - 1),
    summaryPromise,
  ]);

  if (error) {
    console.error('Supabase error (listScopedReviews):', error);
    throw new Error(error.message);
  }

  let myReview = null;
  if (viewerId) {
    const { data: mine } = await supabaseAdmin
      .from('reviews')
      .select(REVIEW_SELECT)
      .eq(column, value)
      .eq('reviewer_id', viewerId)
      .limit(1)
      .maybeSingle();
    myReview = serializeReview(mine, viewerId);
  }

  return {
    reviews: await hydrateContext(
      (reviews || []).map((review) => serializeReview(review, viewerId))
    ),
    summary,
    myReview,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: count || 0,
      pages: Math.ceil((count || 0) / limitNum),
    },
  };
};

const listBusinessReviews = (businessId, queryParams, viewerId) =>
  listScopedReviews('business_id', businessId, queryParams, viewerId, getRatingSummary(businessId));

const listListingReviews = (listingId, queryParams, viewerId) =>
  listScopedReviews('listing_id', listingId, queryParams, viewerId, getListingRatingSummary(listingId));

// ============================================================
// PUBLIC — Reviews for a business
// ============================================================

const getBusinessReviews = async (req, res) => {
  try {
    const { businessId } = req.params;

    const { data: business } = await supabaseAdmin
      .from('businesses')
      .select('id, deleted_at')
      .eq('id', businessId)
      .maybeSingle();

    if (!business || business.deleted_at) {
      return res.status(404).json({ error: 'Business not found' });
    }

    const result = await listBusinessReviews(businessId, req.query, req.user?.id || null);
    res.json(result);
  } catch (err) {
    console.error('Get business reviews error:', err);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
};

// ============================================================
// PUBLIC — Reviews for a product (listing)
// ============================================================

const getListingReviews = async (req, res) => {
  try {
    const { listingId } = req.params;

    const { data: listing } = await supabaseAdmin
      .from('listings')
      .select('id, status')
      .eq('id', listingId)
      .maybeSingle();

    if (!listing) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const result = await listListingReviews(listingId, req.query, req.user?.id || null);
    res.json(result);
  } catch (err) {
    console.error('Get listing reviews error:', err);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
};

// ============================================================
// PUBLIC — Duplicate check for the signed-in user
// ============================================================

const checkMyReview = async (req, res) => {
  try {
    const { businessId = '', orderId = '', dropOffId = '', listingId = '' } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      return res.json({ reviewed: false, review: null, listingReviews: [] });
    }

    if (!businessId && !orderId && !dropOffId && !listingId) {
      return res.status(400).json({ error: 'Provide businessId, listingId, orderId, or dropOffId' });
    }

    // --- Product review check ---
    if (listingId) {
      const { data: review, error } = await supabaseAdmin
        .from('reviews')
        .select(REVIEW_SELECT)
        .eq('listing_id', listingId)
        .eq('reviewer_id', userId)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Supabase error (checkMyReview):', error);
        return res.status(500).json({ error: 'Failed to check review status' });
      }

      return res.json({ reviewed: !!review, review: serializeReview(review, userId), listingReviews: [] });
    }

    // --- Resolve the establishment the check applies to ---
    let targetBusinessId = businessId || null;

    if (orderId) {
      const { data: order } = await supabaseAdmin
        .from('orders')
        .select('business_id')
        .eq('id', orderId)
        .maybeSingle();

      if (!order) return res.status(404).json({ error: 'Order not found' });
      // Marketplace-only orders have no business — skip the establishment check
      targetBusinessId = targetBusinessId || order.business_id || null;
    }

    if (!targetBusinessId && dropOffId) {
      const { data: dropOff } = await supabaseAdmin
        .from('drop_offs')
        .select('business_id')
        .eq('id', dropOffId)
        .maybeSingle();

      if (!dropOff) return res.status(404).json({ error: 'Drop-off not found' });
      targetBusinessId = dropOff.business_id;
    }

    let review = null;
    if (targetBusinessId) {
      const { data: existing, error } = await supabaseAdmin
        .from('reviews')
        .select(REVIEW_SELECT)
        .eq('business_id', targetBusinessId)
        .eq('reviewer_id', userId)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Supabase error (checkMyReview):', error);
        return res.status(500).json({ error: 'Failed to check review status' });
      }
      review = existing;
    }

    // --- My product reviews for this order (per-item review gating) ---
    let listingReviews = [];
    if (orderId) {
      const { data: rows } = await supabaseAdmin
        .from('reviews')
        .select(REVIEW_SELECT)
        .eq('order_id', orderId)
        .eq('reviewer_id', userId)
        .not('listing_id', 'is', null);

      listingReviews = (rows || []).map((row) => serializeReview(row, userId));
    }

    res.json({ reviewed: !!review, review: serializeReview(review, userId), listingReviews });
  } catch (err) {
    console.error('Check review error:', err);
    res.status(500).json({ error: 'Failed to check review status' });
  }
};

// ============================================================
// AUTHENTICATED — My reviews
// ============================================================

const getMyReviews = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);
    const offset = (pageNum - 1) * limitNum;

    const { data: reviews, count, error } = await supabaseAdmin
      .from('reviews')
      .select(
        `${REVIEW_SELECT},
         business:businesses!reviews_business_id_fkey(id, name, slug, logo_url, rating_avg, rating_count),
         listing:listings!reviews_listing_id_fkey(id, title, slug)`,
        { count: 'exact' }
      )
      .eq('reviewer_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);

    if (error) {
      console.error('Supabase error (getMyReviews):', error);
      return res.status(400).json({ error: error.message });
    }

    res.json({
      reviews: await hydrateContext(
        (reviews || []).map((review) => serializeReview(review, userId))
      ),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        pages: Math.ceil((count || 0) / limitNum),
      },
    });
  } catch (err) {
    console.error('Get my reviews error:', err);
    res.status(500).json({ error: 'Failed to fetch your reviews' });
  }
};

// ============================================================
// AUTHENTICATED — Create review (with duplicate prevention)
// ============================================================

const createReview = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      businessId,
      listingId,
      rating,
      title = '',
      body = '',
      isAnonymous = false,
      orderId = null,
      dropOffId = null,
    } = req.body || {};

    if (!businessId && !listingId) {
      return res.status(400).json({ error: 'Business or product is required' });
    }
    if (businessId && listingId) {
      return res.status(400).json({ error: 'Provide either a business or a product, not both' });
    }
    if (listingId && dropOffId) {
      return res.status(400).json({ error: 'Drop-off reviews cannot be attached to a product' });
    }

    const ratingNum = Number(rating);
    if (!isValidInt(ratingNum, 1, 5)) {
      return res.status(400).json({ error: 'Rating must be a whole number between 1 and 5' });
    }

    const trimmedBody = (body || '').trim();
    const minLength = await getMinReviewLength();
    if (trimmedBody.length < minLength) {
      return res.status(400).json({ error: `Review must be at least ${minLength} characters` });
    }
    if (trimmedBody.length > MAX_REVIEW_LENGTH) {
      return res.status(400).json({ error: `Review must be ${MAX_REVIEW_LENGTH} characters or fewer` });
    }

    const trimmedTitle = (title || '').trim();
    if (trimmedTitle.length > MAX_TITLE_LENGTH) {
      return res.status(400).json({ error: `Title must be ${MAX_TITLE_LENGTH} characters or fewer` });
    }

    // --- Resolve the review target (business or product) ---
    let notifyUserId = null;
    let notifyName = '';
    let listing = null;

    if (listingId) {
      const { data: found } = await supabaseAdmin
        .from('listings')
        .select('id, title, seller_id')
        .eq('id', listingId)
        .maybeSingle();

      if (!found) {
        return res.status(404).json({ error: 'Product not found' });
      }
      listing = found;
      notifyUserId = found.seller_id;
      notifyName = found.title;
    } else {
      const { data: business } = await supabaseAdmin
        .from('businesses')
        .select('id, name, owner_id, deleted_at')
        .eq('id', businessId)
        .maybeSingle();

      if (!business || business.deleted_at) {
        return res.status(404).json({ error: 'Business not found' });
      }
      notifyUserId = business.owner_id;
      notifyName = business.name;
    }

    // --- Verify the transaction (order / drop-off) when provided ---
    if (orderId) {
      const { data: order } = await supabaseAdmin
        .from('orders')
        .select('id, buyer_id, business_id, status')
        .eq('id', orderId)
        .maybeSingle();

      if (!order) return res.status(404).json({ error: 'Order not found' });
      if (order.buyer_id !== userId) {
        return res.status(403).json({ error: 'You can only review your own orders' });
      }
      if (order.status !== 'completed') {
        return res.status(400).json({ error: 'Only completed orders can be reviewed' });
      }

      if (listingId) {
        // Product review: the order must actually contain this product
        const { data: item } = await supabaseAdmin
          .from('order_items')
          .select('id')
          .eq('order_id', orderId)
          .eq('listing_id', listingId)
          .maybeSingle();

        if (!item) {
          return res.status(400).json({ error: 'Order does not contain this product' });
        }
      } else if (order.business_id !== businessId) {
        return res.status(400).json({ error: 'Order does not belong to this business' });
      }
    }

    if (dropOffId) {
      const { data: dropOff } = await supabaseAdmin
        .from('drop_offs')
        .select('id, user_id, business_id, status')
        .eq('id', dropOffId)
        .maybeSingle();

      if (!dropOff) return res.status(404).json({ error: 'Drop-off not found' });
      if (dropOff.business_id !== businessId) {
        return res.status(400).json({ error: 'Drop-off does not belong to this business' });
      }
      if (dropOff.user_id !== userId) {
        return res.status(403).json({ error: 'You can only review your own drop-offs' });
      }
      if (!REVIEWABLE_DROP_OFF_STATUSES.includes(dropOff.status)) {
        return res.status(400).json({ error: 'This drop-off is not ready for review' });
      }
    }

    // --- Duplicate prevention: friendly pre-check ---
    if (listingId) {
      const { data: existingListingReview } = await supabaseAdmin
        .from('reviews')
        .select('id, order_id')
        .eq('listing_id', listingId)
        .eq('reviewer_id', userId)
        .limit(1)
        .maybeSingle();

      if (existingListingReview) {
        if (orderId && existingListingReview.order_id === orderId) {
          return res.status(409).json({ error: 'You have already reviewed this product' });
        }
        return res.status(409).json({ error: 'You have already reviewed this product. Edit your existing review instead.' });
      }
    } else {
      const { data: existing } = await supabaseAdmin
        .from('reviews')
        .select('id, order_id, drop_off_id')
        .eq('business_id', businessId)
        .eq('reviewer_id', userId)
        .limit(1)
        .maybeSingle();

      if (existing) {
        if (orderId && existing.order_id === orderId) {
          return res.status(409).json({ error: 'You have already reviewed this order' });
        }
        if (dropOffId && existing.drop_off_id === dropOffId) {
          return res.status(409).json({ error: 'You have already reviewed this drop-off' });
        }
        return res.status(409).json({ error: 'You have already reviewed this business. Edit your existing review instead.' });
      }
    }

    const { data: created, error } = await supabaseAdmin
      .from('reviews')
      .insert({
        reviewer_id: userId,
        business_id: listingId ? null : businessId,
        listing_id: listingId || null,
        rating: ratingNum,
        title: trimmedTitle || null,
        body: trimmedBody,
        is_anonymous: !!isAnonymous,
        order_id: orderId || null,
        drop_off_id: dropOffId || null,
      })
      .select(REVIEW_SELECT)
      .single();

    if (error) {
      // Race-condition backstop: unique index violations become 409s
      if (error.code === '23505') {
        return res.status(409).json({
          error: listingId ? 'You have already reviewed this product' : 'You have already reviewed this business',
        });
      }
      console.error('Supabase error (createReview):', error);
      return res.status(400).json({ error: 'Failed to create review' });
    }

    // Notify the seller / business owner (fire-and-forget)
    if (notifyUserId && notifyUserId !== userId) {
      const profile = req.user.profile;
      const reviewerName = created.is_anonymous || !profile
        ? 'Anonymous'
        : `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'A customer';
      createNotification({
        userId: notifyUserId,
        type: 'review',
        title: 'New review received',
        body: `${ratingNum}-star review from ${reviewerName} on ${notifyName}`,
        data: listingId ? { listingId, reviewId: created.id } : { businessId, reviewId: created.id },
      });
    }

    res.status(201).json({ review: serializeReview(created, userId) });
  } catch (err) {
    console.error('Create review error:', err);
    res.status(500).json({ error: 'Failed to submit review' });
  }
};

// ============================================================
// AUTHENTICATED — Update own review
// ============================================================

const updateReview = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { rating, title, body, isAnonymous } = req.body || {};

    const { data: review } = await supabaseAdmin
      .from('reviews')
      .select('id, reviewer_id, business_id')
      .eq('id', id)
      .maybeSingle();

    if (!review) return res.status(404).json({ error: 'Review not found' });
    if (review.reviewer_id !== userId) {
      return res.status(403).json({ error: 'You can only edit your own review' });
    }

    const patch = {};

    if (rating !== undefined) {
      const ratingNum = Number(rating);
      if (!isValidInt(ratingNum, 1, 5)) {
        return res.status(400).json({ error: 'Rating must be a whole number between 1 and 5' });
      }
      patch.rating = ratingNum;
    }

    if (body !== undefined) {
      const trimmedBody = (body || '').trim();
      const minLength = await getMinReviewLength();
      if (trimmedBody.length < minLength) {
        return res.status(400).json({ error: `Review must be at least ${minLength} characters` });
      }
      if (trimmedBody.length > MAX_REVIEW_LENGTH) {
        return res.status(400).json({ error: `Review must be ${MAX_REVIEW_LENGTH} characters or fewer` });
      }
      patch.body = trimmedBody;
    }

    if (title !== undefined) {
      const trimmedTitle = (title || '').trim();
      if (trimmedTitle.length > MAX_TITLE_LENGTH) {
        return res.status(400).json({ error: `Title must be ${MAX_TITLE_LENGTH} characters or fewer` });
      }
      patch.title = trimmedTitle || null;
    }

    if (isAnonymous !== undefined) {
      patch.is_anonymous = !!isAnonymous;
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'No changes provided' });
    }

    const { data: updated, error } = await supabaseAdmin
      .from('reviews')
      .update(patch)
      .eq('id', id)
      .select(REVIEW_SELECT)
      .single();

    if (error) {
      console.error('Supabase error (updateReview):', error);
      return res.status(400).json({ error: 'Failed to update review' });
    }

    res.json({ review: serializeReview(updated, userId) });
  } catch (err) {
    console.error('Update review error:', err);
    res.status(500).json({ error: 'Failed to update review' });
  }
};

// ============================================================
// AUTHENTICATED — Delete own review (admins may remove any)
// ============================================================

const deleteReview = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.profile?.role;
    const { id } = req.params;

    const { data: review } = await supabaseAdmin
      .from('reviews')
      .select('id, reviewer_id, business_id')
      .eq('id', id)
      .maybeSingle();

    if (!review) return res.status(404).json({ error: 'Review not found' });
    if (review.reviewer_id !== userId && role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { error } = await supabaseAdmin.from('reviews').delete().eq('id', id);
    if (error) {
      console.error('Supabase error (deleteReview):', error);
      return res.status(400).json({ error: 'Failed to delete review' });
    }

    res.json({ message: 'Review deleted' });
  } catch (err) {
    console.error('Delete review error:', err);
    res.status(500).json({ error: 'Failed to delete review' });
  }
};

// ============================================================
// AUTHENTICATED — Business replies to a review
// ============================================================

const replyToReview = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.profile?.role;
    const { id } = req.params;
    const { reply = '' } = req.body || {};

    const trimmedReply = (reply || '').trim();
    if (!trimmedReply) {
      return res.status(400).json({ error: 'Reply text is required' });
    }
    if (trimmedReply.length > MAX_REPLY_LENGTH) {
      return res.status(400).json({ error: `Reply must be ${MAX_REPLY_LENGTH} characters or fewer` });
    }

    const { data: review } = await supabaseAdmin
      .from('reviews')
      .select(`
        id, business_id, listing_id, reviewer_id, rating, is_anonymous,
        business:businesses!reviews_business_id_fkey(id, name, owner_id),
        listing:listings!reviews_listing_id_fkey(id, title, seller_id)
      `)
      .eq('id', id)
      .maybeSingle();

    if (!review) return res.status(404).json({ error: 'Review not found' });

    let allowed = role === 'admin';
    if (review.listing_id) {
      allowed = allowed || review.listing?.seller_id === userId;
    } else {
      allowed = allowed || review.business?.owner_id === userId;
    }
    if (!allowed) {
      return res.status(403).json({
        error: review.listing_id
          ? 'You can only reply to reviews on your own product'
          : 'You can only reply to reviews on your own business',
      });
    }

    const { data: updated, error } = await supabaseAdmin
      .from('reviews')
      .update({
        business_reply: trimmedReply,
        business_replied_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(REVIEW_SELECT)
      .single();

    if (error) {
      console.error('Supabase error (replyToReview):', error);
      return res.status(400).json({ error: 'Failed to post reply' });
    }

    if (review.reviewer_id && review.reviewer_id !== userId) {
      const isProduct = !!review.listing_id;
      createNotification({
        userId: review.reviewer_id,
        type: 'review',
        title: isProduct ? 'Seller replied to your review' : 'Business replied to your review',
        body: `${(isProduct ? review.listing?.title : review.business?.name) || 'They'} responded to your ${review.rating}-star review`,
        data: isProduct
          ? { listingId: review.listing_id, reviewId: review.id }
          : { businessId: review.business_id, reviewId: review.id },
      });
    }

    res.json({ review: serializeReview(updated, userId) });
  } catch (err) {
    console.error('Reply to review error:', err);
    res.status(500).json({ error: 'Failed to post reply' });
  }
};

// ============================================================
// BUSINESS — Reviews for my own business
// ============================================================

const getMyBusinessReviews = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: business } = await supabaseAdmin
      .from('businesses')
      .select('id, name, owner_id, deleted_at')
      .eq('owner_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!business) {
      return res.status(404).json({ error: 'No business found for this account' });
    }

    const result = await listBusinessReviews(business.id, req.query, userId);
    res.json({ ...result, business: { id: business.id, name: business.name } });
  } catch (err) {
    console.error('Get my business reviews error:', err);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
};

// ============================================================
// AUTHENTICATED — Reviews on my listings (products)
// ============================================================

const getMyListingReviews = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, rating = '', sort = 'newest' } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);
    const offset = (pageNum - 1) * limitNum;
    const ratingNum = rating !== '' ? parseInt(rating, 10) : null;

    // Listings I sell directly + listings belonging to businesses I own
    const [{ data: owned }, { data: myBusinesses }] = await Promise.all([
      supabaseAdmin.from('listings').select('id').eq('seller_id', userId),
      supabaseAdmin.from('businesses').select('id').eq('owner_id', userId).is('deleted_at', null),
    ]);

    const businessIds = (myBusinesses || []).map((b) => b.id);
    let listingIds = (owned || []).map((l) => l.id);

    if (businessIds.length > 0) {
      const { data: bizListings } = await supabaseAdmin
        .from('listings')
        .select('id')
        .in('business_id', businessIds);
      listingIds = [...new Set([...listingIds, ...(bizListings || []).map((l) => l.id)])];
    }

    const emptySummary = { avg: 0, count: 0, breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
    if (listingIds.length === 0) {
      return res.json({
        reviews: [],
        summary: emptySummary,
        pagination: { page: pageNum, limit: limitNum, total: 0, pages: 0 },
      });
    }

    // Overall summary across all of my listings
    const { data: allRatings } = await supabaseAdmin
      .from('reviews')
      .select('rating')
      .in('listing_id', listingIds)
      .eq('is_visible', true);

    const rows = allRatings || [];
    const total = rows.length;
    const avg = total
      ? Math.round((rows.reduce((sum, r) => sum + r.rating, 0) / total) * 100) / 100
      : 0;
    const summary = buildSummary({ rating_avg: avg, rating_count: total }, rows);

    let query = supabaseAdmin
      .from('reviews')
      .select(
        `${REVIEW_SELECT}, listing:listings!reviews_listing_id_fkey(id, title, slug, status)`,
        { count: 'exact' }
      )
      .in('listing_id', listingIds)
      .eq('is_visible', true);

    if (ratingNum !== null && isValidInt(ratingNum, 1, 5)) {
      query = query.eq('rating', ratingNum);
    }

    const orderColumn = ['highest', 'lowest'].includes(sort) ? 'rating' : 'created_at';
    query = query.order(orderColumn, { ascending: sort === 'lowest' });
    if (orderColumn !== 'created_at') {
      query = query.order('created_at', { ascending: false });
    }

    const { data: reviews, count, error } = await query.range(offset, offset + limitNum - 1);

    if (error) {
      console.error('Supabase error (getMyListingReviews):', error);
      return res.status(400).json({ error: error.message });
    }

    res.json({
      reviews: await hydrateContext(
        (reviews || []).map((review) => serializeReview(review, userId))
      ),
      summary,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        pages: Math.ceil((count || 0) / limitNum),
      },
    });
  } catch (err) {
    console.error('Get my listing reviews error:', err);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
};

module.exports = {
  getBusinessReviews,
  getListingReviews,
  getMyBusinessReviews,
  getMyListingReviews,
  getMyReviews,
  checkMyReview,
  createReview,
  updateReview,
  deleteReview,
  replyToReview,
};
