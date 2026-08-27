import { Link } from 'react-router-dom';
import { Leaf, Menu, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Avatar from '../ui/Avatar';

export default function Navbar({ onMenuToggle, menuOpen }) {
  const { isAuthenticated, profile, logout } = useAuth();

  const dashboardLink = profile?.role === 'admin' ? '/admin' : '/dashboard';

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuToggle}
            className="lg:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 bg-primary-600 rounded-lg flex items-center justify-center">
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900 hidden sm:block">GreenPlace</span>
          </Link>
        </div>

        <nav className="hidden md:flex items-center gap-6">
          {!isAuthenticated && (
            <>
              <Link to="/establishments" className="text-sm text-gray-600 hover:text-primary-600 transition-colors">Establishments</Link>
              <Link to="/marketplace" className="text-sm text-gray-600 hover:text-primary-600 transition-colors">Marketplace</Link>
              <Link to="/forum" className="text-sm text-gray-600 hover:text-primary-600 transition-colors">Forum</Link>
            </>
          )}
        </nav>

        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <>
              <Link to={dashboardLink} className="hidden sm:flex items-center gap-2 text-sm text-gray-600 hover:text-primary-600 transition-colors">
                <Avatar name={`${profile?.first_name} ${profile?.last_name}`} size="sm" src={profile?.avatar_url} />
                <span className="hidden md:inline">{profile?.first_name}</span>
              </Link>
              <button onClick={logout} className="text-sm text-gray-500 hover:text-red-600 transition-colors">Logout</button>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <Link to="/login" className="text-sm text-gray-600 hover:text-primary-600 transition-colors">Login</Link>
              <Link to="/register" className="text-sm bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors">Get Started</Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
