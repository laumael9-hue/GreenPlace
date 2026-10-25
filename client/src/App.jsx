import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, useNavigate, Link } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './components/layout/MainLayout';
import DashboardLayout from './components/layout/DashboardLayout';
import Login from './pages/Login';
import Landing from './pages/Landing';
import CartDrawer from './components/cart/CartDrawer';

const Register = lazy(() => import('./pages/Register'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));
const Suspended = lazy(() => import('./pages/Suspended'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Profile = lazy(() => import('./pages/Profile'));
const FindEstablishments = lazy(() => import('./pages/FindEstablishments'));
const BusinessDetail = lazy(() => import('./pages/BusinessDetail'));
const Marketplace = lazy(() => import('./pages/Marketplace'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const Cart = lazy(() => import('./pages/Cart'));
const ResidentDashboard = lazy(() => import('./pages/dashboard/ResidentDashboard'));
const BusinessDashboard = lazy(() => import('./pages/dashboard/BusinessDashboard'));
const AdminDashboard = lazy(() => import('./pages/dashboard/AdminDashboard'));
const UserManagement = lazy(() => import('./pages/admin/UserManagement'));
const BusinessManagement = lazy(() => import('./pages/admin/BusinessManagement'));
const BusinessRegistration = lazy(() => import('./pages/business/BusinessRegistration'));
const BusinessProfileManagement = lazy(() => import('./pages/business/BusinessProfileManagement'));
const ListingManagement = lazy(() => import('./pages/dashboard/ListingManagement'));
const Forum = lazy(() => import('./pages/Forum'));
const ForumThread = lazy(() => import('./pages/ForumThread'));
const ForumBookmarks = lazy(() => import('./pages/ForumBookmarks'));
const ForumModeration = lazy(() => import('./pages/admin/ForumModeration'));
const ListingModeration = lazy(() => import('./pages/admin/ListingModeration'));
const Approvals = lazy(() => import('./pages/admin/Approvals'));
const Documents = lazy(() => import('./pages/admin/Documents'));
const Reports = lazy(() => import('./pages/admin/Reports'));
const AdminSettings = lazy(() => import('./pages/admin/Settings'));
const Checkout = lazy(() => import('./pages/Checkout'));
const OrderConfirmation = lazy(() => import('./pages/OrderConfirmation'));
const PaymentSuccess = lazy(() => import('./pages/PaymentSuccess'));
const PaymentFailed = lazy(() => import('./pages/PaymentFailed'));
const OrderHistory = lazy(() => import('./pages/OrderHistory'));
const OrderDetail = lazy(() => import('./pages/OrderDetail'));
const Receipt = lazy(() => import('./pages/Receipt'));
const DropOffReceipt = lazy(() => import('./pages/DropOffReceipt'));
const BusinessOrders = lazy(() => import('./pages/dashboard/BusinessOrders'));
const DropOffTracker = lazy(() => import('./pages/dashboard/DropOffTracker'));
const DropOffHistory = lazy(() => import('./pages/dashboard/DropOffHistory'));
const ReviewManagement = lazy(() => import('./pages/dashboard/ReviewManagement'));
const BusinessAnalytics = lazy(() => import('./pages/dashboard/BusinessAnalytics'));
const Messages = lazy(() => import('./pages/Messages'));
const Notifications = lazy(() => import('./pages/Notifications'));

function App() {
  return (
    <>
      <CartDrawer />
      <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-gray-500">Loading…</div>}>
      <Routes>
      {/* Auth pages — no layout */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/suspended" element={<Suspended />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Public pages — SmartLayout adapts: authenticated → sidebar, public → navbar */}
      <Route element={<SmartLayout />}>
        <Route path="/establishments" element={<FindEstablishments />} />
        <Route path="/establishments/:slug" element={<BusinessDetail />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/marketplace/:slug" element={<ProductDetail />} />
        <Route path="/forum" element={<Forum />} />
        <Route path="/forum/search" element={<Forum />} />
        <Route path="/forum/thread/:slug" element={<ForumThread />} />
        <Route path="/bookmarks" element={<ProtectedRoute><ForumBookmarks /></ProtectedRoute>} />
      </Route>

      {/* Dashboard pages — sidebar layout (must come before MainLayout catch-all) */}
      <Route element={<ProtectedRoute roles={['resident', 'business']}><DashboardLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<RoleDashboard />} />
        <Route path="/dashboard/register-business" element={<BusinessRegistration />} />
        <Route path="/dashboard/profile" element={<BusinessProfileManagement />} />
        <Route path="/dashboard/listings" element={<ListingManagement />} />
        <Route path="/dashboard/orders" element={<BusinessOrders />} />
        <Route path="/dashboard/drop-offs" element={<DropOffTracker />} />
        <Route path="/dashboard/reviews" element={<ReviewManagement />} />
        <Route path="/dashboard/messages" element={<Messages />} />
        <Route path="/dashboard/messages/:conversationId" element={<Messages />} />
        <Route path="/dashboard/analytics" element={<BusinessAnalytics />} />
      </Route>

      {/* Resident pages — sidebar layout (business accounts keep resident powers) */}
      <Route element={<ProtectedRoute roles={['resident', 'business']}><DashboardLayout /></ProtectedRoute>}>
        <Route path="/orders" element={<OrderHistory />} />
        <Route path="/drop-offs" element={<DropOffHistory />} />
      </Route>

      {/* Shared authenticated pages — sidebar layout */}
      <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route path="/orders/:id" element={<OrderDetail />} />
        <Route path="/orders/:id/receipt" element={<Receipt />} />
        <Route path="/drop-offs/:id/receipt" element={<DropOffReceipt />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/profile" element={<Profile />} />
      </Route>

      {/* Admin pages — sidebar layout */}
      <Route element={<ProtectedRoute roles={['admin']}><DashboardLayout /></ProtectedRoute>}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/users" element={<UserManagement />} />
        <Route path="/admin/businesses" element={<BusinessManagement />} />
        <Route path="/admin/approvals" element={<Approvals />} />
        <Route path="/admin/documents" element={<Documents />} />
        <Route path="/admin/listings" element={<ListingModeration />} />
        <Route path="/admin/forum" element={<ForumModeration />} />
        <Route path="/admin/reports" element={<Reports />} />
        <Route path="/admin/settings" element={<AdminSettings />} />
      </Route>

      {/* MainLayout — navbar (catch-all at end) */}
      <Route element={<MainLayout />}>
        <Route path="/" element={<AuthRedirect />} />
        <Route path="/cart" element={<ProtectedRoute><Cart /></ProtectedRoute>} />
        <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
        <Route path="/orders/:id/success" element={<ProtectedRoute><OrderConfirmation /></ProtectedRoute>} />
        <Route path="/payment/success" element={<ProtectedRoute><PaymentSuccess /></ProtectedRoute>} />
        <Route path="/payment/failed" element={<ProtectedRoute><PaymentFailed /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
      </Suspense>
    </>
  );
}

function SmartLayout() {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) {
    return <DashboardLayout />;
  }
  return <MainLayout />;
}

function RoleDashboard() {
  const { role, fetchProfile } = useAuth();

  // Refetch profile so a conversion (resident → business) applies without re-login
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  if (role === 'business') return <BusinessDashboard />;
  return <ResidentDashboard />;
}

function AuthRedirect() {
  const { isAuthenticated, role, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (loading || !isAuthenticated) return;
    navigate(role === 'admin' ? '/admin' : '/dashboard', { replace: true });
  }, [isAuthenticated, role, loading, navigate]);
  if (loading || isAuthenticated) return null;
  return <Landing />;
}

function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-300">404</h1>
        <p className="mt-4 text-lg text-gray-600">Page not found</p>
        <Link to="/" className="mt-6 inline-block text-primary-600 hover:text-primary-500 font-medium">
          Go home
        </Link>
      </div>
    </div>
  );
}

export default App;
