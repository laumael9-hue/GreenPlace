const { supabase, supabaseAdmin } = require('../config/supabase');
const crypto = require('crypto');

const BUCKET_DOCS = 'business-documents';
const BUCKET_IMAGES = 'profile-images';

const logAuditAction = async (adminId, action, targetId, details = {}) => {
  try {
    await supabaseAdmin.from('admin_audit_log').insert({
      admin_id: adminId,
      action,
      target_id: targetId,
      target_type: 'business',
      details,
    });
  } catch (err) {
    console.error('Audit log error:', err);
  }
};

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
// BUSINESS OWNER OPERATIONS
// ============================================================

const createBusiness = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      name, description, category, address, city, province,
      latitude, longitude, phone, email, website,
      acceptsDropOffs, hasMarketplace, hours, materials,
    } = req.body;

    if (!name || !category || !address || latitude == null || longitude == null) {
      return res.status(400).json({
        error: 'Name, category, address, latitude, and longitude are required',
      });
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('businesses')
      .select('id')
      .eq('owner_id', userId)
      .is('deleted_at', null)
      .maybeSingle();

    if (existingError) {
      console.error('Error checking existing business:', existingError);
      return res.status(500).json({ error: 'Failed to verify business eligibility' });
    }

    if (existing) {
      return res.status(400).json({ error: 'You already have a registered business' });
    }

    const slug = generateSlug(name);

    const { data: business, error: bizError } = await supabaseAdmin
      .from('businesses')
      .insert({
        owner_id: userId,
        name: name.trim(),
        slug,
        description: description?.trim() || null,
        category: category.trim(),
        address: address.trim(),
        city: (city || 'Cebu City').trim(),
        province: (province || 'Cebu').trim(),
        latitude,
        longitude,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        website: website?.trim() || null,
        accepts_drop_offs: !!acceptsDropOffs,
        has_marketplace: !!hasMarketplace,
        status: 'pending',
      })
      .select()
      .single();

    if (bizError) {
      console.error('Create business error:', bizError);
      return res.status(400).json({ error: bizError.message });
    }

    if (hours && Array.isArray(hours)) {
      const hourRows = hours.map((h) => ({
        business_id: business.id,
        day: h.day,
        open_time: h.open_time,
        close_time: h.close_time,
        is_closed: !!h.is_closed,
      }));
      await supabaseAdmin.from('business_hours').insert(hourRows);
    }

    if (materials && Array.isArray(materials)) {
      const matRows = materials.map((m) => ({
        business_id: business.id,
        material_name: m.material_name,
        price_per_kg: m.price_per_kg ?? null,
        unit: m.unit || 'kg',
        description: m.description?.trim() || null,
        is_accepted: m.is_accepted !== false,
      }));
      await supabaseAdmin.from('business_materials').insert(matRows);
    }

    await logAuditAction(userId, 'create_business', business.id, { name });

    res.status(201).json({
      message: 'Business registered successfully. Awaiting admin approval.',
      business,
    });
  } catch (err) {
    console.error('Create business error:', err);
    res.status(500).json({ error: 'Failed to create business' });
  }
};

const getMyBusiness = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: business, error } = await supabaseAdmin
      .from('businesses')
      .select('*')
      .eq('owner_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !business) {
      return res.status(404).json({ error: 'No business found for this account' });
    }

    const { data: hours } = await supabaseAdmin
      .from('business_hours')
      .select('*')
      .eq('business_id', business.id)
      .order('day');

    const { data: materials } = await supabaseAdmin
      .from('business_materials')
      .select('*')
      .eq('business_id', business.id)
      .order('material_name');

    const { data: documents } = await supabaseAdmin
      .from('business_documents')
      .select('*')
      .eq('business_id', business.id)
      .order('uploaded_at', { ascending: false });

    res.json({
      business: {
        ...business,
        hours: hours || [],
        materials: materials || [],
        documents: documents || [],
      },
    });
  } catch (err) {
    console.error('Get my business error:', err);
    res.status(500).json({ error: 'Failed to fetch business' });
  }
};

const updateBusiness = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const { data: existing } = await supabaseAdmin
      .from('businesses')
      .select('id, owner_id, deleted_at')
      .eq('id', id)
      .single();

    if (!existing || existing.deleted_at) {
      return res.status(404).json({ error: 'Business not found' });
    }

    if (existing.owner_id !== userId && req.user.profile.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to update this business' });
    }

    const {
      name, description, category, address, city, province,
      latitude, longitude, phone, email, website,
      acceptsDropOffs, hasMarketplace,
    } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim() || null;
    if (category !== undefined) updates.category = category.trim();
    if (address !== undefined) updates.address = address.trim();
    if (city !== undefined) updates.city = city.trim();
    if (province !== undefined) updates.province = province.trim();
    if (latitude !== undefined) updates.latitude = latitude;
    if (longitude !== undefined) updates.longitude = longitude;
    if (phone !== undefined) updates.phone = phone?.trim() || null;
    if (email !== undefined) updates.email = email?.trim() || null;
    if (website !== undefined) updates.website = website?.trim() || null;
    if (acceptsDropOffs !== undefined) updates.accepts_drop_offs = !!acceptsDropOffs;
    if (hasMarketplace !== undefined) updates.has_marketplace = !!hasMarketplace;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const { data: updated, error } = await supabaseAdmin
      .from('businesses')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ business: updated });
  } catch (err) {
    console.error('Update business error:', err);
    res.status(500).json({ error: 'Failed to update business' });
  }
};

const deleteBusiness = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('businesses')
      .select('id, status, deleted_at, name')
      .eq('id', id)
      .single();

    if (fetchError || !existing || existing.deleted_at) {
      return res.status(404).json({ error: 'Business not found' });
    }

    if (existing.owner_id !== userId && req.user.profile.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to delete this business' });
    }

    const { error } = await supabaseAdmin
      .from('businesses')
      .update({
        deleted_at: new Date().toISOString(),
        status: 'suspended',
      })
      .eq('id', id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    await logAuditAction(userId, 'delete_business', id, { status: existing.status });

    res.json({ message: 'Business deleted successfully' });
  } catch (err) {
    console.error('Delete business error:', err);
    res.status(500).json({ error: 'Failed to delete business' });
  }
};

// ============================================================
// BUSINESS HOURS
// ============================================================

const getBusinessHours = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: hours, error } = await supabaseAdmin
      .from('business_hours')
      .select('*')
      .eq('business_id', id)
      .order('day');

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ hours: hours || [] });
  } catch (err) {
    console.error('Get business hours error:', err);
    res.status(500).json({ error: 'Failed to fetch business hours' });
  }
};

const updateBusinessHours = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { hours } = req.body;

    if (!hours || !Array.isArray(hours)) {
      return res.status(400).json({ error: 'Hours array is required' });
    }

    const { data: existing } = await supabaseAdmin
      .from('businesses')
      .select('id, owner_id, deleted_at')
      .eq('id', id)
      .single();

    if (!existing || existing.deleted_at) {
      return res.status(404).json({ error: 'Business not found' });
    }

    if (existing.owner_id !== userId && req.user.profile.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await supabaseAdmin.from('business_hours').delete().eq('business_id', id);

    const hourRows = hours.map((h) => ({
      business_id: id,
      day: h.day,
      open_time: h.open_time,
      close_time: h.close_time,
      is_closed: !!h.is_closed,
    }));

    const { error: insertError } = await supabaseAdmin
      .from('business_hours')
      .insert(hourRows);

    if (insertError) {
      return res.status(400).json({ error: insertError.message });
    }

    const { data: updatedHours } = await supabaseAdmin
      .from('business_hours')
      .select('*')
      .eq('business_id', id)
      .order('day');

    res.json({ hours: updatedHours || [] });
  } catch (err) {
    console.error('Update business hours error:', err);
    res.status(500).json({ error: 'Failed to update business hours' });
  }
};

// ============================================================
// BUSINESS MATERIALS
// ============================================================

const getBusinessMaterials = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: materials, error } = await supabaseAdmin
      .from('business_materials')
      .select('*')
      .eq('business_id', id)
      .order('material_name');

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ materials: materials || [] });
  } catch (err) {
    console.error('Get business materials error:', err);
    res.status(500).json({ error: 'Failed to fetch business materials' });
  }
};

const updateBusinessMaterials = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { materials } = req.body;

    if (!materials || !Array.isArray(materials)) {
      return res.status(400).json({ error: 'Materials array is required' });
    }

    const { data: existing } = await supabaseAdmin
      .from('businesses')
      .select('id, owner_id, deleted_at')
      .eq('id', id)
      .single();

    if (!existing || existing.deleted_at) {
      return res.status(404).json({ error: 'Business not found' });
    }

    if (existing.owner_id !== userId && req.user.profile.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await supabaseAdmin.from('business_materials').delete().eq('business_id', id);

    const matRows = materials.map((m) => ({
      business_id: id,
      material_name: m.material_name,
      price_per_kg: m.price_per_kg ?? null,
      unit: m.unit || 'kg',
      description: m.description?.trim() || null,
      is_accepted: m.is_accepted !== false,
    }));

    const { error: insertError } = await supabaseAdmin
      .from('business_materials')
      .insert(matRows);

    if (insertError) {
      return res.status(400).json({ error: insertError.message });
    }

    const { data: updatedMaterials } = await supabaseAdmin
      .from('business_materials')
      .select('*')
      .eq('business_id', id)
      .order('material_name');

    res.json({ materials: updatedMaterials || [] });
  } catch (err) {
    console.error('Update business materials error:', err);
    res.status(500).json({ error: 'Failed to update business materials' });
  }
};

// ============================================================
// DOCUMENT MANAGEMENT
// ============================================================

const uploadDocument = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { documentType } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!documentType) {
      return res.status(400).json({ error: 'Document type is required' });
    }

    const { data: existing } = await supabaseAdmin
      .from('businesses')
      .select('id, owner_id, deleted_at')
      .eq('id', id)
      .single();

    if (!existing || existing.deleted_at) {
      return res.status(404).json({ error: 'Business not found' });
    }

    if (existing.owner_id !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const file = req.file;
    const ext = file.originalname.split('.').pop();
    const filePath = `businesses/${id}/${documentType}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET_DOCS)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return res.status(400).json({ error: 'Failed to upload document' });
    }

    const { data: urlData } = supabaseAdmin.storage
      .from(BUCKET_DOCS)
      .getPublicUrl(filePath);

    const { data: doc, error: insertError } = await supabaseAdmin
      .from('business_documents')
      .insert({
        business_id: id,
        document_type: documentType,
        file_url: urlData.publicUrl,
        file_name: file.originalname,
        file_size: file.size,
        mime_type: file.mimetype,
      })
      .select()
      .single();

    if (insertError) {
      return res.status(400).json({ error: insertError.message });
    }

    res.status(201).json({
      message: 'Document uploaded successfully',
      document: doc,
    });
  } catch (err) {
    console.error('Upload document error:', err);
    res.status(500).json({ error: 'Failed to upload document' });
  }
};

const getBusinessDocuments = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { data: business } = await supabaseAdmin
      .from('businesses')
      .select('owner_id')
      .eq('id', id)
      .single();

    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    const isAdmin = req.user.profile.role === 'admin';
    if (business.owner_id !== userId && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { data: documents, error } = await supabaseAdmin
      .from('business_documents')
      .select('*')
      .eq('business_id', id)
      .order('uploaded_at', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ documents: documents || [] });
  } catch (err) {
    console.error('Get business documents error:', err);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
};

const deleteDocument = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id, docId } = req.params;

    const { data: business } = await supabaseAdmin
      .from('businesses')
      .select('owner_id')
      .eq('id', id)
      .single();

    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    if (business.owner_id !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { data: doc } = await supabaseAdmin
      .from('business_documents')
      .select('*')
      .eq('id', docId)
      .eq('business_id', id)
      .single();

    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const urlParts = doc.file_url.split('/');
    const bucketIndex = urlParts.indexOf(BUCKET_DOCS);
    if (bucketIndex !== -1) {
      const filePath = urlParts.slice(bucketIndex + 1).join('/');
      await supabaseAdmin.storage.from(BUCKET_DOCS).remove([filePath]);
    }

    await supabaseAdmin.from('business_documents').delete().eq('id', docId);

    res.json({ message: 'Document deleted successfully' });
  } catch (err) {
    console.error('Delete document error:', err);
    res.status(500).json({ error: 'Failed to delete document' });
  }
};

const uploadBusinessLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const userId = req.user.id;
    const { id } = req.params;

    const { data: existing } = await supabaseAdmin
      .from('businesses')
      .select('id, owner_id, logo_url')
      .eq('id', id)
      .single();

    if (!existing) {
      return res.status(404).json({ error: 'Business not found' });
    }

    if (existing.owner_id !== userId && req.user.profile.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const file = req.file;
    const ext = file.originalname.split('.').pop();
    const filePath = `logos/${id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET_IMAGES)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (uploadError) {
      return res.status(400).json({ error: 'Failed to upload logo' });
    }

    const { data: urlData } = supabaseAdmin.storage
      .from(BUCKET_IMAGES)
      .getPublicUrl(filePath);

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('businesses')
      .update({ logo_url: urlData.publicUrl })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }

    res.json({
      message: 'Logo uploaded successfully',
      logo_url: urlData.publicUrl,
      business: updated,
    });
  } catch (err) {
    console.error('Upload business logo error:', err);
    res.status(500).json({ error: 'Failed to upload logo' });
  }
};

const uploadBusinessCover = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const userId = req.user.id;
    const { id } = req.params;

    const { data: existing } = await supabaseAdmin
      .from('businesses')
      .select('id, owner_id')
      .eq('id', id)
      .single();

    if (!existing) {
      return res.status(404).json({ error: 'Business not found' });
    }

    if (existing.owner_id !== userId && req.user.profile.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const file = req.file;
    const ext = file.originalname.split('.').pop();
    const filePath = `covers/${id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET_IMAGES)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (uploadError) {
      return res.status(400).json({ error: 'Failed to upload cover image' });
    }

    const { data: urlData } = supabaseAdmin.storage
      .from(BUCKET_IMAGES)
      .getPublicUrl(filePath);

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('businesses')
      .update({ cover_image_url: urlData.publicUrl })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }

    res.json({
      message: 'Cover image uploaded successfully',
      cover_image_url: urlData.publicUrl,
      business: updated,
    });
  } catch (err) {
    console.error('Upload business cover error:', err);
    res.status(500).json({ error: 'Failed to upload cover image' });
  }
};

// ============================================================
// ADMIN OPERATIONS
// ============================================================

const getAllBusinesses = async (req, res) => {
  try {
    const {
      page = 1, limit = 20, search = '', status = '',
      category = '', city = '', sort = 'created_at', order = 'desc',
    } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabaseAdmin
      .from('businesses')
      .select('*', { count: 'exact' })
      .is('deleted_at', null);

    if (search) {
      query = query.or(`name.ilike.%${search}%,category.ilike.%${search}%,city.ilike.%${search}%`);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (category) {
      query = query.eq('category', category);
    }

    if (city) {
      query = query.ilike('city', `%${city}%`);
    }

    const { data: businesses, count, error } = await query
      .order(sort, { ascending: order === 'asc' })
      .range(offset, offset + parseInt(limit) - 1);

    if (error) {
      console.error('Supabase error (getAllBusinesses):', error);
      return res.status(400).json({ error: error.message });
    }

    const ownerIds = [...new Set(businesses.map(b => b.owner_id).filter(Boolean))];
    let ownerProfiles = {};
    if (ownerIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name, email, avatar_url')
        .in('id', ownerIds);
      if (profiles) {
        ownerProfiles = Object.fromEntries(profiles.map(p => [p.id, p]));
      }
    }

    const enriched = businesses.map(b => ({
      ...b,
      profiles: ownerProfiles[b.owner_id] || null,
    }));

    res.json({
      businesses: enriched,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('Get all businesses error:', err);
    res.status(500).json({ error: 'Failed to fetch businesses' });
  }
};

const getBusinessById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: business, error } = await supabaseAdmin
      .from('businesses')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error || !business) {
      console.error('Supabase error (getBusinessById):', error);
      return res.status(404).json({ error: 'Business not found' });
    }

    let profile = null;
    if (business.owner_id) {
      const { data: p } = await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name, email, avatar_url, phone')
        .eq('id', business.owner_id)
        .single();
      profile = p || null;
    }

    const { data: hours } = await supabaseAdmin
      .from('business_hours')
      .select('*')
      .eq('business_id', id)
      .order('day');

    const { data: materials } = await supabaseAdmin
      .from('business_materials')
      .select('*')
      .eq('business_id', id)
      .order('material_name');

    const { data: documents } = await supabaseAdmin
      .from('business_documents')
      .select('*')
      .eq('business_id', id)
      .order('uploaded_at', { ascending: false });

    res.json({
      business: {
        ...business,
        profiles: profile,
        hours: hours || [],
        materials: materials || [],
        documents: documents || [],
      },
    });
  } catch (err) {
    console.error('Get business by id error:', err);
    res.status(500).json({ error: 'Failed to fetch business' });
  }
};

const approveBusiness = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: existing } = await supabaseAdmin
      .from('businesses')
      .select('id, status, deleted_at, name')
      .eq('id', id)
      .single();

    if (!existing || existing.deleted_at) {
      return res.status(404).json({ error: 'Business not found' });
    }

    if (existing.status === 'approved') {
      return res.status(400).json({ error: 'Business is already approved' });
    }

    const { data: updated, error } = await supabaseAdmin
      .from('businesses')
      .update({
        status: 'approved',
        is_verified: true,
        approved_at: new Date().toISOString(),
        approved_by: req.user.id,
        rejection_reason: null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Supabase error (approveBusiness):', error);
      return res.status(400).json({ error: error.message });
    }

    await logAuditAction(req.user.id, 'approve_business', id, { name: existing.name });

    res.json({
      message: 'Business approved successfully',
      business: updated,
    });
  } catch (err) {
    console.error('Approve business error:', err);
    res.status(500).json({ error: 'Failed to approve business' });
  }
};

const rejectBusiness = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    const { data: existing } = await supabaseAdmin
      .from('businesses')
      .select('id, status, deleted_at, name')
      .eq('id', id)
      .single();

    if (!existing || existing.deleted_at) {
      return res.status(404).json({ error: 'Business not found' });
    }

    const { data: updated, error } = await supabaseAdmin
      .from('businesses')
      .update({
        status: 'rejected',
        is_verified: false,
        rejection_reason: reason.trim(),
        approved_at: null,
        approved_by: null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    await logAuditAction(req.user.id, 'reject_business', id, {
      name: existing.name,
      reason: reason.trim(),
    });

    res.json({
      message: 'Business rejected',
      business: updated,
    });
  } catch (err) {
    console.error('Reject business error:', err);
    res.status(500).json({ error: 'Failed to reject business' });
  }
};

const suspendBusiness = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const { data: existing } = await supabaseAdmin
      .from('businesses')
      .select('id, status, deleted_at, name')
      .eq('id', id)
      .single();

    if (!existing || existing.deleted_at) {
      return res.status(404).json({ error: 'Business not found' });
    }

    if (existing.status === 'suspended') {
      return res.status(400).json({ error: 'Business is already suspended' });
    }

    const { data: updated, error } = await supabaseAdmin
      .from('businesses')
      .update({
        status: 'suspended',
        is_verified: false,
        rejection_reason: reason?.trim() || null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    await logAuditAction(req.user.id, 'suspend_business', id, {
      name: existing.name,
      reason: reason?.trim() || null,
    });

    res.json({
      message: 'Business suspended',
      business: updated,
    });
  } catch (err) {
    console.error('Suspend business error:', err);
    res.status(500).json({ error: 'Failed to suspend business' });
  }
};

const reactivateBusiness = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: existing } = await supabaseAdmin
      .from('businesses')
      .select('id, status, deleted_at, name')
      .eq('id', id)
      .single();

    if (!existing || existing.deleted_at) {
      return res.status(404).json({ error: 'Business not found' });
    }

    if (existing.status !== 'suspended') {
      return res.status(400).json({ error: 'Business is not suspended' });
    }

    const { data: updated, error } = await supabaseAdmin
      .from('businesses')
      .update({
        status: 'pending',
        is_verified: false,
        rejection_reason: null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    await logAuditAction(req.user.id, 'reactivate_business', id, { name: existing.name });

    res.json({
      message: 'Business reactivated and set to pending review',
      business: updated,
    });
  } catch (err) {
    console.error('Reactivate business error:', err);
    res.status(500).json({ error: 'Failed to reactivate business' });
  }
};

const getBusinessStats = async (req, res) => {
  try {
    const { count: total } = await supabaseAdmin
      .from('businesses')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null);

    const { count: pending } = await supabaseAdmin
      .from('businesses')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
      .is('deleted_at', null);

    const { count: approved } = await supabaseAdmin
      .from('businesses')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved')
      .is('deleted_at', null);

    const { count: rejected } = await supabaseAdmin
      .from('businesses')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'rejected')
      .is('deleted_at', null);

    const { count: suspended } = await supabaseAdmin
      .from('businesses')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'suspended')
      .is('deleted_at', null);

    res.json({
      total: total || 0,
      pending: pending || 0,
      approved: approved || 0,
      rejected: rejected || 0,
      suspended: suspended || 0,
    });
  } catch (err) {
    console.error('Get business stats error:', err);
    res.status(500).json({ error: 'Failed to fetch business stats' });
  }
};

// ============================================================
// PUBLIC OPERATIONS
// ============================================================

const getPublicBusinesses = async (req, res) => {
  try {
    const {
      page = 1, limit = 20, search = '', category = '',
      city = '', acceptsDropOffs, hasMarketplace,
    } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabaseAdmin
      .from('businesses')
      .select('id, name, slug, description, category, address, city, latitude, longitude, logo_url, rating_avg, rating_count, accepts_drop_offs, has_marketplace', { count: 'exact' })
      .eq('status', 'approved')
      .is('deleted_at', null);

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,category.ilike.%${search}%`);
    }

    if (category) {
      query = query.eq('category', category);
    }

    if (city) {
      query = query.ilike('city', `%${city}%`);
    }

    if (acceptsDropOffs === 'true') {
      query = query.eq('accepts_drop_offs', true);
    }

    if (hasMarketplace === 'true') {
      query = query.eq('has_marketplace', true);
    }

    const { data: businesses, count, error } = await query
      .order('rating_avg', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      businesses,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('Get public businesses error:', err);
    res.status(500).json({ error: 'Failed to fetch businesses' });
  }
};

const getPublicBusinessBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const { data: business, error } = await supabaseAdmin
      .from('businesses')
      .select('id, name, slug, description, category, address, city, province, latitude, longitude, phone, email, website, logo_url, cover_image_url, rating_avg, rating_count, accepts_drop_offs, has_marketplace, total_drop_offs, total_orders')
      .eq('slug', slug)
      .eq('status', 'approved')
      .is('deleted_at', null)
      .single();

    if (error || !business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    const { data: hours } = await supabaseAdmin
      .from('business_hours')
      .select('*')
      .eq('business_id', business.id)
      .order('day');

    const { data: materials } = await supabaseAdmin
      .from('business_materials')
      .select('*')
      .eq('business_id', business.id)
      .order('material_name');

    res.json({
      business: {
        ...business,
        hours: hours || [],
        materials: materials || [],
      },
    });
  } catch (err) {
    console.error('Get public business by slug error:', err);
    res.status(500).json({ error: 'Failed to fetch business' });
  }
};

module.exports = {
  createBusiness,
  getMyBusiness,
  updateBusiness,
  deleteBusiness,
  getBusinessHours,
  updateBusinessHours,
  getBusinessMaterials,
  updateBusinessMaterials,
  uploadDocument,
  getBusinessDocuments,
  deleteDocument,
  uploadBusinessLogo,
  uploadBusinessCover,
  getAllBusinesses,
  getBusinessById,
  approveBusiness,
  rejectBusiness,
  suspendBusiness,
  reactivateBusiness,
  getBusinessStats,
  getPublicBusinesses,
  getPublicBusinessBySlug,
};
