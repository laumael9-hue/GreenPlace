import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ShoppingBag, Store, MapPin, Tag, Package, Minus, Plus, Loader2, Zap } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Card from '../components/ui/Card';

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
  const { isAuthenticated } = useAuth();
  const { addItem } = useCart();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [addedMessage, setAddedMessage] = useState(false);

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
            <div>
              {listing.category && (
                <Badge variant="neutral" className="mb-2">{listing.category.name}</Badge>
              )}
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{listing.title}</h1>
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
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
