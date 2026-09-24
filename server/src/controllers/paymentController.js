const { supabaseAdmin } = require('../config/supabase');
const paymongoService = require('../services/paymongo');
const { createNotification } = require('../services/notifications');
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

    const returnUrl = `${CLIENT_URL}/payment/success?order_id=${order.id}`;
    const attached = await paymongoService.attachPaymentMethod(intent.id, method.id, returnUrl);

    await supabaseAdmin
      .from('payments')
      .update({ paymongo_payment_id: intent.id })
      .eq('order_id', orderId)
      .eq('status', 'pending');

    let checkoutUrl = null;
    if (attached.next_action?.redirect?.url) {
      checkoutUrl = attached.next_action.redirect.url;
    }

    console.log('PayMongo checkout created:', {
      intentId: intent.id,
      methodId: method.id,
      checkoutUrl,
    });

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

        await createNotification({
          userId: order.buyer_id,
          type: 'order',
          title: 'Payment received',
          body: 'Your payment has been received and your order is confirmed.',
          data: { link: `/orders/${order.id}` },
        });
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

      const { data: failedOrder } = await supabaseAdmin
        .from('orders')
        .select('id, buyer_id')
        .eq('id', payment.order_id)
        .single();

      if (failedOrder?.buyer_id) {
        await createNotification({
          userId: failedOrder.buyer_id,
          type: 'order',
          title: 'Payment failed',
          body: eventType === 'payment.expired'
            ? 'Your payment session expired. Please try checking out again.'
            : 'Your payment could not be processed. Please try again.',
          data: { link: `/orders/${failedOrder.id}` },
        });
      }
    }

    res.status(200).json({ message: 'Webhook processed' });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(200).json({ message: 'Error logged' });
  }
};

// ============================================================
// HELPER: Check pending PayMongo payment via API
// ============================================================

const checkPendingPaymentStatus = async (payment, orderId) => {
  if (!payment || !payment.paymongo_payment_id || payment.status !== 'pending') {
    return { payment, updated: false };
  }

  try {
    const intent = await paymongoService.retrievePaymentIntent(payment.paymongo_payment_id);

    if (intent.status === 'succeeded') {
      await supabaseAdmin
        .from('payments')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', payment.id);
      await supabaseAdmin
        .from('orders')
        .update({ payment_status: 'paid', status: 'confirmed', confirmed_at: new Date().toISOString() })
        .eq('id', orderId);
      payment.status = 'paid';

      const { data: paidOrder } = await supabaseAdmin
        .from('orders')
        .select('id, buyer_id')
        .eq('id', orderId)
        .single();

      if (paidOrder?.buyer_id) {
        await createNotification({
          userId: paidOrder.buyer_id,
          type: 'order',
          title: 'Payment received',
          body: 'Your payment has been received and your order is confirmed.',
          data: { link: `/orders/${paidOrder.id}` },
        });
      }

      return { payment, updated: true, payment_status: 'paid', order_status: 'confirmed' };
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
      return { payment, updated: true, payment_status: 'failed', order_status: null };
    }
  } catch (err) {
    console.error('Failed to check intent status:', err.message);
  }

  return { payment, updated: false };
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
      const result = await checkPendingPaymentStatus(payment, orderId);
      if (result.updated) {
        payment.status = result.payment_status;
        order.payment_status = result.payment_status;
        if (result.order_status) order.status = result.order_status;
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

// ============================================================
// UPLOAD REFUND IMAGE: Upload image for refund request
// ============================================================

const uploadRefundImage = async (req, res) => {
  try {
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.file;
    const ext = file.originalname.split('.').pop();
    const fileName = `refunds/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('refund-images')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return res.status(400).json({ error: 'Failed to upload image' });
    }

    const { data: urlData } = supabaseAdmin.storage
      .from('refund-images')
      .getPublicUrl(fileName);

    res.status(201).json({
      message: 'Image uploaded successfully',
      image_url: urlData.publicUrl,
    });
  } catch (err) {
    console.error('Upload refund image error:', err);
    res.status(500).json({ error: 'Failed to upload image' });
  }
};

// ============================================================
// REQUEST REFUND: Buyer requests a refund
// ============================================================

const requestRefund = async (req, res) => {
  try {
    const userId = req.user.id;
    const { orderId } = req.params;
    const { reason, images } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Refund reason is required' });
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, buyer_id, business_id, status, payment_status, payment_method, total, order_number')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.buyer_id !== userId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    if (order.status !== 'completed') {
      return res.status(400).json({ error: 'Only completed orders can be refunded' });
    }

    if (order.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Only paid orders can be refunded' });
    }

    const { data: existingRefund } = await supabaseAdmin
      .from('refunds')
      .select('id')
      .eq('order_id', orderId)
      .in('status', ['pending', 'approved'])
      .single();

    if (existingRefund) {
      return res.status(400).json({ error: 'A refund request is already pending for this order' });
    }

    const { data: refund, error: refundError } = await supabaseAdmin
      .from('refunds')
      .insert({
        order_id: orderId,
        amount: order.total,
        reason: reason.trim(),
        status: 'pending',
        requested_by: userId,
        images: images && images.length > 0 ? images.slice(0, 3) : [],
      })
      .select()
      .single();

    if (refundError) {
      console.error('Create refund error:', refundError);
      return res.status(400).json({ error: 'Failed to create refund request' });
    }

    await supabaseAdmin
      .from('orders')
      .update({
        refund_status: 'requested',
        refund_reason: reason.trim(),
        refund_requested_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (order.business_id) {
      const { data: business } = await supabaseAdmin
        .from('businesses')
        .select('owner_id')
        .eq('id', order.business_id)
        .single();

      if (business?.owner_id && business.owner_id !== userId) {
        await createNotification({
          userId: business.owner_id,
          type: 'order',
          title: 'Refund requested',
          body: `A refund has been requested for order ${order.order_number}.`,
          data: { link: `/orders/${order.id}` },
        });
      }
    }

    res.status(201).json({
      message: 'Refund request submitted',
      refund,
    });
  } catch (err) {
    console.error('Request refund error:', err);
    res.status(500).json({ error: 'Failed to request refund' });
  }
};

// ============================================================
// EDIT REFUND: Buyer edits pending refund request
// ============================================================

const editRefund = async (req, res) => {
  try {
    const userId = req.user.id;
    const { orderId } = req.params;
    const { reason, images } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Refund reason is required' });
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, buyer_id, status')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.buyer_id !== userId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    if (order.status !== 'completed') {
      return res.status(400).json({ error: 'Only completed orders can have refund requests edited' });
    }

    const { data: existingRefund, error: refundLookupError } = await supabaseAdmin
      .from('refunds')
      .select('id, status')
      .eq('order_id', orderId)
      .eq('status', 'pending')
      .single();

    if (refundLookupError || !existingRefund) {
      return res.status(404).json({ error: 'No pending refund request found' });
    }

    const updateData = { reason: reason.trim() };
    if (images !== undefined) {
      updateData.images = images && images.length > 0 ? images.slice(0, 3) : [];
    }

    const { data: refund, error: updateError } = await supabaseAdmin
      .from('refunds')
      .update(updateData)
      .eq('id', existingRefund.id)
      .select()
      .single();

    if (updateError) {
      console.error('Edit refund error:', updateError);
      return res.status(400).json({ error: 'Failed to update refund request' });
    }

    await supabaseAdmin
      .from('orders')
      .update({ refund_reason: reason.trim() })
      .eq('id', orderId);

    res.json({
      message: 'Refund request updated',
      refund,
    });
  } catch (err) {
    console.error('Edit refund error:', err);
    res.status(500).json({ error: 'Failed to update refund request' });
  }
};

// ============================================================
// PROCESS REFUND: Business approves/refunds or rejects
// ============================================================

const processRefund = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.profile?.role;
    const { refundId } = req.params;
    const { action } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Action must be "approve" or "reject"' });
    }

    const { data: refund, error: refundError } = await supabaseAdmin
      .from('refunds')
      .select(`
        id, order_id, amount, reason, status,
        order:orders(id, order_number, buyer_id, business_id, total, payment_method, payment_status)
      `)
      .eq('id', refundId)
      .single();

    if (refundError || !refund) {
      return res.status(404).json({ error: 'Refund not found' });
    }

    if (refund.status !== 'pending') {
      return res.status(400).json({ error: 'This refund has already been processed' });
    }

    if (userRole !== 'admin') {
      const { data: business } = await supabaseAdmin
        .from('businesses')
        .select('id')
        .eq('owner_id', userId)
        .single();

      if (!business || business.id !== refund.order?.business_id) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
    }

    if (action === 'approve') {
      let paymongoRefundId = null;

      if (refund.order.payment_method !== 'cash_on_pickup' && refund.order.payment_status === 'paid') {
        const { data: payment } = await supabaseAdmin
          .from('payments')
          .select('id, paymongo_payment_id, amount')
          .eq('order_id', refund.order_id)
          .single();

        if (payment?.paymongo_payment_id) {
          try {
            const amountInCentavos = Math.round(parseFloat(refund.amount) * 100);
            const paymongoRefund = await paymongoService.refundPayment(
              payment.paymongo_payment_id,
              amountInCentavos,
              'requested_by_customer'
            );
            paymongoRefundId = paymongoRefund.id;
          } catch (refundErr) {
            console.error('PayMongo refund failed:', refundErr?.response?.data || refundErr.message);
            return res.status(500).json({ error: 'Failed to process payment refund. Please try again.' });
          }
        }
      }

      await supabaseAdmin
        .from('refunds')
        .update({
          status: 'refunded',
          paymongo_refund_id: paymongoRefundId,
          processed_by: userId,
        })
        .eq('id', refundId);

      await supabaseAdmin
        .from('orders')
        .update({
          refund_status: 'refunded',
          payment_status: 'refunded',
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          refunded_at: new Date().toISOString(),
        })
        .eq('id', refund.order_id);

      await supabaseAdmin
        .from('payments')
        .update({ status: 'refunded' })
        .eq('order_id', refund.order_id);

      // Restore listing quantities
      const { data: orderItems } = await supabaseAdmin
        .from('order_items')
        .select('listing_id, quantity')
        .eq('order_id', refund.order_id);

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
                quantity_available: listing.quantity_available + item.quantity,
                sold_count: Math.max(0, (listing.sold_count || 0) - item.quantity),
              })
              .eq('id', item.listing_id);
          }
        }
      }

      if (refund.order?.buyer_id) {
        await createNotification({
          userId: refund.order.buyer_id,
          type: 'order',
          title: 'Refund approved',
          body: `Your refund for order ${refund.order.order_number} has been approved and processed.`,
          data: { link: `/orders/${refund.order.id}` },
        });
      }

      res.json({ message: 'Refund approved and processed' });
    } else {
      await supabaseAdmin
        .from('refunds')
        .update({
          status: 'rejected',
          processed_by: userId,
        })
        .eq('id', refundId);

      await supabaseAdmin
        .from('orders')
        .update({ refund_status: 'rejected' })
        .eq('id', refund.order_id);

      if (refund.order?.buyer_id) {
        await createNotification({
          userId: refund.order.buyer_id,
          type: 'order',
          title: 'Refund rejected',
          body: `Your refund request for order ${refund.order.order_number} was rejected.`,
          data: { link: `/orders/${refund.order.id}` },
        });
      }

      res.json({ message: 'Refund request rejected' });
    }
  } catch (err) {
    console.error('Process refund error:', err);
    res.status(500).json({ error: 'Failed to process refund' });
  }
};

// ============================================================
// GET REFUNDS: List refunds for business orders
// ============================================================

const getRefunds = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.profile?.role;
    const { status } = req.query;

    let query = supabaseAdmin
      .from('refunds')
      .select(`
        id, order_id, amount, reason, status, paymongo_refund_id,
        refund_requested_at:created_at,
        created_at, updated_at,
        order:orders(id, order_number, buyer_id, business_id,
          buyer:profiles(id, first_name, last_name)
        )
      `)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (userRole !== 'admin') {
      const { data: business } = await supabaseAdmin
        .from('businesses')
        .select('id')
        .eq('owner_id', userId)
        .single();

      if (!business) {
        return res.status(404).json({ error: 'Business not found' });
      }

      query = query.eq('order.business_id', business.id);
    }

    const { data: refunds, error } = await query;

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ refunds: refunds || [] });
  } catch (err) {
    console.error('Get refunds error:', err);
    res.status(500).json({ error: 'Failed to fetch refunds' });
  }
};

// ============================================================
// REQUEST BUSINESS REFUND: Business refunds any order
// ============================================================

const requestWalkInRefund = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.profile?.role;
    const { orderId } = req.params;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Refund reason is required' });
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, buyer_id, business_id, status, payment_status, payment_method, total')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Verify business ownership or admin
    if (userRole !== 'admin') {
      const { data: business } = await supabaseAdmin
        .from('businesses')
        .select('id')
        .eq('owner_id', userId)
        .single();

      if (!business || business.id !== order.business_id) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
    }

    if (order.status !== 'completed') {
      return res.status(400).json({ error: 'Only completed orders can be refunded' });
    }

    // Check no existing pending/refunded refund
    const { data: existingRefund } = await supabaseAdmin
      .from('refunds')
      .select('id')
      .eq('order_id', orderId)
      .in('status', ['pending', 'refunded'])
      .single();

    if (existingRefund) {
      return res.status(400).json({ error: 'A refund already exists for this order' });
    }

    // Process PayMongo refund for non-cash orders
    let paymongoRefundId = null;
    if (order.payment_method !== 'cash_on_pickup' && order.payment_status === 'paid') {
      const { data: payment } = await supabaseAdmin
        .from('payments')
        .select('id, paymongo_payment_id, amount')
        .eq('order_id', orderId)
        .single();

      if (payment?.paymongo_payment_id) {
        try {
          const amountInCentavos = Math.round(parseFloat(order.total) * 100);
          const paymongoRefund = await paymongoService.refundPayment(
            payment.paymongo_payment_id,
            amountInCentavos,
            'requested_by_customer'
          );
          paymongoRefundId = paymongoRefund.id;
        } catch (refundErr) {
          console.error('PayMongo refund failed:', refundErr?.response?.data || refundErr.message);
          return res.status(500).json({ error: 'Failed to process payment refund. Please try again.' });
        }
      }
    }

    // Create refund record — immediately refunded (auto-approved)
    const { data: refund, error: refundError } = await supabaseAdmin
      .from('refunds')
      .insert({
        order_id: orderId,
        amount: order.total,
        reason: reason.trim(),
        status: 'refunded',
        paymongo_refund_id: paymongoRefundId,
        requested_by: userId,
        processed_by: userId,
        images: [],
      })
      .select()
      .single();

    if (refundError) {
      console.error('Create business refund error:', refundError);
      return res.status(400).json({ error: 'Failed to process refund' });
    }

    // Update order
    await supabaseAdmin
      .from('orders')
      .update({
        refund_status: 'refunded',
        refund_reason: reason.trim(),
        refund_requested_at: new Date().toISOString(),
        payment_status: 'refunded',
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        refunded_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    // Update payment
    await supabaseAdmin
      .from('payments')
      .update({ status: 'refunded' })
      .eq('order_id', orderId);

    // Restore listing quantities
    const { data: orderItems } = await supabaseAdmin
      .from('order_items')
      .select('listing_id, quantity')
      .eq('order_id', orderId);

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
              quantity_available: listing.quantity_available + item.quantity,
              sold_count: Math.max(0, (listing.sold_count || 0) - item.quantity),
            })
            .eq('id', item.listing_id);
        }
      }
    }

    res.json({ message: 'Refund processed successfully', refund });
  } catch (err) {
    console.error('Request business refund error:', err);
    res.status(500).json({ error: 'Failed to process refund' });
  }
};

// ============================================================
// CANCEL REFUND REQUEST: Buyer cancels a pending refund
// ============================================================

const cancelRefund = async (req, res) => {
  try {
    const userId = req.user.id;
    const { refundId } = req.params;

    const { data: refund, error: refundError } = await supabaseAdmin
      .from('refunds')
      .select('id, order_id, status, requested_by')
      .eq('id', refundId)
      .single();

    if (refundError || !refund) {
      return res.status(404).json({ error: 'Refund not found' });
    }

    if (refund.requested_by !== userId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    if (refund.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending refund requests can be cancelled' });
    }

    await supabaseAdmin
      .from('refunds')
      .update({ status: 'cancelled' })
      .eq('id', refundId);

    await supabaseAdmin
      .from('orders')
      .update({ refund_status: 'none', refund_reason: null, refund_requested_at: null })
      .eq('id', refund.order_id);

    res.json({ message: 'Refund request cancelled' });
  } catch (err) {
    console.error('Cancel refund error:', err);
    res.status(500).json({ error: 'Failed to cancel refund' });
  }
};

module.exports = {
  createCheckout,
  handleWebhook,
  getPaymentStatus,
  expirePayment,
  checkPendingPaymentStatus,
  uploadRefundImage,
  requestRefund,
  editRefund,
  processRefund,
  requestWalkInRefund,
  cancelRefund,
  getRefunds,
};
