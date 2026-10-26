import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, ShoppingBag, ChevronDown, User, LayoutDashboard, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import Avatar from '../ui/Avatar';
import { roleLabel } from '../../lib/roleLabel';
import Logo from '../ui/Logo';

export default function Navbar({ onMenuToggle, menuOpen }) {
  const { isAuthenticated, profile, logout } = useAuth();
  const { itemCount, openCart } = useCart();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const { pathname } = useLocation();
  // Landing page has a dark hero: float the navbar over it instead of a white bar.
  const dark = pathname === '/' && !isAuthenticated;

  const pill = (to) => {
    const active = to === '/' ? pathname === '/' : pathname.startsWith(to);
    const base = 'text-sm font-medium px-4 py-2 rounded-full transition-colors ';
    if (dark) return base + (active ? 'bg-white text-primary-700' : 'text-white/90 hover:text-white hover:bg-white/10');
    return base + (active ? 'bg-primary-600 text-white' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100');
  };

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
    <header className={dark ? "absolute top-0 inset-x-0 z-40 px-3 sm:px-6 pt-3 sm:pt-5" : "sticky top-0 z-40 px-3 sm:px-6 pt-3 pb-3"}>
      <div className={`flex items-center justify-between h-16 px-4 sm:px-6 mx-auto rounded-full backdrop-blur-md ${dark ? "max-w-6xl bg-white/15 border border-white/30 shadow-lg shadow-black/10" : "max-w-7xl bg-white/85 border border-gray-200/80 shadow-sm"}`}>
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuToggle}
            className={`lg:hidden p-2 rounded-full ${dark ? "text-white hover:bg-white/10" : "text-gray-600 hover:bg-gray-100"}`}
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <Link to="/" className="flex items-center gap-2">
            <Logo tone={dark ? "light" : "dark"} hideTextOnMobile />
          </Link>
        </div>

        <nav className="hidden md:flex items-center gap-1">
          {!isAuthenticated && <Link to="/" className={pill("/")}>Home</Link>}
          <Link to="/establishments" className={pill("/establishments")}>Establishments</Link>
          <Link to="/marketplace" className={pill("/marketplace")}>Marketplace</Link>
          {!isAuthenticated && (
            <Link to="/forum" className={pill("/forum")}>Forum</Link>
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
                  className="flex items-center gap-2 hover:bg-gray-100 rounded-full pl-1.5 pr-3 py-1 transition-colors"
                >
                  <Avatar name={`${profile?.first_name} ${profile?.last_name}`} size="sm" src={profile?.avatar_url} />
                  <span className="hidden md:inline text-sm text-gray-700 font-medium">{profile?.first_name}</span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`} />
                </button>

                {profileOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl border border-gray-200/70 shadow-xl py-1.5 z-50">
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
              <Link to="/login" className={`text-sm transition-colors ${dark ? "text-white font-medium border border-white/60 hover:bg-white/15 px-5 py-2 rounded-full" : "text-gray-700 font-medium border border-gray-300 hover:bg-gray-50 px-5 py-2 rounded-full"}`}>Login</Link>
              <Link to="/register" className={dark ? "text-sm font-semibold bg-white text-primary-700 px-5 py-2 rounded-full hover:bg-primary-50 transition-colors shadow-sm" : "text-sm font-semibold bg-primary-600 text-white px-5 py-2 rounded-full hover:bg-primary-700 transition-colors shadow-sm"}>Get Started</Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
