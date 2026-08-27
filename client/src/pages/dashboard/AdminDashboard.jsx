import { Link } from 'react-router-dom';
import {
  Users, Building2, List, FileText, Settings,
  ArrowRight, AlertTriangle
} from 'lucide-react';
import StatCard from '../../components/ui/StatCard';
import Card, { CardHeader, CardTitle } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';

const quickActions = [
  { to: '/admin/users', icon: <Users className="w-5 h-5" />, label: 'Manage Users', color: 'bg-blue-100 text-blue-600' },
  { to: '/admin/businesses', icon: <Building2 className="w-5 h-5" />, label: 'Businesses', color: 'bg-amber-100 text-amber-600' },
  { to: '/admin/reports', icon: <FileText className="w-5 h-5" />, label: 'Reports', color: 'bg-red-100 text-red-600' },
  { to: '/admin/settings', icon: <Settings className="w-5 h-5" />, label: 'Settings', color: 'bg-gray-100 text-gray-600' },
];

const pendingBusinesses = [];
const recentReports = [];

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-500 mt-1">System overview and management.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Users className="w-6 h-6" />} label="Total Users" value="0" change="No users yet" changeType="neutral" />
        <StatCard icon={<Building2 className="w-6 h-6" />} label="Businesses" value="0" change="0 pending approval" changeType="neutral" />
        <StatCard icon={<List className="w-6 h-6" />} label="Listings" value="0" change="No listings" changeType="neutral" />
        <StatCard icon={<AlertTriangle className="w-6 h-6" />} label="Open Reports" value="0" change="No reports" changeType="neutral" />
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
              <CardTitle>Pending Business Approvals</CardTitle>
              <Link to="/admin/businesses" className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
                View all <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </CardHeader>
          {pendingBusinesses.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No pending business approvals.</p>
          ) : (
            <div className="space-y-3">
              {pendingBusinesses.map(biz => (
                <div key={biz.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{biz.name}</p>
                    <p className="text-xs text-gray-500">{biz.category}</p>
                  </div>
                  <Badge variant="warning">pending</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Reports</CardTitle>
              <Link to="/admin/reports" className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
                View all <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </CardHeader>
          {recentReports.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No recent reports.</p>
          ) : (
            <div className="space-y-3">
              {recentReports.map(report => (
                <div key={report.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{report.reason}</p>
                    <p className="text-xs text-gray-500">{report.target_type}</p>
                  </div>
                  <Badge variant="danger">pending</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
