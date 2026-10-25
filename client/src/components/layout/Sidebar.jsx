import { Link } from 'react-router-dom';
import { Leaf, Shield } from 'lucide-react';
import NavItem from './NavItem';
import { useMessages } from '../../context/MessagesContext';
import { useNotifications } from '../../context/NotificationsContext';
import { getNavGroups } from './navConfig';

export default function Sidebar({ role = 'resident' }) {
  const { unreadCount } = useMessages();
  const { unreadCount: notifCount } = useNotifications();
  const groups = getNavGroups(role, unreadCount, notifCount);

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-white border-r border-gray-200 min-h-screen">
      <div className="flex items-center gap-2.5 px-6 h-16 border-b border-gray-100">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-primary-600 rounded-lg flex items-center justify-center">
            <Leaf className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold text-gray-900">GreenPlace</span>
        </Link>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{group.label}</p>
            <div className="space-y-1">
              {group.items.map((item) => (
                <NavItem key={item.to} {...item} />
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="px-3 py-4 border-t border-gray-100">
        <NavItem to={role === 'admin' ? '/admin' : '/dashboard'} icon={<Shield className="w-5 h-5" />} label="Back to App" />
      </div>
    </aside>
  );
}
