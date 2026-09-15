import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Package, MapPin, CreditCard, Clock,
  CheckCircle, XCircle, AlertCircle, Store, Phone
} from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import Badge from '../components/ui/Badge';
import Card, { CardHeader, CardTitle } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';

const statusConfig = {
  pending: { variant: 'warning', label: 'Pending', icon: Clock },
  confirmed: { variant: 'info', label: 'Confirmed', icon: CheckCircle },
  processing: { variant: 'info', label: 'Processing', icon: Loader2 },
  ready_for_pickup: { variant: 'purple', label: 'Ready for Pickup', icon: Package },
  completed: { variant: 'success', label: 'Completed', icon: CheckCircle },
  cancelled: { variant: 'danger', label: 'Cancelled', icon: XCircle },
};

const statusTimeline = ['pending', 'confirmed', 'processing', 'ready_for_pickup', 'completed'];

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const { data } = await api.get(`/orders/${id}`);
        setOrder(data.order);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load order');
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [id]);

  const handleStatusUpdate = async (newStatus) => {
    setActionLoading(true);
    try {
      await api.patch(`/orders/${id}/status`, { status: newStatus });
      const { data } = await api.get(`/orders/${id}`);
      setOrder(data.order);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    setActionLoading(true);
    try {
      await api.post(`/orders/${id}/cancel`, { cancellation_reason: cancelReason || undefined });
      const { data } = await api.get(`/orders/${id}`);
      setOrder(data.order);
      setShowCancelModal(false);
      setCancelReason('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to cancel order');
    } finally {
      setActionLoading(false);
    }
  };

  const getNextStatus = (currentStatus) => {
    const map = {
      pending: 'confirmed',
      confirmed: 'processing',
      processing: 'ready_for_pickup',
      ready_for_pickup: 'completed',
    };
    return map[currentStatus];
  };

  const canCancel = order && ['pending', 'confirmed', 'processing'].includes(order.status);
  const canUpdateStatus = role === 'business' && order && getNextStatus(order.status);
  const currentStepIndex = statusTimeline.indexOf(order?.status);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md mx-4">
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-red-300 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Error</h2>
            <p className="text-gray-500 mb-6">{error}</p>
            <Button onClick={() => navigate('/orders')}>Back to Orders</Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!order) return null;

  const statusInfo = statusConfig[order.status] || statusConfig.pending;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link to={role === 'business' ? '/dashboard/orders' : '/orders'} className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to Orders
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Order #{order.order_number}</h1>
              <p className="text-sm text-gray-500 mt-1">
                Placed on {new Date(order.created_at).toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            <Badge variant={statusInfo.variant} className="text-sm px-3 py-1">
              {statusInfo.label}
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Status Timeline */}
        {order.status !== 'cancelled' && (
          <Card className="mb-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Order Progress</h3>
            <div className="flex items-center justify-between">
              {statusTimeline.map((step, index) => {
                const isCompleted = index <= currentStepIndex;
                const isCurrent = index === currentStepIndex;
                return (
                  <div key={step} className="flex-1 flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      isCompleted ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-500'
                    } ${isCurrent ? 'ring-2 ring-primary-200' : ''}`}>
                      {isCompleted ? <CheckCircle className="w-4 h-4" /> : index + 1}
                    </div>
                    <span className={`text-xs mt-2 text-center ${isCompleted ? 'text-primary-600 font-medium' : 'text-gray-400'}`}>
                      {step.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Order Items */}
            <Card>
              <CardHeader>
                <CardTitle>Items ({order.items?.length || 0})</CardTitle>
              </CardHeader>
              <div className="space-y-3">
                {order.items?.map(item => (
                  <div key={item.id} className="flex gap-3">
                    <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                      {item.listing?.primary_image ? (
                        <img src={item.listing.primary_image} alt={item.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-5 h-5 text-gray-300" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                      <p className="text-xs text-gray-500">Qty: {item.quantity} x ₱{parseFloat(item.price || 0).toLocaleString('en-PH')}</p>
                    </div>
                    <p className="text-sm font-bold text-gray-900 flex-shrink-0">
                      ₱{parseFloat(item.total || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            {/* Pickup Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary-600" />
                  Pickup Details
                </CardTitle>
              </CardHeader>
              <p className="text-sm text-gray-700">{order.pickup_address}</p>
              {order.preferred_pickup_date && (
                <div className="mt-3 p-3 bg-primary-50 rounded-lg">
                  <p className="text-sm font-medium text-primary-800">
                    Pickup Date: {new Date(order.preferred_pickup_date + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                  {order.preferred_pickup_time && (
                    <p className="text-sm text-primary-700 mt-1">
                      Time: {order.preferred_pickup_time === 'morning' ? '8:00 AM - 12:00 PM' : order.preferred_pickup_time === 'afternoon' ? '1:00 PM - 5:00 PM' : '6:00 PM - 9:00 PM'}
                    </p>
                  )}
                </div>
              )}
              {order.notes && (
                <p className="text-sm text-gray-500 mt-2">Notes: {order.notes}</p>
              )}
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Order Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>₱{parseFloat(order.subtotal || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Shipping</span>
                  <span className="text-green-600">Free</span>
                </div>
                <div className="border-t border-gray-200 pt-3">
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-900">Total</span>
                    <span className="font-bold text-primary-600">₱{parseFloat(order.total || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Payment Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-primary-600" />
                  Payment
                </CardTitle>
              </CardHeader>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Method</span>
                  <span className="font-medium text-gray-900 capitalize">{order.payment_method?.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Status</span>
                  <Badge variant={order.payment_status === 'paid' ? 'success' : 'warning'}>
                    {order.payment_status}
                  </Badge>
                </div>
              </div>
            </Card>

            {/* Business Info */}
            {order.business && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Store className="w-5 h-5 text-primary-600" />
                    Seller
                  </CardTitle>
                </CardHeader>
                <div className="space-y-2 text-sm">
                  <p className="font-medium text-gray-900">{order.business.name}</p>
                  {order.business.phone && (
                    <p className="flex items-center gap-2 text-gray-500">
                      <Phone className="w-4 h-4" />
                      {order.business.phone}
                    </p>
                  )}
                </div>
              </Card>
            )}

            {/* Actions */}
            {(canUpdateStatus || canCancel) && (
              <Card>
                <CardHeader>
                  <CardTitle>Actions</CardTitle>
                </CardHeader>
                <div className="space-y-3">
                  {canUpdateStatus && (
                    <Button
                      className="w-full"
                      onClick={() => handleStatusUpdate(getNextStatus(order.status))}
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : null}
                      Mark as {getNextStatus(order.status)?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Button>
                  )}
                  {canCancel && (
                    <Button
                      variant="danger"
                      className="w-full"
                      onClick={() => setShowCancelModal(true)}
                      disabled={actionLoading}
                    >
                      Cancel Order
                    </Button>
                  )}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Cancel Modal */}
      <Modal open={showCancelModal} onClose={() => setShowCancelModal(false)} title="Cancel Order">
        <p className="text-gray-600 mb-4">Are you sure you want to cancel this order?</p>
        <textarea
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          rows={3}
          placeholder="Reason for cancellation (optional)"
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
        />
        <div className="flex gap-3 justify-end mt-4">
          <Button variant="secondary" onClick={() => setShowCancelModal(false)}>Keep Order</Button>
          <Button variant="danger" onClick={handleCancel} disabled={actionLoading}>
            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Cancel Order
          </Button>
        </div>
      </Modal>
    </div>
  );
}
