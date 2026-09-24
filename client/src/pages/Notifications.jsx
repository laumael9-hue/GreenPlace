import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Trash2, CheckCheck, Loader2 } from 'lucide-react';
import api from '../lib/api';
import { useNotifications } from '../context/NotificationsContext';
import { getTypeMeta, timeAgo } from '../lib/notifications';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';

const PAGE_LIMIT = 20;

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const navigate = useNavigate();
  const { unreadCount, refreshUnread } = useNotifications();

  const fetchNotifications = useCallback(async (pageNum, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const params = { page: pageNum, limit: PAGE_LIMIT };
      if (filter === 'unread') params.unread = 'true';
      const { data } = await api.get('/notifications', { params });
      const rows = data.notifications || [];
      setNotifications((prev) => (append ? [...prev, ...rows] : rows));
      setPagination(data.pagination || null);
      setPage(pageNum);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchNotifications(1);
  }, [fetchNotifications]);

  const markRead = async (item) => {
    if (!item.is_read) {
      try {
        await api.patch(`/notifications/${item.id}/read`);
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
        );
        refreshUnread();
      } catch (err) {
        console.error('Failed to mark notification read:', err);
      }
    }
    if (item.data?.link) navigate(item.data.link);
  };

  const markAllRead = async () => {
    try {
      await api.post('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      refreshUnread();
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const removeNotification = async (e, id) => {
    e.stopPropagation();
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      refreshUnread();
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const hasMore = pagination && page < pagination.pages;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-gray-500 mt-1">{unreadCount} unread</p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            <CheckCheck className="w-4 h-4 mr-1.5" />
            Mark all as read
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2 mb-4">
        {[{ key: 'all', label: 'All' }, { key: 'unread', label: 'Unread' }].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${
              filter === tab.key
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Card padding={false}>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={<Bell className="w-7 h-7" />}
            title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            description="Updates about your orders, drop-offs, messages, and forum activity will appear here."
          />
        ) : (
          <div>
            {notifications.map((item) => {
              const meta = getTypeMeta(item.type);
              const Icon = meta.icon;
              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => markRead(item)}
                  onKeyDown={(e) => e.key === 'Enter' && markRead(item)}
                  className={`flex items-start gap-3 px-5 py-4 border-b border-gray-50 last:border-0 cursor-pointer transition-colors ${
                    item.is_read ? 'hover:bg-gray-50' : 'bg-primary-50/60 hover:bg-primary-50'
                  }`}
                >
                  <span className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${meta.classes}`}>
                    <Icon className="w-5 h-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm truncate ${item.is_read ? 'font-medium text-gray-900' : 'font-semibold text-gray-900'}`}>
                        {item.title}
                      </p>
                      {!item.is_read && (
                        <span className="shrink-0 w-2 h-2 rounded-full bg-primary-600" />
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5 break-words">{item.body}</p>
                    <p className="text-xs text-gray-400 mt-1">{timeAgo(item.created_at)}</p>
                  </div>
                  <button
                    type="button"
                    aria-label="Delete notification"
                    onClick={(e) => removeNotification(e, item.id)}
                    className="shrink-0 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}

            {hasMore && (
              <div className="px-5 py-4 text-center border-t border-gray-100">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={loadingMore}
                  onClick={() => fetchNotifications(page + 1, true)}
                >
                  {loadingMore ? 'Loading...' : 'Load more'}
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
