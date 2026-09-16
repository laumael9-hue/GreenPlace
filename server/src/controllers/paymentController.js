const { supabaseAdmin } = require('../config/supabase');
const paymongoService = require('../services/paymongo');
const crypto = require('crypto');

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// ============================================================
// CREATE CHECKOUT: Create PayMongo payment for an order
// ============================================================

const createCheckout = async (req, res) => {
  try {
    const userId = req.user.id;
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, buyer_id, total, payment_method, payment_status, order_number')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.buyer_id !== userId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    if (order.payment_status !== 'pending') {
      return res.status(400).json({ error: 'Order already paid or payment is no longer pending' });
    }

    const amountInCentavos = Math.round(parseFloat(order.total) * 100);

    const intent = await paymongoService.createPaymentIntent({
      amount: amountInCentavos,
      description: `GreenPlace Order #${order.order_number}`,
      metadata: {
        order_id: order.id,
        order_number: order.order_number,
        buyer_id: userId,
      },
    });

    const methodType = paymongoService.METHOD_MAP[order.payment_method];

    if (!methodType) {
      return res.status(400).json({ error: 'Invalid payment method for PayMongo' });
    }

    const method = await paymongoService.createPaymentMethod(methodType);

    const attached = await paymongoService.attachPaymentMethod(method.id, intent.id);

    await supabaseAdmin
      .from('payments')
      .update({ paymongo_payment_id: intent.id })
      .eq('order_id', orderId)
      .eq('status', 'pending');

    let checkoutUrl = null;
    if (attached.attributes?.next_action?.redirect?.url) {
      checkoutUrl = attached.attributes.next_action.redirect.url;
    }

    res.status(201).json({
      payment_id: intent.id,
      client_key: intent.client_key,
      checkout_url: checkoutUrl,
      status: intent.status,
    });
  } catch (err) {
    console.error('Create checkout error:', err?.response?.data || err);
    res.status(500).json({ error: 'Failed to create PayMongo checkout' });
  }
};

// ============================================================
// HANDLE WEBHOOK: Process PayMongo events
// ============================================================

const handleWebhook = async (req, res) => {
  try {
    const signatureHeader = req.headers['paymongo-signature'];
    const payload = req.body.toString('utf8');

    if (!signatureHeader) {
      return res.status(400).json({ error: 'Missing webhook signature' });
    }

    let event;
    try {
      event = paymongoService.verifyWebhook({ payload, signatureHeader });
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    const eventType = event.type;
    const paymentIntentId = event.data?.id;

    if (!paymentIntentId) {
      return res.status(400).json({ error: 'Missing payment intent ID' });
    }

    const eventId = event.data?.attributes?.event_id || `${paymentIntentId}-${eventType}`;

    const { error: insertError } = await supabaseAdmin
      .from('webhook_events')
      .insert({
        event_id: eventId,
        event_type: eventType,
        payload: event.data || {},
      });

    if (insertError && insertError.code === '23505') {
      return res.status(200).json({ message: 'Event already processed' });
    }

    const { data: payment } = await supabaseAdmin
      .from('payments')
      .select('id, order_id, status')
      .eq('paymongo_payment_id', paymentIntentId)
      .single();

    if (!payment) {
      console.error('No payment found for intent:', paymentIntentId);
      return res.status(200).json({ message: 'Payment not found, skipping' });
    }

    if (eventType === 'payment.paid') {
      await supabaseAdmin
        .from('payments')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
        })
        .eq('id', payment.id);

      const { data: order } = await supabaseAdmin
        .from('orders')
        .select('id, buyer_id, payment_status')
        .eq('id', payment.order_id)
        .single();

      if (order && order.payment_status !== 'paid') {
        await supabaseAdmin
          .from('orders')
          .update({
            payment_status: 'paid',
            status: 'confirmed',
            confirmed_at: new Date().toISOString(),
          })
          .eq('id', order.id);

        const { data: orderItems } = await supabaseAdmin
          .from('order_items')
          .select('listing_id, quantity')
          .eq('order_id', order.id);

        if (orderItems) {
          for (const item of orderItems) {
            const { data: listing } = await supabaseAdmin
              .from('listings')
              .select('quantity_available, sold_count')
              .eq('id', item.listing_id)
              .single();

            if (listing) {
              await supabaseAdmin
                .from('listings')
                .update({
                  quantity_available: Math.max(0, listing.quantity_available - item.quantity),
                  sold_count: (listing.sold_count || 0) + item.quantity,
                })
                .eq('id', item.listing_id);
            }
          }

          const cartItemIds = [];
          for (const item of orderItems) {
            const { data: cartItem } = await supabaseAdmin
              .from('cart_items')
              .select('id')
              .eq('user_id', order.buyer_id)
              .eq('listing_id', item.listing_id)
              .single();
            if (cartItem) cartItemIds.push(cartItem.id);
          }

          if (cartItemIds.length > 0) {
            await supabaseAdmin
              .from('cart_items')
              .delete()
              .in('id', cartItemIds);
          }
        }

        console.log(`Order ${order.id} confirmed via webhook`);
      }
    } else if (eventType === 'payment.failed' || eventType === 'payment.expired') {
      await supabaseAdmin
        .from('payments')
        .update({ status: 'failed' })
        .eq('id', payment.id);

      await supabaseAdmin
        .from('orders')
        .update({ payment_status: 'failed' })
        .eq('id', payment.order_id);

      console.log(`Order ${payment.order_id} payment ${eventType}`);
    }

    res.status(200).json({ message: 'Webhook processed' });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(200).json({ message: 'Error logged' });
  }
};

// ============================================================
// GET PAYMENT STATUS
// ============================================================

const getPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, buyer_id, status, payment_method, payment_status, order_number, total')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.buyer_id !== userId && req.user.profile?.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { data: payment } = await supabaseAdmin
      .from('payments')
      .select('id, paymongo_payment_id, amount, method, status, paid_at')
      .eq('order_id', orderId)
      .single();

    if (payment && payment.paymongo_payment_id && payment.status === 'pending') {
      try {
        const intent = await paymongoService.retrievePaymentIntent(payment.paymongo_payment_id);

        if (intent.status === 'succeeded') {
          await supabaseAdmin
            .from('payments')
            .update({ status: 'paid', paid_at: new Date().toISOString() })
            .eq('id', payment.id);
          await supabaseAdmin
            .from('orders')
            .update({ payment_status: 'paid', status: 'confirmed' })
            .eq('id', orderId);
          payment.status = 'paid';
          order.payment_status = 'paid';
          order.status = 'confirmed';
        } else if (intent.status === 'awaiting_payment_method' || intent.status === 'cancelled') {
          await supabaseAdmin
            .from('payments')
            .update({ status: 'failed' })
            .eq('id', payment.id);
          await supabaseAdmin
            .from('orders')
            .update({ payment_status: 'failed' })
            .eq('id', orderId);
          payment.status = 'failed';
          order.payment_status = 'failed';
        }
      } catch (intentErr) {
        console.error('Failed to check intent status:', intentErr.message);
      }
    }

    res.json({
      order: {
        id: order.id,
        order_number: order.order_number,
        status: order.status,
        total: order.total,
        payment_method: order.payment_method,
        payment_status: order.payment_status,
      },
      payment: payment || null,
    });
  } catch (err) {
    console.error('Get payment status error:', err);
    res.status(500).json({ error: 'Failed to get payment status' });
  }
};

// ============================================================
// EXPIRE PAYMENT
// ============================================================

const expirePayment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const { data: payment, error: fetchError } = await supabaseAdmin
      .from('payments')
      .select('id, order_id, paymongo_payment_id, status')
      .eq('id', id)
      .single();

    if (fetchError || !payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('buyer_id')
      .eq('id', payment.order_id)
      .single();

    if (order?.buyer_id !== userId && req.user.profile?.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    if (payment.status !== 'pending') {
      return res.status(400).json({ error: 'Payment is not pending' });
    }

    if (payment.paymongo_payment_id) {
      try {
        await paymongoService.cancelPaymentIntent(payment.paymongo_payment_id);
      } catch (cancelErr) {
        console.error('Failed to cancel intent:', cancelErr.message);
      }
    }

    await supabaseAdmin
      .from('payments')
      .update({ status: 'failed' })
      .eq('id', payment.id);

    await supabaseAdmin
      .from('orders')
      .update({ payment_status: 'failed' })
      .eq('id', payment.order_id);

    res.json({ message: 'Payment expired' });
  } catch (err) {
    console.error('Expire payment error:', err);
    res.status(500).json({ error: 'Failed to expire payment' });
  }
};

module.exports = {
  createCheckout,
  handleWebhook,
  getPaymentStatus,
  expirePayment,
};
