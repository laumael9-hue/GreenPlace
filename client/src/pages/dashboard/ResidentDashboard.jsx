import { Link } from 'react-router-dom';
import { MapPin, ShoppingBag, ClipboardList, Package, Leaf, ArrowRight } from 'lucide-react';
import StatCard from '../../components/ui/StatCard';
import Card, { CardHeader, CardTitle } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';

const quickActions = [
  { to: '/establishments', icon: <MapPin className="w-5 h-5" />, label: 'Find Establishments', color: 'bg-blue-100 text-blue-600' },
  { to: '/marketplace', icon: <ShoppingBag className="w-5 h-5" />, label: 'Marketplace', color: 'bg-purple-100 text-purple-600' },
  { to: '/drop-offs/new', icon: <Package className="w-5 h-5" />, label: 'Schedule Drop-off', color: 'bg-amber-100 text-amber-600' },
  { to: '/forum', icon: <Leaf className="w-5 h-5" />, label: 'Community Forum', color: 'bg-green-100 text-green-600' },
];

const recentOrders = [
  { id: '1', title: 'Recycled Plastic Bottles', status: 'completed', date: 'Aug 25, 2026', total: '₱250.00' },
  { id: '2', title: 'Glass Jar Set', status: 'processing', date: 'Aug 26, 2026', total: '₱180.00' },
];

const statusVariant = { completed: 'success', processing: 'info', pending: 'warning', cancelled: 'danger' };

export default function ResidentDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome back!</h1>
        <p className="text-gray-500 mt-1">Here's an overview of your activity on GreenPlace.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<ClipboardList className="w-6 h-6" />} label="Total Orders" value="0" change="No orders yet" changeType="neutral" />
        <StatCard icon={<Package className="w-6 h-6" />} label="Drop-offs" value="0" change="No drop-offs yet" changeType="neutral" />
        <StatCard icon={<Leaf className="w-6 h-6" />} label="CO₂ Saved" value="0 kg" change="Start recycling!" changeType="neutral" />
        <StatCard icon={<ShoppingBag className="w-6 h-6" />} label="Cart Items" value="0" change="Browse marketplace" changeType="neutral" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {quickActions.map(action => (
          <Link
            key={action.to}
            to={action.to}
            className="flex flex-col items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-primary-200 hover:shadow-md transition-all text-center group"
          >
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${action.color}`}>
              {action.icon}
            </div>
            <span className="text-sm font-medium text-gray-700 group-hover:text-primary-600 transition-colors">{action.label}</span>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Orders</CardTitle>
              <Link to="/orders" className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
                View all <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </CardHeader>
          {recentOrders.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No orders yet. Start by browsing the marketplace.</p>
          ) : (
            <div className="space-y-3">
              {recentOrders.map(order => (
                <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{order.title}</p>
                    <p className="text-xs text-gray-500">{order.date}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant={statusVariant[order.status]}>{order.status}</Badge>
                    <p className="text-sm font-semibold text-gray-900 mt-1">{order.total}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Drop-offs</CardTitle>
              <Link to="/drop-offs" className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
                View all <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </CardHeader>
          <p className="text-sm text-gray-500 text-center py-8">No drop-offs yet. Schedule your first recycling drop-off.</p>
        </Card>
      </div>
    </div>
  );
}
