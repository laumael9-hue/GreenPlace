import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Flag, Loader2, ChevronLeft, ChevronRight, Download, AlertTriangle,
  MessageCircle, Package, FileText,
} from 'lucide-react';
import api from '../../lib/api';
import { exportToCsv, csvFilename } from '../../lib/exportCsv';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';

const reportStatusConfig = {
  pending: { variant: 'warning', label: 'Pending' },
  reviewed: { variant: 'info', label: 'Reviewed' },
  resolved: { variant: 'success', label: 'Resolved' },
  dismissed: { variant: 'neutral', label: 'Dismissed' },
};

const targetConfig = {
  post: { label: 'Post', icon: <MessageCircle className="w-4 h-4" /> },
  thread: { label: 'Thread', icon: <MessageCircle className="w-4 h-4" /> },
  listing: { label: 'Listing', icon: <Package className="w-4 h-4" /> },
};

const contentActionOptions = {
  post: [
    { value: 'none', label: 'No content action' },
    { value: 'remove', label: 'Remove post (permanent)', danger: true },
  ],
  thread: [
    { value: 'none', label: 'No content action' },
    { value: 'lock', label: 'Lock thread (keep visible)' },
    { value: 'remove', label: 'Remove thread (permanent)', danger: true },
  ],
  listing: [
    { value: 'none', label: 'No content action' },
    { value: 'archive', label: 'Archive listing (hidden, restorable)' },
  ],
};

export default function Reports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    byStatus: { pending: 0, reviewed: 0, resolved: 0, dismissed: 0 },
    byTarget: {},
  });
  const [statusFilter, setStatusFilter] = useState('');
  const [targetFilter, setTargetFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [resolveStatus, setResolveStatus] = useState('resolved');
  const [resolveAction, setResolveAction] = useState('none');
  const [resolveNote, setResolveNote] = useState('');
  const [resolveError, setResolveError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchReports = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(statusFilter && { status: statusFilter }),
        ...(targetFilter && { target: targetFilter }),
      });
      const { data } = await api.get(`/forum/admin/reports?${params}`);
      setReports(data.reports || []);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Failed to fetch reports:', err);
      setError(err.response?.data?.error || 'Failed to load reports.');
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, targetFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await api.get('/forum/admin/reports/stats');
      setStats(data.stats);
    } catch (err) {
      console.error('Failed to fetch report stats:', err);
    }
  }, []);

  useEffect(() => {
    fetchReports(1);
    fetchStats();
  }, [fetchReports, fetchStats]);

  const handleResolve = async (e) => {
    e.preventDefault();
    if (!selectedReport) return;
    setActionLoading(true);
    setResolveError('');
    try {
      await api.put(`/forum/admin/reports/${selectedReport.id}`, {
        status: resolveStatus,
        contentAction: resolveStatus === 'resolved' ? resolveAction : 'none',
        resolutionNote: resolveNote.trim() || undefined,
      });
      setShowResolveModal(false);
      setSelectedReport(null);
      setResolveNote('');
      setResolveAction('none');
      fetchReports(pagination.page);
      fetchStats();
    } catch (err) {
      console.error('Failed to resolve report:', err);
      setResolveError(err?.response?.data?.error || 'Failed to resolve report. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const openResolve = (report) => {
    setSelectedReport(report);
    setResolveStatus('resolved');
    setResolveAction('none');
    setResolveNote('');
    setResolveError('');
    setShowResolveModal(true);
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        page: '1', limit: '500',
        ...(statusFilter && { status: statusFilter }),
        ...(targetFilter && { target: targetFilter }),
      });
      const { data } = await api.get(`/forum/admin/reports?${params}`);
      const rows = (data.reports || []).map((r) => [
        r.created_at ? new Date(r.created_at).toLocaleDateString() : '',
        r.status,
        r.target_type,
        r.reason,
        r.description || '',
        r.reporter ? `${r.reporter.first_name} ${r.reporter.last_name}` : '',
        r.target?.title || '',
        r.resolution_note || '',
        r.reviewed_at ? new Date(r.reviewed_at).toLocaleDateString() : '',
      ]);
      exportToCsv(
        csvFilename('greenplace-reports'),
        ['Date', 'Status', 'Target Type', 'Reason', 'Description', 'Reporter', 'Target Title', 'Resolution', 'Reviewed'],
        rows
      );
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to export reports.');
    }
  };

  const targetLink = (report) => {
    if (!report.target) return null;
    if (report.target_type === 'listing' && report.target.slug) {
      return `/marketplace/${report.target.slug}`;
    }
    if (report.target_type === 'thread' && report.target.slug) {
      return `/forum/thread/${report.target.slug}`;
    }
    if (report.target_type === 'post' && report.target.thread?.slug) {
      return `/forum/thread/${report.target.thread.slug}`;
    }
    return null;
  };

  const chips = [
    { value: '', label: 'All', count: stats.total },
    { value: 'pending', label: 'Pending', count: stats.byStatus?.pending || 0 },
    { value: 'reviewed', label: 'Reviewed', count: stats.byStatus?.reviewed || 0 },
    { value: 'resolved', label: 'Resolved', count: stats.byStatus?.resolved || 0 },
    { value: 'dismissed', label: 'Dismissed', count: stats.byStatus?.dismissed || 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-500 mt-1">Cross-content moderation: listings, threads, and posts.</p>
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
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
            <Flag className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-sm text-gray-500">Total Reports</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-4">
          <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.byStatus?.pending || 0}</p>
            <p className="text-sm text-gray-500">Pending</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-4">
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-green-600">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.byStatus?.resolved || 0}</p>
            <p className="text-sm text-gray-500">Resolved</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-4">
          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-600">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.byTarget?.listing || 0}</p>
            <p className="text-sm text-gray-500">Listing Reports</p>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex gap-2 flex-wrap">
          {chips.map((chip) => (
            <button
              key={chip.value}
              onClick={() => setStatusFilter(chip.value)}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                statusFilter === chip.value
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {chip.label} ({chip.count})
            </button>
          ))}
        </div>
        <select
          value={targetFilter}
          onChange={(e) => setTargetFilter(e.target.value)}
          className="sm:ml-auto px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All Content Types</option>
          <option value="listing">Listings</option>
          <option value="thread">Threads</option>
          <option value="post">Posts</option>
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : reports.length === 0 ? (
        <EmptyState
          icon={<Flag className="w-12 h-12" />}
          title="No reports"
          description="No reports match the current filters."
        />
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const link = targetLink(report);
            return (
              <Card key={report.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={reportStatusConfig[report.status]?.variant || 'neutral'}>
                        {reportStatusConfig[report.status]?.label || report.status}
                      </Badge>
                      <Badge variant="neutral">
                        <span className="inline-flex items-center gap-1">
                          {targetConfig[report.target_type]?.icon}
                          {targetConfig[report.target_type]?.label || report.target_type}
                        </span>
                      </Badge>
                      <span className="text-sm text-gray-500">
                        Reported by {report.reporter?.first_name} {report.reporter?.last_name}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(report.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-gray-900">Reason: {report.reason}</p>
                    {report.description && (
                      <p className="mt-1 text-sm text-gray-600">{report.description}</p>
                    )}
                    {report.target ? (
                      <div className="mt-1">
                        <p className="text-sm text-gray-700 line-clamp-2">
                          {report.target.title || report.target.thread?.title}
                          {report.target.status && (
                            <span className="ml-1.5 text-xs text-gray-400">({report.target.status})</span>
                          )}
                        </p>
                        <p className="text-sm text-gray-600 line-clamp-2">{report.target.body}</p>
                        <p className="text-xs text-gray-500">
                          by{' '}
                          {report.target.seller
                            ? `${report.target.seller.first_name} ${report.target.seller.last_name}`
                            : report.target.author
                              ? `${report.target.author.first_name} ${report.target.author.last_name}`
                              : 'Unknown'}
                        </p>
                        {link && (
                          <Link
                            to={link}
                            className="mt-1 inline-block text-xs text-primary-600 hover:text-primary-700 font-medium"
                          >
                            View content →
                          </Link>
                        )}
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-gray-400 italic">
                        Content no longer exists (previously removed).
                      </p>
                    )}
                    {report.resolution_note && (
                      <div className="mt-2 p-3 bg-green-50 rounded-lg">
                        <p className="text-xs text-green-600 font-medium">Resolution:</p>
                        <p className="text-sm text-green-700">{report.resolution_note}</p>
                      </div>
                    )}
                  </div>
                  {report.status === 'pending' && (
                    <Button size="sm" onClick={() => openResolve(report)}>Review</Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={pagination.page <= 1}
            onClick={() => fetchReports(pagination.page - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-gray-600">
            Page {pagination.page} of {pagination.pages}
          </span>
          <Button variant="outline" size="sm" disabled={pagination.page >= pagination.pages}
            onClick={() => fetchReports(pagination.page + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Resolve Modal */}
      <Modal open={showResolveModal} onClose={() => setShowResolveModal(false)} title="Resolve Report">
        <form onSubmit={handleResolve} className="space-y-4">
          {resolveError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {resolveError}
            </p>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
            <select
              value={resolveStatus}
              onChange={(e) => {
                setResolveStatus(e.target.value);
                if (e.target.value !== 'resolved') setResolveAction('none');
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="reviewed">Mark as Reviewed</option>
              <option value="resolved">Resolve</option>
              <option value="dismissed">Dismiss</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Content Action</label>
            <select
              value={resolveStatus === 'resolved' ? resolveAction : 'none'}
              onChange={(e) => setResolveAction(e.target.value)}
              disabled={resolveStatus !== 'resolved'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-400"
            >
              {(contentActionOptions[selectedReport?.target_type] || contentActionOptions.post).map((opt) => (
                <option key={opt.value} value={opt.value} className={opt.danger ? 'text-red-600' : ''}>
                  {opt.label}
                </option>
              ))}
            </select>
            {resolveStatus === 'resolved' && resolveAction === 'remove' && (
              <p className="mt-1.5 text-xs text-red-600">
                This permanently deletes the content. Other pending reports on it will be auto-resolved.
              </p>
            )}
            {resolveStatus === 'resolved' && resolveAction === 'archive' && (
              <p className="mt-1.5 text-xs text-orange-600">
                The listing will be hidden from the marketplace (restorable). Other pending reports on it will be auto-resolved.
              </p>
            )}
            {resolveStatus === 'resolved' && resolveAction === 'lock' && (
              <p className="mt-1.5 text-xs text-gray-500">
                The thread stays visible but no new replies can be posted.
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Resolution Note (optional)</label>
            <textarea
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="Add a note about this resolution..."
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setShowResolveModal(false)}>Cancel</Button>
            <Button
              type="submit"
              variant={resolveStatus === 'resolved' && resolveAction !== 'none' ? 'danger' : 'primary'}
              disabled={actionLoading}
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Submit
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
