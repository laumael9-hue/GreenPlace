import { Link, useLocation } from 'react-router-dom';
import { Leaf } from 'lucide-react';
import { useEffect, useRef } from 'react';
import NavItem from './NavItem';
import { useAuth } from '../../context/AuthContext';
import { useMessages } from '../../context/MessagesContext';
import { useNotifications } from '../../context/NotificationsContext';
import { getNavGroups } from './navConfig';

export default function MobileMenu({ open, onClose }) {
  const { isAuthenticated, profile } = useAuth();
  const { unreadCount } = useMessages();
  const { unreadCount: notifCount } = useNotifications();
  const location = useLocation();
  const groups = getNavGroups(profile?.role, unreadCount, notifCount);
  const prevPath = useRef(location.pathname);

  useEffect(() => {
    if (!isAuthenticated && prevPath.current !== location.pathname && open) {
      onClose();
    }
    prevPath.current = location.pathname;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="fixed inset-y-0 left-0 w-72 bg-white shadow-xl overflow-y-auto">
        <div className="flex items-center justify-between px-6 h-16 border-b border-gray-100">
          <Link to="/" onClick={onClose} className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-primary-600 rounded-lg flex items-center justify-center">
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">GreenPlace</span>
          </Link>
        </div>
        <nav className="px-3 py-4 space-y-4">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{group.label}</p>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <div key={item.to}>
                    <NavItem {...item} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </div>
    </div>
  );
}
