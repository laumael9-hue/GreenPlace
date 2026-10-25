import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AlertCircle } from 'lucide-react';

export default function AuthCallback() {
  const [error, setError] = useState('');
  const { loginWithSession } = useAuth();
  const navigate = useNavigate();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    window.history.replaceState(null, '', window.location.pathname);

    const providerError = params.get('error_description') || params.get('error');
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (providerError || !accessToken || !refreshToken) {
      setError(providerError?.replace(/\+/g, ' ') || 'Sign in was cancelled or failed.');
      return;
    }

    loginWithSession({ access_token: accessToken, refresh_token: refreshToken })
      .then((profile) => {
        navigate(profile?.is_active === false ? '/suspended' : '/dashboard', { replace: true });
      })
      .catch(() => setError('Could not complete sign in. Please try again.'));
  }, [loginWithSession, navigate]);

  if (!error) {
    return <div className="flex min-h-screen items-center justify-center text-gray-500">Signing you in…</div>;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-sm max-w-sm">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        {error}
      </div>
      <Link to="/login" className="mt-4 text-sm font-medium text-primary-600 hover:text-primary-500">
        Back to sign in
      </Link>
    </div>
  );
}
