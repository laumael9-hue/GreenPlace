import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Printer, Leaf, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import api from '../lib/api';
import Button from '../components/ui/Button';

const paymentStatusConfig = {
  pending: { label: 'Pending', icon: Clock, color: 'text-yellow-600' },
  paid: { label: 'Paid', icon: CheckCircle, color: 'text-green-600' },
  failed: { label: 'Failed', icon: AlertTriangle, color: 'text-red-600' },
  refunded: { label: 'Refunded', icon: AlertTriangle, color: 'text-red-600' },
};

export default function Receipt() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const { data } = await api.get(`/orders/${id}`);
        setOrder(data.order);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load receipt');
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  const formatCurrency = (amount) => {
    return parseFloat(amount || 0).toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-PH', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isPayMongo = order?.payment_method?.startsWith('paymongo_');
  const paymentLabel = order?.payment_method?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || '—';
  const latestPayment = order?.payments?.[0];
  const transactionRef = latestPayment?.paymongo_payment_id || null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center no-print">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center no-print">
        <div className="text-center max-w-md mx-4">
          <AlertTriangle className="w-12 h-12 text-red-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-500 mb-6">{error}</p>
          <Button onClick={() => navigate('/orders')}>Back to Orders</Button>
        </div>
      </div>
    );
  }

  if (!order) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Non-print header */}
      <div className="no-print bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link
            to={`/orders/${order.id}`}
            className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Order
          </Link>
          <Button onClick={handlePrint} size="sm">
            <Printer className="w-4 h-4" />
            Print Receipt
          </Button>
        </div>
      </div>

      {/* Receipt content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 print-area">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden print:shadow-none print:border-none print:rounded-none">

          {/* Header */}
          <div className="px-8 pt-8 pb-6 border-b border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
                  <Leaf className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">GreenPlace</h1>
                  <p className="text-xs text-gray-500">Sustainable Living Platform</p>
                </div>
              </div>
              <div className="text-right">
                <h2 className="text-lg font-bold text-gray-900 tracking-wide">RECEIPT</h2>
              </div>
            </div>

            {/* TEST MODE Banner */}
            {isPayMongo && (
              <div className="bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 flex items-center gap-3 print:bg-amber-50 print:border-amber-300">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-amber-800">TEST MODE</p>
                  <p className="text-xs text-amber-700">This is a test transaction — no real payment was processed.</p>
                </div>
              </div>
            )}
          </div>

          {/* Receipt Info */}
          <div className="px-8 py-6 border-b border-gray-100">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Receipt No.</p>
                <p className="text-sm font-bold text-gray-900">{order.order_number}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Date</p>
                <p className="text-sm text-gray-700">{formatDate(order.created_at)}</p>
              </div>
            </div>
          </div>

          {/* Buyer & Seller Info */}
          <div className="px-8 py-6 border-b border-gray-100">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Bill To</p>
                <p className="text-sm font-medium text-gray-900">
                  {order.buyer?.first_name} {order.buyer?.last_name}
                </p>
                {order.buyer?.email && (
                  <p className="text-xs text-gray-500 mt-1">{order.buyer.email}</p>
                )}
                {order.buyer?.phone && (
                  <p className="text-xs text-gray-500">{order.buyer.phone}</p>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Sold By</p>
                <p className="text-sm font-medium text-gray-900">{order.business?.name}</p>
                {order.business?.address && (
                  <p className="text-xs text-gray-500 mt-1">{order.business.address}</p>
                )}
                {order.business?.phone && (
                  <p className="text-xs text-gray-500">{order.business.phone}</p>
                )}
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="px-8 py-6 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Items</p>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider pb-2">Item</th>
                  <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider pb-2 w-16">Qty</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider pb-2 w-28">Price</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider pb-2 w-28">Total</th>
                </tr>
              </thead>
              <tbody>
                {order.items?.map((item) => (
                  <tr key={item.id} className="border-b border-gray-50">
                    <td className="py-3">
                      <p className="text-sm font-medium text-gray-900">{item.title}</p>
                    </td>
                    <td className="py-3 text-center">
                      <span className="text-sm text-gray-600">{item.quantity}</span>
                    </td>
                    <td className="py-3 text-right">
                      <span className="text-sm text-gray-600">₱{formatCurrency(item.price)}</span>
                    </td>
                    <td className="py-3 text-right">
                      <span className="text-sm font-medium text-gray-900">₱{formatCurrency(item.total)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="px-8 py-6 border-b border-gray-100">
            <div className="w-full max-w-xs ml-auto space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span className="text-gray-700">₱{formatCurrency(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Shipping</span>
                <span className="text-green-600 font-medium">Free</span>
              </div>
              <div className="border-t border-gray-200 pt-2 flex justify-between">
                <span className="text-sm font-bold text-gray-900">Total</span>
                <span className="text-base font-bold text-primary-600">₱{formatCurrency(order.total)}</span>
              </div>
            </div>
          </div>

          {/* Payment Details */}
          <div className="px-8 py-6 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Payment Details</p>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Method</span>
                <span className="text-sm font-medium text-gray-900">{paymentLabel}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Status</span>
                <span className={`text-sm font-medium ${paymentStatusConfig[order.payment_status]?.color || 'text-gray-600'}`}>
                  {paymentStatusConfig[order.payment_status]?.label || order.payment_status}
                </span>
              </div>
              {isPayMongo && transactionRef && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Transaction Reference</span>
                  <span className="text-xs font-mono text-gray-700 bg-gray-50 px-2 py-1 rounded">{transactionRef}</span>
                </div>
              )}
              {latestPayment?.paid_at && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Paid At</span>
                  <span className="text-sm text-gray-700">{formatDateTime(latestPayment.paid_at)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-8 py-6 text-center">
            <p className="text-xs text-gray-400">
              Thank you for supporting sustainable living in Metro Cebu.
            </p>
            <p className="text-xs text-gray-300 mt-1">
              GreenPlace — Connecting communities with eco-friendly waste management
            </p>
          </div>
        </div>
      </div>

      {/* Print-specific styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-area,
          .print-area * {
            visibility: visible;
          }
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0;
            margin: 0;
          }
          .no-print {
            display: none !important;
          }
          .print-area .bg-white {
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
          @page {
            margin: 0.5in;
            size: A4;
          }
        }
      `}</style>
    </div>
  );
}
