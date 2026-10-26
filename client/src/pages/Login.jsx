import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SocialLogin from '../components/ui/SocialLogin';
import { Eye, EyeOff, AlertCircle, ShoppingBag, MapPin, Users } from 'lucide-react';
import Logo from '../components/ui/Logo';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/dashboard';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await login(email, password);
      if (data?.user?.profile?.is_active === false) {
        navigate('/suspended', { replace: true });
      } else {
        navigate(from, { replace: true });
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: ShoppingBag, title: 'Sustainable Marketplace', desc: 'Buy & sell recyclables from local businesses' },
    { icon: MapPin,      title: 'Drop-off Tracking',       desc: 'Find and track waste drop-off locations' },
    { icon: Users,       title: 'Eco Community',           desc: 'Forum and messaging for green advocates' },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left brand panel — desktop only */}
      <div className="hidden md:flex md:w-1/2 lg:w-[55%] relative flex-col justify-between bg-primary-800 overflow-hidden p-10 lg:p-14">
        {/* Cebu City skyline photo (Unsplash, Pao Dayag) with brand tint */}
        <img src="/images/hero-cebu.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-950/90 via-primary-900/60 to-primary-800/40" />

        {/* Logo */}
        <Link to="/" className="relative flex items-center gap-3">
          <Logo tone="light" size="lg" />
        </Link>

        {/* Tagline + feature bullets */}
        <div className="relative">
          <h2 className="text-3xl lg:text-4xl font-bold text-white leading-tight">
            Join Metro Cebu's<br />Sustainability Platform
          </h2>
          <p className="mt-3 text-white/75 text-base">
            Connect with eco-friendly businesses, trade recyclables, and track your environmental impact.
          </p>
          <ul className="mt-8 space-y-5">
            {features.map(({ icon: Icon, title, desc }) => (
              <li key={title} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-white text-sm">{title}</p>
                  <p className="text-white/65 text-xs">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative border-t border-white/20 pt-5 text-sm text-white/70">
          Making Metro Cebu greener, one drop-off at a time.
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col justify-center py-12 px-6 sm:px-10 lg:px-16 bg-white overflow-y-auto">
        {/* Mobile-only logo */}
        <div className="flex md:hidden justify-center mb-8">
          <Link to="/" className="flex items-center gap-2">
            <Logo size="lg" />
          </Link>
        </div>

        <div className="max-w-sm w-full mx-auto">
          <h2 className="text-2xl font-bold text-gray-900">Sign in to GreenPlace</h2>
          <p className="mt-1.5 text-sm text-gray-500">
            Or{' '}
            <Link to="/register" className="font-medium text-primary-600 hover:text-primary-500">
              create a new account
            </Link>
          </p>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email address</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm pr-10"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end">
              <Link to="/forgot-password" className="text-sm font-medium text-primary-600 hover:text-primary-500">
                Forgot your password?
              </Link>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-full shadow-sm text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-4 focus:ring-primary-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </div>
          </form>
          <SocialLogin verb="Sign in" />
        </div>
      </div>
    </div>
  );
}
