import { useState, useEffect, useCallback } from 'react';
import api from '../../lib/api';
import { exportToCsv, csvFilename } from '../../lib/exportCsv';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import {
  Search, FileText, ChevronLeft, ChevronRight,
  CheckCircle, XCircle, Eye, Clock, Download,
  AlertTriangle, Building2, Loader2
} from 'lucide-react';

const statusConfig = {
  pending: { variant: 'warning', label: 'Pending' },
  approved: { variant: 'success', label: 'Approved' },
  rejected: { variant: 'danger', label: 'Rejected' },
};

const formatSize = (bytes) => {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function Documents() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0, total: 0 });
  const [previewDoc, setPreviewDoc] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchDocuments = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter }),
      });
      const { data } = await api.get(`/businesses/admin/documents?${params}`);
      setDocuments(data.documents || []);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Failed to fetch documents:', err);
      setError(err.response?.data?.error || 'Failed to load documents.');
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  const fetchCounts = useCallback(async () => {
    try {
      const fetchCount = async (status) => {
        const params = new URLSearchParams({ page: '1', limit: '1', ...(status && { status }) });
        const { data } = await api.get(`/businesses/admin/documents?${params}`);
        return data.pagination?.total || 0;
      };
      const [pending, approved, rejected, total] = await Promise.all([
        fetchCount('pending'), fetchCount('approved'), fetchCount('rejected'), fetchCount(''),
      ]);
      setCounts({ pending, approved, rejected, total });
    } catch (err) {
      console.error('Failed to fetch document counts:', err);
    }
  }, []);

  useEffect(() => {
    fetchDocuments(1);
    fetchCounts();
  }, [fetchDocuments, fetchCounts]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchDocuments(1);
  };

  const handleVerify = async (doc, status, notes = '') => {
    if (!doc) return;
    setActionLoading(true);
    setError('');
    try {
      await api.patch(`/businesses/admin/documents/${doc.id}/verify`, { status, notes });
      setPreviewDoc(prev => prev?.id === doc.id
        ? { ...prev, verification_status: status, verification_notes: notes || null }
        : prev);
      setRejectTarget(null);
      fetchDocuments(pagination.page);
      fetchCounts();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update document.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        page: '1', limit: '500',
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter }),
      });
      const { data } = await api.get(`/businesses/admin/documents?${params}`);
      const rows = (data.documents || []).map((d) => [
        d.file_name,
        d.document_type,
        d.business?.name || '',
        d.business?.owner ? `${d.business.owner.first_name} ${d.business.owner.last_name}` : '',
        d.verification_status,
        d.uploaded_at ? new Date(d.uploaded_at).toLocaleDateString() : '',
        d.verified_at ? new Date(d.verified_at).toLocaleDateString() : '',
        d.verification_notes || '',
      ]);
      exportToCsv(
        csvFilename('greenplace-documents'),
        ['File', 'Type', 'Business', 'Owner', 'Status', 'Uploaded', 'Verified', 'Notes'],
        rows
      );
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to export documents.');
    }
  };

  const isImage = (doc) => doc.mime_type?.startsWith('image/');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="text-gray-500 mt-1">Verify business permits, registrations, and IDs.</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={loading}>
          <Download className="w-4 h-4" />
          Export CSV
        </Button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="flex items-center gap-4 p-4">
          <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{counts.pending}</p>
            <p className="text-sm text-gray-500">Pending</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-4">
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-green-600">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{counts.approved}</p>
            <p className="text-sm text-gray-500">Approved</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-4">
          <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center text-red-600">
            <XCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{counts.rejected}</p>
            <p className="text-sm text-gray-500">Rejected</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-4">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{counts.total}</p>
            <p className="text-sm text-gray-500">Total</p>
          </div>
        </Card>
      </div>

      {/* List */}
      <Card padding={false}>
        <div className="p-4 border-b border-gray-100">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by file name or document type..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <Button type="submit" size="sm">Search</Button>
          </form>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading documents...</div>
        ) : documents.length === 0 ? (
          <EmptyState
            icon={<FileText className="w-8 h-8" />}
            title="No documents found"
            description="No documents match your search criteria."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Document</th>
                  <th className="px-4 py-3">Business</th>
                  <th className="px-4 py-3">Uploaded</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                          <FileText className="w-4 h-4 text-primary-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 line-clamp-1">{doc.file_name}</p>
                          <p className="text-xs text-gray-500">{doc.document_type} · {formatSize(doc.file_size)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-700">{doc.business?.name || '—'}</p>
                      <p className="text-xs text-gray-500">
                        {doc.business?.owner
                          ? `${doc.business.owner.first_name} ${doc.business.owner.last_name}`
                          : 'Unknown owner'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusConfig[doc.verification_status]?.variant || 'neutral'}>
                        {statusConfig[doc.verification_status]?.label || doc.verification_status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setPreviewDoc(doc)}
                          className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          title="Preview document"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {doc.verification_status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleVerify(doc, 'approved')}
                              disabled={actionLoading}
                              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                              title="Approve document"
                            >
                              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => { setRejectTarget(doc); setRejectNotes(''); }}
                              disabled={actionLoading}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                              title="Reject document"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchDocuments(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="p-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-40 rounded-lg"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm text-gray-700">
                Page {pagination.page} of {pagination.pages}
              </span>
              <button
                onClick={() => fetchDocuments(pagination.page + 1)}
                disabled={pagination.page >= pagination.pages}
                className="p-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-40 rounded-lg"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Preview Modal */}
      <Modal open={!!previewDoc} onClose={() => setPreviewDoc(null)} title="Document Preview" maxWidth="max-w-2xl">
        {previewDoc && (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-gray-900">{previewDoc.file_name}</h3>
                <p className="text-sm text-gray-500">
                  {previewDoc.document_type} · {formatSize(previewDoc.file_size)}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  <Building2 className="w-3.5 h-3.5 inline mr-1" />
                  {previewDoc.business?.name || 'Unknown business'}
                </p>
              </div>
              <Badge variant={statusConfig[previewDoc.verification_status]?.variant || 'neutral'}>
                {statusConfig[previewDoc.verification_status]?.label || previewDoc.verification_status}
              </Badge>
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
              {isImage(previewDoc) ? (
                <img
                  src={previewDoc.file_url}
                  alt={previewDoc.file_name}
                  className="w-full max-h-[420px] object-contain"
                />
              ) : (
                <iframe
                  src={previewDoc.file_url}
                  title={previewDoc.file_name}
                  className="w-full h-[420px] bg-white"
                />
              )}
            </div>

            <a
              href={previewDoc.file_url}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Open in new tab →
            </a>

            {previewDoc.verification_notes && (
              <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700">
                <strong>Notes:</strong> {previewDoc.verification_notes}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <Button variant="ghost" size="sm" onClick={() => setPreviewDoc(null)}>Close</Button>
              {previewDoc.verification_status === 'pending' && (
                <>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => { setRejectTarget(previewDoc); setRejectNotes(''); }}
                    disabled={actionLoading}
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleVerify(previewDoc, 'approved')}
                    disabled={actionLoading}
                  >
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    {actionLoading ? 'Saving...' : 'Approve'}
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Reject Modal */}
      <Modal open={!!rejectTarget} onClose={() => setRejectTarget(null)} title="Reject Document" maxWidth="max-w-sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            The business owner will be notified with your notes.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              placeholder="e.g., The document is blurry or expired..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => handleVerify(rejectTarget, 'rejected', rejectNotes)}
              disabled={actionLoading || !rejectNotes.trim()}
            >
              {actionLoading ? 'Rejecting...' : 'Reject Document'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
