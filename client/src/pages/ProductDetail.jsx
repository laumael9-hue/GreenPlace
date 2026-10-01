import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ShoppingBag, Store, MapPin, Tag, Package, Minus, Plus, Loader2, Zap, Flag, Mail, Star } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import StarRating from '../components/ui/StarRating';
import ReviewSummary from '../components/reviews/ReviewSummary';
import ReviewCard from '../components/reviews/ReviewCard';
import ReviewModal from '../components/reviews/ReviewModal';

const CONDITION_LABELS = {
  new: 'New',
  like_new: 'Like New',
  good: 'Good',
  fair: 'Fair',
  used: 'Used',
};

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { addItem } = useCart();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [addedMessage, setAddedMessage] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [reportError, setReportError] = useState('');
  const [reporting, setReporting] = useState(false);
  const [messageError, setMessageError] = useState('');
  const [messaging, setMessaging] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [reviewsSummary, setReviewsSummary] = useState(null);
  const [myReview, setMyReview] = useState(null);
  const [reviewsPagination, setReviewsPagination] = useState({ page: 1, limit: 5, total: 0, pages: 0 });
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);

  useEffect(() => {
    const fetchListing = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await api.get(`/marketplace/listings/slug/${slug}`);
        setListing(data.listing);
      } catch (err) {
        setError(err.response?.data?.error || 'Listing not found');
      } finally {
        setLoading(false);
      }
    };
    fetchListing();
  }, [slug]);

  const fetchReviews = useCallback(async (listingId, page = 1) => {
    if (!listingId) return;
    setReviewsLoading(true);
    try {
      const { data } = await api.get(`/reviews/listing/${listingId}`, {
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
    if (listing?.id) fetchReviews(listing.id, 1);
  }, [listing?.id, fetchReviews]);

  const handleReviewClick = () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    setShowReviewModal(true);
  };

  const handleReviewSaved = () => {
    fetchReviews(listing?.id, reviewsPagination.page);
  };

  const handleAddToCart = async () => {
    if (!isAuthenticated) {
      window.location.href = '/login';
      return;
    }
    setAddingToCart(true);
    const result = await addItem(listing.id, quantity);
    setAddingToCart(false);
    if (result.success) {
      setAddedMessage(true);
      setTimeout(() => setAddedMessage(false), 2000);
    }
  };

  const handleBuyNow = async () => {
    if (!isAuthenticated) {
      window.location.href = '/login';
      return;
    }
    setAddingToCart(true);
    const result = await addItem(listing.id, quantity);
    setAddingToCart(false);
    if (result.success && result.cartItem) {
      sessionStorage.setItem('checkoutItems', JSON.stringify([result.cartItem.id]));
      navigate('/checkout');
    }
  };

  const handleMessageSeller = async () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    setMessaging(true);
    setMessageError('');
    try {
      const { data } = await api.post('/messages/conversations', { recipientId: seller.id });
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

  const openReport = () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
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
        targetId: listing.id,
        reason: reportReason.trim(),
        description: reportDescription.trim() || undefined,
      });
      setShowReport(false);
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

  const images = listing?.listing_images || [];
  const seller = listing?.seller;
  const business = listing?.business;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">Product Not Found</h1>
          <p className="mt-2 text-gray-500">{error}</p>
          <Link to="/marketplace" className="mt-6 inline-block">
            <Button>Back to Marketplace</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <nav className="flex items-center gap-2 text-sm text-gray-500">
            <Link to="/marketplace" className="hover:text-primary-600 transition-colors">Marketplace</Link>
            <span>/</span>
            {listing.category && (
              <>
                <Link
                  to={`/marketplace?category=${listing.category.id}`}
                  className="hover:text-primary-600 transition-colors"
                >
                  {listing.category.name}
                </Link>
                <span>/</span>
              </>
            )}
            <span className="text-gray-900 truncate">{listing.title}</span>
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Image Gallery */}
          <div>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="relative aspect-square bg-gray-100">
                {images.length > 0 ? (
                  <>
                    <img
                      src={images[selectedImage]?.image_url}
                      alt={listing.title}
                      className="w-full h-full object-contain"
                    />
                    {images.length > 1 && (
                      <>
                        <button
                          onClick={() => setSelectedImage(i => i > 0 ? i - 1 : images.length - 1)}
                          className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow hover:bg-white transition-colors"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => setSelectedImage(i => i < images.length - 1 ? i + 1 : 0)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow hover:bg-white transition-colors"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-24 h-24 text-gray-300" />
                  </div>
                )}
              </div>
            </div>

            {/* Thumbnail Strip */}
            {images.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
                {images.map((img, i) => (
                  <button
                    key={img.id}
                    onClick={() => setSelectedImage(i)}
                    className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                      selectedImage === i ? 'border-primary-500' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <img src={img.image_url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                {listing.category && (
                  <Badge variant="neutral" className="mb-2">{listing.category.name}</Badge>
                )}
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{listing.title}</h1>
                <div className="flex items-center gap-2 mt-2">
                  <StarRating value={parseFloat(listing.rating_avg) || 0} size="sm" />
                  <span className="text-sm font-medium text-gray-700">
                    {(parseFloat(listing.rating_avg) || 0).toFixed(1)}
                  </span>
                  <span className="text-sm text-gray-500">
                    ({listing.rating_count || 0} review{listing.rating_count === 1 ? '' : 's'})
                  </span>
                </div>
              </div>
              {(!user || listing.seller?.id !== user.id) && (
                <button
                  onClick={openReport}
                  className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-orange-500 transition-colors mt-1"
                >
                  <Flag className="w-4 h-4" />
                  Report
                </button>
              )}
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-primary-600">
                ₱{parseFloat(listing.price).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </span>
              {listing.original_price && parseFloat(listing.original_price) > listing.price && (
                <span className="text-lg text-gray-400 line-through">
                  ₱{parseFloat(listing.original_price).toLocaleString('en-PH')}
                </span>
              )}
              {listing.unit && listing.unit !== 'piece' && (
                <span className="text-sm text-gray-500">/ {listing.unit}</span>
              )}
            </div>

            {/* Meta */}
            <div className="flex flex-wrap gap-3">
              {listing.condition && (
                <div className="flex items-center gap-1.5 text-sm text-gray-600">
                  <Tag className="w-4 h-4" />
                  {CONDITION_LABELS[listing.condition] || listing.condition}
                </div>
              )}
              {listing.quantity_available > 0 ? (
                <div className="flex items-center gap-1.5 text-sm text-green-600">
                  <Package className="w-4 h-4" />
                  {listing.quantity_available} available
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-sm text-red-600">
                  <Package className="w-4 h-4" />
                  Out of stock
                </div>
              )}
              {listing.city && (
                <div className="flex items-center gap-1.5 text-sm text-gray-600">
                  <MapPin className="w-4 h-4" />
                  {listing.city}
                </div>
              )}
              {listing.view_count > 0 && (
                <span className="text-sm text-gray-400">{listing.view_count} views</span>
              )}
            </div>

            {/* Description */}
            <Card>
              <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
              <p className="text-gray-600 whitespace-pre-wrap">{listing.description}</p>
              {listing.material_type && (
                <p className="mt-3 text-sm text-gray-500">
                  <span className="font-medium">Material:</span> {listing.material_type}
                </p>
              )}
              {listing.weight_kg && (
                <p className="text-sm text-gray-500">
                  <span className="font-medium">Weight:</span> {listing.weight_kg} kg
                </p>
              )}
            </Card>

            {/* Quantity & Add to Cart */}
            {listing.quantity_available > 0 && (
              <Card>
                <div className="flex items-center gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setQuantity(q => Math.max(1, q - 1))}
                        className="w-9 h-9 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition-colors"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-12 text-center font-medium">{quantity}</span>
                      <button
                        onClick={() => setQuantity(q => Math.min(listing.quantity_available, q + 1))}
                        className="w-9 h-9 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-500 mb-1">
                      Subtotal: <span className="font-semibold text-gray-900">
                        ₱{(parseFloat(listing.price) * quantity).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex gap-3">
                  <Button
                    className="flex-1"
                    onClick={handleAddToCart}
                    disabled={addingToCart}
                  >
                    {addingToCart ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ShoppingBag className="w-4 h-4" />
                    )}
                    {addedMessage ? 'Added to Cart!' : 'Add to Cart'}
                  </Button>
                  <Button
                    className="flex-1"
                    variant="primary"
                    onClick={handleBuyNow}
                    disabled={addingToCart}
                  >
                    <Zap className="w-4 h-4" />
                    Buy Now
                  </Button>
                </div>
              </Card>
            )}

            {/* Seller Info */}
            {(business || seller) && (
              <Card>
                <h3 className="font-semibold text-gray-900 mb-3">
                  {business ? 'Seller Business' : 'Seller'}
                </h3>
                <div className="flex items-center gap-3">
                  {business?.logo_url ? (
                    <img src={business.logo_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
                  ) : seller?.avatar_url ? (
                    <img src={seller.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                      <Store className="w-6 h-6 text-primary-600" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    {business ? (
                      <>
                        <Link
                          to={`/establishments/${business.slug}`}
                          className="font-medium text-gray-900 hover:text-primary-600 transition-colors"
                        >
                          {business.name}
                        </Link>
                        {business.address && (
                          <p className="text-sm text-gray-500 truncate">{business.address}</p>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="font-medium text-gray-900">
                          {seller?.first_name} {seller?.last_name}
                        </p>
                        {seller?.city && (
                          <p className="text-sm text-gray-500">{seller.city}</p>
                        )}
                      </>
                    )}
                  </div>
                  {business && (
                    <Link
                      to={`/establishments/${business.slug}`}
                      className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                    >
                      View →
                    </Link>
                  )}
                </div>
                {seller && (!user || seller.id !== user.id) && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={handleMessageSeller}
                      disabled={messaging}
                    >
                      {messaging ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Mail className="w-4 h-4" />
                      )}
                      Message Seller
                    </Button>
                    {messageError && (
                      <p className="text-xs text-red-600 mt-2">{messageError}</p>
                    )}
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>

        {/* Reviews */}
        <div className="mt-8">
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
                      No reviews yet. Be the first to review this product.
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
                      onClick={() => fetchReviews(listing.id, reviewsPagination.page - 1)}
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
                      onClick={() => fetchReviews(listing.id, reviewsPagination.page + 1)}
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
        </div>
      </div>

      <ReviewModal
        open={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        listingId={listing.id}
        businessName={listing.title}
        existingReview={myReview}
        onSaved={handleReviewSaved}
      />

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
