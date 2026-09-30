import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { ArrowLeft, Star, MapPin, Phone, Globe, Clock, Package, Store, Navigation, ExternalLink, Mail, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import Badge from '../components/ui/Badge';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import ReviewSummary from '../components/reviews/ReviewSummary';
import ReviewCard from '../components/reviews/ReviewCard';
import ReviewModal from '../components/reviews/ReviewModal';

const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function BusinessDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [messaging, setMessaging] = useState(false);
  const [messageError, setMessageError] = useState('');
  const [reviews, setReviews] = useState([]);
  const [reviewsSummary, setReviewsSummary] = useState(null);
  const [myReview, setMyReview] = useState(null);
  const [reviewsPagination, setReviewsPagination] = useState({ page: 1, limit: 5, total: 0, pages: 0 });
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);

  const fetchReviews = useCallback(async (businessId, page = 1) => {
    if (!businessId) return;
    setReviewsLoading(true);
    try {
      const { data } = await api.get(`/reviews/business/${businessId}`, {
        params: { page, limit: 5 },
      });
      setReviews(data.reviews || []);
      setReviewsSummary(data.summary);
      setMyReview(data.myReview);
      setReviewsPagination(data.pagination);
    } catch (err) {
      console.error('Error fetching reviews:', err);
    } finally {
      setReviewsLoading(false);
    }
  }, []);

  useEffect(() => {
    const fetchBusiness = async () => {
      try {
        const { data } = await api.get(`/businesses/public/slug/${slug}`);
        setBusiness(data.business);
      } catch (err) {
        setError(err.response?.data?.error || 'Business not found');
      } finally {
        setLoading(false);
      }
    };
    fetchBusiness();
  }, [slug]);

  const handleMessageBusiness = async () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    setMessaging(true);
    setMessageError('');
    try {
      const { data } = await api.post('/messages/conversations', { businessId: business.id });
      navigate(`/dashboard/messages/${data.conversation.id}`);
    } catch (err) {
      if (err?.response?.status === 401) {
        navigate('/login');
        return;
      }
      setMessageError(err?.response?.data?.error || 'Failed to start conversation');
    } finally {
      setMessaging(false);
    }
  };

  useEffect(() => {
    if (business?.id) fetchReviews(business.id, 1);
  }, [business?.id, fetchReviews]);

  const handleReviewClick = () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    setShowReviewModal(true);
  };

  const handleReviewSaved = () => {
    fetchReviews(business?.id, reviewsPagination.page);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-48" />
            <div className="h-64 bg-gray-200 rounded-xl" />
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !business) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Store className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Business Not Found</h1>
          <p className="text-gray-500 mb-6">{error || 'This business does not exist or is no longer available.'}</p>
          <Link to="/establishments" className="text-primary-600 hover:text-primary-700 font-medium">
            ← Back to Establishments
          </Link>
        </div>
      </div>
    );
  }

  const hasLocation = business.latitude && business.longitude;
  const lat = hasLocation ? parseFloat(business.latitude) : null;
  const lng = hasLocation ? parseFloat(business.longitude) : null;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back link */}
        <Link to="/establishments" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to Establishments
        </Link>

        {/* Header */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
          {business.cover_image_url && (
            <img src={business.cover_image_url} alt="" className="w-full h-48 object-cover" />
          )}
          <div className="p-6">
            <div className="flex items-start gap-4">
              {business.logo_url ? (
                <img src={business.logo_url} alt="" className="w-16 h-16 rounded-xl object-cover" />
              ) : (
                <div className="w-16 h-16 bg-primary-100 rounded-xl flex items-center justify-center">
                  <Store className="w-8 h-8 text-primary-600" />
                </div>
              )}
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-gray-900">{business.name}</h1>
                <p className="text-gray-500 mt-1">{business.category}</p>
                <div className="flex items-center gap-4 mt-2">
                  {business.rating_avg > 0 && (
                    <span className="flex items-center gap-1 text-sm">
                      <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                      {parseFloat(business.rating_avg).toFixed(1)}
                      <span className="text-gray-400">({business.rating_count} reviews)</span>
                    </span>
                  )}
                  <div className="flex gap-1.5">
                    {business.accepts_drop_offs && <Badge variant="success">Accepts Drop-offs</Badge>}
                    {business.has_marketplace && <Badge variant="info">Has Marketplace</Badge>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            {business.description && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">About</h2>
                <p className="text-gray-600 whitespace-pre-line">{business.description}</p>
              </Card>
            )}

            {/* Materials */}
            {business.materials && business.materials.length > 0 && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">
                  <Package className="w-5 h-5 inline mr-2 text-primary-600" />
                  Materials
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {business.materials.map((mat) => (
                    <div key={mat.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <span className="font-medium text-gray-900">{mat.material_name}</span>
                        {mat.description && (
                          <p className="text-xs text-gray-500 mt-0.5">{mat.description}</p>
                        )}
                      </div>
                      {mat.price_per_kg && (
                        <span className="text-sm font-semibold text-primary-600">
                          ₱{parseFloat(mat.price_per_kg).toFixed(2)}/{mat.unit || 'kg'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Reviews */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4 gap-3">
                <h2 className="text-lg font-semibold text-gray-900">
                  <Star className="w-5 h-5 inline mr-2 text-yellow-400" />
                  Reviews
                </h2>
                <Button size="sm" variant={myReview ? 'outline' : 'primary'} onClick={handleReviewClick}>
                  {myReview ? 'Edit Your Review' : 'Write a Review'}
                </Button>
              </div>

              {reviewsLoading && reviews.length === 0 ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
                </div>
              ) : (
                <>
                  <ReviewSummary summary={reviewsSummary} />

                  <div className="mt-4 pt-2 border-t border-gray-100">
                    {reviews.length === 0 ? (
                      <p className="text-sm text-gray-500 py-4 text-center">
                        No reviews yet. Be the first to share your experience.
                      </p>
                    ) : (
                      reviews.map((review) => <ReviewCard key={review.id} review={review} />)
                    )}
                  </div>

                  {reviewsPagination.pages > 1 && (
                    <div className="flex items-center justify-between pt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchReviews(business.id, reviewsPagination.page - 1)}
                        disabled={reviewsPagination.page <= 1 || reviewsLoading}
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Previous
                      </Button>
                      <span className="text-sm text-gray-500">
                        Page {reviewsPagination.page} of {reviewsPagination.pages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchReviews(business.id, reviewsPagination.page + 1)}
                        disabled={reviewsPagination.page >= reviewsPagination.pages || reviewsLoading}
                      >
                        Next
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </Card>

            {/* Map */}
            {hasLocation && (
              <Card className="overflow-hidden">
                <div className="p-6 pb-3">
                  <h2 className="text-lg font-semibold text-gray-900">
                    <MapPin className="w-5 h-5 inline mr-2 text-primary-600" />
                    Location
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">{business.address}{business.city ? `, ${business.city}` : ''}</p>
                </div>
                <div className="h-64">
                  <MapContainer center={[lat, lng]} zoom={15} className="w-full h-full">
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <Marker position={[lat, lng]}>
                      <Popup>{business.name}</Popup>
                    </Marker>
                  </MapContainer>
                </div>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Contact */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact</h2>
              <div className="space-y-3">
                {business.address && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                    <span className="text-sm text-gray-600">{business.address}{business.city ? `, ${business.city}` : ''}{business.province ? `, ${business.province}` : ''}</span>
                  </div>
                )}
                {business.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <a href={`tel:${business.phone}`} className="text-sm text-primary-600 hover:text-primary-700">{business.phone}</a>
                  </div>
                )}
                {business.email && (
                  <div className="flex items-center gap-3">
                    <Globe className="w-4 h-4 text-gray-400" />
                    <a href={`mailto:${business.email}`} className="text-sm text-primary-600 hover:text-primary-700">{business.email}</a>
                  </div>
                )}
                {business.website && (
                  <div className="flex items-center gap-3">
                    <ExternalLink className="w-4 h-4 text-gray-400" />
                    <a href={business.website} target="_blank" rel="noopener noreferrer" className="text-sm text-primary-600 hover:text-primary-700">
                      Visit Website
                    </a>
                  </div>
                )}
                {hasLocation && (
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 mt-2 text-sm text-primary-600 hover:text-primary-700"
                  >
                    <Navigation className="w-4 h-4" />
                    Open in Maps
                  </a>
                )}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={handleMessageBusiness}
                  disabled={messaging}
                >
                  {messaging ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Mail className="w-4 h-4" />
                  )}
                  Message Business
                </Button>
                {messageError && (
                  <p className="text-xs text-red-600 mt-2">{messageError}</p>
                )}
              </div>
            </Card>

            {/* Hours */}
            {business.hours && business.hours.length > 0 && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  <Clock className="w-5 h-5 inline mr-2 text-primary-600" />
                  Business Hours
                </h2>
                <div className="space-y-2">
                  {DAYS.map((day) => {
                    const hours = business.hours.find(h => h.day.toLowerCase() === day.toLowerCase());
                    return (
                      <div key={day} className="flex justify-between text-sm">
                        <span className="text-gray-600">{day}</span>
                        {hours?.is_closed ? (
                          <span className="text-red-500">Closed</span>
                        ) : hours?.open_time && hours?.close_time ? (
                          <span className="text-gray-900">
                            {hours.open_time.slice(0, 5)} – {hours.close_time.slice(0, 5)}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* Stats */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Stats</h2>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total Drop-offs</span>
                  <span className="font-medium text-gray-900">{business.total_drop_offs || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total Orders</span>
                  <span className="font-medium text-gray-900">{business.total_orders || 0}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      <ReviewModal
        open={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        businessId={business.id}
        businessName={business.name}
        existingReview={myReview}
        onSaved={handleReviewSaved}
      />
    </div>
  );
}
