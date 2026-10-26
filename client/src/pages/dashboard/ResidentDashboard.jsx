import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search, MapPin, ShoppingBag, ClipboardList, Package, Leaf, ArrowRight,
  Building2, Clock, AlertTriangle, Store, Sparkles, ChevronRight, Loader2, X,
} from 'lucide-react';
import StatCard from '../../components/ui/StatCard';
import Card, { CardHeader, CardTitle } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import ListingCard from '../../components/marketplace/ListingCard';
import StoreCard from '../../components/marketplace/StoreCard';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { formatStatus, formatDropOffStatus } from '../../lib/formatStatus';

const quickActions = [
  { to: '/establishments', icon: <MapPin className="w-5 h-5" />, label: 'Find Establishments', color: 'bg-blue-100 text-blue-600' },
  { to: '/marketplace', icon: <ShoppingBag className="w-5 h-5" />, label: 'Marketplace', color: 'bg-purple-100 text-purple-600' },
  { to: '/drop-offs/new', icon: <Package className="w-5 h-5" />, label: 'Schedule Drop-off', color: 'bg-amber-100 text-amber-600' },
  { to: '/forum', icon: <Leaf className="w-5 h-5" />, label: 'Community Forum', color: 'bg-green-100 text-green-600' },
];

const orderStatusVariant = {
  completed: 'success', confirmed: 'info', processing: 'info', ready_for_pickup: 'purple',
  pending: 'warning', cancelled: 'danger', refunded: 'danger',
};
const dropOffStatusVariant = {
  processed: 'success', completed: 'success', received: 'info', in_transit: 'info',
  scheduled: 'warning', pending: 'warning', cancelled: 'danger',
};

const formatDate = (d) =>
  new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });

function SectionHeader({ icon, title, actionTo, actionLabel }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-semibold tracking-tight text-gray-900 flex items-center gap-2">
        {icon}
        {title}
      </h2>
      {actionTo && (
        <Link
          to={actionTo}
          className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
        >
          {actionLabel || 'See all'} <ChevronRight className="w-4 h-4" />
        </Link>
      )}
    </div>
  );
}

function RowSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-gray-200/70 overflow-hidden animate-pulse">
          <div className="h-40 bg-gray-200" />
          <div className="p-4 space-y-3">
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-3 bg-gray-200 rounded w-1/2" />
            <div className="h-6 bg-gray-200 rounded w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function BecomeBusinessCard() {
  const { profile } = useAuth();
  const dismissKey = `greenplace_biz_cta_dismissed_${profile?.id}`;
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(dismissKey) === '1'
  );

  const dismiss = () => {
    localStorage.setItem(dismissKey, '1');
    setDismissed(true);
  };

  useEffect(() => {
    let cancelled = false;
    const checkBusiness = async () => {
      try {
        const { data } = await api.get('/businesses/my');
        if (!cancelled) setBusiness(data.business || null);
      } catch {
        if (!cancelled) setBusiness(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    checkBusiness();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <div className="h-24 bg-white rounded-xl border border-gray-100 animate-pulse" />;
  }

  if (!business) {
    if (dismissed) return null;
    return (
      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-gradient-to-r from-primary-50 to-green-50 rounded-2xl border border-primary-100">
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-white/60 rounded-lg transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-start gap-4 pr-8 sm:pr-0">
          <div className="w-12 h-12 bg-primary-600 rounded-lg flex items-center justify-center shrink-0">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Become a Business on GreenPlace</h3>
            <p className="text-sm text-gray-600 mt-1">
              Sell recyclables, receive drop-offs, and reach more customers. Applications are reviewed by our team.
            </p>
          </div>
        </div>
        <Link to="/dashboard/register-business" className="shrink-0">
          <Button>
            Get Started <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </Link>
      </div>
    );
  }

  if (business.status === 'pending') {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-amber-50 rounded-2xl border border-amber-200">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Application Under Review</h3>
            <p className="text-sm text-gray-600 mt-1">
              Your application for <strong>{business.name}</strong> is being reviewed. You can keep using GreenPlace as a resident in the meantime.
            </p>
          </div>
        </div>
        <Link to="/dashboard/register-business" className="shrink-0">
          <Button variant="outline">View Application</Button>
        </Link>
      </div>
    );
  }

  if (business.status === 'rejected') {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-red-50 rounded-2xl border border-red-200">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Application Needs Attention</h3>
            <p className="text-sm text-gray-600 mt-1">
              {business.rejection_reason
                ? business.rejection_reason
                : 'Your application for ' + business.name + ' was not approved.'}
            </p>
          </div>
        </div>
        <Link to="/dashboard/register-business" className="shrink-0">
          <Button>Reapply</Button>
        </Link>
      </div>
    );
  }

  return null;
}

export default function ResidentDashboard() {
  const { profile } = useAuth();
  const { addItem, itemCount } = useCart();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState([]);
  const [stores, setStores] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [recommendedPersonalized, setRecommendedPersonalized] = useState(false);
  const [featured, setFeatured] = useState([]);
  const [topRated, setTopRated] = useState([]);
  const [orders, setOrders] = useState([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [dropOffs, setDropOffs] = useState([]);
  const [dropOffsTotal, setDropOffsTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [addingToCart, setAddingToCart] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      const safeGet = async (url, params) => {
        try {
          const { data } = await api.get(url, { params });
          return data;
        } catch (err) {
          console.error(`Failed to fetch ${url}:`, err);
          return null;
        }
      };

      const hasLocation = profile?.latitude && profile?.longitude;

      const [
        catData, storeData, recData, featData, topData, orderData, dropOffData,
      ] = await Promise.all([
        safeGet('/marketplace/categories'),
        hasLocation
          ? safeGet('/businesses/public/recommendations', { latitude: profile.latitude, longitude: profile.longitude, limit: 8 })
          : safeGet('/businesses/public', { limit: 8 }),
        safeGet('/marketplace/listings/recommended', { limit: 8 }),
        safeGet('/marketplace/listings', { featured: 'true', limit: 8 }),
        safeGet('/marketplace/listings', { sort: 'rating', limit: 8 }),
        safeGet('/orders', { limit: 3 }),
        safeGet('/drop-offs/my', { limit: 3 }),
      ]);

      if (cancelled) return;

      // Stores: recommendations endpoint first, fall back to top-rated public list
      let storeList = storeData?.businesses || [];
      if (storeList.length === 0 && hasLocation) {
        const fallback = await safeGet('/businesses/public', { limit: 8 });
        storeList = fallback?.businesses || [];
      }

      setCategories(catData?.categories || []);
      setStores(storeList);
      setRecommended(recData?.listings || []);
      setRecommendedPersonalized(!!recData?.personalized);
      setFeatured(featData?.listings || []);
      setTopRated(topData?.listings || []);
      setOrders(orderData?.orders || []);
      setOrdersTotal(orderData?.pagination?.total || 0);
      setDropOffs(dropOffData?.dropOffs || []);
      setDropOffsTotal(dropOffData?.pagination?.total || 0);
      setLoading(false);
    };

    fetchData();
    return () => { cancelled = true; };
  }, [profile]);

  const handleSearch = (e) => {
    e.preventDefault();
    const q = search.trim();
    navigate(q ? `/marketplace?search=${encodeURIComponent(q)}` : '/marketplace');
  };

  const handleAddToCart = useCallback(async (listingId) => {
    setAddingToCart(listingId);
    await addItem(listingId, 1);
    setAddingToCart(null);
  }, [addItem]);

  const firstName = profile?.first_name || 'there';

  return (
    <div className="space-y-8">
      {/* Hero: greeting + search */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary-600 via-primary-600 to-emerald-500 rounded-3xl p-6 sm:p-10 text-white shadow-lg shadow-primary-600/20">
        <div className="pointer-events-none absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 w-56 h-56 rounded-full bg-emerald-300/20 blur-3xl" />
        <p className="relative text-primary-100 text-sm font-medium">Welcome back,</p>
        <h1 className="relative text-2xl sm:text-4xl font-bold tracking-tight mt-1">{firstName}</h1>
        <p className="relative text-primary-100 mt-1 text-sm sm:text-base">
          Find recyclable materials, eco-friendly products, and local green stores.
        </p>
        <form onSubmit={handleSearch} className="mt-6 relative max-w-xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products, materials, stores..."
            className="w-full pl-11 pr-28 py-3.5 rounded-full text-gray-900 text-sm bg-white shadow-md focus:ring-2 focus:ring-white/70 outline-none"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-5 py-2 rounded-full transition-colors"
          >
            Search
          </button>
        </form>
        {/* Category chips */}
        {!loading && categories.length > 0 && (
          <div className="relative mt-4 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                to={`/marketplace?category=${cat.id}`}
                className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/25 transition-colors whitespace-nowrap"
              >
                {cat.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Recommended stores */}
      <section>
        <SectionHeader
          icon={<Store className="w-5 h-5 text-primary-600" />}
          title={profile?.latitude ? 'Recommended Stores' : 'Top Rated Stores'}
          actionTo="/establishments"
        />
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-white rounded-2xl border border-gray-200/70 animate-pulse" />
            ))}
          </div>
        ) : stores.length === 0 ? (
          <Card className="p-6 text-center text-sm text-gray-500">
            No stores available yet.
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {stores.slice(0, 4).map((biz) => (
              <StoreCard key={biz.id} business={biz} />
            ))}
          </div>
        )}
        {stores.length > 4 && (
          <div className="mt-3 text-right">
            <Link to="/establishments" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              View all stores →
            </Link>
          </div>
        )}
      </section>

      {/* Recommended for you */}
      <section>
        <SectionHeader
          icon={<Sparkles className="w-5 h-5 text-primary-600" />}
          title={recommendedPersonalized ? 'Recommended for You' : 'Popular Right Now'}
          actionTo="/marketplace"
        />
        {loading ? (
          <RowSkeleton />
        ) : recommended.length === 0 ? (
          <Card className="p-6 text-center text-sm text-gray-500">
            No products to show yet. Browse the marketplace to see more.
          </Card>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {recommended.slice(0, 4).map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                onAddToCart={handleAddToCart}
                addingToCart={addingToCart}
              />
            ))}
          </div>
        )}
        {recommended.length > 4 && (
          <div className="mt-3 text-right">
            <Link to="/marketplace" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              See more recommendations →
            </Link>
          </div>
        )}
      </section>

      {/* Featured */}
      {!loading && featured.length > 0 && (
        <section>
          <SectionHeader
            icon={<Badge variant="warning" className="text-xs">Featured</Badge>}
            title="Featured Picks"
            actionTo="/marketplace"
          />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {featured.slice(0, 4).map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                onAddToCart={handleAddToCart}
                addingToCart={addingToCart}
              />
            ))}
          </div>
        </section>
      )}

      {/* Top rated */}
      <section>
        <SectionHeader
          icon={<Leaf className="w-5 h-5 text-primary-600" />}
          title="Top Rated"
          actionTo="/marketplace?sort=rating"
        />
        {loading ? (
          <RowSkeleton />
        ) : topRated.length === 0 ? (
          <Card className="p-6 text-center text-sm text-gray-500">
            Nothing rated yet — be the first to review a product!
          </Card>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {topRated.slice(0, 4).map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                onAddToCart={handleAddToCart}
                addingToCart={addingToCart}
              />
            ))}
          </div>
        )}
      </section>

      {/* Quick actions */}
      <section>
        <SectionHeader title="Quick Actions" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {quickActions.map(action => (
            <Link
              key={action.to}
              to={action.to}
              className="flex flex-col items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-primary-200 hover:shadow-md transition-all text-center group"
            >
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${action.color}`}>
                {action.icon}
              </div>
              <span className="text-sm font-medium text-gray-700 group-hover:text-primary-600 transition-colors">{action.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* My activity — compact strips */}
      <section>
        <SectionHeader title="My Activity" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <StatCard
            icon={<ClipboardList className="w-6 h-6" />}
            label="Total Orders"
            value={String(ordersTotal)}
            change={ordersTotal > 0 ? 'View order history' : 'No orders yet'}
            changeType="neutral"
          />
          <StatCard
            icon={<Package className="w-6 h-6" />}
            label="Drop-offs"
            value={String(dropOffsTotal)}
            change={dropOffsTotal > 0 ? 'Keep it up!' : 'No drop-offs yet'}
            changeType="neutral"
          />
          <StatCard
            icon={<ShoppingBag className="w-6 h-6" />}
            label="Cart Items"
            value={String(itemCount)}
            change={itemCount > 0 ? 'Ready to checkout' : 'Browse marketplace'}
            changeType="neutral"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Orders</CardTitle>
                <Link to="/orders" className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
                  View all <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </CardHeader>
            {loading ? (
              <div className="space-y-3">
                {[...Array(2)].map((_, i) => (
                  <div key={i} className="h-16 bg-gray-50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : orders.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No orders yet. Start by browsing the marketplace.</p>
            ) : (
              <div className="space-y-3">
                {orders.map(order => (
                  <Link
                    key={order.id}
                    to={`/orders/${order.id}`}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {order.items?.[0]?.title || order.order_number}
                        {order.items?.length > 1 && ` +${order.items.length - 1} more`}
                      </p>
                      <p className="text-xs text-gray-500">{formatDate(order.created_at)}</p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <Badge variant={orderStatusVariant[order.status] || 'neutral'}>{formatStatus(order.status)}</Badge>
                      <p className="text-sm font-semibold text-gray-900 mt-1">
                        ₱{parseFloat(order.total || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Drop-offs</CardTitle>
                <Link to="/drop-offs" className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
                  View all <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </CardHeader>
            {loading ? (
              <div className="space-y-3">
                {[...Array(2)].map((_, i) => (
                  <div key={i} className="h-16 bg-gray-50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : dropOffs.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No drop-offs yet. Schedule your first recycling drop-off.</p>
            ) : (
              <div className="space-y-3">
                {dropOffs.map(d => (
                  <div key={d.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {d.business?.name || 'Establishment'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {d.reference_number} · {formatDate(d.created_at)}
                      </p>
                    </div>
                    <Badge variant={dropOffStatusVariant[d.status] || 'neutral'}>{formatDropOffStatus(d.status)}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </section>

      <BecomeBusinessCard />

      {addingToCart && (
        <div className="fixed bottom-6 right-6 bg-primary-600 text-white text-sm font-medium px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 z-50">
          <Loader2 className="w-4 h-4 animate-spin" /> Adding to cart...
        </div>
      )}
    </div>
  );
}
