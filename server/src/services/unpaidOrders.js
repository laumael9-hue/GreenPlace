const { supabaseAdmin } = require('../config/supabase');
const paymongoService = require('./paymongo');
const { releaseOrderStock } = require('./stock');
const { createNotification } = require('./notifications');

// GCash/Maya orders hold stock from the moment they are placed. If the buyer never
// finishes paying, that stock must come back, or one abandoned checkout could make
// an item look sold out forever.
const UNPAID_HOLD_MINUTES = 30;

// payment_method is a Postgres enum, which has no LIKE operator, so list the online
// methods explicitly (a LIKE filter errors and silently matches nothing).
const ONLINE_METHODS = ['paymongo_gcash', 'paymongo_maya', 'paymongo_card'];

// Cancel one unpaid online order and give its stock back.
// Only matches orders still 'pending' and not paid, so it can never undo a real sale.
const cancelUnpaidOnlineOrder = async (orderId, reason, { notifyBuyer = false } = {}) => {
  const { data: cancelled } = await supabaseAdmin
    .from('orders')
    .update({
      status: 'cancelled',
      payment_status: 'failed',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason,
    })
    .eq('id', orderId)
    .eq('status', 'pending')
    .in('payment_method', ONLINE_METHODS)
    .in('payment_status', ['pending', 'failed'])
    .select('id, buyer_id, order_number')
    .maybeSingle();

  if (!cancelled) return false;

  await releaseOrderStock(orderId);

  const { data: payments } = await supabaseAdmin
    .from('payments')
    .select('id, paymongo_payment_id, status')
    .eq('order_id', orderId);

  for (const payment of payments || []) {
    if (payment.paymongo_payment_id && payment.status === 'pending') {
      try {
        await paymongoService.cancelPaymentIntent(payment.paymongo_payment_id);
      } catch {
        // Already expired or cancelled on PayMongo's side.
      }
    }
  }

  await supabaseAdmin
    .from('payments')
    .update({ status: 'failed' })
    .eq('order_id', orderId)
    .eq('status', 'pending');

  if (notifyBuyer && cancelled.buyer_id) {
    await createNotification({
      userId: cancelled.buyer_id,
      type: 'order',
      title: 'Order cancelled',
      body: `Order ${cancelled.order_number} was cancelled because payment was not completed within ${UNPAID_HOLD_MINUTES} minutes. The items are back in stock.`,
      data: { link: `/orders/${orderId}` },
    });
  }

  return true;
};

// Checking out the same items again (e.g. after a declined payment) replaces the earlier
// unpaid online order instead of leaving a duplicate that also holds stock.
const cancelSupersededOnlineOrders = async (userId, listingIds) => {
  if (!listingIds.length) return;

  const { data: unpaidOrders, error } = await supabaseAdmin
    .from('orders')
    .select('id, order_items(listing_id)')
    .eq('buyer_id', userId)
    .eq('status', 'pending')
    .in('payment_method', ONLINE_METHODS)
    .in('payment_status', ['pending', 'failed']);
  if (error) console.error('Find superseded orders error:', error);

  for (const order of unpaidOrders || []) {
    const overlaps = (order.order_items || []).some((i) => listingIds.includes(i.listing_id));
    if (overlaps) await cancelUnpaidOnlineOrder(order.id, 'Replaced by a new checkout');
  }
};

// Release stock held by online orders left unpaid for too long. There is no cron on
// the serverless deploy, so this runs on busy endpoints (cart, checkout, listings),
// at most once a minute per server instance.
let lastSweep = 0;
const expireStaleOnlineOrders = async () => {
  const now = Date.now();
  if (now - lastSweep < 60 * 1000) return;
  lastSweep = now;

  try {
    const cutoff = new Date(now - UNPAID_HOLD_MINUTES * 60 * 1000).toISOString();
    const { data: stale, error } = await supabaseAdmin
      .from('orders')
      .select('id')
      .eq('status', 'pending')
      .eq('stock_reserved', true)
      .in('payment_method', ONLINE_METHODS)
      .in('payment_status', ['pending', 'failed'])
      .lt('created_at', cutoff)
      .limit(50);
    if (error) console.error('Find stale online orders error:', error);

    for (const order of stale || []) {
      await cancelUnpaidOnlineOrder(order.id, 'Payment not completed in time', { notifyBuyer: true });
    }
  } catch (err) {
    console.error('Expire stale online orders error:', err);
  }
};

module.exports = {
  UNPAID_HOLD_MINUTES,
  cancelUnpaidOnlineOrder,
  cancelSupersededOnlineOrders,
  expireStaleOnlineOrders,
};
