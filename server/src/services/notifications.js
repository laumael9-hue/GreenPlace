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

// Image helpers: attach a relevant picture to notification data (data.image)
const getOrderImage = async (orderId) => {
  try {
    const { data: items } = await supabaseAdmin
      .from('order_items')
      .select('listing_id')
      .eq('order_id', orderId)
      .limit(1);

    const listingId = items?.[0]?.listing_id;
    if (!listingId) return null;

    const { data: images } = await supabaseAdmin
      .from('listing_images')
      .select('image_url, is_primary, sort_order')
      .eq('listing_id', listingId)
      .order('sort_order');

    if (!images || images.length === 0) return null;
    return (images.find((img) => img.is_primary) || images[0]).image_url;
  } catch (err) {
    console.error('Order image lookup error:', err);
    return null;
  }
};

const getBusinessLogo = async (businessId) => {
  try {
    const { data: business } = await supabaseAdmin
      .from('businesses')
      .select('logo_url')
      .eq('id', businessId)
      .maybeSingle();

    return business?.logo_url || null;
  } catch (err) {
    console.error('Business logo lookup error:', err);
    return null;
  }
};

// ============================================================
// READ-TIME IMAGE RESOLUTION
// Fills data.image for rows that don't have one yet (old rows,
// or businesses without a logo). Never throws — the list
// endpoint must keep working even if a lookup fails.
// ============================================================

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DROP_OFF_REF_RE = /DO-[A-Za-z0-9-]+/;
const DROP_OFF_FALLBACK_IMAGE = '/favicon.svg';

const attachNotificationImages = async (rows = []) => {
  try {
    if (!Array.isArray(rows) || rows.length === 0) return rows;

    const missing = rows.filter((row) => !(row.data && row.data.image));
    if (missing.length === 0) return rows;

    // --- Order notifications: first order item's primary listing image
    const orderIds = new Set();
    for (const row of missing) {
      if (row.type !== 'order' || !row.data?.link) continue;
      const orderId = row.data.link.split('/')[2];
      if (orderId && UUID_RE.test(orderId)) orderIds.add(orderId);
    }

    if (orderIds.size > 0) {
      const { data: items } = await supabaseAdmin
        .from('order_items')
        .select('order_id, listing_id')
        .in('order_id', [...orderIds]);

      const listingByOrder = new Map();
      for (const item of items || []) {
        if (!listingByOrder.has(item.order_id)) listingByOrder.set(item.order_id, item.listing_id);
      }

      const listingIds = [...new Set(listingByOrder.values())];
      if (listingIds.length > 0) {
        const { data: images } = await supabaseAdmin
          .from('listing_images')
          .select('listing_id, image_url, is_primary, sort_order')
          .in('listing_id', listingIds)
          .order('sort_order');

        const imageByListing = new Map();
        for (const img of images || []) {
          const current = imageByListing.get(img.listing_id);
          if (!current || (img.is_primary && !current.is_primary)) {
            imageByListing.set(img.listing_id, img);
          }
        }

        for (const row of missing) {
          if (row.type !== 'order' || !row.data?.link) continue;
          const listingId = listingByOrder.get(row.data.link.split('/')[2]);
          const image = listingId ? imageByListing.get(listingId) : null;
          if (image) row.data = { ...row.data, image: image.image_url };
        }
      }
    }

    // --- Drop-off notifications: business logo, else static fallback
    const dropRows = missing.filter((row) => row.type === 'drop_off');
    if (dropRows.length > 0) {
      const refByRow = new Map();
      const refs = new Set();
      for (const row of dropRows) {
        const match = (row.body || '').match(DROP_OFF_REF_RE);
        if (match) {
          refByRow.set(row, match[0]);
          refs.add(match[0]);
        }
      }

      const logoByRef = new Map();
      if (refs.size > 0) {
        const { data: dropOffs } = await supabaseAdmin
          .from('drop_offs')
          .select('reference_number, business_id')
          .in('reference_number', [...refs]);

        const bizByRef = new Map((dropOffs || []).map((d) => [d.reference_number, d.business_id]));
        const businessIds = [...new Set([...bizByRef.values()].filter(Boolean))];

        const logoById = new Map();
        if (businessIds.length > 0) {
          const { data: businesses } = await supabaseAdmin
            .from('businesses')
            .select('id, logo_url')
            .in('id', businessIds);
          for (const business of businesses || []) logoById.set(business.id, business.logo_url);
        }
        for (const [ref, businessId] of bizByRef) {
          logoByRef.set(ref, logoById.get(businessId) || null);
        }
      }

      for (const row of dropRows) {
        const ref = refByRow.get(row);
        const logo = ref ? logoByRef.get(ref) : null;
        row.data = { ...row.data, image: logo || DROP_OFF_FALLBACK_IMAGE };
      }
    }

    return rows;
  } catch (err) {
    console.error('Notification image attach error:', err);
    return rows;
  }
};

module.exports = {
  createNotification,
  getOrderImage,
  getBusinessLogo,
  attachNotificationImages,
};
