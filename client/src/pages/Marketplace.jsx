import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Filter, ChevronDown, ChevronUp, X, ShoppingBag, Loader2, Flag } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import ListingCard from '../components/marketplace/ListingCard';

const CEBU_CITIES = [
  'Cebu City', 'Mandaue City', 'Lapu-Lapu City', 'Talisay City',
  'Minglanilla', 'Naga City', 'Consolacion', 'Liloan',
  'Compostela', 'Danao City', 'Tuburan', 'Carcar City',
];

const CONDITIONS = ['new', 'like_new', 'good', 'fair', 'used'];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'popular', label: 'Most Popular' },
  { value: 'rating', label: 'Top Rated' },
];

const CONDITION_LABELS = {
  new: 'New',
  like_new: 'Like New',
  good: 'Good',
  fair: 'Fair',
  used: 'Used',
};

export default function Marketplace() {
  const { isAuthenticated, user } = useAuth();
  const { addItem } = useCart();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [listings, setListings] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(() => searchParams.get('search') || '');
  const [selectedCategory, setSelectedCategory] = useState(() => searchParams.get('category') || '');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedCondition, setSelectedCondition] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sortBy, setSortBy] = useState(() => searchParams.get('sort') || 'newest');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [addingToCart, setAddingToCart] = useState(null);
  const debounceRef = useRef(null);
  const [showReport, setShowReport] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [reportError, setReportError] = useState('');
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { data } = await api.get('/marketplace/categories');
        setCategories(data.categories || []);
      } catch (err) {
        console.error('Failed to fetch categories:', err);
      }
    };
    fetchCategories();
  }, []);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 20,
        ...(search && { search }),
        ...(selectedCategory && { category: selectedCategory }),
        ...(selectedCity && { city: selectedCity }),
        ...(selectedCondition && { condition: selectedCondition }),
        ...(minPrice && { minPrice }),
        ...(maxPrice && { maxPrice }),
        sort: sortBy,
      };

      const { data } = await api.get('/marketplace/listings', { params });
      setListings(data.listings || []);
      setTotalPages(data.pagination?.pages || 1);
      setTotal(data.pagination?.total || 0);
    } catch (err) {
      console.error('Failed to fetch listings:', err);
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, selectedCategory, selectedCity, selectedCondition, minPrice, maxPrice, sortBy]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  useEffect(() => {
    setPage(1);
  }, [search, selectedCategory, selectedCity, selectedCondition, minPrice, maxPrice, sortBy]);

  const handleSearch = (value) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {}, 300);
  };

  const clearFilters = () => {
    setSearch('');
    setSelectedCategory('');
    setSelectedCity('');
    setSelectedCondition('');
    setMinPrice('');
    setMaxPrice('');
    setSortBy('newest');
  };

  const hasActiveFilters = selectedCategory || selectedCity || selectedCondition || minPrice || maxPrice;

  const handleAddToCart = async (listingId) => {
    if (!isAuthenticated) {
      window.location.href = '/login';
      return;
    }
    setAddingToCart(listingId);
    await addItem(listingId, 1);
    setAddingToCart(null);
  };

  const openReport = (listingId) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    setReportTarget(listingId);
    setReportReason('');
    setReportDescription('');
    setReportError('');
    setShowReport(true);
  };

  const handleReport = async (e) => {
    e.preventDefault();
    if (!reportReason.trim()) return;
    setReporting(true);
    setReportError('');
    try {
      await api.post('/forum/report', {
        targetType: 'listing',
        targetId: reportTarget,
        reason: reportReason.trim(),
        description: reportDescription.trim() || undefined,
      });
      setShowReport(false);
      setReportTarget(null);
    } catch (err) {
      if (err?.response?.status === 401) {
        navigate('/login');
        return;
      }
      setReportError(err?.response?.data?.error || 'Failed to submit report. Please try again.');
    } finally {
      setReporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Gradient hero — heading, search bar, category chips */}
      <div className="relative bg-gradient-to-r from-primary-600 to-emerald-500 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.12)_0%,transparent_60%)] pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <div className="text-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Marketplace</h1>
            <p className="mt-1 text-white/80 text-sm sm:text-base">
              Browse recyclable materials and eco-friendly products from local sellers
            </p>
          </div>

          {/* Prominent rounded search bar */}
          <div className="max-w-2xl mx-auto mb-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search products, materials..."
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 rounded-full shadow-lg border-0 focus:ring-2 focus:ring-white/50 outline-none text-gray-800 bg-white placeholder-gray-400 text-sm sm:text-base"
              />
            </div>
          </div>

          {/* Category chips — active = white fill, inactive = frosted */}
          <div>
            <div className="flex gap-2 justify-center flex-wrap">
              <button
                onClick={() => setSelectedCategory('')}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  !selectedCategory
                    ? 'bg-white text-primary-700'
                    : 'bg-white/20 text-white border border-white/30 hover:bg-white/30'
                }`}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(selectedCategory === cat.id ? '' : cat.id)}
                  className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                    selectedCategory === cat.id
                      ? 'bg-white text-primary-700'
                      : 'bg-white/20 text-white border border-white/30 hover:bg-white/30'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* Filter Bar */}
        <div className="mb-6">
          <div className="flex justify-end">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg font-medium transition-colors ${
                hasActiveFilters
                  ? 'border-primary-300 bg-primary-50 text-primary-700'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
              {hasActiveFilters && (
                <span className="w-5 h-5 bg-primary-600 text-white text-xs rounded-full flex items-center justify-center">
                  {[selectedCategory, selectedCity, selectedCondition, minPrice, maxPrice].filter(Boolean).length}
                </span>
              )}
              {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <Card className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <select
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  >
                    <option value="">All Cities</option>
                    {CEBU_CITIES.map((city) => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
                  <select
                    value={selectedCondition}
                    onChange={(e) => setSelectedCondition(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  >
                    <option value="">Any Condition</option>
                    {CONDITIONS.map((c) => (
                      <option key={c} value={c}>{CONDITION_LABELS[c]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Price (PHP)</label>
                  <input
                    type="number"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    placeholder="0"
                    min="0"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Price (PHP)</label>
                  <input
                    type="number"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    placeholder="No limit"
                    min="0"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  />
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <label className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">Sort by:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  >
                    {SORT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </label>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    Clear all filters
                  </button>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* Results Count */}
        <div className="mb-4">
          <p className="text-sm text-gray-500">
            {loading ? 'Searching...' : `${total} product${total !== 1 ? 's' : ''} found`}
          </p>
        </div>

        {/* Listings Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-pulse">
                <div className="h-48 bg-gray-200" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                  <div className="h-6 bg-gray-200 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : listings.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag className="w-8 h-8" />}
            title="No products found"
            description="Try adjusting your filters or search terms."
            action={
              hasActiveFilters ? (
                <Button variant="secondary" size="sm" onClick={clearFilters}>
                  Clear Filters
                </Button>
              ) : null
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {listings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  onAddToCart={handleAddToCart}
                  addingToCart={addingToCart}
                  onReport={openReport}
                  currentUser={user}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-8">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-500">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <Modal open={showReport} onClose={() => setShowReport(false)} title="Report Listing">
        <form onSubmit={handleReport} className="space-y-4">
          {reportError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {reportError}
            </p>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
            <select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              required
            >
              <option value="">Select a reason...</option>
              <option value="spam">Spam</option>
              <option value="harassment">Harassment</option>
              <option value="misinformation">Misinformation</option>
              <option value="inappropriate">Inappropriate Content</option>
              <option value="off-topic">Off-Topic</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Additional Details (optional)</label>
            <textarea
              value={reportDescription}
              onChange={(e) => setReportDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="Provide more context..."
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setShowReport(false)}>Cancel</Button>
            <Button type="submit" variant="danger" disabled={reporting || !reportReason.trim()}>
              {reporting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Flag className="w-4 h-4 mr-2" />}
              Submit Report
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

