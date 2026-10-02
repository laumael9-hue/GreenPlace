import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, Package, Flag, Eye, ChevronLeft, ChevronRight, Archive, RotateCcw, Loader2, AlertTriangle, Download } from 'lucide-react';
import api from '../../lib/api';
import { exportToCsv, csvFilename } from '../../lib/exportCsv';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import Modal from '../../components/ui/Modal';

const statusConfig = {
  draft: { variant: 'neutral', label: 'Draft' },
  active: { variant: 'success', label: 'Active' },
  sold: { variant: 'info', label: 'Sold' },
  archived: { variant: 'warning', label: 'Archived' },
};

export default function ListingModeration() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [actionLoading, setActionLoading] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [archiveReason, setArchiveReason] = useState('');
  const [error, setError] = useState('');

  const fetchListings = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter }),
        ...(flaggedOnly && { flagged: 'true' }),
      });
      const { data } = await api.get(`/marketplace/admin/listings?${params}`);
      setListings(data.listings || []);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Failed to fetch listings:', err);
      setError(err.response?.data?.error || 'Failed to load listings.');
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, flaggedOnly]);

  useEffect(() => {
    fetchListings(1);
  }, [fetchListings]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchListings(1);
  };

  const handleStatusChange = async (id, status, reason = '') => {
    setActionLoading(id);
    setError('');
    try {
      await api.patch(`/marketplace/admin/listings/${id}/status`, { status, reason: reason || undefined });
      setArchiveTarget(null);
      setArchiveReason('');
      fetchListings(pagination.page);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update listing status.');
    } finally {
      setActionLoading(null);
    }
  };

  const openArchiveModal = (listing) => {
    setArchiveReason('');
    setArchiveTarget(listing);
  };

  const handleExport = async () => {
    setError('');
    try {
      const params = new URLSearchParams({
        page: '1', limit: '500',
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter }),
        ...(flaggedOnly && { flagged: 'true' }),
      });
      const { data } = await api.get(`/marketplace/admin/listings?${params}`);
      const rows = (data.listings || []).map((l) => [
        l.title,
        sellerName(l),
        l.category?.name || '',
        l.price,
        l.status,
        l.report_count || 0,
        l.city || '',
        l.created_at ? new Date(l.created_at).toLocaleDateString() : '',
      ]);
      exportToCsv(
        csvFilename('greenplace-listings'),
        ['Title', 'Seller', 'Category', 'Price', 'Status', 'Reports', 'City', 'Created'],
        rows
      );
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to export listings.');
    }
  };

  const sellerName = (l) => {
    if (l.business?.name) return l.business.name;
    if (l.seller) return `${l.seller.first_name} ${l.seller.last_name}`;
    return '—';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Marketplace Moderation</h1>
          <p className="text-gray-500 mt-1">Review, archive, and restore marketplace listings.</p>
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

      <Card padding={false}>
        <div className="p-4 border-b border-gray-100">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by title or description..."
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
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="sold">Sold</option>
              <option value="archived">Archived</option>
            </select>
            <button
              type="button"
              onClick={() => setFlaggedOnly(prev => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                flaggedOnly
                  ? 'bg-red-100 text-red-700 border border-red-200'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-red-300'
              }`}
            >
              <Flag className="w-4 h-4" />
              Reported Only
            </button>
            <Button type="submit" size="sm">Search</Button>
          </form>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading listings...</div>
        ) : listings.length === 0 ? (
          <EmptyState
            icon={<Package className="w-8 h-8" />}
            title="No listings found"
            description="No listings match your search criteria."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Listing</th>
                  <th className="px-4 py-3">Seller</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Reports</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {listings.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {l.primary_image ? (
                          <img src={l.primary_image} alt="" className="w-8 h-8 rounded-lg object-cover" />
                        ) : (
                          <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                            <Package className="w-4 h-4 text-primary-600" />
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-gray-900 line-clamp-1">{l.title}</p>
                          <p className="text-xs text-gray-500">{l.category?.name || 'Uncategorized'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{sellerName(l)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-primary-600">
                      ₱{parseFloat(l.price).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusConfig[l.status]?.variant || 'neutral'}>
                        {statusConfig[l.status]?.label || l.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {l.report_count > 0 ? (
                        <Badge variant="danger">
                          <Flag className="w-3 h-3 mr-1" />
                          {l.report_count}
                        </Badge>
                      ) : (
                        <span className="text-sm text-gray-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          to={`/marketplace/${l.slug}`}
                          className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          title="View listing"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        {l.status === 'archived' ? (
                          <button
                            onClick={() => handleStatusChange(l.id, 'active')}
                            disabled={actionLoading === l.id}
                            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Restore listing"
                          >
                            {actionLoading === l.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <RotateCcw className="w-4 h-4" />
                            )}
                          </button>
                        ) : (
                          <button
                            onClick={() => openArchiveModal(l)}
                            disabled={actionLoading === l.id}
                            className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Archive listing"
                          >
                            {actionLoading === l.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Archive className="w-4 h-4" />
                            )}
                          </button>
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
                onClick={() => fetchListings(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="p-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-40 rounded-lg"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm text-gray-700">
                Page {pagination.page} of {pagination.pages}
              </span>
              <button
                onClick={() => fetchListings(pagination.page + 1)}
                disabled={pagination.page >= pagination.pages}
                className="p-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-40 rounded-lg"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </Card>

      <p className="text-xs text-gray-400 flex items-center gap-1">
        <AlertTriangle className="w-3.5 h-3.5" />
        Archived listings are hidden from the marketplace and can be restored at any time.
      </p>

      {/* Archive Modal */}
      <Modal open={!!archiveTarget} onClose={() => setArchiveTarget(null)} title="Archive Listing" maxWidth="max-w-sm">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
              <Archive className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">Archive Listing</h3>
              <p className="text-sm text-gray-500 line-clamp-1">{archiveTarget?.title}</p>
            </div>
          </div>
          <p className="text-sm text-gray-600">
            The listing will be hidden from the marketplace. You can restore it at any time.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
            <textarea
              rows={3}
              value={archiveReason}
              onChange={(e) => setArchiveReason(e.target.value)}
              placeholder="e.g., Reported for misleading content..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setArchiveTarget(null)}>Cancel</Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleStatusChange(archiveTarget.id, 'archived', archiveReason)}
              disabled={actionLoading === archiveTarget?.id}
            >
              {actionLoading === archiveTarget?.id ? 'Archiving...' : 'Archive'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
