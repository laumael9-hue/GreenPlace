import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Package, MapPin, CreditCard, Clock,
  CheckCircle, XCircle, AlertCircle, Store, Phone, RotateCcw, Pencil, ChevronRight, FileText
} from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { paymentMethodLabels } from '../lib/utilities';
import Badge from '../components/ui/Badge';
import Card, { CardHeader, CardTitle } from '../components/ui/Card';
import Button from '../components/ui/Button';
import ImageViewer from '../components/ui/ImageViewer';
import Modal from '../components/ui/Modal';

const statusConfig = {
  pending: { variant: 'warning', label: 'Pending', icon: Clock },
  confirmed: { variant: 'info', label: 'Confirmed', icon: CheckCircle },
  processing: { variant: 'info', label: 'Processing', icon: Loader2 },
  ready_for_pickup: { variant: 'purple', label: 'Ready for Pickup', icon: Package },
  completed: { variant: 'success', label: 'Completed', icon: CheckCircle },
  cancelled: { variant: 'danger', label: 'Cancelled', icon: XCircle },
  refunded: { variant: 'danger', label: 'Refunded', icon: RotateCcw },
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
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [editingRefund, setEditingRefund] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [refundImages, setRefundImages] = useState([]);
  const [viewingImages, setViewingImages] = useState(null);
  const [viewingIndex, setViewingIndex] = useState(0);
  const [showRefundDetailModal, setShowRefundDetailModal] = useState(false);
  const [showWalkInRefundModal, setShowWalkInRefundModal] = useState(false);
  const [walkInRefundReason, setWalkInRefundReason] = useState('');
  const fileInputRef = useRef(null);

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

  const handleRequestRefund = async () => {
    setActionLoading(true);
    try {
      const uploadedUrls = [];
      for (const file of refundImages) {
        if (typeof file === 'string') {
          uploadedUrls.push(file);
          continue;
        }
        const formData = new FormData();
        formData.append('image', file);
        const { data } = await api.post('/payments/refund-image', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        uploadedUrls.push(data.image_url);
      }
      if (editingRefund) {
        await api.put(`/payments/refund/${id}`, { reason: refundReason, images: uploadedUrls });
      } else {
        await api.post(`/payments/refund/${id}`, { reason: refundReason, images: uploadedUrls });
      }
      const { data } = await api.get(`/orders/${id}`);
      setOrder(data.order);
      setShowRefundModal(false);
      setEditingRefund(false);
      setRefundReason('');
      setRefundImages([]);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit refund request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelRefund = async () => {
    const refundId = order.refund?.id;
    if (!refundId) return;
    setActionLoading(true);
    try {
      await api.post(`/payments/refund/${refundId}/cancel`);
      const { data } = await api.get(`/orders/${id}`);
      setOrder(data.order);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to cancel refund');
    } finally {
      setActionLoading(false);
    }
  };

  const handleProcessRefund = async (action) => {
    const refundId = order.refund?.id;
    if (!refundId) return;
    setActionLoading(true);
    try {
      await api.post(`/payments/refund/${refundId}/process`, { action });
      const { data } = await api.get(`/orders/${id}`);
      setOrder(data.order);
      setShowRefundDetailModal(false);
    } catch (err) {
      setError(err.response?.data?.error || `Failed to ${action} refund`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleWalkInRefund = async () => {
    if (!walkInRefundReason.trim()) return;
    setActionLoading(true);
    try {
      await api.post(`/payments/refund-walkin/${id}`, { reason: walkInRefundReason.trim() });
      const { data } = await api.get(`/orders/${id}`);
      setOrder(data.order);
      setShowWalkInRefundModal(false);
      setWalkInRefundReason('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to process refund');
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

  const canCancel = order && ['pending', 'confirmed', 'processing', 'ready_for_pickup'].includes(order.status);
  const canUpdateStatus = role === 'business' && order && getNextStatus(order.status);
  const canRequestRefund = role === 'resident' && order && order.buyer_id && order.status === 'completed' && order.payment_status === 'paid' && order.refund_status !== 'requested' && order.refund_status !== 'refunded';
  const canRefundBusiness = role === 'business' && order && order.status === 'completed' && order.refund_status !== 'refunded';
  const refundRequested = order && order.refund_status === 'requested';
  const isRefunded = order && order.refund_status === 'refunded';
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

  const statusInfo = order.refund_status === 'refunded'
    ? statusConfig.refunded
    : statusConfig[order.status] || statusConfig.pending;

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
              {!order.buyer_id && order.guest_name && (
                <p className="text-sm text-gray-500 mt-1">
                  Walk-in: <span className="font-medium text-gray-700">{order.guest_name}</span>
                  {order.guest_phone && <span className="text-gray-400 ml-2">({order.guest_phone})</span>}
                </p>
              )}
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
                  <span className="font-medium text-gray-900">{paymentMethodLabels[order.payment_method] || order.payment_method?.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Status</span>
                  <Badge variant={order.payment_status === 'paid' ? 'success' : 'warning'}>
                    {order.payment_status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
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

            {/* View Receipt */}
            {['confirmed', 'processing', 'ready_for_pickup', 'completed'].includes(order.status) && (
              <Link to={`/orders/${order.id}/receipt`}>
                <Button variant="outline" className="w-full">
                  <FileText className="w-4 h-4" />
                  View Receipt
                </Button>
              </Link>
            )}

            {/* Actions */}
            {(canUpdateStatus || canCancel || canRequestRefund || canRefundBusiness || refundRequested || isRefunded || (role === 'business' && refundRequested)) && (
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
                  {canRequestRefund && (
                    <Button
                      variant="danger"
                      className="w-full"
                      onClick={() => setShowRefundModal(true)}
                      disabled={actionLoading}
                    >
                      <RotateCcw className="w-4 h-4" />
                      Request Refund
                    </Button>
                  )}
                  {canRefundBusiness && (
                    <Button
                      variant="danger"
                      className="w-full"
                      onClick={() => setShowWalkInRefundModal(true)}
                      disabled={actionLoading}
                    >
                      <RotateCcw className="w-4 h-4" />
                      Refund Order
                    </Button>
                  )}
                  {refundRequested && role === 'resident' && (
                    <div
                      className="p-4 bg-amber-50 border border-amber-200 rounded-lg cursor-pointer hover:border-amber-300 transition-colors"
                      onClick={() => setShowRefundDetailModal(true)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-semibold text-amber-800">Refund Request Pending</p>
                        <ChevronRight className="w-4 h-4 text-amber-400" />
                      </div>
                      <p className="text-sm text-gray-700 mb-1">{order.refund?.reason}</p>
                      {order.refund?.images && order.refund.images.length > 0 && (
                        <div className="flex gap-2 mt-3">
                          {order.refund.images.map((url, idx) => (
                            <img
                              key={idx}
                              src={url}
                              alt={`Refund proof ${idx + 1}`}
                              className="w-14 h-14 object-cover rounded-lg border border-amber-200"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {isRefunded && (
                    <div
                      className="p-4 bg-green-50 border border-green-200 rounded-lg cursor-pointer hover:border-green-300 transition-colors"
                      onClick={() => setShowRefundDetailModal(true)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-semibold text-green-800">Refund Processed</p>
                        <ChevronRight className="w-4 h-4 text-green-400" />
                      </div>
                      <p className="text-sm text-gray-700">{order.refund?.reason || 'Your refund has been processed successfully.'}</p>
                      {order.refund?.images && order.refund.images.length > 0 && (
                        <div className="flex gap-2 mt-3">
                          {order.refund.images.map((url, idx) => (
                            <img
                              key={idx}
                              src={url}
                              alt={`Refund proof ${idx + 1}`}
                              className="w-14 h-14 object-cover rounded-lg border border-green-200"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {role === 'business' && refundRequested && order.refund && (
                    <div
                      className="p-4 bg-amber-50 border border-amber-200 rounded-lg cursor-pointer hover:border-amber-300 transition-colors"
                      onClick={() => setShowRefundDetailModal(true)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-semibold text-amber-800">Refund Request</p>
                        <ChevronRight className="w-4 h-4 text-amber-400" />
                      </div>
                      <p className="text-sm text-gray-700 mb-1">{order.refund.reason}</p>
                      <p className="text-sm font-medium text-gray-900">
                        ₱{parseFloat(order.refund.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </p>
                      {order.refund.images && order.refund.images.length > 0 && (
                        <div className="flex gap-2 mt-3">
                          {order.refund.images.map((url, idx) => (
                            <img
                              key={idx}
                              src={url}
                              alt={`Refund proof ${idx + 1}`}
                              className="w-14 h-14 object-cover rounded-lg border border-amber-200"
                            />
                          ))}
                        </div>
                      )}
                    </div>
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

      {/* Refund Modal */}
      <Modal open={showRefundModal} onClose={() => { setShowRefundModal(false); setEditingRefund(false); }} title={editingRefund ? 'Edit Refund Request' : 'Request Refund'}>
        <p className="text-gray-600 mb-2">Please provide a reason for your refund request.</p>
        <p className="text-xs text-gray-400 mb-4">The seller will review your request. Approved refunds will be processed back to your original payment method.</p>
        <textarea
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          rows={3}
          placeholder="Reason for refund (required)"
          value={refundReason}
          onChange={(e) => setRefundReason(e.target.value)}
        />
        <div className="mt-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">Photos (optional, max 3)</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && refundImages.length < 3) {
                setRefundImages((prev) => [...prev, file]);
              }
              e.target.value = '';
            }}
          />
          <div className="flex flex-wrap gap-2">
            {refundImages.map((file, idx) => (
              <div key={idx} className="relative">
                <img
                  src={typeof file === 'string' ? file : URL.createObjectURL(file)}
                  alt={`Proof ${idx + 1}`}
                  className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                />
                <button
                  type="button"
                  onClick={() => setRefundImages((prev) => prev.filter((_, i) => i !== idx))}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                >
                  X
                </button>
              </div>
            ))}
            {refundImages.length < 3 && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-primary-400 hover:text-primary-500 transition-colors"
              >
                <span className="text-lg leading-none">+</span>
                <span className="text-[10px] mt-0.5">Add</span>
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-3 justify-end mt-4">
          <Button variant="secondary" onClick={() => { setShowRefundModal(false); setEditingRefund(false); setRefundImages([]); }}>Cancel</Button>
          <Button variant="danger" onClick={handleRequestRefund} disabled={actionLoading || !refundReason.trim()}>
            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Submit Refund Request
          </Button>
        </div>
      </Modal>

      {/* Refund Detail Modal */}
      <Modal open={showRefundDetailModal} onClose={() => setShowRefundDetailModal(false)} title={isRefunded ? 'Refund Details' : 'Refund Request'}>
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-500">Reason</p>
            <p className="text-sm text-gray-900 mt-1">{order?.refund?.reason}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Amount</p>
            <p className="text-lg font-semibold text-gray-900 mt-1">
              ₱{parseFloat(order?.refund?.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </p>
          </div>
          {order?.refund?.images && order.refund.images.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-500 mb-2">Proof Photos</p>
              <div className="flex flex-wrap gap-3">
                {order.refund.images.map((url, idx) => (
                  <img
                    key={idx}
                    src={url}
                    alt={`Refund proof ${idx + 1}`}
                    className="w-32 h-32 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => { setViewingImages(order.refund.images); setViewingIndex(idx); }}
                  />
                ))}
              </div>
            </div>
          )}
          {role === 'business' && refundRequested && (
            <div className="flex gap-3 pt-2">
              <Button
                className="flex-1"
                onClick={() => handleProcessRefund('approve')}
                disabled={actionLoading}
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Approve Refund
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                onClick={() => handleProcessRefund('reject')}
                disabled={actionLoading}
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Reject Refund
              </Button>
            </div>
          )}
          {role === 'resident' && refundRequested && (
            <div className="flex gap-3 pt-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setShowRefundDetailModal(false);
                  setEditingRefund(true);
                  setRefundReason(order.refund?.reason || '');
                  setRefundImages(order.refund?.images || []);
                  setShowRefundModal(true);
                }}
                disabled={actionLoading}
              >
                <Pencil className="w-4 h-4" />
                Edit Request
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                onClick={() => { setShowRefundDetailModal(false); handleCancelRefund(); }}
                disabled={actionLoading}
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Cancel Request
              </Button>
            </div>
          )}
        </div>
      </Modal>

      {/* Business Refund Modal */}
      <Modal open={showWalkInRefundModal} onClose={() => { setShowWalkInRefundModal(false); setWalkInRefundReason(''); }} title="Refund Order">
        <p className="text-gray-600 mb-2">Process a refund for this order. The order will be cancelled and listing quantities restored.</p>
        <p className="text-xs text-gray-400 mb-4">For cash orders, the refund is handled in person. For online payments, the refund will be processed back to the original payment method.</p>
        <textarea
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          rows={3}
          placeholder="Reason for refund (required)"
          value={walkInRefundReason}
          onChange={(e) => setWalkInRefundReason(e.target.value)}
        />
        <div className="flex gap-3 justify-end mt-4">
          <Button variant="secondary" onClick={() => { setShowWalkInRefundModal(false); setWalkInRefundReason(''); }}>Cancel</Button>
          <Button variant="danger" onClick={handleWalkInRefund} disabled={actionLoading || !walkInRefundReason.trim()}>
            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Process Refund
          </Button>
        </div>
      </Modal>

      {viewingImages && (
        <ImageViewer
          images={viewingImages}
          index={viewingIndex}
          onClose={() => setViewingImages(null)}
        />
      )}
    </div>
  );
}
