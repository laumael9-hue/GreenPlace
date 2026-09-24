import {
  ClipboardList, Mail, Package, MessageCircle, Building2, Bell, Star,
} from 'lucide-react';

export const TYPE_META = {
  order: { icon: ClipboardList, classes: 'bg-blue-50 text-blue-600' },
  message: { icon: Mail, classes: 'bg-primary-50 text-primary-600' },
  drop_off: { icon: Package, classes: 'bg-purple-50 text-purple-600' },
  forum: { icon: MessageCircle, classes: 'bg-green-50 text-green-600' },
  business: { icon: Building2, classes: 'bg-yellow-50 text-yellow-700' },
  review: { icon: Star, classes: 'bg-orange-50 text-orange-600' },
  system: { icon: Bell, classes: 'bg-gray-100 text-gray-600' },
};

export const getTypeMeta = (type) => TYPE_META[type] || TYPE_META.system;

export const timeAgo = (iso) => {
  if (!iso) return '';
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
};
