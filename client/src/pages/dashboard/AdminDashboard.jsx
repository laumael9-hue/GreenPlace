import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';
import {
  Users, Building2, FileText, Settings,
  ArrowRight, Clock, CheckCircle, Shield, User
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

export default function AdminDashboard() {
  const [userStats, setUserStats] = useState({ total: 0, active: 0, inactive: 0, pendingDeletion: 0, deleted: 0 });
  const [bizStats, setBizStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0, suspended: 0 });
  const [pendingBusinesses, setPendingBusinesses] = useState([]);
  const [roleStats, setRoleStats] = useState({ residents: 0, businesses: 0, admins: 0 });
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [userStatsRes, bizStatsRes, pendingBizRes, residentRes, businessRes, adminRes] = await Promise.allSettled([
        api.get('/users/stats'),
        api.get('/businesses/admin/stats'),
        api.get('/businesses/admin?status=pending&limit=5'),
        api.get('/users?role=resident&limit=1'),
        api.get('/users?role=business&limit=1'),
        api.get('/users?role=admin&limit=1'),
      ]);

      if (userStatsRes.status === 'fulfilled') setUserStats(userStatsRes.value.data);
      if (bizStatsRes.status === 'fulfilled') setBizStats(bizStatsRes.value.data);
      if (pendingBizRes.status === 'fulfilled') setPendingBusinesses(pendingBizRes.value.data.businesses);
      if (residentRes.status === 'fulfilled') setRoleStats(prev => ({ ...prev, residents: residentRes.value.data.pagination.total }));
      if (businessRes.status === 'fulfilled') setRoleStats(prev => ({ ...prev, businesses: businessRes.value.data.pagination.total }));
      if (adminRes.status === 'fulfilled') setRoleStats(prev => ({ ...prev, admins: adminRes.value.data.pagination.total }));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-500 mt-1">System overview and management.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Users className="w-6 h-6" />} label="Total Users" value={userStats.total} change={`${userStats.active} active`} changeType="up" />
        <StatCard icon={<Building2 className="w-6 h-6" />} label="Businesses" value={bizStats.total} change={`${bizStats.pending} pending approval`} changeType="neutral" />
        <StatCard icon={<Clock className="w-6 h-6" />} label="Pending Approvals" value={bizStats.pending} change="Needs review" changeType="neutral" />
        <StatCard icon={<CheckCircle className="w-6 h-6" />} label="Approved" value={bizStats.approved} change={`${bizStats.rejected} rejected`} changeType="up" />
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
              <CardTitle>Users by Role</CardTitle>
              <Link to="/admin/users" className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
                Manage <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </CardHeader>
          <div className="grid grid-cols-3 gap-4">
            <Link to="/admin/users?role=resident" className="p-3 bg-blue-50 rounded-lg text-center hover:bg-blue-100 transition-colors">
              <User className="w-5 h-5 text-blue-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-blue-700">{roleStats.residents}</p>
              <p className="text-xs text-blue-600">Residents</p>
            </Link>
            <Link to="/admin/users?role=business" className="p-3 bg-amber-50 rounded-lg text-center hover:bg-amber-100 transition-colors">
              <Building2 className="w-5 h-5 text-amber-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-amber-700">{roleStats.businesses}</p>
              <p className="text-xs text-amber-600">Business</p>
            </Link>
            <Link to="/admin/users?role=admin" className="p-3 bg-red-50 rounded-lg text-center hover:bg-red-100 transition-colors">
              <Shield className="w-5 h-5 text-red-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-red-700">{roleStats.admins}</p>
              <p className="text-xs text-red-600">Admins</p>
            </Link>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Pending Business Approvals</CardTitle>
              <Link to="/admin/businesses" className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
                View all <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </CardHeader>
          {loading ? (
            <p className="text-sm text-gray-500 text-center py-8">Loading...</p>
          ) : pendingBusinesses.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No pending business approvals.</p>
          ) : (
            <div className="space-y-3">
              {pendingBusinesses.map(biz => (
                <div key={biz.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{biz.name}</p>
                    <p className="text-xs text-gray-500">{biz.category} — {biz.city}</p>
                  </div>
                  <Badge variant="warning">
                    <Clock className="w-3 h-3 mr-1" />
                    pending
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Business Stats</CardTitle>
              <Link to="/admin/businesses" className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
                View all <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </CardHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-green-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-green-700">{bizStats.approved}</p>
              <p className="text-xs text-green-600">Approved</p>
            </div>
            <div className="p-3 bg-amber-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-amber-700">{bizStats.pending}</p>
              <p className="text-xs text-amber-600">Pending</p>
            </div>
            <div className="p-3 bg-red-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-red-700">{bizStats.rejected}</p>
              <p className="text-xs text-red-600">Rejected</p>
            </div>
            <div className="p-3 bg-orange-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-orange-700">{bizStats.suspended}</p>
              <p className="text-xs text-orange-600">Suspended</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
