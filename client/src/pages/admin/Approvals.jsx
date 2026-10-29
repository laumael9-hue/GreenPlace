import { useState, useEffect, useCallback } from 'react';
import api from '../../lib/api';
import { exportToCsv, csvFilename } from '../../lib/exportCsv';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import BusinessApprovalReviewModal from '../../components/admin/BusinessApprovalReviewModal';
import {
  Search, Building2, ChevronLeft, ChevronRight,
  CheckCircle, XCircle, FileSearch, Clock,
  Download, AlertTriangle,
} from 'lucide-react';

export default function Approvals() {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0, suspended: 0 });
  const [reviewing, setReviewing] = useState(null);
  const [error, setError] = useState('');

  const fetchQueue = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(search && { search }),
      });
      const { data } = await api.get(`/admin/businesses/pending?${params}`);
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

  const handleChanged = () => {
    fetchQueue(pagination.page);
    fetchStats();
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({ page: '1', limit: '100', ...(search && { search }) });
      const { data } = await api.get(`/admin/businesses/pending?${params}`);
      const rows = (data.businesses || []).map((b) => [
        b.name,
        b.profiles ? `${b.profiles.first_name} ${b.profiles.last_name}` : '',
        b.profiles?.email || '',
        b.category,
        b.city,
        `${b.documents_approved}/${b.documents_submitted} approved`,
        b.submitted_for_review_at ? new Date(b.submitted_for_review_at).toLocaleDateString() : '',
      ]);
      exportToCsv(
        csvFilename('greenplace-pending-approvals'),
        ['Business', 'Owner', 'Email', 'Category', 'City', 'Documents', 'Submitted'],
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
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Business Approvals</h1>
          <p className="text-gray-500 mt-1">Businesses that submitted their documents and are waiting for review.</p>
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
          <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-semibold tracking-tight text-gray-900">{stats.pending}</p>
            <p className="text-sm text-gray-500">Pending</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-4">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-semibold tracking-tight text-gray-900">{stats.total}</p>
            <p className="text-sm text-gray-500">Total</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-4">
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-green-600">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-semibold tracking-tight text-gray-900">{stats.approved}</p>
            <p className="text-sm text-gray-500">Approved</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-4">
          <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center text-red-600">
            <XCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-semibold tracking-tight text-gray-900">{stats.rejected}</p>
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
                placeholder="Search pending businesses..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <Button type="submit" size="sm">Search</Button>
          </form>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading pending businesses...</div>
        ) : businesses.length === 0 ? (
          <EmptyState
            icon={<CheckCircle className="w-8 h-8" />}
            title="Approval queue is clear"
            description="No businesses are waiting for document review."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/70 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Business</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Documents</th>
                  <th className="px-4 py-3">Submitted</th>
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
                          <p className="text-xs text-gray-500">{biz.category}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <p>{getOwnerName(biz)}</p>
                      {biz.profiles?.email && <p className="text-xs text-gray-500">{biz.profiles.email}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={biz.documents_approved === 3 ? 'success' : 'warning'}>
                        {biz.documents_approved} of 3 approved
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {biz.submitted_for_review_at ? new Date(biz.submitted_for_review_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="outline" onClick={() => setReviewing(biz)}>
                        <FileSearch className="w-4 h-4" />
                        Review Documents
                      </Button>
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

      <BusinessApprovalReviewModal
        business={reviewing}
        onClose={() => setReviewing(null)}
        onChanged={handleChanged}
      />
    </div>
  );
}
