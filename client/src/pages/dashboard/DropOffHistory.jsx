import { useState, useEffect, useCallback } from 'react';
import { Package, Loader2, ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import api from '../../lib/api';
import Badge from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';

const statusConfig = {
  scheduled: { variant: 'warning', label: 'Pending' },
  in_transit: { variant: 'info', label: 'In Transit' },
  received: { variant: 'info', label: 'Received' },
  processed: { variant: 'success', label: 'Completed' },
  cancelled: { variant: 'danger', label: 'Cancelled' },
};

export default function DropOffHistory() {
  const [dropOffs, setDropOffs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [selectedDropOff, setSelectedDropOff] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchDropOffs = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });
      if (filter) params.set('status', filter);

      const { data } = await api.get(`/drop-offs/my?${params}`);
      setDropOffs(data.dropOffs || []);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Failed to fetch drop-offs:', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchDropOffs(1); }, [fetchDropOffs]);

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

  const filterOptions = [
    { value: '', label: 'All' },
    { value: 'scheduled', label: 'Pending' },
    { value: 'processed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Drop-off History</h1>
        <p className="text-gray-500 mt-1">View your past recycling drop-offs</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
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

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
        </div>
      ) : dropOffs.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Package className="w-8 h-8" />}
            title="No drop-offs yet"
            description="When you sell materials at a facility, your drop-offs will appear here."
          />
        </Card>
      ) : (
        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Facility</th>
                  <th className="px-4 py-3">Materials</th>
                  <th className="px-4 py-3">Weight</th>
                  <th className="px-4 py-3">Payout</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Status</th>
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
                        <span className="text-sm font-mono font-medium text-gray-900">{dropOff.reference_number}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-sm text-gray-600">{dropOff.business?.name || '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-[160px] truncate">{materialNames}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{totalWeight.toFixed(1)} kg</td>
                      <td className="px-4 py-3 text-sm font-bold text-primary-600">
                        ₱{parseFloat(dropOff.actual_value || dropOff.estimated_value || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(dropOff.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

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
      )}

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
                <p className="text-xs text-gray-500">Facility</p>
                <p className="text-sm font-medium text-gray-900">{selectedDropOff.business?.name}</p>
                <p className="text-xs text-gray-400">{selectedDropOff.business?.address}</p>
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
                <span className="text-gray-500">Total Payout</span>
                <span className="font-bold text-primary-600">
                  ₱{parseFloat(selectedDropOff.actual_value || selectedDropOff.estimated_value || 0).toFixed(2)}
                </span>
              </div>
            </div>

            {selectedDropOff.notes && (
              <div>
                <p className="text-xs text-gray-500">Notes</p>
                <p className="text-sm text-gray-700">{selectedDropOff.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
