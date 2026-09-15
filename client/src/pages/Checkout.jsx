import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import { ArrowLeft, Loader2, Package, MapPin, CreditCard, Store, AlertCircle, Navigation, Calendar } from 'lucide-react';
import api from '../lib/api';
import { useCart } from '../context/CartContext';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';

const pickupIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export default function Checkout() {
  const navigate = useNavigate();
  const { items, refresh } = useCart();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash_on_pickup');

  // Pickup date/time defaults
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 30);

  const [preferredPickupDate, setPreferredPickupDate] = useState(() => tomorrow.toISOString().split('T')[0]);
  const [preferredPickupTime, setPreferredPickupTime] = useState('morning');

  const [selectedIds] = useState(() => {
    const stored = sessionStorage.getItem('checkoutItems');
    return stored ? JSON.parse(stored) : [];
  });

  const selectedItems = useMemo(() => {
    return items.filter(item => selectedIds.includes(item.id));
  }, [items, selectedIds]);

  const storeGroups = useMemo(() => {
    const groups = {};
    selectedItems.forEach(item => {
      const listing = item.listing || {};
      const business = listing.business;
      const seller = listing.seller;
      const storeId = business?.id || seller?.id || 'unknown';
      const storeName = business?.name || (seller ? `${seller.first_name} ${seller.last_name}` : 'Unknown Seller');

      if (!groups[storeId]) {
        groups[storeId] = {
          storeId,
          storeName,
          storeAddress: business?.address || null,
          storeLatitude: business?.latitude ? parseFloat(business.latitude) : null,
          storeLongitude: business?.longitude ? parseFloat(business.longitude) : null,
          storeLogo: business?.logo_url || null,
          items: [],
          subtotal: 0,
        };
      }
      groups[storeId].items.push(item);
      if (listing.status === 'active') {
        groups[storeId].subtotal += parseFloat(listing.price || 0) * item.quantity;
      }
    });
    return Object.values(groups).map(g => ({
      ...g,
      subtotal: Math.round(g.subtotal * 100) / 100,
    }));
  }, [selectedItems]);

  const subtotal = useMemo(() => {
    return storeGroups.reduce((sum, g) => sum + g.subtotal, 0);
  }, [storeGroups]);

  const paymentOptions = [
    { value: 'cash_on_pickup', label: 'Cash on Pickup' },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (selectedItems.length === 0) {
      setError('No items selected for checkout');
      return;
    }

    setLoading(true);
    try {
      const cartItemIds = selectedItems.map(item => item.id);
      const { data } = await api.post('/orders/checkout', {
        cartItemIds,
        notes: notes.trim() || undefined,
        paymentMethod,
        preferredPickupDate,
        preferredPickupTime,
      });

      sessionStorage.removeItem('checkoutItems');
      await refresh();

      const firstOrder = data.orders?.[0];
      if (firstOrder) {
        navigate(`/orders/${firstOrder.id}/success`, { state: { order: firstOrder } });
      } else {
        navigate('/orders');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to place order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (selectedItems.length === 0 && items.length > 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Card>
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">No items selected</h2>
              <p className="text-gray-500 mb-6">Go back to your cart and select items to checkout.</p>
              <Link to="/cart">
                <Button>Back to Cart</Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Card>
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">Your cart is empty</h2>
              <p className="text-gray-500 mb-6">Browse the marketplace to find items.</p>
              <Link to="/marketplace">
                <Button>Browse Marketplace</Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link to="/cart" className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to Cart
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Checkout</h1>
          <p className="mt-1 text-gray-500">Review your order and confirm pickup details</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              {/* Payment Method */}
              <Card>
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-primary-600" />
                  Payment Method
                </h2>
                <Select
                  options={paymentOptions}
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                />
                <p className="mt-2 text-xs text-gray-500">
                  Pay with cash when you pick up your order from the seller.
                </p>
              </Card>

              {/* Preferred Pickup Date & Time */}
              <Card>
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary-600" />
                  Preferred Pickup Date & Time
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pickup Date</label>
                    <input
                      type="date"
                      value={preferredPickupDate}
                      min={tomorrow.toISOString().split('T')[0]}
                      max={maxDate.toISOString().split('T')[0]}
                      onChange={(e) => setPreferredPickupDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pickup Time</label>
                    <select
                      value={preferredPickupTime}
                      onChange={(e) => setPreferredPickupTime(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="morning">Morning (8:00 AM - 12:00 PM)</option>
                      <option value="afternoon">Afternoon (1:00 PM - 5:00 PM)</option>
                      <option value="evening">Evening (6:00 PM - 9:00 PM)</option>
                    </select>
                  </div>
                </div>
                <p className="mt-3 text-xs text-gray-500">
                  Select a date and time range for pickup. The seller will confirm availability.
                </p>
              </Card>

              {/* Notes */}
              <Card>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Notes (optional)</h2>
                <Input
                  placeholder="Special instructions, contact number, or landmark"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </Card>

              {/* Pickup Location + Items by Store */}
              {storeGroups.map(group => (
                <div key={group.storeId} className="space-y-4">
                  {/* Pickup Location Card */}
                  <Card className="overflow-hidden">
                    <div className="px-6 pt-5 pb-3">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                          <MapPin className="w-4 h-4 text-primary-600" />
                        </div>
                        <h2 className="text-base font-semibold text-gray-900">Pickup Location</h2>
                      </div>
                      <div className="flex items-center gap-3">
                        {group.storeLogo ? (
                          <img src={group.storeLogo} alt="" className="w-10 h-10 rounded-lg object-cover border border-gray-200" />
                        ) : (
                          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                            <Store className="w-5 h-5 text-gray-400" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900">{group.storeName}</p>
                          {group.storeAddress && (
                            <p className="text-xs text-gray-500 truncate">{group.storeAddress}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Map */}
                    {group.storeLatitude && group.storeLongitude ? (
                      <div className="h-48 relative">
                        <MapContainer
                          center={[group.storeLatitude, group.storeLongitude]}
                          zoom={15}
                          className="w-full h-full"
                          zoomControl={false}
                          attributionControl={false}
                        >
                          <TileLayer
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          />
                          <Marker
                            position={[group.storeLatitude, group.storeLongitude]}
                            icon={pickupIcon}
                          />
                        </MapContainer>
                      </div>
                    ) : (
                      <div className="h-32 bg-gray-100 flex items-center justify-center">
                        <div className="text-center">
                          <MapPin className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                          <p className="text-xs text-gray-400">{group.storeAddress || 'No location available'}</p>
                        </div>
                      </div>
                    )}

                    {/* Directions Button */}
                    {group.storeAddress && (
                      <div className="px-6 py-3 border-t border-gray-100">
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(group.storeAddress)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700"
                        >
                          <Navigation className="w-4 h-4" />
                          Get Directions
                        </a>
                      </div>
                    )}
                  </Card>

                  {/* Store Items */}
                  <Card>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                        <Store className="w-4 h-4 text-gray-500" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900">{group.storeName}</h3>
                        <p className="text-xs text-gray-500">{group.items.length} {group.items.length === 1 ? 'item' : 'items'}</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {group.items.map(item => {
                        const listing = item.listing || {};
                        return (
                          <div key={item.id} className="flex gap-3">
                            <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                              {listing.primary_image ? (
                                <img src={listing.primary_image} alt={listing.title} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Package className="w-5 h-5 text-gray-300" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{listing.title}</p>
                              <p className="text-xs text-gray-500">Qty: {item.quantity} x ₱{parseFloat(listing.price || 0).toLocaleString('en-PH')}</p>
                            </div>
                            <p className="text-sm font-bold text-gray-900 flex-shrink-0">
                              ₱{(parseFloat(listing.price || 0) * item.quantity).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-end">
                      <span className="text-sm text-gray-500">Store Subtotal:</span>
                      <span className="ml-2 text-sm font-bold text-gray-900">
                        ₱{group.subtotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </Card>
                </div>
              ))}
            </div>

            {/* Order Summary Sidebar */}
            <div className="lg:col-span-1">
              <Card className="sticky top-24">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h2>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal ({selectedItems.length} items)</span>
                    <span className="font-medium text-gray-900">₱{subtotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Shipping</span>
                    <span className="text-green-600 font-medium">Free (Pickup)</span>
                  </div>
                  <div className="border-t border-gray-200 pt-3">
                    <div className="flex justify-between">
                      <span className="text-base font-semibold text-gray-900">Total</span>
                      <span className="text-base font-bold text-primary-600">₱{subtotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-6">
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Placing Order...
                      </>
                    ) : (
                      'Place Order'
                    )}
                  </Button>
                </div>
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 text-center">
                    Pick up your order at the store location shown above. Bring your order number.
                  </p>
                </div>
              </Card>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
