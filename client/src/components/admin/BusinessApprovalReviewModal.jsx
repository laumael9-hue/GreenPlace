import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, CheckCircle, Clock, ExternalLink, Loader2, Minus, XCircle } from 'lucide-react';
import api from '../../lib/api';
import Modal from '../ui/Modal';
import Badge from '../ui/Badge';
import Button from '../ui/Button';

const STATUS_ICON = {
  approved: <CheckCircle className="w-5 h-5 text-green-600" aria-label="Approved" />,
  rejected: <XCircle className="w-5 h-5 text-red-600" aria-label="Rejected" />,
  pending: <Clock className="w-5 h-5 text-amber-600" aria-label="Pending review" />,
  missing: <Minus className="w-5 h-5 text-gray-300" aria-label="Not submitted" />,
};

// Admin review of a business's 3 required documents. Per-document approve/reject,
// then approve/reject for the whole business (only when appropriate).
// onChanged() lets the parent refresh its queue after a business-level decision.
export default function BusinessApprovalReviewModal({ business, onClose, onChanged }) {
  const businessId = business?.id;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [rejectingDocId, setRejectingDocId] = useState(null);
  const [docReason, setDocReason] = useState('');
  const [rejectingBusiness, setRejectingBusiness] = useState(false);
  const [businessReason, setBusinessReason] = useState('');
  const [deciding, setDeciding] = useState(false);

  const load = useCallback(async () => {
    if (!businessId) return;
    try {
      const { data: res } = await api.get(`/admin/businesses/${businessId}/documents`);
      setData(res);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load documents.');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    setData(null);
    setError('');
    setRejectingDocId(null);
    setRejectingBusiness(false);
    if (businessId) {
      setLoading(true);
      load();
    }
  }, [businessId, load]);

  const reviewDocument = async (doc, status, notes = '') => {
    setBusyId(doc.id);
    setError('');
    try {
      await api.patch(`/admin/documents/${doc.id}`, { status, notes });
      setRejectingDocId(null);
      setDocReason('');
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update document.');
    } finally {
      setBusyId(null);
    }
  };

  const approveBusiness = async () => {
    setDeciding(true);
    setError('');
    try {
      await api.post(`/admin/businesses/${businessId}/approve`);
      onChanged?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to approve business.');
    } finally {
      setDeciding(false);
    }
  };

  const rejectBusiness = async () => {
    setDeciding(true);
    setError('');
    try {
      await api.post(`/admin/businesses/${businessId}/reject`, { reason: businessReason.trim() });
      onChanged?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reject business.');
    } finally {
      setDeciding(false);
    }
  };

  const startRejectBusiness = () => {
    // Pre-fill with what was said on the rejected documents; the admin can edit it
    const reasons = data.documents
      .filter((d) => d.status === 'rejected')
      .map((d) => (d.notes ? `${d.label}: ${d.notes}` : `${d.label} was rejected`));
    setBusinessReason(reasons.join('. '));
    setRejectingBusiness(true);
  };

  return (
    <Modal open={!!business} onClose={onClose} title="Review Documents" maxWidth="max-w-xl">
      <div className="space-y-5">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{business?.name}</h3>
          {data && (
            <p className="mt-0.5 text-sm text-gray-500">
              {data.submittedCount} of {data.total} documents submitted
            </p>
          )}
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {loading && !data ? (
          <div className="py-8 text-center text-gray-500">Loading documents...</div>
        ) : data && (
          <>
            <ul className="space-y-2">
              {data.documents.map((doc) => (
                <li key={doc.type} className="p-3 border border-gray-200 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="shrink-0">{STATUS_ICON[doc.status]}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">{doc.label}</p>
                      <p className="text-xs text-gray-500 truncate">{doc.file_name || 'Not submitted'}</p>
                    </div>
                    {doc.url ? (
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-primary-600 hover:underline shrink-0"
                      >
                        View <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    ) : (
                      <span className="text-sm text-gray-300 shrink-0">View</span>
                    )}
                  </div>

                  {doc.status === 'rejected' && doc.notes && (
                    <p className="mt-2 text-xs text-red-600">Reason: {doc.notes}</p>
                  )}

                  {doc.id && rejectingDocId !== doc.id && (
                    <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-gray-100">
                      <Badge variant={doc.status === 'approved' ? 'success' : doc.status === 'rejected' ? 'danger' : 'warning'}>
                        {doc.status === 'pending' ? 'Pending review' : doc.status === 'approved' ? 'Approved' : 'Rejected'}
                      </Badge>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => { setRejectingDocId(doc.id); setDocReason(''); }}
                          disabled={busyId === doc.id || doc.status === 'rejected'}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-40"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => reviewDocument(doc, 'approved')}
                          disabled={busyId === doc.id || doc.status === 'approved'}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-green-700 border border-green-200 hover:bg-green-50 rounded-md transition-colors disabled:opacity-40"
                        >
                          {busyId === doc.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                          Approve
                        </button>
                      </div>
                    </div>
                  )}

                  {rejectingDocId === doc.id && (
                    <div className="mt-2 space-y-2">
                      <textarea
                        rows={2}
                        value={docReason}
                        onChange={(e) => setDocReason(e.target.value)}
                        placeholder="Reason (optional). The owner sees this."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                      />
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setRejectingDocId(null)}>Cancel</Button>
                        <Button variant="danger" size="sm" onClick={() => reviewDocument(doc, 'rejected', docReason.trim())} disabled={busyId === doc.id}>
                          {busyId === doc.id ? 'Rejecting...' : 'Reject document'}
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>

            {rejectingBusiness ? (
              <div className="space-y-2 pt-3 border-t border-gray-100">
                <label htmlFor="business-reject-reason" className="block text-sm font-medium text-gray-700">
                  Rejection reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="business-reject-reason"
                  rows={3}
                  value={businessReason}
                  onChange={(e) => setBusinessReason(e.target.value)}
                  placeholder="Explain what the owner needs to fix..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setRejectingBusiness(false)}>Cancel</Button>
                  <Button variant="danger" size="sm" onClick={rejectBusiness} disabled={deciding || !businessReason.trim()}>
                    {deciding ? 'Rejecting...' : 'Reject business'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-500">
                  {data.canApprove
                    ? 'All documents are approved.'
                    : data.canReject
                      ? 'A document was rejected. You can reject the business so the owner can resubmit.'
                      : 'Review every document to decide on this business.'}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={startRejectBusiness}
                    disabled={!data.canReject || deciding}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject business
                  </button>
                  <Button size="sm" onClick={approveBusiness} disabled={!data.canApprove || deciding}>
                    <CheckCircle className="w-4 h-4" />
                    {deciding ? 'Approving...' : 'Approve business'}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
