import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, MessageCircle, Eye, Loader2 } from 'lucide-react';
import api from '../lib/api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Avatar from '../components/ui/Avatar';

export default function ForumBookmarks() {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  const fetchBookmarks = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/forum/bookmarks', { params: { page, limit: 20 } });
      setThreads(data.threads || []);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Error fetching bookmarks:', err);
      setThreads([]);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchBookmarks(); }, [fetchBookmarks]);

  const handleRemoveBookmark = async (threadId) => {
    try {
      await api.post(`/forum/threads/${threadId}/bookmark`);
      setThreads(prev => prev.filter(t => t.id !== threadId));
    } catch (err) {
      console.error('Error removing bookmark:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/forum" className="hover:text-primary-600">Forum</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">My Bookmarks</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Bookmarks</h1>
        <p className="text-gray-600 mt-1">Threads you've saved for later.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : threads.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <Bookmark className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No bookmarks yet.</p>
            <Link to="/forum">
              <Button variant="outline" className="mt-4">Browse Forum</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {threads.map((thread) => (
            <Card key={thread.id}>
              <div className="flex items-start gap-3">
                <Avatar
                  src={thread.author?.avatar_url}
                  name={`${thread.author?.first_name || ''} ${thread.author?.last_name || ''}`}
                  size="md"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {thread.category && (
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded"
                        style={{
                          backgroundColor: (thread.category.color || '#10B981') + '20',
                          color: thread.category.color || '#10B981',
                        }}
                      >
                        {thread.category.name}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">
                      Saved {new Date(thread.bookmarked_at).toLocaleDateString()}
                    </span>
                  </div>
                  <Link to={`/forum/thread/${thread.slug}`} className="font-medium text-gray-900 hover:text-primary-600 mt-1 block">
                    {thread.title}
                  </Link>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-1">{thread.body}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                    <span>{thread.author?.first_name} {thread.author?.last_name}</span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="w-3 h-3" />{thread.reply_count || 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />{thread.view_count || 0}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveBookmark(thread.id)}
                  className="p-2 rounded-lg text-yellow-500 hover:bg-yellow-50 transition-colors flex-shrink-0"
                  title="Remove bookmark"
                >
                  <Bookmark className="w-5 h-5 fill-current" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-gray-600">Page {page} of {pagination.pages}</span>
          <Button variant="outline" size="sm" disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
