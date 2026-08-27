import { Link } from 'react-router-dom';
import { Leaf } from 'lucide-react';
import {
  LayoutDashboard, MapPin, ShoppingBag, ClipboardList,
  Package, MessageCircle, User, Building2, List,
  Clock, Star, BarChart3, Users, FileText, Settings
} from 'lucide-react';
import NavItem from './NavItem';
import { useAuth } from '../../context/AuthContext';

const residentNav = [
  { to: '/dashboard', icon: <LayoutDashboard className="w-5 h-5" />, label: 'Dashboard' },
  { to: '/establishments', icon: <MapPin className="w-5 h-5" />, label: 'Find Establishments' },
  { to: '/marketplace', icon: <ShoppingBag className="w-5 h-5" />, label: 'Marketplace' },
  { to: '/orders', icon: <ClipboardList className="w-5 h-5" />, label: 'My Orders' },
  { to: '/drop-offs', icon: <Package className="w-5 h-5" />, label: 'Drop-offs' },
  { to: '/forum', icon: <MessageCircle className="w-5 h-5" />, label: 'Forum' },
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
  { to: '/dashboard/messages', icon: <MessageCircle className="w-5 h-5" />, label: 'Messages' },
  { to: '/dashboard/analytics', icon: <BarChart3 className="w-5 h-5" />, label: 'Analytics' },
];

const adminNav = [
  { to: '/admin', icon: <LayoutDashboard className="w-5 h-5" />, label: 'Dashboard' },
  { to: '/admin/users', icon: <Users className="w-5 h-5" />, label: 'Users' },
  { to: '/admin/businesses', icon: <Building2 className="w-5 h-5" />, label: 'Businesses' },
  { to: '/admin/listings', icon: <List className="w-5 h-5" />, label: 'Listings' },
  { to: '/admin/forum', icon: <MessageCircle className="w-5 h-5" />, label: 'Forum' },
  { to: '/admin/reports', icon: <FileText className="w-5 h-5" />, label: 'Reports' },
  { to: '/admin/settings', icon: <Settings className="w-5 h-5" />, label: 'Settings' },
];

const navMap = { resident: residentNav, business: businessNav, admin: adminNav };

export default function MobileMenu({ open, onClose }) {
  const { profile } = useAuth();
  const items = navMap[profile?.role] || navMap.resident;

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
        <nav className="px-3 py-4 space-y-1">
          {items.map(item => (
            <div key={item.to} onClick={onClose}>
              <NavItem {...item} />
            </div>
          ))}
        </nav>
      </div>
    </div>
  );
}
