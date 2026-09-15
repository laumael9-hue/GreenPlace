import { useLocation, Link } from 'react-router-dom';
import { CheckCircle, Package, ArrowRight, Home } from 'lucide-react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

export default function OrderConfirmation() {
  const location = useLocation();
  const order = location.state?.order;

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">No order data</h2>
            <p className="text-gray-500 mb-6">Please check your order history.</p>
            <Link to="/orders">
              <Button>View Orders</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card>
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Order Placed!</h1>
            <p className="text-gray-500 mb-1">Your order has been successfully placed.</p>
            <p className="text-sm text-gray-400">Order #{order.order_number}</p>
          </div>

          <div className="border-t border-gray-100 pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Status</span>
              <span className="text-sm font-medium text-amber-600 capitalize">{order.status}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Payment</span>
              <span className="text-sm font-medium text-gray-900 capitalize">{order.payment_method?.replace(/_/g, ' ')}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Total</span>
              <span className="text-sm font-bold text-primary-600">₱{parseFloat(order.total || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-6 mt-6">
            <p className="text-sm text-gray-600 mb-6">
              The seller will confirm your order shortly. You can track your order status in your order history.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link to={`/orders/${order.id}`} className="flex-1">
                <Button className="w-full">
                  View Order
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
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
