import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';
import { exportToCsv, csvFilename } from '../../lib/exportCsv';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import {
  Search, Building2, ChevronLeft, ChevronRight,
  CheckCircle, XCircle, Eye, Clock, FileText,
  Download, AlertTriangle, MapPin, Mail, Phone
} from 'lucide-react';

const statusConfig = {
  pending: { variant: 'warning', label: 'Pending' },
  approved: { variant: 'success', label: 'Approved' },
  rejected: { variant: 'danger', label: 'Rejected' },
  suspended: { variant: 'danger', label: 'Suspended' },
};

export default function Approvals() {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0, suspended: 0 });
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [error, setError] = useState('');

  const fetchQueue = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        status: 'pending',
        ...(search && { search }),
      });
      const { data } = await api.get(`/businesses/admin?${params}`);
      setBusinesses(data.businesses || []);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Failed to fetch pending businesses:', err);
      setError(err.response?.data?.error || 'Failed to load the approvals queue.');
      setBusinesses([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await api.get('/businesses/admin/stats');
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  useEffect(() => {
    fetchQueue(1);
    fetchStats();
  }, [fetchQueue, fetchStats]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchQueue(1);
  };

  const openDetail = async (businessId) => {
    setDetailLoading(true);
    setSelectedBusiness(null);
    try {
      const { data } = await api.get(`/businesses/admin/${businessId}`);
      setSelectedBusiness(data.business);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load business details.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleApprove = async (businessId) => {
    setActionLoading(true);
    setError('');
    try {
      await api.patch(`/businesses/admin/${businessId}/approve`);
      setSelectedBusiness(prev => prev?.id === businessId
        ? { ...prev, status: 'approved', is_verified: true }
        : prev);
      fetchQueue(pagination.page);
      fetchStats();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to approve business.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedBusiness || !rejectReason.trim()) return;
    setActionLoading(true);
    setError('');
    try {
      await api.patch(`/businesses/admin/${selectedBusiness.id}/reject`, { reason: rejectReason });
      setSelectedBusiness(prev => prev ? { ...prev, status: 'rejected', rejection_reason: rejectReason } : null);
      setShowRejectModal(false);
      fetchQueue(pagination.page);
      fetchStats();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reject business.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({ page: '1', limit: '500', status: 'pending', ...(search && { search }) });
      const { data } = await api.get(`/businesses/admin?${params}`);
      const rows = (data.businesses || []).map((b) => [
        b.name,
        b.profiles ? `${b.profiles.first_name} ${b.profiles.last_name}` : '',
        b.profiles?.email || '',
        b.category,
        b.city,
        b.status,
        b.created_at ? new Date(b.created_at).toLocaleDateString() : '',
      ]);
      exportToCsv(
        csvFilename('greenplace-pending-approvals'),
        ['Business', 'Owner', 'Email', 'Category', 'City', 'Status', 'Registered'],
        rows
      );
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to export approvals.');
    }
  };

  const getOwnerName = (biz) =>
    biz.profiles ? `${biz.profiles.first_name} ${biz.profiles.last_name}` : 'Unknown';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Approvals</h1>
          <p className="text-gray-500 mt-1">Pending business registrations waiting for review.</p>
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
            <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
            <p className="text-sm text-gray-500">Pending</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-4">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-sm text-gray-500">Total</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-4">
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-green-600">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.approved}</p>
            <p className="text-sm text-gray-500">Approved</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-4">
          <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center text-red-600">
            <XCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.rejected}</p>
            <p className="text-sm text-gray-500">Rejected</p>
          </div>
        </Card>
      </div>

      {/* Queue */}
      <Card padding={false}>
        <div className="p-4 border-b border-gray-100">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search pending registrations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <Button type="submit" size="sm">Search</Button>
          </form>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading pending registrations...</div>
        ) : businesses.length === 0 ? (
          <EmptyState
            icon={<CheckCircle className="w-8 h-8" />}
            title="Approval queue is clear"
            description="No business registrations are waiting for review."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Business</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">City</th>
                  <th className="px-4 py-3">Registered</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {businesses.map((biz) => (
                  <tr key={biz.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {biz.logo_url ? (
                          <img src={biz.logo_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
                        ) : (
                          <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                            <Building2 className="w-4 h-4 text-primary-600" />
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-gray-900">{biz.name}</p>
                          <Badge variant="warning">Pending Review</Badge>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{getOwnerName(biz)}</td>
                    <td className="px-4 py-3">
                      <Badge variant="neutral">{biz.category}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{biz.city}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {biz.created_at ? new Date(biz.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openDetail(biz.id)}
                          className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          title="Review details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleApprove(biz.id)}
                          disabled={actionLoading}
                          className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Approve"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { setSelectedBusiness(biz); setRejectReason(''); setShowRejectModal(true); }}
                          disabled={actionLoading}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Reject"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
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
                onClick={() => fetchQueue(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="p-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-40 rounded-lg"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm text-gray-700">
                Page {pagination.page} of {pagination.pages}
              </span>
              <button
                onClick={() => fetchQueue(pagination.page + 1)}
                disabled={pagination.page >= pagination.pages}
                className="p-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-40 rounded-lg"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Detail Modal */}
      <Modal open={!!selectedBusiness || detailLoading} onClose={() => setSelectedBusiness(null)} title="Review Registration" maxWidth="max-w-lg">
        {detailLoading ? (
          <div className="py-8 text-center text-gray-500">Loading business details...</div>
        ) : selectedBusiness && (
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              {selectedBusiness.logo_url ? (
                <img src={selectedBusiness.logo_url} alt="" className="w-14 h-14 rounded-xl object-cover" />
              ) : (
                <div className="w-14 h-14 bg-primary-100 rounded-xl flex items-center justify-center">
                  <Building2 className="w-7 h-7 text-primary-600" />
                </div>
              )}
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">{selectedBusiness.name}</h3>
                <p className="text-sm text-gray-500">{selectedBusiness.category}</p>
                <div className="mt-1">
                  <Badge variant={statusConfig[selectedBusiness.status]?.variant || 'neutral'}>
                    {statusConfig[selectedBusiness.status]?.label || selectedBusiness.status}
                  </Badge>
                </div>
              </div>
            </div>

            {selectedBusiness.description && (
              <p className="text-sm text-gray-600">{selectedBusiness.description}</p>
            )}

            <div className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <MapPin className="w-4 h-4 text-gray-400" />
                {selectedBusiness.address}, {selectedBusiness.city}
              </div>
              {selectedBusiness.phone && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Phone className="w-4 h-4 text-gray-400" />
                  {selectedBusiness.phone}
                </div>
              )}
              {selectedBusiness.email && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Mail className="w-4 h-4 text-gray-400" />
                  {selectedBusiness.email}
                </div>
              )}
            </div>

            <div className="text-sm text-gray-500">
              <p>Owner: <span className="font-medium text-gray-900">{getOwnerName(selectedBusiness)}</span></p>
              <p>Registered: <span className="font-medium text-gray-900">
                {selectedBusiness.created_at ? new Date(selectedBusiness.created_at).toLocaleDateString() : '—'}
              </span></p>
            </div>

            {selectedBusiness.documents && selectedBusiness.documents.length > 0 && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-1.5">
                  <FileText className="w-4 h-4" />
                  Submitted Documents ({selectedBusiness.documents.length})
                </p>
                <div className="space-y-1 text-sm">
                  {selectedBusiness.documents.map(doc => (
                    <div key={doc.id} className="flex justify-between items-center">
                      <span className="text-gray-700 truncate">{doc.file_name}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={doc.verification_status === 'approved' ? 'success' : doc.verification_status === 'rejected' ? 'danger' : 'warning'}>
                          {doc.verification_status || 'pending'}
                        </Badge>
                        <a href={doc.file_url} target="_blank" rel="noreferrer" className="text-primary-600 hover:underline">View</a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedBusiness.status === 'pending' && (
              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => { setRejectReason(''); setShowRejectModal(true); }}
                  disabled={actionLoading}
                >
                  <XCircle className="w-4 h-4" />
                  Reject
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleApprove(selectedBusiness.id)}
                  disabled={actionLoading}
                >
                  <CheckCircle className="w-4 h-4" />
                  {actionLoading ? 'Approving...' : 'Approve'}
                </Button>
              </div>
            )}
            {selectedBusiness.status !== 'pending' && (
              <div className="pt-3 border-t border-gray-100">
                <Link to="/admin/businesses" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                  View in Business Management →
                </Link>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Reject Modal */}
      <Modal open={showRejectModal} onClose={() => setShowRejectModal(false)} title="Reject Registration" maxWidth="max-w-sm">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Reject Business</h3>
              <p className="text-sm text-gray-500">{selectedBusiness?.name}</p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rejection Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Explain why this registration is being rejected..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowRejectModal(false)}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={handleReject} disabled={actionLoading || !rejectReason.trim()}>
              {actionLoading ? 'Rejecting...' : 'Reject Business'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
