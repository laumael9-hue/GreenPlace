import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isPendingSkipped } from '../lib/pendingApproval';

// Pages a business that is not yet Verified may still reach.
const ALLOWED_PATHS = [
  '/pending-approval',
  '/login',
  '/register',
  '/suspended',
  '/auth/callback',
  '/forgot-password',
  '/reset-password',
];

// Wraps the whole route tree: an owner whose business is not Verified is sent to
// the Pending Approval screen on entry, unless they chose to continue as a resident.
export default function VerificationGate({ children }) {
  const { loading, needsBusinessVerification } = useAuth();
  const { pathname } = useLocation();

  if (loading && localStorage.getItem('access_token')) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (needsBusinessVerification && !isPendingSkipped() && !ALLOWED_PATHS.includes(pathname)) {
    return <Navigate to="/pending-approval" replace />;
  }

  return children;
}
