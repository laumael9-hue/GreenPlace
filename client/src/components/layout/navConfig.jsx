import {
  LayoutDashboard, MapPin, ShoppingBag, ClipboardList,
  Package, MessageCircle, User, Building2, List,
  Clock, Star, BarChart3, Users, FileText, Settings, Bookmark, Mail, Bell,
  CheckCircle, Home, LogIn, UserPlus
} from 'lucide-react';

// Shown to visitors who are not logged in (mobile menu only; desktop uses the Navbar).
export const publicNavGroups = [
  {
    label: 'Menu',
    items: [
      { to: '/establishments', icon: <MapPin className="w-5 h-5" />, label: 'Find Establishments' },
      { to: '/marketplace', icon: <ShoppingBag className="w-5 h-5" />, label: 'Marketplace' },
      { to: '/forum', icon: <MessageCircle className="w-5 h-5" />, label: 'Forum' },
      { to: '/login', icon: <LogIn className="w-5 h-5" />, label: 'Login' },
      { to: '/register', icon: <UserPlus className="w-5 h-5" />, label: 'Get Started' },
    ],
  },
];

const residentNav = [
  { to: '/dashboard', icon: <Home className="w-5 h-5" />, label: 'Home' },
  { to: '/establishments', icon: <MapPin className="w-5 h-5" />, label: 'Find Establishments' },
  { to: '/marketplace', icon: <ShoppingBag className="w-5 h-5" />, label: 'Marketplace' },
  { to: '/orders', icon: <ClipboardList className="w-5 h-5" />, label: 'My Orders' },
  { to: '/drop-offs', icon: <Package className="w-5 h-5" />, label: 'Drop-offs' },
  { to: '/dashboard/messages', icon: <Mail className="w-5 h-5" />, label: 'Messages' },
  { to: '/notifications', icon: <Bell className="w-5 h-5" />, label: 'Notifications' },
  { to: '/forum', icon: <MessageCircle className="w-5 h-5" />, label: 'Forum' },
  { to: '/bookmarks', icon: <Bookmark className="w-5 h-5" />, label: 'Saved Posts' },
  { to: '/dashboard/register-business', icon: <Building2 className="w-5 h-5" />, label: 'Become a Business' },
  { to: '/profile', icon: <User className="w-5 h-5" />, label: 'Profile' },
];

// Business accounts keep resident powers (layered model):
// business tools first, then the general resident section.
const businessNav = [
  {
    label: 'Business',
    items: [
      { to: '/dashboard', icon: <LayoutDashboard className="w-5 h-5" />, label: 'Dashboard' },
      { to: '/dashboard/profile', icon: <Building2 className="w-5 h-5" />, label: 'Business Profile' },
      { to: '/dashboard/listings', icon: <List className="w-5 h-5" />, label: 'Listings' },
      { to: '/dashboard/orders', icon: <ClipboardList className="w-5 h-5" />, label: 'Incoming Orders' },
      { to: '/dashboard/drop-offs', icon: <Clock className="w-5 h-5" />, label: 'Drop-offs' },
      { to: '/dashboard/reviews', icon: <Star className="w-5 h-5" />, label: 'Reviews' },
      { to: '/dashboard/analytics', icon: <BarChart3 className="w-5 h-5" />, label: 'Analytics' },
    ],
  },
  {
    label: 'General',
    items: [
      { to: '/establishments', icon: <MapPin className="w-5 h-5" />, label: 'Find Establishments' },
      { to: '/marketplace', icon: <ShoppingBag className="w-5 h-5" />, label: 'Marketplace' },
      { to: '/orders', icon: <ClipboardList className="w-5 h-5" />, label: 'My Orders' },
      { to: '/drop-offs', icon: <Package className="w-5 h-5" />, label: 'My Drop-offs' },
      { to: '/dashboard/messages', icon: <Mail className="w-5 h-5" />, label: 'Messages' },
      { to: '/notifications', icon: <Bell className="w-5 h-5" />, label: 'Notifications' },
      { to: '/forum', icon: <MessageCircle className="w-5 h-5" />, label: 'Forum' },
      { to: '/bookmarks', icon: <Bookmark className="w-5 h-5" />, label: 'Saved Posts' },
      { to: '/profile', icon: <User className="w-5 h-5" />, label: 'Profile' },
    ],
  },
];

const adminNav = [
  { to: '/admin', icon: <LayoutDashboard className="w-5 h-5" />, label: 'Dashboard' },
  { to: '/admin/approvals', icon: <CheckCircle className="w-5 h-5" />, label: 'Business Approvals' },
  { to: '/admin/users', icon: <Users className="w-5 h-5" />, label: 'Users' },
  { to: '/admin/businesses', icon: <Building2 className="w-5 h-5" />, label: 'Businesses' },
  { to: '/admin/listings', icon: <List className="w-5 h-5" />, label: 'Listings' },
  { to: '/admin/forum', icon: <MessageCircle className="w-5 h-5" />, label: 'Forum' },
  { to: '/bookmarks', icon: <Bookmark className="w-5 h-5" />, label: 'Saved Posts' },
  { to: '/admin/reports', icon: <FileText className="w-5 h-5" />, label: 'Reports' },
  { to: '/notifications', icon: <Bell className="w-5 h-5" />, label: 'Notifications' },
  { to: '/admin/settings', icon: <Settings className="w-5 h-5" />, label: 'Settings' },
];

const navMap = { resident: residentNav, business: businessNav, admin: adminNav };

const withBadges = (items, unreadCount, notifCount) =>
  items.map((item) => {
    if (item.to === '/dashboard/messages' && unreadCount > 0) {
      return { ...item, badge: unreadCount > 9 ? '9+' : unreadCount };
    }
    if (item.to === '/notifications' && notifCount > 0) {
      return { ...item, badge: notifCount > 9 ? '9+' : notifCount };
    }
    return item;
  });

// Role → nav groups. Resident/admin are flat arrays wrapped in one group;
// business is already grouped (Business + General).
export function getNavGroups(role, unreadCount = 0, notifCount = 0) {
  const nav = navMap[role] || navMap.resident;

  if (role === 'business') {
    return nav.map((group) => ({
      label: group.label,
      items: withBadges(group.items, unreadCount, notifCount),
    }));
  }

  const label = role === 'admin' ? 'Moderation' : 'Menu';
  return [{ label, items: withBadges(nav, unreadCount, notifCount) }];
}
