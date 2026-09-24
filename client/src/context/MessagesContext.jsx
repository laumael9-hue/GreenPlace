import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import { useAuth } from './AuthContext';

const MessagesContext = createContext(null);
const POLL_INTERVAL = 5000;

export function MessagesProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnread = useCallback(async () => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      return;
    }
    try {
      const { data } = await api.get('/messages/unread-count');
      setUnreadCount(data.count || 0);
    } catch (err) {
      console.error('Failed to fetch unread count:', err);
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

  return <MessagesContext.Provider value={value}>{children}</MessagesContext.Provider>;
}

export function useMessages() {
  const context = useContext(MessagesContext);
  if (!context) {
    throw new Error('useMessages must be used within a MessagesProvider');
  }
  return context;
}

export default MessagesContext;
