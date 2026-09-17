import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, MessageCircle, ArrowRight, Loader2, TrendingUp, Clock, Bookmark } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Avatar from '../components/ui/Avatar';

const SORT_TABS = [
  { value: 'newest', label: 'New', icon: Clock },
  { value: 'trending', label: 'Trending', icon: TrendingUp },
];

const CATEGORY_ICONS = {
  'message-circle': MessageCircle,
  'trash-2': () => <span className="text-lg">\uD83D\uDDD1</span>,
  'recycle': () => <span className="text-lg">\u267B</span>,
  'seedling': () => <span className="text-lg">\uD83C\uDF31</span>,
  'calendar': () => <span className="text-lg">\uD83D\uDCC5</span>,
  'building': () => <span className="text-lg">\uD83C\uDFE2</span>,
  'help-circle': () => <span className="text-lg">\u2753</span>,
  'coffee': () => <span className="text-lg">\u2615</span>,
};

function CategoryIcon({ icon, color }) {
  const IconComp = CATEGORY_ICONS[icon] || MessageCircle;
  if (typeof IconComp === 'function' && IconComp.toString().includes('text-lg')) {
    return <IconComp />;
  }
  return <IconComp className="w-6 h-6" style={{ color: color || '#10B981' }} />;
}

function getReactionSummary(reactionCounts) {
  if (!reactionCounts || typeof reactionCounts !== 'object') return 0;
  return Object.values(reactionCounts).reduce((sum, c) => sum + c, 0);
}

export default function Forum() {
  const { isAuthenticated } = useAuth();
  const [categories, setCategories] = useState([]);
  const [recentThreads, setRecentThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    try {
      const [catRes, threadRes] = await Promise.all([
        api.get('/forum/categories'),
        api.get('/forum/threads', { params: { limit: 10, sort: sortBy } }),
      ]);
      setCategories(catRes.data.categories || []);
      setRecentThreads(threadRes.data.threads || []);
    } catch (err) {
      console.error('Error fetching forum data:', err);
    } finally {
      setLoading(false);
    }
  }, [sortBy]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/forum/search?q=${encodeURIComponent(search.trim())}`);
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
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Community Forum</h1>
          <p className="mt-2 text-gray-600">Join sustainability discussions with the Metro Cebu community.</p>
        </div>
        {isAuthenticated ? (
          <Link to="/bookmarks">
            <Button variant="outline" size="sm">
              <Bookmark className="w-4 h-4 mr-2" />My Bookmarks
            </Button>
          </Link>
        ) : (
          <Link to="/login">
            <Button variant="outline" size="sm">Log in</Button>
          </Link>
        )}
      </div>

      <form onSubmit={handleSearch} className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search threads and posts..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <Button type="submit">Search</Button>
      </form>

      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Categories</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {categories.map((cat) => (
            <Link key={cat.id} to={`/forum/${cat.slug}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <div className="flex items-start gap-3">
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: (cat.color || '#10B981') + '20' }}
                  >
                    <CategoryIcon icon={cat.icon} color={cat.color} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{cat.name}</h3>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{cat.description}</p>
                    <p className="text-xs text-gray-400 mt-2">{cat.thread_count || 0} threads</p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Recent Activity</h2>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {SORT_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setSortBy(tab.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  sortBy === tab.value
                    ? 'bg-white text-primary-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        {recentThreads.length === 0 ? (
          <Card>
            <p className="text-center text-gray-500 py-8">No threads yet. Be the first to start a discussion!</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {recentThreads.map((thread) => (
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
                      </div>
                      <h3 className="font-medium text-gray-900 mt-1 truncate">{thread.title}</h3>
                      <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                        <span>{thread.author?.first_name} {thread.author?.last_name}</span>
                        <span>{thread.reply_count || 0} replies</span>
                        <span>{thread.view_count || 0} views</span>
                        {getReactionSummary(thread.reaction_counts) > 0 && (
                          <span>{getReactionSummary(thread.reaction_counts)} reactions</span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-2" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
