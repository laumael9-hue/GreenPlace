import { Link } from 'react-router-dom';
import {
  Building2, List, ClipboardList, Clock, Star,
  BarChart3, ArrowRight
} from 'lucide-react';
import StatCard from '../../components/ui/StatCard';
import Card, { CardHeader, CardTitle } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';

const quickActions = [
  { to: '/dashboard/profile', icon: <Building2 className="w-5 h-5" />, label: 'Business Profile', color: 'bg-blue-100 text-blue-600' },
  { to: '/dashboard/listings', icon: <List className="w-5 h-5" />, label: 'Manage Listings', color: 'bg-purple-100 text-purple-600' },
  { to: '/dashboard/orders', icon: <ClipboardList className="w-5 h-5" />, label: 'View Orders', color: 'bg-amber-100 text-amber-600' },
  { to: '/dashboard/analytics', icon: <BarChart3 className="w-5 h-5" />, label: 'Analytics', color: 'bg-green-100 text-green-600' },
];

const pendingOrders = [];

export default function BusinessDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Business Dashboard</h1>
        <p className="text-gray-500 mt-1">Manage your business, listings, and orders.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<ClipboardList className="w-6 h-6" />} label="Pending Orders" value="0" change="No pending orders" changeType="neutral" />
        <StatCard icon={<List className="w-6 h-6" />} label="Active Listings" value="0" change="Create your first listing" changeType="neutral" />
        <StatCard icon={<Clock className="w-6 h-6" />} label="Drop-offs" value="0" change="No drop-offs scheduled" changeType="neutral" />
        <StatCard icon={<Star className="w-6 h-6" />} label="Avg Rating" value="0.0" change="No reviews yet" changeType="neutral" />
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
              <CardTitle>Pending Orders</CardTitle>
              <Link to="/dashboard/orders" className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
                View all <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </CardHeader>
          {pendingOrders.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No pending orders.</p>
          ) : (
            <div className="space-y-3">
              {pendingOrders.map(order => (
                <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{order.title}</p>
                    <p className="text-xs text-gray-500">{order.date}</p>
                  </div>
                  <Badge variant="warning">pending</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <p className="text-sm text-gray-500 text-center py-8">No recent activity. Start by creating a listing or updating your profile.</p>
        </Card>
      </div>
    </div>
  );
}
