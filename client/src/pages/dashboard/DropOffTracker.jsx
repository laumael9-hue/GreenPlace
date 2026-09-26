import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Package, Search, Plus, CheckCircle2, Clock, Loader2, Eye,
  DollarSign, User, ChevronLeft, ChevronRight, XCircle,
} from 'lucide-react';
import api from '../../lib/api';
import Badge from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import NewDropOffModal from './NewDropOffModal';

const statusConfig = {
  scheduled: { variant: 'warning', label: 'Pending' },
  in_transit: { variant: 'info', label: 'In Transit' },
  received: { variant: 'info', label: 'Received' },
  processed: { variant: 'success', label: 'Completed' },
  cancelled: { variant: 'danger', label: 'Cancelled' },
};

export default function DropOffTracker() {
  const [dropOffs, setDropOffs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedDropOff, setSelectedDropOff] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [stats, setStats] = useState({ total: 0, pending: 0, completed: 0, totalPayout: 0 });

  const fetchDropOffs = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });
      if (search) params.set('search', search);
      if (filter) params.set('status', filter);

      const { data } = await api.get(`/drop-offs/business?${params}`);
      setDropOffs(data.dropOffs || []);
      setPagination(data.pagination);

      // Calculate stats from all data (fetch without pagination for stats)
      if (page === 1) {
        const { data: allData } = await api.get('/drop-offs/business?limit=1000');
        const all = allData.dropOffs || [];
        setStats({
          total: all.length,
          pending: all.filter(d => d.status === 'scheduled').length,
          completed: all.filter(d => d.status === 'processed').length,
          totalPayout: all
            .filter(d => d.status === 'processed')
            .reduce((sum, d) => sum + parseFloat(d.actual_value || d.estimated_value || 0), 0),
        });
      }
    } catch (err) {
      console.error('Failed to fetch drop-offs:', err);
    } finally {
      setLoading(false);
    }
  }, [search, filter]);

  useEffect(() => { fetchDropOffs(1); }, [fetchDropOffs]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchDropOffs(1);
  };

  const openDetail = async (id) => {
    setDetailLoading(true);
    setSelectedDropOff(null);
    try {
      const { data } = await api.get(`/drop-offs/${id}`);
      setSelectedDropOff(data.dropOff);
    } catch (err) {
      console.error('Failed to fetch drop-off:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleComplete = async (id) => {
    setActionLoading(true);
    setActionError('');
    try {
      await api.patch(`/drop-offs/${id}/complete`);
      setSelectedDropOff(null);
      fetchDropOffs(pagination.page);
    } catch (err) {
      console.error('Failed to complete drop-off:', err);
      setActionError(err.response?.data?.error || err.message || 'Failed to complete drop-off');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async (id) => {
    setActionLoading(true);
    setActionError('');
    try {
      await api.patch(`/drop-offs/${id}/cancel`);
      setSelectedDropOff(null);
      fetchDropOffs(pagination.page);
    } catch (err) {
      console.error('Failed to cancel drop-off:', err);
      setActionError(err.response?.data?.error || err.message || 'Failed to cancel drop-off');
    } finally {
      setActionLoading(false);
    }
  };

  const filterOptions = [
    { value: '', label: 'All Drop-offs' },
    { value: 'scheduled', label: 'Pending' },
    { value: 'processed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  const statCards = [
    { label: 'Total Drop-offs', value: stats.total, icon: Package, color: 'bg-gray-100 text-gray-600' },
    { label: 'Pending', value: stats.pending, icon: Clock, color: 'bg-amber-100 text-amber-600' },
    { label: 'Completed', value: stats.completed, icon: CheckCircle2, color: 'bg-green-100 text-green-600' },
    { label: 'Total Payout', value: `₱${stats.totalPayout.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`, icon: DollarSign, color: 'bg-primary-100 text-primary-600' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Drop-off Tracker</h1>
          <p className="text-gray-500 mt-1">Record residents selling materials to your facility.</p>
        </div>
        <Button onClick={() => setShowNewModal(true)}>
          <Plus className="w-4 h-4" /> New Drop-off
        </Button>
      </div>

      {actionError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between gap-3">
          <p className="text-sm text-red-700">{actionError}</p>
          <button onClick={() => setActionError('')} className="p-1 text-red-400 hover:text-red-600">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="flex items-center gap-4 p-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${stat.color}`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{stat.label}</p>
              <p className="text-lg font-bold text-gray-900">{stat.value}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Search */}
      <Card padding={false}>
        <div className="p-4 border-b border-gray-100">
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by resident, material, or date..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <Button type="submit" size="sm">Search</Button>
          </form>
        </div>

        {/* Filter tabs */}
        <div className="px-4 pt-3 flex gap-2 overflow-x-auto">
          {filterOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                filter === opt.value
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-primary-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
          </div>
        ) : dropOffs.length === 0 ? (
          <EmptyState
            icon={<Package className="w-8 h-8" />}
            title="No drop-offs yet"
            description="Record your first drop-off to get started."
            action={<Button onClick={() => setShowNewModal(true)}><Plus className="w-4 h-4" /> New Drop-off</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Resident</th>
                  <th className="px-4 py-3">Material</th>
                  <th className="px-4 py-3">Weight</th>
                  <th className="px-4 py-3">Payout</th>
                  <th className="px-4 py-3">Date / Time</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {dropOffs.map((dropOff) => {
                  const statusInfo = statusConfig[dropOff.status] || statusConfig.scheduled;
                  const items = dropOff.drop_off_items || [];
                  const materialNames = items.map(i => i.material_name).join(', ');
                  const totalWeight = items.reduce((sum, i) => sum + parseFloat(i.quantity || 0), 0);

                  return (
                    <tr
                      key={dropOff.id}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => openDetail(dropOff.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-gray-400" />
                          </div>
                          <span className="text-sm font-medium text-gray-900">{dropOff.resident_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-[180px] truncate">{materialNames}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">{totalWeight.toFixed(1)} kg</td>
                      <td className="px-4 py-3 text-sm font-bold text-primary-600">
                        ₱{parseFloat(dropOff.actual_value || dropOff.estimated_value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(dropOff.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                        {', '}
                        {new Date(dropOff.created_at).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true })}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {dropOff.status === 'scheduled' ? (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleComplete(dropOff.id)}
                              disabled={actionLoading}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Complete
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleCancel(dropOff.id)}
                              disabled={actionLoading}
                            >
                              <XCircle className="w-3.5 h-3.5" /> Cancel
                            </Button>
                          </div>
                        ) : dropOff.status === 'processed' ? (
                          <Link to={`/drop-offs/${dropOff.id}/receipt`} onClick={(e) => e.stopPropagation()}>
                            <Button variant="outline" size="sm">
                              <Package className="w-3.5 h-3.5" /> Receipt
                            </Button>
                          </Link>
                        ) : (
                          <Button variant="ghost" size="sm" disabled>
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Showing {(pagination.page - 1) * pagination.limit + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchDropOffs(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <span className="text-sm text-gray-600">Page {pagination.page} of {pagination.pages}</span>
              <button
                onClick={() => fetchDropOffs(pagination.page + 1)}
                disabled={pagination.page >= pagination.pages}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Detail Modal */}
      <Modal
        open={!!selectedDropOff || detailLoading}
        onClose={() => setSelectedDropOff(null)}
        title="Drop-off Details"
        maxWidth="max-w-lg"
      >
        {detailLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
          </div>
        ) : selectedDropOff && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Reference</p>
                <p className="text-sm font-mono font-bold text-gray-900">{selectedDropOff.reference_number}</p>
              </div>
              <Badge variant={statusConfig[selectedDropOff.status]?.variant}>
                {statusConfig[selectedDropOff.status]?.label}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Resident</p>
                <p className="text-sm font-medium text-gray-900">{selectedDropOff.resident_name}</p>
                {selectedDropOff.guest_phone && (
                  <p className="text-xs text-gray-400">{selectedDropOff.guest_phone}</p>
                )}
                {selectedDropOff.resident?.phone && (
                  <p className="text-xs text-gray-400">{selectedDropOff.resident.phone}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500">Date & Time</p>
                <p className="text-sm text-gray-900">
                  {new Date(selectedDropOff.created_at).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
                  {', '}
                  {new Date(selectedDropOff.created_at).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true })}
                </p>
              </div>
            </div>

            {/* Materials */}
            <div>
              <p className="text-xs text-gray-500 mb-2">Materials</p>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Material</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Weight</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(selectedDropOff.drop_off_items || []).map((item) => (
                      <tr key={item.id}>
                        <td className="px-3 py-2 text-gray-900">{item.material_name}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{parseFloat(item.quantity).toFixed(1)} {item.unit}</td>
                        <td className="px-3 py-2 text-right font-medium text-primary-600">
                          ₱{parseFloat(item.actual_value || item.estimated_value || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div className="bg-gray-50 rounded-lg p-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total Weight</span>
                <span className="font-medium text-gray-900">
                  {parseFloat(selectedDropOff.total_weight_kg || 0).toFixed(1)} kg
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Estimated Payout</span>
                <span className="font-medium text-gray-900">
                  ₱{parseFloat(selectedDropOff.estimated_value || 0).toFixed(2)}
                </span>
              </div>
              {selectedDropOff.actual_value && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Actual Payout</span>
                  <span className="font-bold text-primary-600">
                    ₱{parseFloat(selectedDropOff.actual_value).toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            {/* Notes */}
            {selectedDropOff.notes && (
              <div>
                <p className="text-xs text-gray-500">Notes</p>
                <p className="text-sm text-gray-700">{selectedDropOff.notes}</p>
              </div>
            )}

            {/* Actions */}
            {selectedDropOff.status === 'scheduled' && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                <Button
                  onClick={() => handleComplete(selectedDropOff.id)}
                  disabled={actionLoading}
                >
                  <CheckCircle2 className="w-4 h-4" /> Mark Complete
                </Button>
                <Button
                  variant="danger"
                  onClick={() => handleCancel(selectedDropOff.id)}
                  disabled={actionLoading}
                >
                  <XCircle className="w-4 h-4" /> Cancel
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* New Drop-off Modal */}
      {showNewModal && (
        <NewDropOffModal
          open={showNewModal}
          onClose={() => setShowNewModal(false)}
          onCreated={() => {
            setShowNewModal(false);
            fetchDropOffs(1);
          }}
        />
      )}
    </div>
  );
}
