import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Leaf, Ban, LogOut, AlertCircle } from 'lucide-react';

export default function Suspended() {
  const { isAuthenticated, loading, profile, suspensionReason, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
    } else if (profile?.is_active) {
      navigate('/dashboard', { replace: true });
    }
  }, [loading, isAuthenticated, profile, navigate]);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  if (loading || !isAuthenticated || profile?.is_active) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <Link to="/" className="w-12 h-12 bg-primary-600 rounded-lg flex items-center justify-center hover:bg-primary-700 transition-colors">
            <Leaf className="w-7 h-7 text-white" />
          </Link>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 text-center">
          <div className="mx-auto w-14 h-14 bg-red-50 rounded-full flex items-center justify-center">
            <Ban className="w-7 h-7 text-red-600" />
          </div>

          <h2 className="mt-4 text-2xl font-bold text-gray-900">Your account is suspended</h2>
          <p className="mt-2 text-sm text-gray-600">
            You are signed in, but your account has been suspended and cannot use GreenPlace features right now.
          </p>

          <div className="mt-6 text-left bg-red-50 border border-red-100 rounded-lg p-4">
            <div className="flex items-start gap-2 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">
                  {suspensionReason ? `Reason: ${suspensionReason}` : 'No reason provided'}
                </p>
                {profile?.suspended_at && (
                  <p className="mt-1 text-xs text-red-600">
                    Suspended on {new Date(profile.suspended_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          </div>

          <p className="mt-6 text-sm text-gray-600">
            If you believe this is a mistake, contact our support team for assistance.
          </p>

          <button
            onClick={handleLogout}
            className="mt-6 w-full flex justify-center items-center gap-2 py-2 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <LogOut className="w-4 h-4" />
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
