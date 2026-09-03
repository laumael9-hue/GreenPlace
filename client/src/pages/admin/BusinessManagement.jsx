import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import {
  Search, Building2, ChevronLeft, ChevronRight,
  CheckCircle, Ban, XCircle, Eye, Clock, MapPin,
  Phone, Globe, Mail, AlertTriangle, RotateCcw, Users
} from 'lucide-react';

const statusConfig = {
  pending: { variant: 'warning', label: 'Pending' },
  approved: { variant: 'success', label: 'Approved' },
  rejected: { variant: 'danger', label: 'Rejected' },
  suspended: { variant: 'danger', label: 'Suspended' },
};

export default function BusinessManagement() {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0, suspended: 0 });

  // Modals
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [suspendReason, setSuspendReason] = useState('');

  const fetchBusinesses = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter }),
      });
      const { data } = await api.get(`/businesses/admin?${params}`);
      setBusinesses(data.businesses);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Failed to fetch businesses:', err);
      setBusinesses([]);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await api.get('/businesses/admin/stats');
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  useEffect(() => {
    fetchBusinesses(1);
    fetchStats();
  }, [fetchBusinesses, fetchStats]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchBusinesses(1);
  };

  const openBusinessDetail = async (businessId) => {
    setDetailLoading(true);
    setSelectedBusiness(null);
    try {
      const { data } = await api.get(`/businesses/admin/${businessId}`);
      setSelectedBusiness(data.business);
    } catch {
      // ignore
    } finally {
      setDetailLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedBusiness) return;
    setActionLoading(true);
    try {
      await api.patch(`/businesses/admin/${selectedBusiness.id}/approve`);
      setSelectedBusiness(prev => prev ? { ...prev, status: 'approved', is_verified: true } : null);
      fetchBusinesses(pagination.page);
      fetchStats();
    } catch {
      // ignore
    } finally {
      setActionLoading(false);
    }
  };

  const openRejectModal = () => {
    setRejectReason('');
    setShowRejectModal(true);
  };

  const handleReject = async () => {
    if (!selectedBusiness || !rejectReason.trim()) return;
    setActionLoading(true);
    try {
      await api.patch(`/businesses/admin/${selectedBusiness.id}/reject`, { reason: rejectReason });
      setSelectedBusiness(prev => prev ? { ...prev, status: 'rejected', rejection_reason: rejectReason } : null);
      setShowRejectModal(false);
      fetchBusinesses(pagination.page);
      fetchStats();
    } catch {
      // ignore
    } finally {
      setActionLoading(false);
    }
  };

  const openSuspendModal = () => {
    setSuspendReason('');
    setShowSuspendModal(true);
  };

  const handleSuspend = async () => {
    if (!selectedBusiness) return;
    setActionLoading(true);
    try {
      await api.patch(`/businesses/admin/${selectedBusiness.id}/suspend`, {
        reason: suspendReason || undefined,
      });
      setSelectedBusiness(prev => prev ? { ...prev, status: 'suspended', is_verified: false } : null);
      setShowSuspendModal(false);
      fetchBusinesses(pagination.page);
      fetchStats();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to suspend business');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivate = async () => {
    if (!selectedBusiness) return;
    setActionLoading(true);
    try {
      await api.patch(`/businesses/admin/${selectedBusiness.id}/reactivate`);
      setSelectedBusiness(prev => prev ? { ...prev, status: 'approved', is_verified: true, rejection_reason: null } : null);
      fetchBusinesses(pagination.page);
      fetchStats();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to reactivate business');
    } finally {
      setActionLoading(false);
    }
  };

  const getOwnerName = (biz) => {
    if (biz.profiles) {
      return `${biz.profiles.first_name} ${biz.profiles.last_name}`;
    }
    return 'Unknown';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Business Management</h1>
        <p className="text-gray-500 mt-1">Review, approve, and manage business registrations.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
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
          <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
            <p className="text-sm text-gray-500">Pending</p>
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
        <Card className="flex items-center gap-4 p-4">
          <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center text-orange-600">
            <Ban className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.suspended}</p>
            <p className="text-sm text-gray-500">Suspended</p>
          </div>
        </Card>
      </div>

      {/* Search & Filter */}
      <Card padding={false}>
        <div className="p-4 border-b border-gray-100">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, category, or city..."
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
              <option value="suspended">Suspended</option>
            </select>
            <Button type="submit" size="sm">Search</Button>
          </form>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading businesses...</div>
        ) : businesses.length === 0 ? (
          <EmptyState
            icon={<Building2 className="w-8 h-8" />}
            title="No businesses found"
            description="No businesses match your search criteria."
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
                  <th className="px-4 py-3">Status</th>
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
                          <p className="text-xs text-gray-500">{biz.address?.substring(0, 30)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">{getOwnerName(biz)}</span>
                        {biz.profiles && (
                          <Badge variant={biz.profiles.is_active ? 'success' : 'danger'}>
                            {biz.profiles.is_active ? 'Active' : 'Suspended'}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="neutral">{biz.category}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{biz.city}</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusConfig[biz.status]?.variant || 'neutral'}>
                        {statusConfig[biz.status]?.label || biz.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openBusinessDetail(biz.id)}
                        className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                        title="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
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
                onClick={() => fetchBusinesses(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="p-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-40 rounded-lg"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm text-gray-700">
                Page {pagination.page} of {pagination.pages}
              </span>
              <button
                onClick={() => fetchBusinesses(pagination.page + 1)}
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
      <Modal open={!!selectedBusiness || detailLoading} onClose={() => setSelectedBusiness(null)} maxWidth="max-w-lg">
        {detailLoading ? (
          <div className="py-8 text-center text-gray-500">Loading business details...</div>
        ) : selectedBusiness && (
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              {selectedBusiness.logo_url ? (
                <img src={selectedBusiness.logo_url} alt="" className="w-16 h-16 rounded-xl object-cover" />
              ) : (
                <div className="w-16 h-16 bg-primary-100 rounded-xl flex items-center justify-center">
                  <Building2 className="w-8 h-8 text-primary-600" />
                </div>
              )}
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">{selectedBusiness.name}</h3>
                <p className="text-sm text-gray-500">{selectedBusiness.category}</p>
                <Badge variant={statusConfig[selectedBusiness.status]?.variant || 'neutral'}>
                  {statusConfig[selectedBusiness.status]?.label || selectedBusiness.status}
                </Badge>
              </div>
            </div>

            {selectedBusiness.description && (
              <p className="text-sm text-gray-600">{selectedBusiness.description}</p>
            )}

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">{selectedBusiness.address}, {selectedBusiness.city}</span>
              </div>
              {selectedBusiness.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">{selectedBusiness.phone}</span>
                </div>
              )}
              {selectedBusiness.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">{selectedBusiness.email}</span>
                </div>
              )}
              {selectedBusiness.website && (
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-gray-400" />
                  <a href={selectedBusiness.website} target="_blank" rel="noreferrer" className="text-primary-600 hover:underline truncate">{selectedBusiness.website}</a>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-lg font-bold text-gray-900">{selectedBusiness.rating_avg || '0.0'}</p>
                <p className="text-xs text-gray-500">Rating ({selectedBusiness.rating_count || 0})</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-lg font-bold text-gray-900">{selectedBusiness.total_drop_offs || 0}</p>
                <p className="text-xs text-gray-500">Drop-offs</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-lg font-bold text-gray-900">{selectedBusiness.total_orders || 0}</p>
                <p className="text-xs text-gray-500">Orders</p>
              </div>
            </div>

            <div className="text-sm">
              <div className="flex items-center gap-2">
                <p className="text-gray-500">Owner: <span className="font-medium text-gray-900">{getOwnerName(selectedBusiness)}</span></p>
                {selectedBusiness.profiles && (
                  <Badge variant={selectedBusiness.profiles.is_active ? 'success' : 'danger'}>
                    {selectedBusiness.profiles.is_active ? 'Account Active' : 'Account Suspended'}
                  </Badge>
                )}
              </div>
              <p className="text-gray-500">Registered: <span className="font-medium text-gray-900">{new Date(selectedBusiness.created_at).toLocaleDateString()}</span></p>
              {selectedBusiness.approved_at && (
                <p className="text-gray-500">Approved: <span className="font-medium text-gray-900">{new Date(selectedBusiness.approved_at).toLocaleDateString()}</span></p>
              )}
              {selectedBusiness.owner_id && (
                <Link
                  to={`/admin/users?role=business`}
                  className="inline-flex items-center gap-1 mt-2 text-xs text-primary-600 hover:text-primary-700 font-medium"
                >
                  <Users className="w-3 h-3" />
                  View Owner Account
                </Link>
              )}
            </div>

            {selectedBusiness.rejection_reason && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800"><strong>Rejection Reason:</strong> {selectedBusiness.rejection_reason}</p>
              </div>
            )}

            {/* Hours */}
            {selectedBusiness.hours && selectedBusiness.hours.length > 0 && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-900 mb-2">Operating Hours</p>
                <div className="space-y-1 text-sm">
                  {selectedBusiness.hours.map(h => (
                    <div key={h.day} className="flex justify-between">
                      <span className="text-gray-500 capitalize">{h.day}</span>
                      <span className="font-medium">{h.is_closed ? 'Closed' : `${h.open_time} - ${h.close_time}`}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Materials */}
            {selectedBusiness.materials && selectedBusiness.materials.length > 0 && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-900 mb-2">Accepted Materials</p>
                <div className="flex flex-wrap gap-2">
                  {selectedBusiness.materials.map((m, i) => (
                    <Badge key={i} variant="neutral">
                      {m.material_name}{m.price_per_kg ? ` — ₱${m.price_per_kg}/${m.unit}` : ''}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Documents */}
            {selectedBusiness.documents && selectedBusiness.documents.length > 0 && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-900 mb-2">Documents ({selectedBusiness.documents.length})</p>
                <div className="space-y-1 text-sm">
                  {selectedBusiness.documents.map(doc => (
                    <div key={doc.id} className="flex justify-between">
                      <span className="text-gray-700">{doc.file_name}</span>
                      <a href={doc.file_url} target="_blank" rel="noreferrer" className="text-primary-600 hover:underline">View</a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
              {selectedBusiness.status === 'pending' && (
                <>
                  <Button variant="primary" size="sm" onClick={handleApprove} disabled={actionLoading}>
                    <CheckCircle className="w-4 h-4" />
                    {actionLoading ? 'Processing...' : 'Approve'}
                  </Button>
                  <Button variant="danger" size="sm" onClick={openRejectModal} disabled={actionLoading}>
                    <XCircle className="w-4 h-4" />
                    Reject
                  </Button>
                </>
              )}
              {selectedBusiness.status === 'approved' && (
                <Button variant="danger" size="sm" onClick={openSuspendModal} disabled={actionLoading}>
                  <Ban className="w-4 h-4" />
                  Suspend
                </Button>
              )}
              {selectedBusiness.status === 'rejected' && (
                <Button variant="primary" size="sm" onClick={handleApprove} disabled={actionLoading}>
                  <CheckCircle className="w-4 h-4" />
                  Approve Instead
                </Button>
              )}
              {(selectedBusiness.status === 'suspended' || selectedBusiness.status === 'rejected') && (
                <Button variant="outline" size="sm" onClick={handleReactivate} disabled={actionLoading}>
                  <RotateCcw className="w-4 h-4" />
                  Reactivate
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Reject Modal */}
      <Modal open={showRejectModal} onClose={() => setShowRejectModal(false)} maxWidth="max-w-sm">
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
              placeholder="Explain why this business is being rejected..."
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

      {/* Suspend Modal */}
      <Modal open={showSuspendModal} onClose={() => setShowSuspendModal(false)} maxWidth="max-w-sm">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Suspend Business</h3>
              <p className="text-sm text-gray-500">{selectedBusiness?.name}</p>
            </div>
          </div>
          <p className="text-sm text-gray-600">
            This will hide the business from public listings and prevent new orders.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
            <input
              type="text"
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="e.g., Violation of terms..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowSuspendModal(false)}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={handleSuspend} disabled={actionLoading}>
              {actionLoading ? 'Suspending...' : 'Suspend Business'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
