import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  MessageCircle, Flag, Eye, Pin, Lock, Unlock, Loader2, ChevronLeft, ChevronRight,
} from 'lucide-react';
import api from '../../lib/api';
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

export default function ForumModeration() {
  const [activeTab, setActiveTab] = useState('reports');
  const [reports, setReports] = useState([]);
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reportPagination, setReportPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [threadPagination, setThreadPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [reportFilter, setReportFilter] = useState('');
  const [threadSearch, setThreadSearch] = useState('');
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [resolveStatus, setResolveStatus] = useState('resolved');
  const [resolveNote, setResolveNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchReports = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(reportFilter && { status: reportFilter }),
      });
      const { data } = await api.get(`/forum/admin/reports?${params}`);
      setReports(data.reports || []);
      setReportPagination(data.pagination);
    } catch (err) {
      console.error('Failed to fetch reports:', err);
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [reportFilter]);

  const fetchThreads = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(threadSearch && { search: threadSearch }),
      });
      const { data } = await api.get(`/forum/threads?${params}`);
      setThreads(data.threads || []);
      setThreadPagination(data.pagination);
    } catch (err) {
      console.error('Failed to fetch threads:', err);
      setThreads([]);
    } finally {
      setLoading(false);
    }
  }, [threadSearch]);

  useEffect(() => {
    if (activeTab === 'reports') fetchReports(1);
    else fetchThreads(1);
  }, [activeTab, fetchReports, fetchThreads]);

  const handleResolve = async (e) => {
    e.preventDefault();
    if (!selectedReport) return;
    setActionLoading(true);
    try {
      await api.put(`/forum/admin/reports/${selectedReport.id}`, {
        status: resolveStatus,
        resolutionNote: resolveNote.trim() || undefined,
      });
      setShowResolveModal(false);
      setSelectedReport(null);
      setResolveNote('');
      fetchReports(reportPagination.page);
    } catch (err) {
      console.error('Failed to resolve report:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleModerateThread = async (threadId, action) => {
    setActionLoading(true);
    try {
      if (action === 'pin') {
        const thread = threads.find(t => t.id === threadId);
        await api.put(`/forum/threads/${threadId}/moderate`, { isPinned: !thread?.is_pinned });
      } else if (action === 'lock') {
        const thread = threads.find(t => t.id === threadId);
        await api.put(`/forum/threads/${threadId}/moderate`, { isLocked: !thread?.is_locked });
      }
      fetchThreads(threadPagination.page);
    } catch (err) {
      console.error('Failed to moderate thread:', err);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Forum Moderation</h1>
        <p className="text-gray-600 mt-1">Manage reports and moderate forum content.</p>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'reports'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Flag className="w-4 h-4 inline mr-1.5" />
          Reports ({reportPagination.total || 0})
        </button>
        <button
          onClick={() => setActiveTab('threads')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'threads'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <MessageCircle className="w-4 h-4 inline mr-1.5" />
          Threads
        </button>
      </div>

      {activeTab === 'reports' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            {['', 'pending', 'reviewed', 'resolved', 'dismissed'].map((status) => (
              <button
                key={status}
                onClick={() => setReportFilter(status)}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                  reportFilter === status
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {status || 'All'}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
            </div>
          ) : reports.length === 0 ? (
            <EmptyState
              icon={<Flag className="w-12 h-12" />}
              title="No reports"
              description="No reports match the current filter."
            />
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <Card key={report.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={reportStatusConfig[report.status]?.variant || 'neutral'}>
                          {reportStatusConfig[report.status]?.label || report.status}
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
                      {report.target && (
                        <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                          <p className="text-xs text-gray-400 mb-1">
                            Reported post in: {report.target.thread?.title}
                          </p>
                          <p className="text-sm text-gray-700 line-clamp-2">{report.target.body}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            by {report.target.author?.first_name} {report.target.author?.last_name}
                          </p>
                        </div>
                      )}
                      {report.resolution_note && (
                        <div className="mt-2 p-3 bg-green-50 rounded-lg">
                          <p className="text-xs text-green-600 font-medium">Resolution:</p>
                          <p className="text-sm text-green-700">{report.resolution_note}</p>
                        </div>
                      )}
                    </div>
                    {report.status === 'pending' && (
                      <Button
                        size="sm"
                        onClick={() => { setSelectedReport(report); setShowResolveModal(true); }}
                      >
                        Review
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}

          {reportPagination.pages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={reportPagination.page <= 1}
                onClick={() => fetchReports(reportPagination.page - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-gray-600">
                Page {reportPagination.page} of {reportPagination.pages}
              </span>
              <Button variant="outline" size="sm" disabled={reportPagination.page >= reportPagination.pages}
                onClick={() => fetchReports(reportPagination.page + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'threads' && (
        <div className="space-y-4">
          <input
            type="text"
            value={threadSearch}
            onChange={(e) => setThreadSearch(e.target.value)}
            placeholder="Search threads..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          />

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
            </div>
          ) : threads.length === 0 ? (
            <EmptyState
              icon={<MessageCircle className="w-12 h-12" />}
              title="No threads found"
              description="No threads match your search."
            />
          ) : (
            <div className="space-y-3">
              {threads.map((thread) => (
                <Card key={thread.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {thread.is_pinned && (
                          <Badge variant="info">Pinned</Badge>
                        )}
                        {thread.is_locked && (
                          <Badge variant="warning">Locked</Badge>
                        )}

                      </div>
                      <Link to={`/forum/thread/${thread.slug}`} className="font-medium text-gray-900 hover:text-primary-600 mt-1 block">
                        {thread.title}
                      </Link>
                      <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                        <span>by {thread.author?.first_name} {thread.author?.last_name}</span>
                        <span>{thread.reply_count || 0} replies</span>
                        <span>{thread.view_count || 0} views</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleModerateThread(thread.id, 'pin')}
                        disabled={actionLoading}
                        className={`p-1.5 rounded-lg transition-colors ${
                          thread.is_pinned
                            ? 'bg-primary-100 text-primary-700'
                            : 'text-gray-400 hover:bg-gray-100'
                        }`}
                        title={thread.is_pinned ? 'Unpin' : 'Pin'}
                      >
                        <Pin className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleModerateThread(thread.id, 'lock')}
                        disabled={actionLoading}
                        className={`p-1.5 rounded-lg transition-colors ${
                          thread.is_locked
                            ? 'bg-orange-100 text-orange-700'
                            : 'text-gray-400 hover:bg-gray-100'
                        }`}
                        title={thread.is_locked ? 'Unlock' : 'Lock'}
                      >
                        {thread.is_locked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                      </button>
                      <Link
                        to={`/forum/thread/${thread.slug}`}
                        className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
                        title="View"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {threadPagination.pages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={threadPagination.page <= 1}
                onClick={() => fetchThreads(threadPagination.page - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-gray-600">
                Page {threadPagination.page} of {threadPagination.pages}
              </span>
              <Button variant="outline" size="sm" disabled={threadPagination.page >= threadPagination.pages}
                onClick={() => fetchThreads(threadPagination.page + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      <Modal open={showResolveModal} onClose={() => setShowResolveModal(false)} title="Resolve Report">
        <form onSubmit={handleResolve} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
            <select
              value={resolveStatus}
              onChange={(e) => setResolveStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="reviewed">Mark as Reviewed</option>
              <option value="resolved">Resolve</option>
              <option value="dismissed">Dismiss</option>
            </select>
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
            <Button type="submit" disabled={actionLoading}>
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Submit
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
