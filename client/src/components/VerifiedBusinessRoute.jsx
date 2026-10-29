import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Route guard for business tools (listings, incoming orders, analytics, ...).
// Only a business whose verification_status is 'Verified' gets through.
export default function VerifiedBusinessRoute({ children }) {
  const { loading, role, verificationStatus } = useAuth();

  if (loading || role === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (verificationStatus === 'Verified') {
    return children ?? <Outlet />;
  }

  // Has a business that isn't approved yet -> pending screen; plain residents -> their dashboard
  return <Navigate to={verificationStatus ? '/pending-approval' : '/dashboard'} replace />;
}
