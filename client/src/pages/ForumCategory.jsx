import { useState, useEffect, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MessageCircle, ArrowRight, Plus, Loader2, Clock, Eye, Filter, ChevronDown } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import Avatar from '../components/ui/Avatar';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'popular', label: 'Most Views' },
  { value: 'most_replies', label: 'Most Replies' },
  { value: 'trending', label: 'Trending' },
];

export default function ForumCategory() {
  const { slug } = useParams();
  const { isAuthenticated } = useAuth();
  const [category, setCategory] = useState(null);
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('newest');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [showNewThread, setShowNewThread] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchCategory = useCallback(async () => {
    try {
      const { data } = await api.get(`/forum/categories/${slug}`);
      setCategory(data.category);
    } catch (err) {
      console.error('Error fetching category:', err);
    }
  }, [slug]);

  const fetchThreads = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/forum/threads', {
        params: { category: slug, sort: sortBy, page, limit: 20 },
      });
      setThreads(data.threads || []);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Error fetching threads:', err);
    } finally {
      setLoading(false);
    }
  }, [slug, sortBy, page]);

  useEffect(() => { fetchCategory(); }, [fetchCategory]);
  useEffect(() => { fetchThreads(); }, [fetchThreads]);

  const handleCreateThread = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !newBody.trim()) return;
    setSubmitting(true);
    try {
      await api.post('/forum/threads', {
        title: newTitle.trim(),
        body: newBody.trim(),
        categoryId: category.id,
      });
      setNewTitle('');
      setNewBody('');
      setShowNewThread(false);
      setPage(1);
      fetchThreads();
    } catch (err) {
      console.error('Error creating thread:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (!category && !loading) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-semibold text-gray-900">Category not found</h2>
        <Link to="/forum" className="text-primary-600 hover:text-primary-500 mt-2 inline-block">Back to Forum</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/forum" className="hover:text-primary-600">Forum</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">{category?.name || 'Loading...'}</span>
      </div>

      {category && (
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{category.name}</h1>
            <p className="text-gray-600 mt-1">{category.description}</p>
          </div>
          {isAuthenticated ? (
            <Button onClick={() => setShowNewThread(true)}>
              <Plus className="w-4 h-4 mr-2" />New Thread
            </Button>
          ) : (
            <Link to="/login" state={{ from: { pathname: `/forum/${slug}` } }}>
              <Button variant="outline">
                <Plus className="w-4 h-4 mr-2" />Log in to Post
              </Button>
            </Link>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Filter className="w-4 h-4 text-gray-500" />
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
            className="appearance-none bg-white border border-gray-300 rounded-lg px-3 py-1.5 pr-8 text-sm focus:ring-2 focus:ring-primary-500"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : threads.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No threads in this category yet.</p>
            {isAuthenticated ? (
              <Button className="mt-4" onClick={() => setShowNewThread(true)}>
                <Plus className="w-4 h-4 mr-2" />Start a Discussion
              </Button>
            ) : (
              <Link to="/login" state={{ from: { pathname: `/forum/${slug}` } }}>
                <Button variant="outline" className="mt-4">
                  <Plus className="w-4 h-4 mr-2" />Log in to Post
                </Button>
              </Link>
            )}
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {threads.map((thread) => (
            <Link key={thread.id} to={`/forum/thread/${thread.slug}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-start gap-3">
                  <Avatar
                    src={thread.author?.avatar_url}
                    name={`${thread.author?.first_name || ''} ${thread.author?.last_name || ''}`}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {thread.is_pinned && (
                        <span className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-0.5 rounded">Pinned</span>
                      )}
                      {thread.is_locked && (
                        <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded">Locked</span>
                      )}
                    </div>
                    <h3 className="font-medium text-gray-900 mt-1">{thread.title}</h3>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-1">{thread.body}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                      <span>{thread.author?.first_name} {thread.author?.last_name}</span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="w-3 h-3" />{thread.reply_count || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />{thread.view_count || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(thread.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-2" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-gray-600">
            Page {page} of {pagination.pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pagination.pages}
            onClick={() => setPage(p => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

      <Modal open={showNewThread} onClose={() => setShowNewThread(false)} title="New Thread">
        <form onSubmit={handleCreateThread} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="What's your discussion about?"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
            <textarea
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Share your thoughts..."
              required
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setShowNewThread(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting || !newTitle.trim() || !newBody.trim()}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Create Thread
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
