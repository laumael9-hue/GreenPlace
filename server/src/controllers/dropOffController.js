const { supabaseAdmin } = require('../config/supabase');
const crypto = require('crypto');

// ============================================================
// UTILITY: Generate Reference Number
// ============================================================

const generateReferenceNumber = () => {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = crypto.randomBytes(3).toString('hex');
  return `DO-${date}-${suffix}`;
};

// ============================================================
// CREATE DROP-OFF
// ============================================================

const createDropOff = async (req, res) => {
  try {
    const businessId = req.user.profile.role === 'business'
      ? (await supabaseAdmin.from('businesses').select('id').eq('owner_id', req.user.id).eq('status', 'approved').is('deleted_at', null).limit(1).maybeSingle()).data?.id
      : null;

    if (!businessId) {
      return res.status(400).json({ error: 'No approved business found for this account' });
    }

    const { userId, guestName, guestPhone, items, notes } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one material item is required' });
    }

    if (!userId && !guestName) {
      return res.status(400).json({ error: 'Resident selection or guest name is required' });
    }

    // Fetch business materials for price lookup
    const { data: businessMaterials } = await supabaseAdmin
      .from('business_materials')
      .select('material_name, price_per_kg')
      .eq('business_id', businessId)
      .eq('is_accepted', true);

    const priceMap = {};
    (businessMaterials || []).forEach(m => {
      priceMap[m.material_name.toLowerCase()] = parseFloat(m.price_per_kg);
    });

    // Calculate estimated values for items - accept both camelCase and snake_case
    const processedItems = items.map(item => {
      const rawName = item.materialName || item.material_name;
      if (!rawName || !rawName.trim()) {
        throw new Error('Material name is required');
      }
      const materialName = rawName.trim();
      const weight = parseFloat(item.quantity);
      if (isNaN(weight) || weight <= 0) {
        throw new Error(`Invalid weight for ${materialName}`);
      }
      const pricePerKg = priceMap[materialName.toLowerCase()] || 0;
      const estimatedValue = Math.round(weight * pricePerKg * 100) / 100;
      return {
        material_name: materialName,
        quantity: weight,
        unit: item.unit || 'kg',
        estimated_value: estimatedValue,
        notes: item.notes || null,
      };
    });

    const totalWeight = processedItems.reduce((sum, i) => sum + i.quantity, 0);
    const totalEstimatedValue = processedItems.reduce((sum, i) => sum + i.estimated_value, 0);

    // Resolve resident info
    let residentProfile = null;
    if (userId) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name, phone')
        .eq('id', userId)
        .single();
      residentProfile = profile;
    }

    const referenceNumber = generateReferenceNumber();

    // Build insert payload - only include guest fields if needed (migration-safe)
    const insertPayload = {
      user_id: userId || null,
      business_id: businessId,
      reference_number: referenceNumber,
      status: 'scheduled',
      total_weight_kg: totalWeight,
      estimated_value: totalEstimatedValue,
      notes: notes || null,
    };
    if (!userId) {
      insertPayload.guest_name = guestName;
      if (guestPhone) insertPayload.guest_phone = guestPhone;
    }

    // Insert drop-off - retry without guest fields if columns don't exist yet
    let dropOff = null;
    let insertError = null;
    {
      const result = await supabaseAdmin
        .from('drop_offs')
        .insert(insertPayload)
        .select()
        .single();
      dropOff = result.data;
      insertError = result.error;
      // If guest columns don't exist (migration not run), retry without them
      if (insertError && insertError.message && insertError.message.includes('guest_')) {
        console.warn('Guest columns missing, retrying without them. Please run migration 010.');
        const fallbackPayload = { ...insertPayload };
        delete fallbackPayload.guest_name;
        delete fallbackPayload.guest_phone;
        // For guests without migration, store name in notes as fallback
        if (!userId && guestName) {
          fallbackPayload.notes = `Guest: ${guestName}${guestPhone ? ' (' + guestPhone + ')' : ''}${notes ? ' - ' + notes : ''}`;
        }
        const retry = await supabaseAdmin
          .from('drop_offs')
          .insert(fallbackPayload)
          .select()
          .single();
        dropOff = retry.data;
        insertError = retry.error;
      }
    }

    if (insertError) {
      console.error('Create drop-off error:', insertError);
      return res.status(400).json({ error: insertError.message });
    }

    // Insert drop-off items
    const itemsToInsert = processedItems.map(item => ({
      drop_off_id: dropOff.id,
      material_name: item.material_name,
      quantity: item.quantity,
      unit: item.unit,
      estimated_value: item.estimated_value,
      notes: item.notes,
    }));

    const { error: itemsError } = await supabaseAdmin
      .from('drop_off_items')
      .insert(itemsToInsert);

    if (itemsError) {
      console.error('Create drop-off items error:', itemsError);
      return res.status(400).json({ error: itemsError.message });
    }

    // Increment business total_drop_offs
    try {
      const { data: biz } = await supabaseAdmin
        .from('businesses')
        .select('total_drop_offs')
        .eq('id', businessId)
        .single();
      await supabaseAdmin
        .from('businesses')
        .update({ total_drop_offs: (biz?.total_drop_offs || 0) + 1 })
        .eq('id', businessId);
    } catch (countErr) {
      console.error('Failed to update drop-off count:', countErr);
    }

    res.status(201).json({
      message: 'Drop-off recorded successfully',
      dropOff: {
        ...dropOff,
        items: processedItems,
        resident: residentProfile || { first_name: null, last_name: null },
      },
    });
  } catch (err) {
    console.error('Create drop-off error:', err);
    const message = err.message || 'Failed to create drop-off';
    res.status(500).json({ error: message });
  }
};

// ============================================================
// GET BUSINESS DROP-OFFS
// ============================================================

const getBusinessDropOffs = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', status = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const businessId = (await supabaseAdmin
      .from('businesses')
      .select('id')
      .eq('owner_id', req.user.id)
      .eq('status', 'approved')
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle()).data?.id;

    if (!businessId) {
      return res.status(400).json({ error: 'No approved business found' });
    }

    let query = supabaseAdmin
      .from('drop_offs')
      .select(`
        *,
        resident:profiles(id, first_name, last_name, phone, avatar_url),
        drop_off_items(id, material_name, quantity, unit, estimated_value, actual_value, notes)
      `, { count: 'exact' })
      .eq('business_id', businessId);

    if (status) {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(`
        reference_number.ilike.%${search}%,
        guest_name.ilike.%${search}%,
        profiles.first_name.ilike.%${search}%,
        profiles.last_name.ilike.%${search}%,
        drop_off_items.material_name.ilike.%${search}%
      `);
    }

    const { data: dropOffs, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (error) {
      console.error('Get business drop-offs error:', error);
      return res.status(400).json({ error: error.message });
    }

    const enriched = (dropOffs || []).map(d => ({
      ...d,
      resident_name: d.resident
        ? `${d.resident.first_name || ''} ${d.resident.last_name || ''}`.trim()
        : d.guest_name || 'Unknown',
      materials_summary: (d.drop_off_items || []).map(i => i.material_name).join(', '),
    }));

    res.json({
      dropOffs: enriched,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('Get business drop-offs error:', err);
    res.status(500).json({ error: 'Failed to fetch drop-offs' });
  }
};

// ============================================================
// GET MY DROP-OFFS (Resident)
// ============================================================

const getMyDropOffs = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, status = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabaseAdmin
      .from('drop_offs')
      .select(`
        *,
        business:businesses(id, name, slug, address),
        drop_off_items(id, material_name, quantity, unit, estimated_value, actual_value)
      `, { count: 'exact' })
      .eq('user_id', userId);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: dropOffs, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (error) {
      console.error('Get my drop-offs error:', error);
      return res.status(400).json({ error: error.message });
    }

    res.json({
      dropOffs: dropOffs || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('Get my drop-offs error:', err);
    res.status(500).json({ error: 'Failed to fetch drop-offs' });
  }
};

// ============================================================
// GET DROP-OFF BY ID
// ============================================================

const getDropOffById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.profile.role;

    const { data: dropOff, error } = await supabaseAdmin
      .from('drop_offs')
      .select(`
        *,
        resident:profiles(id, first_name, last_name, phone, avatar_url),
        business:businesses(id, name, slug, address, phone, email),
        drop_off_items(id, material_name, quantity, unit, estimated_value, actual_value, notes)
      `)
      .eq('id', id)
      .single();

    if (error || !dropOff) {
      return res.status(404).json({ error: 'Drop-off not found' });
    }

    // Check access: resident owns it, business owner, or admin
    if (userRole === 'resident' && dropOff.user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to view this drop-off' });
    }

    if (userRole === 'business') {
      const { data: myBusiness } = await supabaseAdmin
        .from('businesses')
        .select('id')
        .eq('owner_id', userId)
        .eq('status', 'approved')
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle();

      if (myBusiness && myBusiness.id !== dropOff.business_id) {
        return res.status(403).json({ error: 'Not authorized to view this drop-off' });
      }
    }

    res.json({
      dropOff: {
        ...dropOff,
        resident_name: dropOff.resident
          ? `${dropOff.resident.first_name || ''} ${dropOff.resident.last_name || ''}`.trim()
          : dropOff.guest_name || 'Unknown',
      },
    });
  } catch (err) {
    console.error('Get drop-off by id error:', err);
    res.status(500).json({ error: 'Failed to fetch drop-off' });
  }
};

// ============================================================
// COMPLETE DROP-OFF
// ============================================================

const completeDropOff = async (req, res) => {
  try {
    const { id } = req.params;
    const { actualValue, items } = req.body || {};
    const userId = req.user.id;
    console.log('[completeDropOff] Called for id:', id, 'by user:', userId);

    // Verify business owns this
    const { data: myBusiness, error: bizError } = await supabaseAdmin
      .from('businesses')
      .select('id')
      .eq('owner_id', userId)
      .eq('status', 'approved')
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle();

    if (bizError) {
      console.error('[completeDropOff] Business lookup error:', bizError);
      return res.status(400).json({ error: bizError.message });
    }

    if (!myBusiness) {
      console.error('[completeDropOff] No approved business for user:', userId);
      return res.status(400).json({ error: 'No approved business found' });
    }

    console.log('[completeDropOff] Found business:', myBusiness.id);

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('drop_offs')
      .select('id, business_id, status')
      .eq('id', id)
      .maybeSingle();

    if (existingError) {
      console.error('[completeDropOff] Fetch existing error:', existingError);
      return res.status(400).json({ error: existingError.message });
    }

    if (!existing) {
      console.error('[completeDropOff] Drop-off not found:', id);
      return res.status(404).json({ error: 'Drop-off not found' });
    }

    console.log('[completeDropOff] Existing drop-off:', existing.id, 'status:', existing.status, 'business:', existing.business_id);

    if (existing.business_id !== myBusiness.id) {
      console.error('[completeDropOff] Business mismatch:', existing.business_id, '!==', myBusiness.id);
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (existing.status === 'processed' || existing.status === 'cancelled') {
      return res.status(400).json({ error: `Cannot complete a ${existing.status} drop-off` });
    }

    // Update drop-off
    const updates = {
      status: 'processed',
      processed_at: new Date().toISOString(),
    };

    if (actualValue != null) {
      updates.actual_value = parseFloat(actualValue);
    }

    console.log('[completeDropOff] Updating with:', updates);

    const { data: dropOffs, error: updateError } = await supabaseAdmin
      .from('drop_offs')
      .update(updates)
      .eq('id', id)
      .select();

    if (updateError) {
      console.error('[completeDropOff] Update error:', JSON.stringify(updateError));
      return res.status(400).json({ error: updateError.message });
    }

    const dropOff = dropOffs && dropOffs.length > 0 ? dropOffs[0] : null;

    if (!dropOff) {
      console.error('[completeDropOff] Update returned no rows for id:', id, 'dropOffs:', dropOffs);
      return res.status(400).json({ error: 'Failed to update drop-off: no rows returned' });
    }

    console.log('[completeDropOff] Updated successfully:', dropOff.id, 'status:', dropOff.status);

    // Update item actual values if provided - non-critical, don't fail whole request
    if (items && Array.isArray(items)) {
      for (const item of items) {
        if (item.id && item.actualValue != null) {
          try {
            const { error: itemError } = await supabaseAdmin
              .from('drop_off_items')
              .update({ actual_value: parseFloat(item.actualValue) })
              .eq('id', item.id)
              .eq('drop_off_id', id);
            if (itemError) console.error('[completeDropOff] Update item error:', itemError);
          } catch (itemErr) {
            console.error('[completeDropOff] Update item exception:', itemErr);
          }
        }
      }
    }

    res.json({ message: 'Drop-off completed', dropOff });
  } catch (err) {
    console.error('[completeDropOff] UNCAUGHT ERROR:', err && err.stack ? err.stack : err);
    const message = (err && err.message) ? err.message : 'Failed to complete drop-off';
    res.status(500).json({ error: message });
  }
};

// ============================================================
// CANCEL DROP-OFF
// ============================================================

const cancelDropOff = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { data: myBusiness } = await supabaseAdmin
      .from('businesses')
      .select('id')
      .eq('owner_id', userId)
      .eq('status', 'approved')
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle();

    if (!myBusiness) {
      return res.status(400).json({ error: 'No approved business found' });
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('drop_offs')
      .select('id, business_id, status')
      .eq('id', id)
      .maybeSingle();

    if (existingError) {
      console.error('Fetch existing drop-off error:', existingError);
      return res.status(400).json({ error: existingError.message });
    }

    if (!existing) {
      return res.status(404).json({ error: 'Drop-off not found' });
    }

    if (existing.business_id !== myBusiness.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (existing.status === 'processed' || existing.status === 'cancelled') {
      return res.status(400).json({ error: `Cannot cancel a ${existing.status} drop-off` });
    }

    const { error } = await supabaseAdmin
      .from('drop_offs')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (error) {
      console.error('Cancel drop-off error:', error);
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Drop-off cancelled' });
  } catch (err) {
    console.error('Cancel drop-off error:', err && err.stack ? err.stack : err);
    const message = (err && err.message) ? err.message : 'Failed to cancel drop-off';
    res.status(500).json({ error: message });
  }
};

// ============================================================
// GET BUSINESS MATERIALS (for dropdown)
// ============================================================

const getBusinessMaterials = async (req, res) => {
  try {
    const businessId = (await supabaseAdmin
      .from('businesses')
      .select('id')
      .eq('owner_id', req.user.id)
      .eq('status', 'approved')
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle()).data?.id;

    if (!businessId) {
      return res.status(400).json({ error: 'No approved business found' });
    }

    const { data: materials, error } = await supabaseAdmin
      .from('business_materials')
      .select('id, material_name, price_per_kg, unit')
      .eq('business_id', businessId)
      .eq('is_accepted', true)
      .order('material_name');

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ materials: materials || [] });
  } catch (err) {
    console.error('Get business materials error:', err);
    res.status(500).json({ error: 'Failed to fetch materials' });
  }
};

// ============================================================
// SEARCH RESIDENTS (for drop-off creation)
// ============================================================

const searchResidents = async (req, res) => {
  try {
    const { q = '' } = req.query;

    if (!q || q.trim().length < 1) {
      return res.json({ residents: [] });
    }

    const searchTerm = q.trim();

    const { data: residents, error } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, phone')
      .eq('role', 'resident')
      .is('deleted_at', null)
      .eq('is_active', true)
      .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`)
      .limit(10);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ residents: residents || [] });
  } catch (err) {
    console.error('Search residents error:', err);
    res.status(500).json({ error: 'Failed to search residents' });
  }
};

module.exports = {
  createDropOff,
  getBusinessDropOffs,
  getMyDropOffs,
  getDropOffById,
  completeDropOff,
  cancelDropOff,
  getBusinessMaterials,
  searchResidents,
};
