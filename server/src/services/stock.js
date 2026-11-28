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

// ------------------------------------------------------------
// Order-level helpers. `orders.stock_reserved` says whether an order currently holds
// its items' stock. Each helper flips that flag atomically first, so two requests
// (e.g. a webhook and a status poll) can never take or return the same stock twice.
// ------------------------------------------------------------

const getOrderItems = async (orderId) => {
  const { data } = await supabaseAdmin
    .from('order_items')
    .select('listing_id, quantity')
    .eq('order_id', orderId);
  return data || [];
};

// Take stock for an existing order that is not holding any.
// force=true is for money already received: never refuse, clamp at 0.
// Returns true when the order holds stock afterwards.
const reserveOrderStock = async (orderId, { force = false } = {}) => {
  const { data: claimed } = await supabaseAdmin
    .from('orders')
    .update({ stock_reserved: true })
    .eq('id', orderId)
    .eq('stock_reserved', false)
    .select('id')
    .maybeSingle();
  if (!claimed) return true; // already holding stock

  const items = await getOrderItems(orderId);
  const taken = [];
  for (const item of items) {
    if (!item.listing_id) continue;
    const ok = await reserveListingStock(item.listing_id, item.quantity, { force });
    if (!ok) {
      for (const t of taken) await releaseListingStock(t.listing_id, t.quantity);
      await supabaseAdmin.from('orders').update({ stock_reserved: false }).eq('id', orderId);
      return false;
    }
    taken.push(item);
  }
  return true;
};

// Give back the stock an order holds (cancel, refund, failed/expired payment).
const releaseOrderStock = async (orderId) => {
  const { data: claimed } = await supabaseAdmin
    .from('orders')
    .update({ stock_reserved: false })
    .eq('id', orderId)
    .eq('stock_reserved', true)
    .select('id')
    .maybeSingle();
  if (!claimed) return false; // was not holding stock

  for (const item of await getOrderItems(orderId)) {
    if (item.listing_id) await releaseListingStock(item.listing_id, item.quantity);
  }
  return true;
};

module.exports = { reserveListingStock, releaseListingStock, reserveOrderStock, releaseOrderStock };
