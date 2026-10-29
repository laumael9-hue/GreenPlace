const { supabaseAdmin } = require('../config/supabase');
const { fetchOwnerEmails } = require('./businessController');
const {
  BUCKET_DOCS,
  REQUIRED_DOCUMENTS,
  REQUIRED_TYPES,
  MIME_EXTENSIONS,
  hasValidSignature,
  storagePathFromUrl,
  createSignedUrl,
  getOwnBusiness,
  getRequiredDocumentRows,
  buildSlots,
  summarizeSlots,
} = require('../services/businessVerification');

const labelFor = (type) => REQUIRED_DOCUMENTS.find((d) => d.type === type)?.label || type;

const NO_BUSINESS = { error: 'No business application found for this account', code: 'NO_BUSINESS' };

// ============================================================
// BUSINESS OWNER
// ============================================================

const getMyDocuments = async (req, res) => {
  try {
    const business = await getOwnBusiness(req.user.id);
    if (!business) return res.status(404).json(NO_BUSINESS);

    const slots = buildSlots(await getRequiredDocumentRows(business.id), business);
    const summary = summarizeSlots(slots);
    const isSubmitted = !!business.submitted_for_review_at;

    res.json({
      business: {
        id: business.id,
        name: business.name,
        verification_status: business.verification_status,
        rejection_reason: business.rejection_reason,
        submitted_for_review_at: business.submitted_for_review_at,
      },
      documents: slots,
      missing: summary.missing,
      canSubmit: business.verification_status !== 'Verified'
        && summary.missing.length === 0
        && summary.rejected.length === 0
        && (!isSubmitted || business.verification_status === 'Rejected'),
    });
  } catch (err) {
    console.error('Get my documents error:', err);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
};

const uploadMyDocument = async (req, res) => {
  let uploadedPath = null;
  try {
    const { documentType } = req.body;
    const file = req.file;

    if (!REQUIRED_TYPES.includes(documentType)) {
      return res.status(400).json({
        error: `Document type must be one of: ${REQUIRED_TYPES.join(', ')}`,
        allowed: REQUIRED_TYPES,
      });
    }

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!hasValidSignature(file.buffer, file.mimetype)) {
      return res.status(400).json({ error: 'The file content does not match its type. Upload a real PDF, JPG or PNG.' });
    }

    const business = await getOwnBusiness(req.user.id);
    if (!business) return res.status(404).json(NO_BUSINESS);

    if (business.verification_status === 'Verified') {
      return res.status(400).json({ error: 'Your business is already verified' });
    }

    const { data: existing } = await supabaseAdmin
      .from('business_documents')
      .select('*')
      .eq('business_id', business.id)
      .eq('document_type', documentType)
      .maybeSingle();

    if (existing) {
      const isDraft = !business.submitted_for_review_at;
      if (existing.verification_status === 'approved') {
        return res.status(409).json({ error: 'This document is already approved and cannot be replaced' });
      }
      if (!isDraft && existing.verification_status !== 'rejected') {
        return res.status(409).json({ error: 'This document is under review. You can replace it only if it is rejected.' });
      }
    }

    uploadedPath = `businesses/${business.id}/${documentType}/${Date.now()}.${MIME_EXTENSIONS[file.mimetype]}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET_DOCS)
      .upload(uploadedPath, file.buffer, { contentType: file.mimetype, upsert: false });

    if (uploadError) {
      console.error('Document upload error:', uploadError);
      uploadedPath = null;
      return res.status(400).json({ error: 'Failed to upload document' });
    }

    const { data: urlData } = supabaseAdmin.storage.from(BUCKET_DOCS).getPublicUrl(uploadedPath);

    const fields = {
      file_url: urlData.publicUrl,
      file_name: file.originalname.slice(0, 255),
      file_size: file.size,
      mime_type: file.mimetype,
      uploaded_at: new Date().toISOString(),
      verification_status: 'pending',
      verification_notes: null,
      verified_by: null,
      verified_at: null,
    };

    const { data: doc, error: saveError } = existing
      ? await supabaseAdmin.from('business_documents').update(fields).eq('id', existing.id).select().single()
      : await supabaseAdmin.from('business_documents')
        .insert({ business_id: business.id, document_type: documentType, ...fields })
        .select().single();

    if (saveError) {
      console.error('Document save error:', saveError);
      await supabaseAdmin.storage.from(BUCKET_DOCS).remove([uploadedPath]);
      uploadedPath = null;
      const raced = saveError.code === '23505';
      return res.status(raced ? 409 : 400).json({
        error: raced ? 'This document was just uploaded from another session. Refresh and try again.' : 'Failed to save document',
      });
    }

    // The replaced file is no longer referenced by any row
    const oldPath = existing ? storagePathFromUrl(existing.file_url) : null;
    if (oldPath) await supabaseAdmin.storage.from(BUCKET_DOCS).remove([oldPath]);

    res.status(existing ? 200 : 201).json({
      message: existing ? 'Document replaced' : 'Document uploaded',
      document: buildSlots([doc], business).find((s) => s.type === documentType),
    });
  } catch (err) {
    console.error('Upload my document error:', err);
    if (uploadedPath) await supabaseAdmin.storage.from(BUCKET_DOCS).remove([uploadedPath]);
    res.status(500).json({ error: 'Failed to upload document' });
  }
};

const submitForReview = async (req, res) => {
  try {
    const business = await getOwnBusiness(req.user.id);
    if (!business) return res.status(404).json(NO_BUSINESS);

    if (business.verification_status === 'Verified') {
      return res.status(400).json({ error: 'Your business is already verified' });
    }

    if (business.submitted_for_review_at && business.verification_status === 'Pending') {
      return res.status(400).json({ error: 'Your documents are already submitted and awaiting review' });
    }

    const summary = summarizeSlots(buildSlots(await getRequiredDocumentRows(business.id), business));

    if (summary.missing.length > 0) {
      return res.status(400).json({
        error: `All 3 required documents must be uploaded. Missing: ${summary.missing.map(labelFor).join(', ')}`,
        missing: summary.missing,
      });
    }

    if (summary.rejected.length > 0) {
      return res.status(400).json({
        error: `Replace the rejected documents before resubmitting: ${summary.rejected.map(labelFor).join(', ')}`,
        rejected: summary.rejected,
      });
    }

    const { data: updated, error } = await supabaseAdmin
      .from('businesses')
      .update({
        verification_status: 'Pending',
        status: 'pending',
        submitted_for_review_at: new Date().toISOString(),
        rejection_reason: null,
      })
      .eq('id', business.id)
      .select('id, name, verification_status, submitted_for_review_at')
      .single();

    if (error) {
      console.error('Submit for review error:', error);
      return res.status(400).json({ error: 'Failed to submit for review' });
    }

    res.json({ message: 'Submitted for review', business: updated });
  } catch (err) {
    console.error('Submit for review error:', err);
    res.status(500).json({ error: 'Failed to submit for review' });
  }
};

// ============================================================
// ADMIN
// ============================================================

const getPendingBusinesses = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const offset = (pageNum - 1) * limitNum;

    let query = supabaseAdmin
      .from('businesses')
      .select('id, owner_id, name, category, city, logo_url, verification_status, submitted_for_review_at, created_at', { count: 'exact' })
      .eq('verification_status', 'Pending')
      .not('submitted_for_review_at', 'is', null)
      .is('deleted_at', null);

    if (search) {
      // Strip characters that have meaning inside a PostgREST filter string
      query = query.ilike('name', `%${String(search).replace(/[%,()]/g, ' ')}%`);
    }

    const { data: businesses, count, error } = await query
      .order('submitted_for_review_at', { ascending: true })
      .range(offset, offset + limitNum - 1);

    if (error) {
      console.error('Pending businesses error:', error);
      return res.status(400).json({ error: error.message });
    }

    const rows = businesses || [];
    const ownerIds = [...new Set(rows.map((b) => b.owner_id).filter(Boolean))];
    const businessIds = rows.map((b) => b.id);

    const [{ data: profiles }, { data: docs }, emails] = await Promise.all([
      ownerIds.length
        ? supabaseAdmin.from('profiles').select('id, first_name, last_name').in('id', ownerIds)
        : { data: [] },
      businessIds.length
        ? supabaseAdmin.from('business_documents').select('business_id, verification_status')
          .in('business_id', businessIds).in('document_type', REQUIRED_TYPES)
        : { data: [] },
      fetchOwnerEmails(ownerIds),
    ]);

    const ownerMap = Object.fromEntries((profiles || []).map((p) => [p.id, { ...p, email: emails[p.id] }]));

    res.json({
      businesses: rows.map((b) => {
        const mine = (docs || []).filter((d) => d.business_id === b.id);
        return {
          ...b,
          profiles: ownerMap[b.owner_id] || null,
          documents_submitted: mine.length,
          documents_approved: mine.filter((d) => d.verification_status === 'approved').length,
        };
      }),
      pagination: { page: pageNum, limit: limitNum, total: count || 0, pages: Math.ceil((count || 0) / limitNum) },
    });
  } catch (err) {
    console.error('Get pending businesses error:', err);
    res.status(500).json({ error: 'Failed to fetch pending businesses' });
  }
};

const getBusinessDocumentsForReview = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: business } = await supabaseAdmin
      .from('businesses')
      .select('id, name, status, verification_status, submitted_for_review_at, rejection_reason')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (!business) return res.status(404).json({ error: 'Business not found' });

    const rows = await getRequiredDocumentRows(id);
    const slots = buildSlots(rows, business);
    const summary = summarizeSlots(slots);

    // Signed URLs are short-lived (about 5 minutes); the bucket is private
    const documents = await Promise.all(slots.map(async (slot) => {
      const row = rows.find((r) => r.id === slot.id);
      return { ...slot, url: row ? await createSignedUrl(row.file_url) : null };
    }));

    res.json({
      business,
      documents,
      submittedCount: summary.submittedCount,
      approvedCount: summary.approvedCount,
      total: REQUIRED_DOCUMENTS.length,
      canApprove: business.verification_status !== 'Verified' && summary.approvedCount === REQUIRED_DOCUMENTS.length,
      canReject: business.verification_status === 'Pending' && summary.rejected.length > 0,
    });
  } catch (err) {
    console.error('Get documents for review error:', err);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
};

module.exports = {
  getMyDocuments,
  uploadMyDocument,
  submitForReview,
  getPendingBusinesses,
  getBusinessDocumentsForReview,
};
