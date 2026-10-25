import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Leaf, Menu, X, ShoppingBag, ChevronDown, User, LayoutDashboard, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import Avatar from '../ui/Avatar';
import { roleLabel } from '../../lib/roleLabel';

export default function Navbar({ onMenuToggle, menuOpen }) {
  const { isAuthenticated, profile, logout } = useAuth();
  const { itemCount, openCart } = useCart();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  const dashboardLink = profile?.role === 'admin' ? '/admin' : '/dashboard';

  useEffect(() => {
    const handler = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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
          <Link to="/establishments" className="text-sm text-gray-600 hover:text-primary-600 transition-colors">Establishments</Link>
          <Link to="/marketplace" className="text-sm text-gray-600 hover:text-primary-600 transition-colors">Marketplace</Link>
          {!isAuthenticated && (
            <Link to="/forum" className="text-sm text-gray-600 hover:text-primary-600 transition-colors">Forum</Link>
          )}
        </nav>

        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <>
              <button
                onClick={openCart}
                className="relative p-2 text-gray-600 hover:text-primary-600 transition-colors"
              >
                <ShoppingBag className="w-5 h-5" />
                {itemCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary-600 text-white text-[10px] rounded-full flex items-center justify-center font-medium">
                    {itemCount > 9 ? '9+' : itemCount}
                  </span>
                )}
              </button>

              <div ref={profileRef} className="relative hidden sm:block">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 hover:bg-gray-50 rounded-lg px-2 py-1.5 transition-colors"
                >
                  <Avatar name={`${profile?.first_name} ${profile?.last_name}`} size="sm" src={profile?.avatar_url} />
                  <span className="hidden md:inline text-sm text-gray-700 font-medium">{profile?.first_name}</span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`} />
                </button>

                {profileOpen && (
                  <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl border border-gray-100 shadow-lg py-1 z-50">
                    <div className="px-4 py-2.5 border-b border-gray-100">
                      <p className="text-sm font-semibold text-gray-900">{profile?.first_name} {profile?.last_name}</p>
                      <p className="text-xs text-gray-500 capitalize">{roleLabel(profile?.role)}</p>
                    </div>
                    <Link
                      to={dashboardLink}
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <LayoutDashboard className="w-4 h-4 text-gray-400" /> Dashboard
                    </Link>
                    <Link
                      to="/profile"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <User className="w-4 h-4 text-gray-400" /> View Profile
                    </Link>
                    <div className="border-t border-gray-100 my-1" />
                    <button
                      onClick={() => { logout(); setProfileOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                  </div>
                )}
              </div>
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
