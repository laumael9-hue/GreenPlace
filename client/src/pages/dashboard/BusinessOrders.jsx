import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, Loader2, ChevronRight, User, Package, ShoppingBag } from 'lucide-react';
import api from '../../lib/api';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';

const statusConfig = {
  pending: { variant: 'warning', label: 'Pending', dot: 'bg-amber-400' },
  confirmed: { variant: 'info', label: 'Confirmed', dot: 'bg-blue-400' },
  processing: { variant: 'info', label: 'Processing', dot: 'bg-blue-400' },
  ready_for_pickup: { variant: 'purple', label: 'Ready for Pickup', dot: 'bg-purple-400' },
  completed: { variant: 'success', label: 'Completed', dot: 'bg-green-400' },
  cancelled: { variant: 'danger', label: 'Cancelled', dot: 'bg-red-400' },
  refunded: { variant: 'danger', label: 'Refunded', dot: 'bg-red-400' },
};

export default function BusinessOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });
  const [filter, setFilter] = useState('');

  const fetchOrders = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: 10 };
      if (filter) params.status = filter;
      const { data } = await api.get('/orders/business', { params });
      setOrders(data.orders || []);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchOrders(1); }, [fetchOrders]);

  const handlePageChange = (newPage) => {
    fetchOrders(newPage);
  };

  const filterOptions = [
    { value: '', label: 'All Orders' },
    { value: 'pending', label: 'Pending' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'processing', label: 'Processing' },
    { value: 'ready_for_pickup', label: 'Ready' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  const pendingCount = orders.filter(o => o.status === 'pending').length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Incoming Orders</h1>
          <p className="mt-1 text-gray-500">{pagination.total} total orders</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {pendingCount > 0 && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 mb-6">
            <ClipboardList className="w-5 h-5 text-amber-600" />
            <p className="text-sm text-amber-700">
              You have <strong>{pendingCount}</strong> pending {pendingCount === 1 ? 'order' : 'orders'} awaiting confirmation.
            </p>
          </div>
        )}

        {/* Filter */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {filterOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                filter === opt.value
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-primary-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">No orders yet</h2>
              <p className="text-gray-500 mb-6">When customers place orders, they will appear here.</p>
              <Link to="/marketplace">
                <Button>View Marketplace</Button>
              </Link>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {orders.map(order => {
              const statusInfo = statusConfig[order.status] || statusConfig.pending;
              const firstItem = order.items?.[0];
              const itemCount = order.items?.length || 0;
              const itemTitle = firstItem?.title || 'Item';
              const itemQty = firstItem?.quantity || 1;

              return (
                <Link key={order.id} to={`/orders/${order.id}`}>
                  <Card className="hover:shadow-lg hover:border-primary-300 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group">
                    <div className="flex items-center gap-4">
                      {/* Item Image */}
                      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden group-hover:ring-2 group-hover:ring-primary-200 transition-all">
                        <Package className="w-8 h-8 text-gray-300" />
                      </div>

                      {/* Order Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold text-gray-900">#{order.order_number}</span>
                          <span className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${statusInfo.dot}`}></span>
                            <span className="text-xs font-medium text-gray-600">{statusInfo.label}</span>
                          </span>
                        </div>

                        <p className="text-sm font-medium text-gray-700 truncate">
                          {itemTitle}{itemCount > 1 ? ` +${itemCount - 1} more` : ''} × {itemQty}
                        </p>

                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {order.buyer?.first_name} {order.buyer?.last_name}
                          </span>
                          <span>•</span>
                          <span>{new Date(order.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          {order.preferred_pickup_date && (
                            <>
                              <span>•</span>
                              <span>Pickup: {new Date(order.preferred_pickup_date + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Price + Arrow */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-base sm:text-lg font-bold text-primary-600">
                          ₱{parseFloat(order.total || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </span>
                        <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-primary-400 transition-colors" />
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                >
                  Previous
                </Button>
                <span className="text-sm text-gray-500">
                  Page {pagination.page} of {pagination.pages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.pages}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
