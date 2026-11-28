import { useSearchParams, Link } from 'react-router-dom';
import { XCircle, ShoppingCart, ArrowRight } from 'lucide-react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

export default function PaymentFailed() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order_id');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card>
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900 mb-2">Payment Failed</h1>
            <p className="text-gray-500 mb-1">Your payment could not be completed.</p>
            <p className="text-sm text-gray-400">
              This may have been cancelled or the payment was declined.
            </p>
          </div>

          <div className="border-t border-gray-100 pt-6 mt-6">
            <p className="text-sm text-gray-600 mb-6">
              {orderId
                ? 'Your order is saved. You can retry the payment from the order page, or pick a different payment method.'
                : 'Your cart items are still available. You can try checking out again.'}
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              {orderId ? (
                <Link to={`/orders/${orderId}`} className="flex-1">
                  <Button className="w-full">
                    Retry Payment
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              ) : (
                <Link to="/checkout" className="flex-1">
                  <Button className="w-full">
                    <ShoppingCart className="w-4 h-4" />
                    Try Again
                  </Button>
                </Link>
              )}
              <Link to="/cart" className="flex-1">
                <Button variant="secondary" className="w-full">
                  <ShoppingCart className="w-4 h-4" />
                  Back to Cart
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
