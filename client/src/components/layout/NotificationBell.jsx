import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import api from '../../lib/api';
import { useNotifications } from '../../context/NotificationsContext';
import { getTypeMeta, timeAgo } from '../../lib/notifications';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);
  const navigate = useNavigate();
  const { unreadCount, refreshUnread } = useNotifications();

  const fetchRecent = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/notifications', { params: { limit: 8 } });
      setItems(data.notifications || []);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    fetchRecent();
    const handleMouseDown = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [open, fetchRecent]);

  const markAllRead = async () => {
    try {
      await api.post('/notifications/read-all');
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
      refreshUnread();
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const handleOpenItem = async (item) => {
    try {
      if (!item.is_read) {
        await api.patch(`/notifications/${item.id}/read`);
        setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)));
        refreshUnread();
      }
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
    setOpen(false);
    if (item.data?.link) navigate(item.data.link);
  };

  const hasUnread = items.some((n) => !n.is_read);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => setOpen((prev) => !prev)}
        className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-semibold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-900">Notifications</p>
            {hasUnread && (
              <button
                type="button"
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-8">
                <span className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">You&apos;re all caught up</p>
              </div>
            ) : (
              items.map((item) => {
                const meta = getTypeMeta(item.type);
                const Icon = meta.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleOpenItem(item)}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left border-b border-gray-50 last:border-0 transition-colors ${
                      item.is_read ? 'hover:bg-gray-50' : 'bg-primary-50 hover:bg-primary-100/60'
                    }`}
                  >
                    <span className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${meta.classes}`}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm truncate ${item.is_read ? 'font-medium text-gray-900' : 'font-semibold text-gray-900'}`}>
                        {item.title}
                      </span>
                      <span className="block text-xs text-gray-500 truncate">{item.body}</span>
                      <span className="block text-xs text-gray-400 mt-0.5">{timeAgo(item.created_at)}</span>
                    </span>
                    {!item.is_read && (
                      <span className="shrink-0 w-2 h-2 rounded-full bg-primary-600 mt-1.5" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          <div className="border-t border-gray-100">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate('/notifications');
              }}
              className="w-full px-4 py-2.5 text-center text-sm font-medium text-primary-600 hover:bg-gray-50 transition-colors"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
