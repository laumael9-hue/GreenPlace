import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, MessageCircle, ArrowRight, Loader2 } from 'lucide-react';
import api from '../lib/api';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

const CATEGORY_ICONS = {
  'message-circle': MessageCircle,
  'trash-2': () => <span className="text-lg">🗑</span>,
  'recycle': () => <span className="text-lg">♻</span>,
  'seedling': () => <span className="text-lg">🌱</span>,
  'calendar': () => <span className="text-lg">📅</span>,
  'building': () => <span className="text-lg">🏢</span>,
  'help-circle': () => <span className="text-lg">❓</span>,
  'coffee': () => <span className="text-lg">☕</span>,
};

function CategoryIcon({ icon, color }) {
  const IconComp = CATEGORY_ICONS[icon] || MessageCircle;
  if (typeof IconComp === 'function' && IconComp.displayName === undefined && IconComp.toString().includes('text-lg')) {
    return <IconComp />;
  }
  return <IconComp className="w-6 h-6" style={{ color: color || '#10B981' }} />;
}

export default function Forum() {
  const [categories, setCategories] = useState([]);
  const [recentThreads, setRecentThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    try {
      const [catRes, threadRes] = await Promise.all([
        api.get('/forum/categories'),
        api.get('/forum/threads?limit=10&sort=newest'),
      ]);
      setCategories(catRes.data.categories || []);
      setRecentThreads(threadRes.data.threads || []);
    } catch (err) {
      console.error('Error fetching forum data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

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
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Community Forum</h1>
        <p className="mt-2 text-gray-600">Join sustainability discussions with the Metro Cebu community.</p>
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
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
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
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                        <span>{thread.author?.first_name} {thread.author?.last_name}</span>
                        <span>{thread.reply_count || 0} replies</span>
                        <span>{thread.view_count || 0} views</span>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
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
