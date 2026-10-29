const { supabaseAdmin } = require('../config/supabase');

const BUCKET_DOCS = 'business-documents';
const MAX_DOC_BYTES = 5 * 1024 * 1024;
const ADMIN_URL_TTL_SECONDS = 5 * 60;

const REQUIRED_DOCUMENTS = [
  { type: 'DTI_SEC', label: 'DTI / SEC Registration' },
  { type: 'BUSINESS_PERMIT', label: "Mayor's / Business Permit" },
  { type: 'BIR_COR', label: 'BIR Certificate of Registration' },
];
const REQUIRED_TYPES = REQUIRED_DOCUMENTS.map((d) => d.type);

const MIME_EXTENSIONS = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};
const ALLOWED_MIME_TYPES = Object.keys(MIME_EXTENSIONS);

// The client-supplied MIME type is not trustworthy; check the file's magic bytes too.
const SIGNATURES = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46],
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47],
};

const hasValidSignature = (buffer, mimeType) => {
  const signature = SIGNATURES[mimeType];
  if (!signature || !buffer || buffer.length < signature.length) return false;
  return signature.every((byte, i) => buffer[i] === byte);
};

// Stored file_url values are public-style URLs ending in /business-documents/<path>.
const storagePathFromUrl = (fileUrl) => {
  const marker = `/${BUCKET_DOCS}/`;
  const idx = fileUrl ? fileUrl.indexOf(marker) : -1;
  if (idx === -1) return null;
  return decodeURIComponent(fileUrl.slice(idx + marker.length).split('?')[0]);
};

const createSignedUrl = async (fileUrl, ttlSeconds = ADMIN_URL_TTL_SECONDS) => {
  const filePath = storagePathFromUrl(fileUrl);
  if (!filePath) return null;
  const { data } = await supabaseAdmin.storage.from(BUCKET_DOCS).createSignedUrl(filePath, ttlSeconds);
  return data?.signedUrl || null;
};

const getOwnBusiness = async (userId) => {
  const { data } = await supabaseAdmin
    .from('businesses')
    .select('id, name, status, verification_status, submitted_for_review_at, rejection_reason')
    .eq('owner_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data || null;
};

const getRequiredDocumentRows = async (businessId) => {
  const { data } = await supabaseAdmin
    .from('business_documents')
    .select('*')
    .eq('business_id', businessId)
    .in('document_type', REQUIRED_TYPES);
  return data || [];
};

// One entry per required document, whether or not it has been uploaded.
const buildSlots = (rows, business) => REQUIRED_DOCUMENTS.map(({ type, label }) => {
  const doc = rows.find((r) => r.document_type === type);
  const status = doc ? doc.verification_status : 'missing';
  const isDraft = !business.submitted_for_review_at;
  return {
    type,
    label,
    status,
    id: doc?.id || null,
    file_name: doc?.file_name || null,
    file_size: doc?.file_size || null,
    mime_type: doc?.mime_type || null,
    notes: doc?.verification_notes || null,
    uploaded_at: doc?.uploaded_at || null,
    // Approved documents are locked; otherwise only missing/rejected slots
    // (or anything, while the owner is still collecting documents) can be replaced.
    canReplace: business.verification_status !== 'Verified'
      && status !== 'approved'
      && (status === 'missing' || status === 'rejected' || isDraft),
  };
});

const summarizeSlots = (slots) => ({
  missing: slots.filter((s) => s.status === 'missing').map((s) => s.type),
  rejected: slots.filter((s) => s.status === 'rejected').map((s) => s.type),
  notApproved: slots.filter((s) => s.status !== 'approved').map((s) => s.type),
  submittedCount: slots.filter((s) => s.status !== 'missing').length,
  approvedCount: slots.filter((s) => s.status === 'approved').length,
});

module.exports = {
  BUCKET_DOCS,
  MAX_DOC_BYTES,
  ADMIN_URL_TTL_SECONDS,
  REQUIRED_DOCUMENTS,
  REQUIRED_TYPES,
  MIME_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  hasValidSignature,
  storagePathFromUrl,
  createSignedUrl,
  getOwnBusiness,
  getRequiredDocumentRows,
  buildSlots,
  summarizeSlots,
};
