const { supabaseAdmin } = require('../config/supabase');

// Listing stock changes use optimistic compare-and-swap: the UPDATE only matches while
// quantity_available still equals the value we read, so concurrent buyers cannot both
// consume the same unit (or double-restore on racing cancels/refunds).
const MAX_ATTEMPTS = 5;

// Take `quantity` units. Returns false when the listing is inactive or short on stock.
// `force` is for money already received (paid PayMongo orders): never refuse, clamp at 0.
const reserveListingStock = async (listingId, quantity, { force = false } = {}) => {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { data: current } = await supabaseAdmin
      .from('listings')
      .select('quantity_available, sold_count, status')
      .eq('id', listingId)
      .single();

    if (!current) return false;
    if (!force && (current.status !== 'active' || current.quantity_available < quantity)) return false;

    const { data: updated } = await supabaseAdmin
      .from('listings')
      .update({
        quantity_available: Math.max(0, current.quantity_available - quantity),
        sold_count: (current.sold_count || 0) + quantity,
      })
      .eq('id', listingId)
      .eq('quantity_available', current.quantity_available)
      .select('id')
      .maybeSingle();

    if (updated) return true;
  }
  return false;
};

const releaseListingStock = async (listingId, quantity) => {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { data: current } = await supabaseAdmin
      .from('listings')
      .select('quantity_available, sold_count')
      .eq('id', listingId)
      .single();

    if (!current) return false;

    const { data: updated } = await supabaseAdmin
      .from('listings')
      .update({
        quantity_available: current.quantity_available + quantity,
        sold_count: Math.max(0, (current.sold_count || 0) - quantity),
      })
      .eq('id', listingId)
      .eq('quantity_available', current.quantity_available)
      .select('id')
      .maybeSingle();

    if (updated) return true;
  }
  return false;
};

module.exports = { reserveListingStock, releaseListingStock };
