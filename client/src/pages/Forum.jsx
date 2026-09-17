import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Clock, TrendingUp, Bookmark, Plus, Loader2, MessageCircle, Share2 } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Avatar from '../components/ui/Avatar';
import Modal from '../components/ui/Modal';

const SORT_TABS = [
  { value: 'newest', label: 'New', icon: Clock },
  { value: 'trending', label: 'Trending', icon: TrendingUp },
  { value: 'popular', label: 'Top', icon: TrendingUp },
];

function getReactionSummary(reactionCounts) {
  if (!reactionCounts || typeof reactionCounts !== 'object') return 0;
  return Object.values(reactionCounts).reduce((sum, c) => sum + c, 0);
}

function PostCard({ thread }) {
  const totalReactions = getReactionSummary(thread.reaction_counts);

  return (
    <Link to={`/forum/thread/${thread.slug}`}>
      <Card className="hover:shadow-md transition-all cursor-pointer">
        <div className="flex items-start gap-3">
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
              {thread.is_pinned && (
                <span className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">Pinned</span>
              )}
            </div>
            <h3 className="font-medium text-gray-900 mt-1 text-base">{thread.title}</h3>
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{thread.body}</p>
            <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <MessageCircle className="w-3.5 h-3.5" />
                {thread.reply_count || 0}
              </span>
              {totalReactions > 0 && (
                <span className="flex items-center gap-1">
                  <span className="text-sm leading-none">+</span>
                  {totalReactions}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Share2 className="w-3.5 h-3.5" />
                Share
              </span>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

export default function Forum() {
  const { isAuthenticated } = useAuth();
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [showNewThread, setShowNewThread] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const navigate = useNavigate();

  const fetchThreads = useCallback(async () => {
    try {
      const { data } = await api.get('/forum/threads', { params: { page, limit: 20, sort: sortBy } });
      setThreads(data.threads || []);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Error fetching threads:', err);
    } finally {
      setLoading(false);
    }
  }, [sortBy, page]);

  useEffect(() => { fetchThreads(); }, [fetchThreads]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/forum/search?q=${encodeURIComponent(search.trim())}`);
    }
  };

  const handleCreateThread = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !newBody.trim()) return;
    setSubmitting(true);
    try {
      const { data } = await api.post('/forum/threads', {
        title: newTitle.trim(),
        body: newBody.trim(),
      });
      setNewTitle('');
      setNewBody('');
      setShowNewThread(false);
      navigate(`/forum/thread/${data.thread.slug}`);
    } catch (err) {
      console.error('Error creating thread:', err);
    } finally {
      setSubmitting(false);
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Community</h1>
        <div className="flex items-center gap-2">
          {isAuthenticated && (
            <Link to="/bookmarks">
              <Button variant="ghost" size="sm">
                <Bookmark className="w-4 h-4" />
              </Button>
            </Link>
          )}
          {isAuthenticated ? (
            <Button onClick={() => setShowNewThread(true)} size="sm">
              <Plus className="w-4 h-4 mr-1" />New Post
            </Button>
          ) : (
            <Link to="/login">
              <Button variant="outline" size="sm">Log in</Button>
            </Link>
          )}
        </div>
      </div>

      {/* Compose box */}
      {isAuthenticated && (
        <Card className="overflow-hidden">
          <div className="flex items-start gap-3 p-4">
            <Avatar
              src={null}
              name="You"
              size="md"
            />
            <button
              onClick={() => setShowNewThread(true)}
              className="flex-1 text-left px-4 py-2.5 bg-gray-100 rounded-full text-gray-400 hover:bg-gray-200 transition-colors text-sm"
            >
              What&apos;s on your mind?
            </button>
          </div>
        </Card>
      )}

      {/* Search */}
      <form onSubmit={handleSearch} className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search discussions..."
          className="w-full pl-10 pr-4 py-2.5 bg-gray-100 rounded-full text-sm focus:ring-2 focus:ring-primary-500 focus:bg-white border border-transparent focus:border-gray-300 transition-all"
        />
      </form>

      {/* Sort tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-full p-1">
        {SORT_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setSortBy(tab.value); setPage(1); }}
            className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full transition-colors ${
              sortBy === tab.value
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Feed */}
      {threads.length === 0 ? (
        <div className="text-center py-16">
          <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No posts yet. Start the conversation!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {threads.map((thread) => (
            <PostCard key={thread.id} thread={thread} />
          ))}
        </div>
      )}

      {/* Pagination */}
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

      {/* New Thread Modal */}
      <Modal open={showNewThread} onClose={() => setShowNewThread(false)} title="New Post">
        <form onSubmit={handleCreateThread} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="What's your post about?"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
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
              Post
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
