import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';
import {
  Building2, List, ClipboardList, Clock, Star,
  BarChart3, ArrowRight, AlertTriangle, FileText, Upload
} from 'lucide-react';
import StatCard from '../../components/ui/StatCard';
import Card, { CardHeader, CardTitle } from '../../components/ui/Card';
import Button from '../../components/ui/Button';

export default function BusinessDashboard() {
  const [business, setBusiness] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBusiness = async () => {
      try {
        const { data } = await api.get('/businesses/my');
        setBusiness(data.business);
        setDocuments(data.business.documents || []);
      } catch {
        // No business registered yet
      } finally {
        setLoading(false);
      }
    };
    fetchBusiness();
  }, []);

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading...</div>;
  }

  if (!business) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Business Dashboard</h1>
          <p className="text-gray-500 mt-1">Get started by registering your business.</p>
        </div>
        <Card>
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-primary-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Register Your Business</h2>
            <p className="text-gray-500 mt-2 max-w-md mx-auto">
              Start by registering your waste management establishment. It only takes a few minutes.
            </p>
            <Link to="/dashboard/register-business" className="mt-6 inline-block">
              <Button>Register Business</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  // ============================================================
  // GATE: No documents uploaded yet — prompt to upload
  // ============================================================
  if (documents.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Business Dashboard</h1>
          <p className="text-gray-500 mt-1">Complete your registration to access all features.</p>
        </div>

        <Card>
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Upload Verification Documents</h2>
            <p className="text-gray-500 mt-2 max-w-md mx-auto">
              Please upload at least one verification document (business permit, DTI/SEC registration, etc.)
              to access dashboard features. This is required for admin approval.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link to="/dashboard/profile">
                <Button>
                  <Upload className="w-4 h-4" />
                  Upload Documents
                </Button>
              </Link>
              <Link to="/dashboard/register-business">
                <Button variant="ghost">
                  Continue Registration
                </Button>
              </Link>
            </div>
          </div>
        </Card>

        {business.rejection_reason && (
          <Card className="border-red-200">
            <div className="p-4">
              <p className="text-sm text-red-800">
                <strong>Rejection Reason:</strong> {business.rejection_reason}
              </p>
            </div>
          </Card>
        )}
      </div>
    );
  }

  // ============================================================
  // Full dashboard (documents uploaded)
  // ============================================================
  const statusMessages = {
    pending: {
      color: 'bg-amber-50 border-amber-200',
      iconColor: 'text-amber-600',
      icon: <AlertTriangle className="w-5 h-5" />,
      title: 'Awaiting Approval',
      desc: 'Your business registration is being reviewed by an admin. You will be notified once approved.',
    },
    rejected: {
      color: 'bg-red-50 border-red-200',
      iconColor: 'text-red-600',
      icon: <AlertTriangle className="w-5 h-5" />,
      title: 'Registration Rejected',
      desc: business.rejection_reason
        ? `Reason: ${business.rejection_reason}. Please update your information and contact support.`
        : 'Your registration was rejected. Please contact support for more information.',
    },
    suspended: {
      color: 'bg-red-50 border-red-200',
      iconColor: 'text-red-600',
      icon: <AlertTriangle className="w-5 h-5" />,
      title: 'Business Suspended',
      desc: 'Your business has been suspended. Contact support for more information.',
    },
  };

  const statusInfo = statusMessages[business.status];

  const quickActions = [
    { to: '/dashboard/profile', icon: <Building2 className="w-5 h-5" />, label: 'Business Profile', color: 'bg-blue-100 text-blue-600' },
    { to: '/dashboard/listings', icon: <List className="w-5 h-5" />, label: 'Manage Listings', color: 'bg-purple-100 text-purple-600' },
    { to: '/dashboard/orders', icon: <ClipboardList className="w-5 h-5" />, label: 'View Orders', color: 'bg-amber-100 text-amber-600' },
    { to: '/dashboard/analytics', icon: <BarChart3 className="w-5 h-5" />, label: 'Analytics', color: 'bg-green-100 text-green-600' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Business Dashboard</h1>
        <p className="text-gray-500 mt-1">Manage your business, listings, and orders.</p>
      </div>

      {statusInfo && (
        <div className={`p-4 border rounded-xl ${statusInfo.color}`}>
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-white ${statusInfo.iconColor}`}>
              {statusInfo.icon}
            </div>
            <div>
              <h3 className="text-sm font-semibold">{statusInfo.title}</h3>
              <p className="text-sm mt-1 opacity-80">{statusInfo.desc}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<ClipboardList className="w-6 h-6" />} label="Pending Orders" value="0" change="No pending orders" changeType="neutral" />
        <StatCard icon={<List className="w-6 h-6" />} label="Active Listings" value="0" change="Create your first listing" changeType="neutral" />
        <StatCard icon={<Clock className="w-6 h-6" />} label="Drop-offs" value="0" change="No drop-offs scheduled" changeType="neutral" />
        <StatCard icon={<Star className="w-6 h-6" />} label="Avg Rating" value={business.rating_avg || '0.0'} change={`${business.rating_count || 0} reviews`} changeType="neutral" />
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
          <p className="text-sm text-gray-500 text-center py-8">No pending orders.</p>
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
