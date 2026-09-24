import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import { useAuth } from './AuthContext';

const NotificationsContext = createContext(null);
const POLL_INTERVAL = 5000;

export function NotificationsProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnread = useCallback(async () => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      return;
    }
    try {
      const { data } = await api.get('/notifications/unread-count');
      setUnreadCount(data.count || 0);
    } catch (err) {
      console.error('Failed to fetch notification count:', err);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchUnread();
    if (!isAuthenticated) return undefined;
    const timer = setInterval(fetchUnread, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [fetchUnread, isAuthenticated]);

  const value = {
    unreadCount,
    refreshUnread: fetchUnread,
  };

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
}

export default NotificationsContext;
