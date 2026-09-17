import { Routes, Route } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './components/layout/MainLayout';
import DashboardLayout from './components/layout/DashboardLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Profile from './pages/Profile';
import FindEstablishments from './pages/FindEstablishments';
import BusinessDetail from './pages/BusinessDetail';
import Marketplace from './pages/Marketplace';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import ResidentDashboard from './pages/dashboard/ResidentDashboard';
import BusinessDashboard from './pages/dashboard/BusinessDashboard';
import AdminDashboard from './pages/dashboard/AdminDashboard';
import UserManagement from './pages/admin/UserManagement';
import BusinessManagement from './pages/admin/BusinessManagement';
import BusinessRegistration from './pages/business/BusinessRegistration';
import BusinessProfileManagement from './pages/business/BusinessProfileManagement';
import ListingManagement from './pages/dashboard/ListingManagement';
import Checkout from './pages/Checkout';
import OrderConfirmation from './pages/OrderConfirmation';
import PaymentSuccess from './pages/PaymentSuccess';
import PaymentFailed from './pages/PaymentFailed';
import OrderHistory from './pages/OrderHistory';
import OrderDetail from './pages/OrderDetail';
import Receipt from './pages/Receipt';
import DropOffReceipt from './pages/DropOffReceipt';
import BusinessOrders from './pages/dashboard/BusinessOrders';
import DropOffTracker from './pages/dashboard/DropOffTracker';
import DropOffHistory from './pages/dashboard/DropOffHistory';
import Landing from './pages/Landing';
import { Leaf } from 'lucide-react';
import { Link } from 'react-router-dom';

function App() {
  return (
    <Routes>
      {/* Auth pages — no layout */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Public pages — SmartLayout adapts: authenticated → sidebar, public → navbar */}
      <Route element={<SmartLayout />}>
        <Route path="/establishments" element={<FindEstablishments />} />
        <Route path="/establishments/:slug" element={<BusinessDetail />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/marketplace/:slug" element={<ProductDetail />} />
      </Route>

      {/* Dashboard pages — sidebar layout (must come before MainLayout catch-all) */}
      <Route element={<ProtectedRoute roles={['resident', 'business']}><DashboardLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<RoleDashboard />} />
        <Route path="/dashboard/register-business" element={<BusinessRegistration />} />
        <Route path="/dashboard/profile" element={<BusinessProfileManagement />} />
        <Route path="/dashboard/listings" element={<ListingManagement />} />
        <Route path="/dashboard/orders" element={<BusinessOrders />} />
        <Route path="/dashboard/drop-offs" element={<DropOffTracker />} />
        <Route path="/dashboard/reviews" element={<Placeholder title="Reviews" desc="View and respond to customer reviews." />} />
        <Route path="/dashboard/messages" element={<Placeholder title="Messages" desc="Communicate with customers." />} />
        <Route path="/dashboard/analytics" element={<Placeholder title="Analytics" desc="View business performance metrics." />} />
      </Route>

      {/* Resident pages — sidebar layout */}
      <Route element={<ProtectedRoute roles={['resident']}><DashboardLayout /></ProtectedRoute>}>
        <Route path="/orders" element={<OrderHistory />} />
        <Route path="/drop-offs" element={<DropOffHistory />} />
      </Route>

      {/* Shared authenticated pages — sidebar layout */}
      <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route path="/orders/:id" element={<OrderDetail />} />
        <Route path="/orders/:id/receipt" element={<Receipt />} />
        <Route path="/drop-offs/:id/receipt" element={<DropOffReceipt />} />
        <Route path="/profile" element={<Profile />} />
      </Route>

      {/* Admin pages — sidebar layout */}
      <Route element={<ProtectedRoute roles={['admin']}><DashboardLayout /></ProtectedRoute>}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/users" element={<UserManagement />} />
        <Route path="/admin/businesses" element={<BusinessManagement />} />
        <Route path="/admin/listings" element={<Placeholder title="Marketplace Moderation" desc="Review and moderate marketplace listings." />} />
        <Route path="/admin/forum" element={<Placeholder title="Forum Moderation" desc="Moderate forum threads and posts." />} />
        <Route path="/admin/reports" element={<Placeholder title="Reports" desc="Review content and user reports." />} />
        <Route path="/admin/settings" element={<Placeholder title="System Settings" desc="Configure application settings." />} />
      </Route>

      {/* MainLayout — navbar (catch-all at end) */}
      <Route element={<MainLayout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/cart" element={<ProtectedRoute><Cart /></ProtectedRoute>} />
        <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
        <Route path="/forum" element={<Placeholder title="Community Forum" desc="Join sustainability discussions with the community." />} />
        <Route path="/orders/:id/success" element={<ProtectedRoute><OrderConfirmation /></ProtectedRoute>} />
        <Route path="/payment/success" element={<ProtectedRoute><PaymentSuccess /></ProtectedRoute>} />
        <Route path="/payment/failed" element={<ProtectedRoute><PaymentFailed /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
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
  const { role } = useAuth();
  if (role === 'business') return <BusinessDashboard />;
  return <ResidentDashboard />;
}

function Placeholder({ title, desc }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-4">
        <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 mx-auto mb-4">
          <Leaf className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <p className="mt-2 text-gray-500">{desc}</p>
      </div>
    </div>
  );
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
