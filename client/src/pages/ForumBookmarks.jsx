import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, MessageCircle, Share2, Loader2 } from 'lucide-react';
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

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Saved Posts</h1>
        <p className="text-gray-500 mt-1">Posts you&apos;ve saved for later.</p>
      </div>

      {threads.length === 0 ? (
        <div className="text-center py-16">
          <Bookmark className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No saved posts yet.</p>
          <Link to="/forum" className="mt-4 inline-block">
            <Button variant="outline" size="sm">Browse Community</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {threads.map((thread) => (
            <Card key={thread.id} className="relative group">
              <button
                onClick={() => handleRemoveBookmark(thread.id)}
                className="absolute top-3 right-3 p-1.5 rounded-full text-yellow-500 hover:bg-yellow-50 transition-colors z-10"
                title="Remove bookmark"
              >
                <Bookmark className="w-5 h-5 fill-current" />
              </button>
              <Link to={`/forum/thread/${thread.slug}`} className="block">
                <div className="flex items-start gap-3 pr-8">
                  <Avatar
                    src={thread.author?.avatar_url}
                    name={`${thread.author?.first_name || ''} ${thread.author?.last_name || ''}`}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 text-sm">
                        {thread.author?.first_name} {thread.author?.last_name}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(thread.created_at).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric',
                        })}
                      </span>
                      <span className="text-xs text-yellow-600 bg-yellow-50 px-1.5 py-0.5 rounded-full">Saved</span>
                    </div>
                    <h3 className="font-medium text-gray-900 mt-1 text-base">{thread.title}</h3>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{thread.body}</p>
                    {thread.images && thread.images.length > 0 && (
                      <div className="mt-2 flex gap-1.5">
                        {thread.images.slice(0, 4).map((url, i) => (
                          <img
                            key={i}
                            src={url}
                            alt=""
                            className={`h-16 rounded-lg object-cover ${
                              thread.images.length === 1 ? 'w-28' : 'w-16'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <MessageCircle className="w-3.5 h-3.5" />
                        {thread.reply_count || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <Share2 className="w-3.5 h-3.5" />
                        Share
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
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
