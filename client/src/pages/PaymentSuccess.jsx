import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, Package, ArrowRight, Home, Loader2 } from 'lucide-react';
import api from '../lib/api';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order_id');
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!orderId) {
      setError('No order ID provided');
      setLoading(false);
      return;
    }

    const fetchStatus = async () => {
      try {
        const { data } = await api.get(`/payments/status/${orderId}`);
        setOrder(data.order);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load payment status');
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
  }, [orderId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 text-primary-600 mx-auto mb-4 animate-spin" />
            <p className="text-gray-500">Confirming your payment...</p>
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h2>
            <p className="text-gray-500 mb-6">{error}</p>
            <Link to="/orders">
              <Button>View Orders</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const isPaid = order?.payment_status === 'paid' || order?.status === 'confirmed';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card>
          <div className="text-center py-8">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${isPaid ? 'bg-green-100' : 'bg-amber-100'}`}>
              <CheckCircle className={`w-8 h-8 ${isPaid ? 'text-green-600' : 'text-amber-600'}`} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {isPaid ? 'Payment Successful!' : 'Payment Processing'}
            </h1>
            <p className="text-gray-500 mb-1">
              {isPaid
                ? 'Your payment has been confirmed.'
                : 'Your payment is being processed. This may take a moment.'}
            </p>
            {order && (
              <p className="text-sm text-gray-400">Order #{order.order_number}</p>
            )}
          </div>

          {order && (
            <div className="border-t border-gray-100 pt-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Status</span>
                <span className={`text-sm font-medium capitalize ${isPaid ? 'text-green-600' : 'text-amber-600'}`}>
                  {order.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Payment</span>
                <span className="text-sm font-medium text-gray-900 capitalize">
                  {order.payment_method?.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Total</span>
                <span className="text-sm font-bold text-primary-600">
                  ₱{parseFloat(order.total || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )}

          <div className="border-t border-gray-100 pt-6 mt-6">
            <p className="text-sm text-gray-600 mb-6">
              {isPaid
                ? 'The seller will confirm your order shortly. You can track your order status in your order history.'
                : 'Please wait while we confirm your payment. You can check back in a moment.'}
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              {orderId && (
                <Link to={`/orders/${orderId}`} className="flex-1">
                  <Button className="w-full">
                    View Order
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              )}
              <Link to="/" className="flex-1">
                <Button variant="secondary" className="w-full">
                  <Home className="w-4 h-4" />
                  Back to Home
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
