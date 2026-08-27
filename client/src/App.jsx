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
import ResidentDashboard from './pages/dashboard/ResidentDashboard';
import BusinessDashboard from './pages/dashboard/BusinessDashboard';
import AdminDashboard from './pages/dashboard/AdminDashboard';
import UserManagement from './pages/admin/UserManagement';
import BusinessManagement from './pages/admin/BusinessManagement';
import BusinessRegistration from './pages/business/BusinessRegistration';
import BusinessProfileManagement from './pages/business/BusinessProfileManagement';
import { Leaf, MapPin, ShoppingBag, Users, Shield, Recycle } from 'lucide-react';
import { Link } from 'react-router-dom';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route path="/" element={<MainLayout><LandingPage /></MainLayout>} />
      <Route path="/establishments" element={<MainLayout><Placeholder title="Find Establishments" desc="Search and discover waste management establishments near you." /></MainLayout>} />
      <Route path="/marketplace" element={<MainLayout><Placeholder title="Marketplace" desc="Browse recyclable materials and eco-friendly products." /></MainLayout>} />
      <Route path="/forum" element={<MainLayout><Placeholder title="Community Forum" desc="Join sustainability discussions with the community." /></MainLayout>} />

      <Route path="/dashboard" element={<ProtectedRoute roles={['resident', 'business']}><DashboardLayout><RoleDashboard /></DashboardLayout></ProtectedRoute>} />
      <Route path="/dashboard/register-business" element={<ProtectedRoute roles={['business']}><DashboardLayout><BusinessRegistration /></DashboardLayout></ProtectedRoute>} />
      <Route path="/dashboard/profile" element={<ProtectedRoute roles={['business']}><DashboardLayout><BusinessProfileManagement /></DashboardLayout></ProtectedRoute>} />
      <Route path="/dashboard/listings" element={<ProtectedRoute roles={['business']}><DashboardLayout><Placeholder title="My Listings" desc="Create and manage your marketplace listings." /></DashboardLayout></ProtectedRoute>} />
      <Route path="/dashboard/orders" element={<ProtectedRoute roles={['business']}><DashboardLayout><Placeholder title="Orders" desc="View and process incoming orders." /></DashboardLayout></ProtectedRoute>} />
      <Route path="/dashboard/drop-offs" element={<ProtectedRoute roles={['business']}><DashboardLayout><Placeholder title="Drop-offs" desc="Manage scheduled recycling drop-offs." /></DashboardLayout></ProtectedRoute>} />
      <Route path="/dashboard/reviews" element={<ProtectedRoute roles={['business']}><DashboardLayout><Placeholder title="Reviews" desc="View and respond to customer reviews." /></DashboardLayout></ProtectedRoute>} />
      <Route path="/dashboard/messages" element={<ProtectedRoute roles={['business']}><DashboardLayout><Placeholder title="Messages" desc="Communicate with customers." /></DashboardLayout></ProtectedRoute>} />
      <Route path="/dashboard/analytics" element={<ProtectedRoute roles={['business']}><DashboardLayout><Placeholder title="Analytics" desc="View business performance metrics." /></DashboardLayout></ProtectedRoute>} />

      <Route path="/orders" element={<ProtectedRoute roles={['resident']}><DashboardLayout><Placeholder title="My Orders" desc="Track your marketplace orders." /></DashboardLayout></ProtectedRoute>} />
      <Route path="/drop-offs" element={<ProtectedRoute roles={['resident']}><DashboardLayout><Placeholder title="My Drop-offs" desc="View your recycling drop-off history." /></DashboardLayout></ProtectedRoute>} />
      <Route path="/drop-offs/new" element={<ProtectedRoute roles={['resident']}><DashboardLayout><Placeholder title="Schedule Drop-off" desc="Schedule a new recycling drop-off." /></DashboardLayout></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><DashboardLayout><Profile /></DashboardLayout></ProtectedRoute>} />

      <Route path="/admin" element={<ProtectedRoute roles={['admin']}><DashboardLayout><AdminDashboard /></DashboardLayout></ProtectedRoute>} />
      <Route path="/admin/users" element={<ProtectedRoute roles={['admin']}><DashboardLayout><UserManagement /></DashboardLayout></ProtectedRoute>} />
      <Route path="/admin/businesses" element={<ProtectedRoute roles={['admin']}><DashboardLayout><BusinessManagement /></DashboardLayout></ProtectedRoute>} />
      <Route path="/admin/listings" element={<ProtectedRoute roles={['admin']}><DashboardLayout><Placeholder title="Marketplace Moderation" desc="Review and moderate marketplace listings." /></DashboardLayout></ProtectedRoute>} />
      <Route path="/admin/forum" element={<ProtectedRoute roles={['admin']}><DashboardLayout><Placeholder title="Forum Moderation" desc="Moderate forum threads and posts." /></DashboardLayout></ProtectedRoute>} />
      <Route path="/admin/reports" element={<ProtectedRoute roles={['admin']}><DashboardLayout><Placeholder title="Reports" desc="Review content and user reports." /></DashboardLayout></ProtectedRoute>} />
      <Route path="/admin/settings" element={<ProtectedRoute roles={['admin']}><DashboardLayout><Placeholder title="System Settings" desc="Configure application settings." /></DashboardLayout></ProtectedRoute>} />

      <Route path="*" element={<MainLayout><NotFound /></MainLayout>} />
    </Routes>
  );
}

function LandingPage() {
  return (
    <main>
      <section className="relative bg-gradient-to-b from-primary-50 to-white py-20 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 tracking-tight">
            Sustainable Living Made Simple
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto">
            GreenPlace connects Metro Cebu residents with waste management establishments,
            recyclable marketplaces, and a community dedicated to proper waste segregation and recycling.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register" className="w-full sm:w-auto bg-primary-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors text-lg">
              Join as Resident
            </Link>
            <Link to="/register" className="w-full sm:w-auto bg-white text-primary-600 border-2 border-primary-600 px-8 py-3 rounded-lg font-semibold hover:bg-primary-50 transition-colors text-lg">
              Register Business
            </Link>
          </div>
        </div>
      </section>

      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Why Choose GreenPlace?</h2>
            <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
              A comprehensive platform for waste management, recycling, and sustainable living in Metro Cebu
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard icon={<MapPin className="w-6 h-6" />} title="Find Establishments" description="Locate nearby waste management facilities, recycling centers, and junk shops with interactive maps and filters." />
            <FeatureCard icon={<Recycle className="w-6 h-6" />} title="Material Exchange" description="Buy and sell recyclable materials through our marketplace. Turn waste into value." />
            <FeatureCard icon={<ShoppingBag className="w-6 h-6" />} title="Eco Marketplace" description="Discover upcycled products and sustainable goods from local businesses." />
            <FeatureCard icon={<Users className="w-6 h-6" />} title="Community Forum" description="Engage with fellow residents, share tips, and learn about sustainable practices." />
            <FeatureCard icon={<Shield className="w-6 h-6" />} title="Secure Transactions" description="Safe payment options including Cash on Pickup and PayMongo test mode for demonstrations." />
            <FeatureCard icon={<Leaf className="w-6 h-6" />} title="Drop-off Tracking" description="Track your recycling drop-offs, view history, and monitor your environmental impact." />
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">How It Works</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <StepCard number="1" title="Discover" description="Search for nearby waste management establishments that accept your materials. Filter by material type, distance, and ratings." />
            <StepCard number="2" title="Transact" description="Schedule drop-offs or browse the marketplace for recyclable materials and eco-friendly products." />
            <StepCard number="3" title="Earn & Impact" description="Get paid for recyclables, track your contributions, and join a community making Metro Cebu greener." />
          </div>
        </div>
      </section>

      <section className="py-20 bg-primary-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">Ready to Make an Impact?</h2>
          <p className="text-primary-100 text-lg mb-10 max-w-2xl mx-auto">
            Join thousands of residents and businesses in Metro Cebu working together for a sustainable future.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register" className="w-full sm:w-auto bg-white text-primary-600 px-8 py-3 rounded-lg font-semibold hover:bg-primary-50 transition-colors text-lg">
              Get Started Free
            </Link>
            <Link to="/register" className="w-full sm:w-auto bg-transparent border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white/10 transition-colors text-lg">
              Register Your Business
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function FeatureCard({ icon, title, description }) {
  return (
    <div className="bg-white p-6 rounded-xl border border-gray-100 hover:border-primary-200 hover:shadow-lg transition-all duration-300">
      <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center text-primary-600 mb-4">
        {icon}
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}

function StepCard({ number, title, description }) {
  return (
    <div className="relative text-center p-6">
      <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-6">
        {number}
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
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
