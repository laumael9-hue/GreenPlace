const { supabaseAdmin } = require('../config/supabase');
const crypto = require('crypto');

// ============================================================
// UTILITY: Generate Order Number
// ============================================================

const generateOrderNumber = () => {
  const date = new Date();
  const datePart = date.toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `GP-${datePart}-${randomPart}`;
};

// ============================================================
// CHECKOUT: Create order from cart items
// ============================================================

const checkout = async (req, res) => {
  try {
    const userId = req.user.id;
    const { cartItemIds, notes, paymentMethod = 'cash_on_pickup', preferredPickupDate, preferredPickupTime } = req.body;

    if (!cartItemIds || !Array.isArray(cartItemIds) || cartItemIds.length === 0) {
      return res.status(400).json({ error: 'At least one cart item is required' });
    }

    const validPaymentMethods = ['cash_on_pickup', 'paymongo_gcash', 'paymongo_maya', 'paymongo_card'];
    if (!validPaymentMethods.includes(paymentMethod)) {
      return res.status(400).json({ error: 'Invalid payment method' });
    }

    if (!preferredPickupDate) {
      return res.status(400).json({ error: 'Preferred pickup date is required' });
    }

    const validPickupTimes = ['morning', 'afternoon', 'evening'];
    if (preferredPickupTime && !validPickupTimes.includes(preferredPickupTime)) {
      return res.status(400).json({ error: 'Invalid pickup time. Must be "morning" or "afternoon"' });
    }

    // Fetch cart items with listing details
    const { data: cartItems, error: cartError } = await supabaseAdmin
      .from('cart_items')
      .select(`
        id, quantity,
        listing:listings(
          id, title, price, quantity_available, status, seller_id, business_id,
          seller:profiles(id, first_name, last_name)
        )
      `)
      .eq('user_id', userId)
      .in('id', cartItemIds);

    if (cartError) {
      return res.status(400).json({ error: cartError.message });
    }

    if (!cartItems || cartItems.length === 0) {
      return res.status(404).json({ error: 'Cart items not found' });
    }

    // Validate all items are available
    const unavailableItems = cartItems.filter(item =>
      !item.listing || item.listing.status !== 'active' || item.quantity > item.listing.quantity_available
    );

    if (unavailableItems.length > 0) {
      const titles = unavailableItems.map(i => i.listing?.title || 'Unknown item');
      return res.status(400).json({
        error: `Some items are no longer available: ${titles.join(', ')}`
      });
    }

    // Group items by business_id (one order per business)
    const businessGroups = {};
    cartItems.forEach(item => {
      const businessId = item.listing.business_id || 'individual';
      if (!businessGroups[businessId]) {
        businessGroups[businessId] = [];
      }
      businessGroups[businessId].push(item);
    });

    const createdOrders = [];

    for (const [businessId, items] of Object.entries(businessGroups)) {
      // Fetch business address for pickup
      let pickupAddress = null;
      let pickupLatitude = null;
      let pickupLongitude = null;
      if (businessId !== 'individual') {
        const { data: business } = await supabaseAdmin
          .from('businesses')
          .select('address, latitude, longitude')
          .eq('id', businessId)
          .single();
        if (business) {
          pickupAddress = business.address;
          pickupLatitude = business.latitude;
          pickupLongitude = business.longitude;
        }
      }

      // Calculate totals
      let subtotal = 0;
      const orderItems = items.map(item => {
        const itemTotal = parseFloat(item.listing.price) * item.quantity;
        subtotal += itemTotal;
        return {
          listing_id: item.listing.id,
          seller_id: item.listing.seller_id,
          title: item.listing.title,
          price: parseFloat(item.listing.price),
          quantity: item.quantity,
          total: Math.round(itemTotal * 100) / 100,
        };
      });

      subtotal = Math.round(subtotal * 100) / 100;
      const total = subtotal; // No shipping for Cash on Pickup

      // Create order
      const orderNumber = generateOrderNumber();
      const { data: order, error: orderError } = await supabaseAdmin
        .from('orders')
        .insert({
          buyer_id: userId,
          business_id: businessId === 'individual' ? null : businessId,
          order_number: orderNumber,
          status: 'pending',
          subtotal,
          shipping_fee: 0,
          total,
          payment_method: paymentMethod,
          payment_status: paymentMethod === 'cash_on_pickup' ? 'pending' : 'pending',
          pickup_address: pickupAddress,
          pickup_latitude: pickupLatitude,
          pickup_longitude: pickupLongitude,
          preferred_pickup_date: preferredPickupDate,
          preferred_pickup_time: preferredPickupTime || 'morning',
          notes: notes || null,
        })
        .select()
        .single();

      if (orderError) {
        console.error('Create order error:', orderError);
        return res.status(400).json({ error: 'Failed to create order' });
      }

      // Create order items
      const orderItemsWithOrderId = orderItems.map(item => ({
        ...item,
        order_id: order.id,
      }));

      const { error: itemsError } = await supabaseAdmin
        .from('order_items')
        .insert(orderItemsWithOrderId);

      if (itemsError) {
        console.error('Create order items error:', itemsError);
        return res.status(400).json({ error: 'Failed to create order items' });
      }

      // Update listing quantities
      for (const item of items) {
        await supabaseAdmin
          .from('listings')
          .update({
            quantity_available: item.listing.quantity_available - item.quantity,
            sold_count: (item.listing.sold_count || 0) + item.quantity,
          })
          .eq('id', item.listing.id);
      }

      // Remove purchased items from cart
      const cartItemIdsForOrder = items.map(i => i.id);
      await supabaseAdmin
        .from('cart_items')
        .delete()
        .in('id', cartItemIdsForOrder);

      // Create payment record for cash on pickup
      if (paymentMethod === 'cash_on_pickup') {
        await supabaseAdmin
          .from('payments')
          .insert({
            order_id: order.id,
            amount: total,
            method: 'cash_on_pickup',
            status: 'pending',
          });
      }

      createdOrders.push(order);
    }

    res.status(201).json({
      message: 'Order(s) placed successfully',
      orders: createdOrders,
    });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: 'Failed to process checkout' });
  }
};

// ============================================================
// GET ORDERS: Buyer's order history
// ============================================================

const getOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabaseAdmin
      .from('orders')
      .select(`
        id, order_number, status, subtotal, shipping_fee, total,
        payment_method, payment_status, pickup_address,
        preferred_pickup_date, preferred_pickup_time,
        confirmed_at, completed_at, cancelled_at, created_at,
        business:businesses(id, name, slug, logo_url),
        items:order_items(id, listing_id, title, price, quantity, total)
      `, { count: 'exact' })
      .eq('buyer_id', userId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    query = query.range(offset, offset + parseInt(limit) - 1);

    const { data: orders, count, error } = await query;

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Fetch listing images for all items
    const listingIds = [...new Set(
      (orders || []).flatMap(o => o.items?.map(i => i.listing_id).filter(Boolean) || [])
    )];

    let imagesMap = {};
    if (listingIds.length > 0) {
      const { data: images } = await supabaseAdmin
        .from('listing_images')
        .select('listing_id, image_url, is_primary, sort_order')
        .in('listing_id', listingIds);

      if (images) {
        images.forEach(img => {
          if (!imagesMap[img.listing_id]) imagesMap[img.listing_id] = [];
          imagesMap[img.listing_id].push(img);
        });
      }
    }

    // Attach primary image to each item
    const ordersWithImages = (orders || []).map(order => ({
      ...order,
      items: (order.items || []).map(item => {
        const imgs = imagesMap[item.listing_id] || [];
        const primaryImage = imgs.find(i => i.is_primary)?.image_url
          || imgs.sort((a, b) => a.sort_order - b.sort_order)[0]?.image_url
          || null;
        return { ...item, listing_image: primaryImage };
      }),
    }));

    const total = count || 0;
    const pages = Math.ceil(total / parseInt(limit));

    res.json({
      orders: ordersWithImages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages,
      },
    });
  } catch (err) {
    console.error('Get orders error:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
};

// ============================================================
// GET ORDER BY ID
// ============================================================

const getOrderById = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.profile?.role;
    const { id } = req.params;

    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select(`
        id, order_number, status, subtotal, shipping_fee, total,
        payment_method, payment_status, pickup_address,
        pickup_latitude, pickup_longitude, notes,
        preferred_pickup_date, preferred_pickup_time,
        confirmed_at, completed_at, cancelled_at, cancellation_reason,
        created_at, updated_at,
        buyer_id, business_id
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Get order query error:', error);
      return res.status(400).json({ error: error.message });
    }
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Use req.user.profile for buyer (already loaded by auth middleware)
    const buyer = { id: userId, first_name: req.user.profile?.first_name, last_name: req.user.profile?.last_name, email: req.user.profile?.email, phone: req.user.profile?.phone };

    const [businessResult, itemsResult, paymentsResult] = await Promise.all([
      supabaseAdmin.from('businesses').select('id, name, slug, logo_url, phone, address, latitude, longitude').eq('id', order.business_id).single(),
      supabaseAdmin.from('order_items').select('id, title, price, quantity, total, listing_id, seller_id').eq('order_id', order.id),
      supabaseAdmin.from('payments').select('id, amount, method, status, paid_at, created_at').eq('order_id', order.id),
    ]);

    const business = businessResult.data;
    const items = itemsResult.data || [];
    const payments = paymentsResult.data || [];

    // Fetch listing info and images for items
    const listingIds = items.map(item => item.listing_id).filter(Boolean);
    const sellerIds = items.map(item => item.seller_id).filter(Boolean);

    const [listingsResult, sellersResult, imagesResult] = await Promise.all([
      listingIds.length > 0
        ? supabaseAdmin.from('listings').select('id, slug').in('id', listingIds)
        : { data: [] },
      sellerIds.length > 0
        ? supabaseAdmin.from('profiles').select('id, first_name, last_name').in('id', sellerIds)
        : { data: [] },
      listingIds.length > 0
        ? supabaseAdmin.from('listing_images').select('listing_id, image_url, is_primary, sort_order').in('listing_id', listingIds)
        : { data: [] },
    ]);

    const listingsMap = {};
    (listingsResult.data || []).forEach(l => { listingsMap[l.id] = l; });
    const sellersMap = {};
    (sellersResult.data || []).forEach(s => { sellersMap[s.id] = s; });
    const imagesByListing = {};
    (imagesResult.data || []).forEach(img => {
      if (!imagesByListing[img.listing_id]) imagesByListing[img.listing_id] = [];
      imagesByListing[img.listing_id].push(img);
    });

    // Check authorization: buyer, business owner, or admin
    const isBuyer = order.buyer_id === userId;
    const isBusinessOwner = userRole === 'business';
    const isAdmin = userRole === 'admin';

    // For business owners, verify they own this business
    if (isBusinessOwner && !isAdmin) {
      const { data: businessProfile } = await supabaseAdmin
        .from('businesses')
        .select('id')
        .eq('owner_id', userId)
        .single();

      if (!businessProfile || businessProfile.id !== business?.id) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
    }

    if (!isBuyer && !isBusinessOwner && !isAdmin) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Enrich items with listing and seller data
    const enrichedItems = items.map(item => {
      const listing = listingsMap[item.listing_id];
      const images = imagesByListing[item.listing_id] || [];
      const primaryImage = images.find(img => img.is_primary)?.image_url
        || images.sort((a, b) => a.sort_order - b.sort_order)[0]?.image_url
        || null;
      return {
        ...item,
        listing: {
          id: listing?.id,
          slug: listing?.slug,
          primary_image: primaryImage,
        },
        seller: sellersMap[item.seller_id] || null,
      };
    });

    res.json({
      order: { ...order, buyer, business, items: enrichedItems, payments },
    });
  } catch (err) {
    console.error('Get order error:', err);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
};

// ============================================================
// UPDATE ORDER STATUS: Business updates order status
// ============================================================

const updateOrderStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.profile?.role;
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['confirmed', 'processing', 'ready_for_pickup', 'completed'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    // Fetch order
    const { data: order, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('id, business_id, status, buyer_id')
      .eq('id', id)
      .single();

    if (fetchError || !order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Verify business ownership or admin
    if (userRole === 'business') {
      const { data: businessProfile } = await supabaseAdmin
        .from('businesses')
        .select('id')
        .eq('owner_id', userId)
        .single();

      if (!businessProfile || businessProfile.id !== order.business_id) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
    } else if (userRole !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Validate status transitions
    const validTransitions = {
      pending: ['confirmed'],
      confirmed: ['processing', 'cancelled'],
      processing: ['ready_for_pickup', 'cancelled'],
      ready_for_pickup: ['completed'],
    };

    if (!validTransitions[order.status]?.includes(status)) {
      return res.status(400).json({
        error: `Cannot transition from "${order.status}" to "${status}"`
      });
    }

    // Build update object
    const updates = { status };
    if (status === 'confirmed') updates.confirmed_at = new Date().toISOString();
    if (status === 'completed') updates.completed_at = new Date().toISOString();

    const { data: updatedOrder, error: updateError } = await supabaseAdmin
      .from('orders')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }

    // If completed, update payment status for cash on pickup
    if (status === 'completed' && order.payment_method === 'cash_on_pickup') {
      await supabaseAdmin
        .from('payments')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('order_id', id)
        .eq('method', 'cash_on_pickup');
    }

    res.json({
      message: `Order status updated to "${status}"`,
      order: updatedOrder,
    });
  } catch (err) {
    console.error('Update order status error:', err);
    res.status(500).json({ error: 'Failed to update order status' });
  }
};

// ============================================================
// CANCEL ORDER
// ============================================================

const cancelOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.profile?.role;
    const { id } = req.params;
    const { cancellation_reason } = req.body;

    // Fetch order with items
    const { data: order, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select(`
        id, buyer_id, business_id, status, payment_method,
        items:order_items(id, listing_id, quantity)
      `)
      .eq('id', id)
      .single();

    if (fetchError || !order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Check authorization
    const isBuyer = order.buyer_id === userId;
    let isBusinessOwner = false;

    if (userRole === 'business') {
      const { data: businessProfile } = await supabaseAdmin
        .from('businesses')
        .select('id')
        .eq('owner_id', userId)
        .single();
      isBusinessOwner = businessProfile?.id === order.business_id;
    }

    if (!isBuyer && !isBusinessOwner && userRole !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Check if order can be cancelled
    if (!['pending', 'confirmed', 'processing'].includes(order.status)) {
      return res.status(400).json({
        error: `Cannot cancel order with status "${order.status}"`
      });
    }

    // Update order status
    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: cancellation_reason || null,
      })
      .eq('id', id);

    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }

    // Restore listing quantities
    for (const item of order.items) {
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

    // Update payment status
    if (order.payment_method === 'cash_on_pickup') {
      await supabaseAdmin
        .from('payments')
        .update({ status: 'refunded' })
        .eq('order_id', id)
        .eq('method', 'cash_on_pickup');
    }

    res.json({ message: 'Order cancelled successfully' });
  } catch (err) {
    console.error('Cancel order error:', err);
    res.status(500).json({ error: 'Failed to cancel order' });
  }
};

// ============================================================
// GET BUSINESS ORDERS: Business views incoming orders
// ============================================================

const getBusinessOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get business ID for this user
    const { data: business } = await supabaseAdmin
      .from('businesses')
      .select('id')
      .eq('owner_id', userId)
      .single();

    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    let query = supabaseAdmin
      .from('orders')
      .select(`
        id, order_number, status, subtotal, total,
        payment_method, payment_status, pickup_address, notes,
        preferred_pickup_date, preferred_pickup_time,
        confirmed_at, completed_at, cancelled_at, created_at,
        items:order_items(id, title, price, quantity, total)
      `, { count: 'exact' })
      .eq('business_id', business.id)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    query = query.range(offset, offset + parseInt(limit) - 1);

    const { data: orders, count, error } = await query;

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Fetch buyer info for each order separately
    const buyerIds = [...new Set((orders || []).map(o => o.buyer_id))];
    let buyersMap = {};
    if (buyerIds.length > 0) {
      const { data: buyers } = await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name, phone')
        .in('id', buyerIds);
      if (buyers) {
        buyers.forEach(b => { buyersMap[b.id] = b; });
      }
    }

    const ordersWithBuyers = (orders || []).map(o => ({
      ...o,
      buyer: buyersMap[o.buyer_id] || null,
    }));

    const total = count || 0;
    const pages = Math.ceil(total / parseInt(limit));

    res.json({
      orders: ordersWithBuyers,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages },
    });
  } catch (err) {
    console.error('Get business orders error:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
};

module.exports = {
  checkout,
  getOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder,
  getBusinessOrders,
};
