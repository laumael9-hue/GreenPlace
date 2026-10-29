// The 3 documents a waste management establishment must submit. Keep in sync
// with REQUIRED_DOCUMENTS in server/src/services/businessVerification.js.
export const REQUIRED_DOCUMENTS = [
  { type: 'DTI_SEC', label: 'DTI / SEC Registration' },
  { type: 'BUSINESS_PERMIT', label: "Mayor's / Business Permit" },
  { type: 'BIR_COR', label: 'BIR Certificate of Registration' },
];

export const DOCUMENT_ACCEPT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png'];

// Returns an error message, or '' when the file is acceptable.
export function validateDocumentFile(file) {
  if (!file) return '';
  if (!ALLOWED_MIME.includes(file.type)) return 'Only PDF, JPG or PNG files are allowed.';
  if (file.size > MAX_DOCUMENT_BYTES) return 'File is too large. The maximum size is 5 MB.';
  if (file.size === 0) return 'This file is empty.';
  return '';
}

export function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function uploadRequiredDocument(api, documentType, file) {
  const formData = new FormData();
  formData.append('documentType', documentType);
  formData.append('file', file);
  const { data } = await api.post('/business/documents', formData);
  return data.document;
}
