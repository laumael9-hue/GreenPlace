const { supabase, supabaseAdmin } = require('../config/supabase');
const crypto = require('crypto');

const BUCKET_IMAGES = 'product-images';

// ============================================================
// UTILITY: Generate Slug
// ============================================================

const generateSlug = (name) => {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const suffix = crypto.randomBytes(3).toString('hex');
  return `${base}-${suffix}`;
};

// ============================================================
// CATEGORIES
// ============================================================

const getCategories = async (req, res) => {
  try {
    const { data: categories, error } = await supabaseAdmin
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ categories: categories || [] });
  } catch (err) {
    console.error('Get categories error:', err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
};

const getCategoryBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const { data: category, error } = await supabaseAdmin
      .from('categories')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (error || !category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json({ category });
  } catch (err) {
    console.error('Get category error:', err);
    res.status(500).json({ error: 'Failed to fetch category' });
  }
};

// ============================================================
// LISTINGS - PUBLIC
// ============================================================

const getListings = async (req, res) => {
  try {
    const {
      page = 1, limit = 20, search = '', category = '',
      minPrice, maxPrice, condition, sort = 'newest',
      city = '', seller, business,
    } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabaseAdmin
      .from('listings')
      .select(`
        id, title, slug, description, price, original_price, unit,
        quantity_available, condition, material_type, status,
        is_featured, view_count, sold_count, city,
        created_at, published_at,
        category:categories(id, name, slug, icon),
        seller:profiles(id, first_name, last_name, avatar_url),
        business:businesses(id, name, slug, logo_url),
        listing_images(id, image_url, alt_text, is_primary, sort_order)
      `, { count: 'exact' })
      .eq('status', 'active');

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,material_type.ilike.%${search}%`);
    }

    if (category) {
      query = query.eq('category_id', category);
    }

    if (minPrice) {
      query = query.gte('price', parseFloat(minPrice));
    }

    if (maxPrice) {
      query = query.lte('price', parseFloat(maxPrice));
    }

    if (condition) {
      query = query.eq('condition', condition);
    }

    if (city) {
      query = query.ilike('city', `%${city}%`);
    }

    if (seller) {
      query = query.eq('seller_id', seller);
    }

    if (business) {
      query = query.eq('business_id', business);
    }

    let orderConfig;
    switch (sort) {
      case 'price_asc':
        orderConfig = { column: 'price', ascending: true };
        break;
      case 'price_desc':
        orderConfig = { column: 'price', ascending: false };
        break;
      case 'popular':
        orderConfig = { column: 'view_count', ascending: false };
        break;
      case 'oldest':
        orderConfig = { column: 'created_at', ascending: true };
        break;
      default:
        orderConfig = { column: 'created_at', ascending: false };
    }

    const { data: listings, count, error } = await query
      .order(orderConfig.column, { ascending: orderConfig.ascending })
      .range(offset, offset + parseInt(limit) - 1);

    if (error) {
      console.error('Supabase error (getListings):', error);
      return res.status(400).json({ error: error.message });
    }

    const enriched = (listings || []).map(l => ({
      ...l,
      primary_image: (l.listing_images || []).find(img => img.is_primary)?.image_url
        || (l.listing_images || [])[0]?.image_url
        || null,
      image_count: (l.listing_images || []).length,
    }));

    res.json({
      listings: enriched,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('Get listings error:', err);
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
};

const getListingBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const { data: listing, error } = await supabaseAdmin
      .from('listings')
      .select(`
        *,
        category:categories(id, name, slug, icon),
        seller:profiles(id, first_name, last_name, avatar_url, city),
        business:businesses(id, name, slug, logo_url, address, phone, email),
        listing_images(id, image_url, alt_text, is_primary, sort_order)
      `)
      .eq('slug', slug)
      .eq('status', 'active')
      .single();

    if (error || !listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    // Increment view count
    await supabaseAdmin
      .from('listings')
      .update({ view_count: (listing.view_count || 0) + 1 })
      .eq('id', listing.id);

    const sortedImages = (listing.listing_images || [])
      .sort((a, b) => a.sort_order - b.sort_order);

    res.json({
      listing: {
        ...listing,
        listing_images: sortedImages,
        view_count: (listing.view_count || 0) + 1,
      },
    });
  } catch (err) {
    console.error('Get listing by slug error:', err);
    res.status(500).json({ error: 'Failed to fetch listing' });
  }
};

const getListingById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: listing, error } = await supabaseAdmin
      .from('listings')
      .select(`
        *,
        category:categories(id, name, slug, icon),
        seller:profiles(id, first_name, last_name, avatar_url, city),
        business:businesses(id, name, slug, logo_url, address, phone, email),
        listing_images(id, image_url, alt_text, is_primary, sort_order)
      `)
      .eq('id', id)
      .single();

    if (error || !listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const sortedImages = (listing.listing_images || [])
      .sort((a, b) => a.sort_order - b.sort_order);

    res.json({ listing: { ...listing, listing_images: sortedImages } });
  } catch (err) {
    console.error('Get listing by id error:', err);
    res.status(500).json({ error: 'Failed to fetch listing' });
  }
};

// ============================================================
// LISTINGS - SELLER CRUD
// ============================================================

const createListing = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      title, description, price, originalPrice, unit,
      quantityAvailable, condition, materialType, weightKg,
      categoryId, businessId, city, latitude, longitude,
    } = req.body;

    if (!title || !description || price == null || !categoryId) {
      return res.status(400).json({
        error: 'Title, description, price, and category are required',
      });
    }

    // Auto-assign business if not provided and user owns a business
    let resolvedBusinessId = businessId || null;
    if (!resolvedBusinessId) {
      const { data: myBusiness } = await supabaseAdmin
        .from('businesses')
        .select('id')
        .eq('owner_id', userId)
        .eq('status', 'approved')
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle();
      if (myBusiness) {
        resolvedBusinessId = myBusiness.id;
      }
    }

    const slug = generateSlug(title);

    const { data: listing, error: insertError } = await supabaseAdmin
      .from('listings')
      .insert({
        seller_id: userId,
        business_id: resolvedBusinessId,
        category_id: categoryId,
        title: title.trim(),
        slug,
        description: description.trim(),
        price: parseFloat(price),
        original_price: originalPrice ? parseFloat(originalPrice) : null,
        unit: unit || 'piece',
        quantity_available: parseInt(quantityAvailable) || 1,
        condition: condition || 'new',
        material_type: materialType?.trim() || null,
        weight_kg: weightKg ? parseFloat(weightKg) : null,
        status: 'draft',
        city: city?.trim() || null,
        latitude: latitude || null,
        longitude: longitude || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Create listing error:', insertError);
      return res.status(400).json({ error: insertError.message });
    }

    res.status(201).json({
      message: 'Listing created successfully',
      listing,
    });
  } catch (err) {
    console.error('Create listing error:', err);
    res.status(500).json({ error: 'Failed to create listing' });
  }
};

const updateListing = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const { data: existing } = await supabaseAdmin
      .from('listings')
      .select('id, seller_id')
      .eq('id', id)
      .single();

    if (!existing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (existing.seller_id !== userId && req.user.profile.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to update this listing' });
    }

    const {
      title, description, price, originalPrice, unit,
      quantityAvailable, condition, materialType, weightKg,
      categoryId, city, latitude, longitude,
    } = req.body;

    const updates = {};
    if (title !== undefined) updates.title = title.trim();
    if (description !== undefined) updates.description = description.trim();
    if (price !== undefined) updates.price = parseFloat(price);
    if (originalPrice !== undefined) updates.original_price = originalPrice ? parseFloat(originalPrice) : null;
    if (unit !== undefined) updates.unit = unit;
    if (quantityAvailable !== undefined) updates.quantity_available = parseInt(quantityAvailable);
    if (condition !== undefined) updates.condition = condition;
    if (materialType !== undefined) updates.material_type = materialType?.trim() || null;
    if (weightKg !== undefined) updates.weight_kg = weightKg ? parseFloat(weightKg) : null;
    if (categoryId !== undefined) updates.category_id = categoryId;
    if (city !== undefined) updates.city = city?.trim() || null;
    if (latitude !== undefined) updates.latitude = latitude;
    if (longitude !== undefined) updates.longitude = longitude;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('listings')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }

    res.json({ listing: updated });
  } catch (err) {
    console.error('Update listing error:', err);
    res.status(500).json({ error: 'Failed to update listing' });
  }
};

const deleteListing = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const { data: existing } = await supabaseAdmin
      .from('listings')
      .select('id, seller_id, status')
      .eq('id', id)
      .single();

    if (!existing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (existing.seller_id !== userId && req.user.profile.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to delete this listing' });
    }

    const { error } = await supabaseAdmin
      .from('listings')
      .update({ status: 'archived' })
      .eq('id', id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Listing deleted successfully' });
  } catch (err) {
    console.error('Delete listing error:', err);
    res.status(500).json({ error: 'Failed to delete listing' });
  }
};

const publishListing = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const { data: existing } = await supabaseAdmin
      .from('listings')
      .select('id, seller_id, status')
      .eq('id', id)
      .single();

    if (!existing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (existing.seller_id !== userId && req.user.profile.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { data: updated, error } = await supabaseAdmin
      .from('listings')
      .update({
        status: 'active',
        published_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Listing published', listing: updated });
  } catch (err) {
    console.error('Publish listing error:', err);
    res.status(500).json({ error: 'Failed to publish listing' });
  }
};

const getMyListings = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, status = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabaseAdmin
      .from('listings')
      .select(`
        *,
        category:categories(id, name, slug),
        listing_images(id, image_url, is_primary, sort_order)
      `, { count: 'exact' })
      .eq('seller_id', userId);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: listings, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const enriched = (listings || []).map(l => ({
      ...l,
      primary_image: (l.listing_images || []).find(img => img.is_primary)?.image_url
        || (l.listing_images || [])[0]?.image_url
        || null,
    }));

    res.json({
      listings: enriched,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('Get my listings error:', err);
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
};

// ============================================================
// LISTING IMAGES
// ============================================================

const uploadListingImage = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { data: existing } = await supabaseAdmin
      .from('listings')
      .select('id, seller_id')
      .eq('id', id)
      .single();

    if (!existing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (existing.seller_id !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const file = req.file;
    const ext = file.originalname.split('.').pop();
    const filePath = `listings/${id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET_IMAGES)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return res.status(400).json({ error: 'Failed to upload image' });
    }

    const { data: urlData } = supabaseAdmin.storage
      .from(BUCKET_IMAGES)
      .getPublicUrl(filePath);

    const { count: imageCount } = await supabaseAdmin
      .from('listing_images')
      .select('*', { count: 'exact', head: true })
      .eq('listing_id', id);

    const { data: image, error: insertError } = await supabaseAdmin
      .from('listing_images')
      .insert({
        listing_id: id,
        image_url: urlData.publicUrl,
        alt_text: file.originalname,
        sort_order: imageCount || 0,
        is_primary: (imageCount || 0) === 0,
      })
      .select()
      .single();

    if (insertError) {
      return res.status(400).json({ error: insertError.message });
    }

    res.status(201).json({
      message: 'Image uploaded successfully',
      image,
    });
  } catch (err) {
    console.error('Upload listing image error:', err);
    res.status(500).json({ error: 'Failed to upload image' });
  }
};

const deleteListingImage = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id, imageId } = req.params;

    const { data: listing } = await supabaseAdmin
      .from('listings')
      .select('seller_id')
      .eq('id', id)
      .single();

    if (!listing || listing.seller_id !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { data: image } = await supabaseAdmin
      .from('listing_images')
      .select('*')
      .eq('id', imageId)
      .eq('listing_id', id)
      .single();

    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const urlParts = image.image_url.split('/');
    const bucketIndex = urlParts.indexOf(BUCKET_IMAGES);
    if (bucketIndex !== -1) {
      const filePath = urlParts.slice(bucketIndex + 1).join('/');
      await supabaseAdmin.storage.from(BUCKET_IMAGES).remove([filePath]);
    }

    await supabaseAdmin.from('listing_images').delete().eq('id', imageId);

    if (image.is_primary) {
      const { data: nextImage } = await supabaseAdmin
        .from('listing_images')
        .select('id')
        .eq('listing_id', id)
        .order('sort_order')
        .limit(1)
        .single();

      if (nextImage) {
        await supabaseAdmin
          .from('listing_images')
          .update({ is_primary: true })
          .eq('id', nextImage.id);
      }
    }

    res.json({ message: 'Image deleted successfully' });
  } catch (err) {
    console.error('Delete listing image error:', err);
    res.status(500).json({ error: 'Failed to delete image' });
  }
};

// ============================================================
// SHOPPING CART
// ============================================================

const getCart = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: items, error } = await supabaseAdmin
      .from('cart_items')
      .select(`
        id, quantity, added_at,
        listing:listings(
          id, title, slug, price, unit, quantity_available, status,
          seller:profiles(id, first_name, last_name),
          business:businesses(id, name, slug),
          listing_images(image_url, is_primary, sort_order)
        )
      `)
      .eq('user_id', userId)
      .order('added_at', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const enriched = (items || []).map(item => {
      const listing = item.listing || {};
      const images = listing.listing_images || [];
      const primaryImage = images.find(img => img.is_primary)?.image_url
        || images.sort((a, b) => a.sort_order - b.sort_order)[0]?.image_url
        || null;

      return {
        ...item,
        listing: {
          ...listing,
          primary_image: primaryImage,
          listing_images: undefined,
        },
      };
    });

    const subtotal = enriched.reduce((sum, item) => {
      if (item.listing?.status === 'active') {
        return sum + (parseFloat(item.listing.price) * item.quantity);
      }
      return sum;
    }, 0);

    const itemCount = enriched.reduce((sum, item) => {
      if (item.listing?.status === 'active') {
        return sum + item.quantity;
      }
      return sum;
    }, 0);

    res.json({
      items: enriched,
      subtotal: Math.round(subtotal * 100) / 100,
      itemCount,
    });
  } catch (err) {
    console.error('Get cart error:', err);
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
};

const addToCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { listingId, quantity = 1 } = req.body;

    if (!listingId) {
      return res.status(400).json({ error: 'Listing ID is required' });
    }

    const qty = parseInt(quantity);
    if (qty < 1) {
      return res.status(400).json({ error: 'Quantity must be at least 1' });
    }

    const { data: listing } = await supabaseAdmin
      .from('listings')
      .select('id, status, quantity_available, seller_id')
      .eq('id', listingId)
      .single();

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (listing.status !== 'active') {
      return res.status(400).json({ error: 'Listing is not available' });
    }

    if (listing.seller_id === userId) {
      return res.status(400).json({ error: 'Cannot add your own listing to cart' });
    }

    if (qty > listing.quantity_available) {
      return res.status(400).json({ error: 'Not enough quantity available' });
    }

    const { data: existingItem } = await supabaseAdmin
      .from('cart_items')
      .select('id, quantity')
      .eq('user_id', userId)
      .eq('listing_id', listingId)
      .single();

    let cartItem;

    if (existingItem) {
      const newQty = existingItem.quantity + qty;
      if (newQty > listing.quantity_available) {
        return res.status(400).json({ error: 'Not enough quantity available' });
      }

      const { data: updated, error: updateError } = await supabaseAdmin
        .from('cart_items')
        .update({ quantity: newQty })
        .eq('id', existingItem.id)
        .select()
        .single();

      if (updateError) {
        return res.status(400).json({ error: updateError.message });
      }
      cartItem = updated;
    } else {
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('cart_items')
        .insert({
          user_id: userId,
          listing_id: listingId,
          quantity: qty,
        })
        .select()
        .single();

      if (insertError) {
        return res.status(400).json({ error: insertError.message });
      }
      cartItem = inserted;
    }

    res.status(201).json({
      message: 'Item added to cart',
      cartItem,
    });
  } catch (err) {
    console.error('Add to cart error:', err);
    res.status(500).json({ error: 'Failed to add item to cart' });
  }
};

const updateCartItem = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { quantity } = req.body;

    if (quantity == null || parseInt(quantity) < 1) {
      return res.status(400).json({ error: 'Valid quantity is required' });
    }

    const qty = parseInt(quantity);

    const { data: cartItem } = await supabaseAdmin
      .from('cart_items')
      .select('id, listing_id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!cartItem) {
      return res.status(404).json({ error: 'Cart item not found' });
    }

    const { data: listing } = await supabaseAdmin
      .from('listings')
      .select('quantity_available')
      .eq('id', cartItem.listing_id)
      .single();

    if (qty > (listing?.quantity_available || 0)) {
      return res.status(400).json({ error: 'Not enough quantity available' });
    }

    const { data: updated, error } = await supabaseAdmin
      .from('cart_items')
      .update({ quantity: qty })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ cartItem: updated });
  } catch (err) {
    console.error('Update cart item error:', err);
    res.status(500).json({ error: 'Failed to update cart item' });
  }
};

const removeFromCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const { data: cartItem } = await supabaseAdmin
      .from('cart_items')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!cartItem) {
      return res.status(404).json({ error: 'Cart item not found' });
    }

    const { error } = await supabaseAdmin
      .from('cart_items')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Item removed from cart' });
  } catch (err) {
    console.error('Remove from cart error:', err);
    res.status(500).json({ error: 'Failed to remove item from cart' });
  }
};

const clearCart = async (req, res) => {
  try {
    const userId = req.user.id;

    const { error } = await supabaseAdmin
      .from('cart_items')
      .delete()
      .eq('user_id', userId);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Cart cleared' });
  } catch (err) {
    console.error('Clear cart error:', err);
    res.status(500).json({ error: 'Failed to clear cart' });
  }
};

const getCartCount = async (req, res) => {
  try {
    const userId = req.user.id;

    const { count, error } = await supabaseAdmin
      .from('cart_items')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ count: count || 0 });
  } catch (err) {
    console.error('Get cart count error:', err);
    res.status(500).json({ error: 'Failed to get cart count' });
  }
};

module.exports = {
  getCategories,
  getCategoryBySlug,
  getListings,
  getListingBySlug,
  getListingById,
  createListing,
  updateListing,
  deleteListing,
  publishListing,
  getMyListings,
  uploadListingImage,
  deleteListingImage,
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  getCartCount,
};
