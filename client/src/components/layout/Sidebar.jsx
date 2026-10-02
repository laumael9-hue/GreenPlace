import { Link } from 'react-router-dom';
import { Leaf } from 'lucide-react';
import {
  LayoutDashboard, MapPin, ShoppingBag, ClipboardList,
  Package, MessageCircle, User, Building2, List,
  Clock, Star, BarChart3, Users, FileText, Settings, Shield, Bookmark, Mail, Bell,
  CheckCircle, FolderCheck
} from 'lucide-react';
import NavItem from './NavItem';
import { useMessages } from '../../context/MessagesContext';
import { useNotifications } from '../../context/NotificationsContext';

const residentNav = [
  { to: '/dashboard', icon: <LayoutDashboard className="w-5 h-5" />, label: 'Dashboard' },
  { to: '/establishments', icon: <MapPin className="w-5 h-5" />, label: 'Find Establishments' },
  { to: '/marketplace', icon: <ShoppingBag className="w-5 h-5" />, label: 'Marketplace' },
  { to: '/orders', icon: <ClipboardList className="w-5 h-5" />, label: 'My Orders' },
  { to: '/drop-offs', icon: <Package className="w-5 h-5" />, label: 'Drop-offs' },
  { to: '/dashboard/messages', icon: <Mail className="w-5 h-5" />, label: 'Messages' },
  { to: '/notifications', icon: <Bell className="w-5 h-5" />, label: 'Notifications' },
  { to: '/forum', icon: <MessageCircle className="w-5 h-5" />, label: 'Forum' },
  { to: '/bookmarks', icon: <Bookmark className="w-5 h-5" />, label: 'Saved Posts' },
  { to: '/profile', icon: <User className="w-5 h-5" />, label: 'Profile' },
];

const businessNav = [
  { to: '/dashboard', icon: <LayoutDashboard className="w-5 h-5" />, label: 'Dashboard' },
  { to: '/dashboard/profile', icon: <Building2 className="w-5 h-5" />, label: 'Business Profile' },
  { to: '/dashboard/listings', icon: <List className="w-5 h-5" />, label: 'Listings' },
  { to: '/dashboard/orders', icon: <ClipboardList className="w-5 h-5" />, label: 'Orders' },
  { to: '/dashboard/drop-offs', icon: <Clock className="w-5 h-5" />, label: 'Drop-offs' },
  { to: '/dashboard/reviews', icon: <Star className="w-5 h-5" />, label: 'Reviews' },
  { to: '/forum', icon: <MessageCircle className="w-5 h-5" />, label: 'Forum' },
  { to: '/bookmarks', icon: <Bookmark className="w-5 h-5" />, label: 'Saved Posts' },
  { to: '/dashboard/messages', icon: <Mail className="w-5 h-5" />, label: 'Messages' },
  { to: '/notifications', icon: <Bell className="w-5 h-5" />, label: 'Notifications' },
  { to: '/dashboard/analytics', icon: <BarChart3 className="w-5 h-5" />, label: 'Analytics' },
];

const adminNav = [
  { to: '/admin', icon: <LayoutDashboard className="w-5 h-5" />, label: 'Dashboard' },
  { to: '/admin/approvals', icon: <CheckCircle className="w-5 h-5" />, label: 'Approvals' },
  { to: '/admin/users', icon: <Users className="w-5 h-5" />, label: 'Users' },
  { to: '/admin/businesses', icon: <Building2 className="w-5 h-5" />, label: 'Businesses' },
  { to: '/admin/documents', icon: <FolderCheck className="w-5 h-5" />, label: 'Documents' },
  { to: '/admin/listings', icon: <List className="w-5 h-5" />, label: 'Listings' },
  { to: '/admin/forum', icon: <MessageCircle className="w-5 h-5" />, label: 'Forum' },
  { to: '/bookmarks', icon: <Bookmark className="w-5 h-5" />, label: 'Saved Posts' },
  { to: '/admin/reports', icon: <FileText className="w-5 h-5" />, label: 'Reports' },
  { to: '/notifications', icon: <Bell className="w-5 h-5" />, label: 'Notifications' },
  { to: '/admin/settings', icon: <Settings className="w-5 h-5" />, label: 'Settings' },
];

const navMap = { resident: residentNav, business: businessNav, admin: adminNav };

export default function Sidebar({ role = 'resident' }) {
  const { unreadCount } = useMessages();
  const { unreadCount: notifCount } = useNotifications();
  const baseItems = navMap[role] || navMap.resident;
  const items = baseItems.map(item => {
    if (item.to === '/dashboard/messages' && unreadCount > 0) {
      return { ...item, badge: unreadCount > 9 ? '9+' : unreadCount };
    }
    if (item.to === '/notifications' && notifCount > 0) {
      return { ...item, badge: notifCount > 9 ? '9+' : notifCount };
    }
    return item;
  });
  const sectionLabel = role === 'admin' ? 'Administration' : role === 'business' ? 'Business' : 'Menu';

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
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{sectionLabel}</p>
        {items.map(item => (
          <NavItem key={item.to} {...item} />
        ))}
      </nav>
      <div className="px-3 py-4 border-t border-gray-100">
        <NavItem to={role === 'admin' ? '/admin' : '/dashboard'} icon={<Shield className="w-5 h-5" />} label="Back to App" />
      </div>
    </aside>
  );
}
