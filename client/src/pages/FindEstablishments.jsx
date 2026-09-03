import { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { Search, Filter, MapPin, Star, ChevronDown, ChevronUp, X, Navigation, Store, Loader2, Maximize2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { searchAddresses } from '../lib/geocoding';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';

// ============================================================
// Leaflet Icons
// ============================================================

const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const selectedIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [30, 48],
  iconAnchor: [15, 48],
  popupAnchor: [1, -40],
  shadowSize: [48, 48],
  className: 'selected-marker',
});

const userIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  className: 'user-marker',
});

L.Marker.prototype.options.icon = defaultIcon;

// ============================================================
// Constants
// ============================================================

const CEBU_CENTER = [10.3157, 123.8854];
const DEFAULT_ZOOM = 12;
const CEBU_BOUNDS = L.latLngBounds(
  [9.8, 123.5],  // SW corner
  [11.0, 124.4]  // NE corner
);

const CATEGORIES = [
  'Recyclable Materials', 'Eco-Friendly Products', 'Composting Supplies',
  'Upcycled Goods', 'Reusable Items', 'Garden & Outdoor', 'Household', 'Electronics & Repair',
];

const CEBU_CITIES = [
  'Cebu City', 'Mandaue City', 'Lapu-Lapu City', 'Talisay City',
  'Minglanilla', 'Naga City', 'Consolacion', 'Liloan',
  'Compostela', 'Danao City', 'Tuburan', 'Carcar City',
];

// ============================================================
// Map Sub-Components
// ============================================================

function MapEventsHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng);
    },
  });
  return null;
}

function RecenterMap({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, zoom || map.getZoom());
    }
  }, [center, zoom, map]);
  return null;
}

function FitBoundsToMarkers({ businesses }) {
  const map = useMap();
  useEffect(() => {
    const coords = businesses
      .filter((b) => b.latitude && b.longitude)
      .map((b) => [parseFloat(b.latitude), parseFloat(b.longitude)]);
    if (coords.length > 1) {
      const bounds = L.latLngBounds(coords);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [businesses, map]);
  return null;
}

// ============================================================
// Main Component
// ============================================================

export default function FindEstablishments() {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [addressQuery, setAddressQuery] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const [geocoding] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [acceptsDropOffs, setAcceptsDropOffs] = useState(false);
  const [hasMarketplace, setHasMarketplace] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [mapCenter, setMapCenter] = useState(CEBU_CENTER);
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [viewMode, setViewMode] = useState('map');
  const [sortBy, setSortBy] = useState('rating');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [fitAll, setFitAll] = useState(false);
  const mapRef = useRef(null);
  const addressDebounceRef = useRef(null);
  const addressSearchRef = useRef(null);

  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = [pos.coords.latitude, pos.coords.longitude];
          setUserLocation(loc);
          setMapCenter(loc);
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []);

  // Close address suggestions on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (addressSearchRef.current && !addressSearchRef.current.contains(e.target)) {
        setShowAddressSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Fetch businesses
  const fetchBusinesses = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 50,
        ...(search && { search }),
        ...(selectedCategory && { category: selectedCategory }),
        ...(selectedCity && { city: selectedCity }),
        ...(acceptsDropOffs && { acceptsDropOffs: 'true' }),
        ...(hasMarketplace && { hasMarketplace: 'true' }),
        ...(userLocation && {
          latitude: userLocation[0],
          longitude: userLocation[1],
          radius: 50,
        }),
      };

      const endpoint = userLocation ? '/businesses/public/nearby' : '/businesses/public';
      const { data } = await api.get(endpoint, { params });

      let sorted = data.businesses || [];
      if (sortBy === 'distance' && userLocation) {
        sorted.sort((a, b) => (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity));
      } else if (sortBy === 'name') {
        sorted.sort((a, b) => a.name.localeCompare(b.name));
      }

      setBusinesses(sorted);
      setTotalPages(data.pagination?.pages || 1);
      setTotal(data.pagination?.total || 0);
    } catch (err) {
      console.error('Failed to fetch businesses:', err);
      setBusinesses([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, selectedCategory, selectedCity, acceptsDropOffs, hasMarketplace, userLocation, sortBy]);

  useEffect(() => {
    fetchBusinesses();
  }, [fetchBusinesses]);

  useEffect(() => {
    setPage(1);
  }, [search, selectedCategory, selectedCity, acceptsDropOffs, hasMarketplace, sortBy]);

  const clearFilters = () => {
    setSearch('');
    setAddressQuery('');
    setSelectedCategory('');
    setSelectedCity('');
    setAcceptsDropOffs(false);
    setHasMarketplace(false);
    setSortBy('rating');
  };

  const hasActiveFilters = selectedCategory || selectedCity || acceptsDropOffs || hasMarketplace;

  const focusOnBusiness = (biz) => {
    setSelectedBusiness(biz);
    if (biz.latitude && biz.longitude) {
      setMapCenter([parseFloat(biz.latitude), parseFloat(biz.longitude)]);
    }
  };

  const handleAddressSearch = (value) => {
    setAddressQuery(value);
    setShowAddressSuggestions(true);
    if (addressDebounceRef.current) clearTimeout(addressDebounceRef.current);
    if (value.trim().length < 3) {
      setAddressSuggestions([]);
      return;
    }
    addressDebounceRef.current = setTimeout(async () => {
      const results = await searchAddresses(value);
      setAddressSuggestions(results);
    }, 500);
  };

  const handleSelectAddress = (suggestion) => {
    setAddressQuery(suggestion.displayName);
    setShowAddressSuggestions(false);
    setAddressSuggestions([]);
    setMapCenter([suggestion.lat, suggestion.lng]);
    // Search nearby businesses
    setUserLocation([suggestion.lat, suggestion.lng]);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Find Establishments</h1>
              <p className="mt-1 text-gray-500">
                Discover waste management facilities, recycling centers, and junk shops near you
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('map')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === 'map' ? 'bg-primary-100 text-primary-700' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                <MapPin className="w-4 h-4 inline mr-1" />
                Map
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === 'list' ? 'bg-primary-100 text-primary-700' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                <Store className="w-4 h-4 inline mr-1" />
                List
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Address Search Bar */}
        <div className="mb-4">
          <div className="relative" ref={addressSearchRef}>
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
            {geocoding && (
              <Loader2 className="absolute right-10 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin z-10" />
            )}
            <input
              type="text"
              value={addressQuery}
              onChange={(e) => handleAddressSearch(e.target.value)}
              onFocus={() => setShowAddressSuggestions(true)}
              placeholder="Search location (e.g., 'Mandaue City, Cebu' or 'Colon Street, Cebu City')..."
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none shadow-sm"
            />
            {showAddressSuggestions && addressSuggestions.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                {addressSuggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSelectAddress(s)}
                    className="w-full text-left px-4 py-3 text-sm hover:bg-primary-50 border-b border-gray-100 last:border-0 flex items-start gap-2"
                  >
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <span className="line-clamp-2">{s.displayName}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search businesses, materials..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              />
            </div>
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
                  {[selectedCategory, selectedCity, acceptsDropOffs, hasMarketplace].filter(Boolean).length}
                </span>
              )}
              {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {userLocation && (
              <button
                onClick={() => setMapCenter(userLocation)}
                className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Navigation className="w-4 h-4" />
                My Location
              </button>
            )}
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <Card className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  >
                    <option value="">All Categories</option>
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  >
                    <option value="rating">Rating</option>
                    {userLocation && <option value="distance">Distance</option>}
                    <option value="name">Name</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2 justify-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={acceptsDropOffs}
                      onChange={(e) => setAcceptsDropOffs(e.target.checked)}
                      className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">Accepts Drop-offs</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasMarketplace}
                      onChange={(e) => setHasMarketplace(e.target.checked)}
                      className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">Has Marketplace</span>
                  </label>
                </div>
              </div>
              {hasActiveFilters && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <button
                    onClick={clearFilters}
                    className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    Clear all filters
                  </button>
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Results Count & Fit All */}
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {loading ? 'Searching...' : `${total} establishment${total !== 1 ? 's' : ''} found`}
          </p>
          {businesses.length > 1 && (
            <button
              onClick={() => setFitAll((f) => !f)}
              className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              {fitAll ? 'Reset View' : 'Fit All Markers'}
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Map */}
          <div className={`${viewMode === 'map' ? 'w-full' : 'w-full lg:w-1/2'} h-[500px] lg:h-[calc(100vh-300px)] rounded-xl overflow-hidden border border-gray-200 bg-white relative`}>
            <MapContainer
              center={mapCenter}
              zoom={DEFAULT_ZOOM}
              className="w-full h-full"
              ref={mapRef}
              maxBounds={CEBU_BOUNDS}
              maxBoundsViscosity={0.8}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapEventsHandler onMapClick={() => setSelectedBusiness(null)} />
              <RecenterMap center={mapCenter} zoom={14} />
              {fitAll && <FitBoundsToMarkers businesses={businesses} />}

              {/* User location marker */}
              {userLocation && (
                <Marker position={userLocation} icon={userIcon}>
                  <Popup>
                    <div className="text-center font-medium text-sm">Your Location</div>
                  </Popup>
                </Marker>
              )}

              {/* Business markers */}
              {businesses.map((biz) => (
                biz.latitude && biz.longitude && (
                  <Marker
                    key={biz.id}
                    position={[parseFloat(biz.latitude), parseFloat(biz.longitude)]}
                    icon={selectedBusiness?.id === biz.id ? selectedIcon : defaultIcon}
                    eventHandlers={{
                      click: () => focusOnBusiness(biz),
                    }}
                  >
                    <Popup maxWidth={280}>
                      <div className="p-1">
                        <div className="flex items-start gap-2 mb-2">
                          {biz.logo_url ? (
                            <img src={biz.logo_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
                          ) : (
                            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                              <Store className="w-5 h-5 text-primary-600" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 text-sm truncate">{biz.name}</h3>
                            <p className="text-xs text-gray-500 truncate">{biz.category}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                          {biz.rating_avg > 0 && (
                            <span className="flex items-center gap-1">
                              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                              {parseFloat(biz.rating_avg).toFixed(1)}
                              <span>({biz.rating_count})</span>
                            </span>
                          )}
                          {biz.distance_km != null && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {biz.distance_km} km
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {biz.accepts_drop_offs && (
                            <Badge variant="success" className="text-[10px] px-1.5 py-0.5">Drop-off</Badge>
                          )}
                          {biz.has_marketplace && (
                            <Badge variant="info" className="text-[10px] px-1.5 py-0.5">Marketplace</Badge>
                          )}
                        </div>
                        <Link
                          to={`/establishments/${biz.slug}`}
                          className="block w-full text-center text-xs bg-primary-600 text-white py-1.5 rounded-lg hover:bg-primary-700 transition-colors"
                        >
                          View Details
                        </Link>
                      </div>
                    </Popup>
                  </Marker>
                )
              ))}
            </MapContainer>

            {/* Cluster styles override */}
            <style>{`
              .user-marker {
                filter: hue-rotate(120deg);
              }
              .selected-marker {
                filter: hue-rotate(220deg) brightness(1.2);
                z-index: 1000 !important;
              }
              .leaflet-popup-content-wrapper {
                border-radius: 12px;
              }
              .leaflet-popup-content {
                margin: 8px 12px;
              }
              .marker-cluster-small {
                background-color: rgba(34, 197, 94, 0.2);
              }
              .marker-cluster-small div {
                background-color: rgba(34, 197, 94, 0.6);
              }
              .marker-cluster-medium {
                background-color: rgba(34, 197, 94, 0.3);
              }
              .marker-cluster-medium div {
                background-color: rgba(34, 197, 94, 0.7);
              }
              .marker-cluster-large {
                background-color: rgba(34, 197, 94, 0.4);
              }
              .marker-cluster-large div {
                background-color: rgba(34, 197, 94, 0.8);
              }
            `}</style>
          </div>

          {/* Business List Sidebar */}
          <div className={`${viewMode === 'map' ? 'w-full lg:w-96' : 'w-full'} space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto`}>
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
                    <div className="flex gap-3">
                      <div className="w-12 h-12 bg-gray-200 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-3/4" />
                        <div className="h-3 bg-gray-200 rounded w-1/2" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : businesses.length === 0 ? (
              <EmptyState
                icon={<Store className="w-8 h-8" />}
                title="No establishments found"
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
                {businesses.map((biz) => (
                  <div
                    key={biz.id}
                    onClick={() => focusOnBusiness(biz)}
                    className={`bg-white rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md ${
                      selectedBusiness?.id === biz.id
                        ? 'border-primary-400 ring-2 ring-primary-100'
                        : 'border-gray-200 hover:border-primary-200'
                    }`}
                  >
                    <div className="flex gap-3">
                      {biz.logo_url ? (
                        <img src={biz.logo_url} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Store className="w-6 h-6 text-primary-600" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{biz.name}</h3>
                        <p className="text-sm text-gray-500 truncate">{biz.category}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          {biz.rating_avg > 0 && (
                            <span className="flex items-center gap-1">
                              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                              {parseFloat(biz.rating_avg).toFixed(1)}
                              <span>({biz.rating_count})</span>
                            </span>
                          )}
                          {biz.distance_km != null && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {biz.distance_km} km
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex gap-1.5">
                        {biz.accepts_drop_offs && (
                          <Badge variant="success" className="text-[10px]">Drop-off</Badge>
                        )}
                        {biz.has_marketplace && (
                          <Badge variant="info" className="text-[10px]">Marketplace</Badge>
                        )}
                      </div>
                      <Link
                        to={`/establishments/${biz.slug}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                      >
                        View →
                      </Link>
                    </div>
                  </div>
                ))}

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 pt-4">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-gray-500">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
