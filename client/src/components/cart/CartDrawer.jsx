import { X, ShoppingBag, Trash2, ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';

export default function CartDrawer() {
  const { isCartOpen, closeCart, items, subtotal, itemCount, removeItem } = useCart();
  const navigate = useNavigate();

  if (!isCartOpen) return null;

  const handleCheckout = () => {
    const ids = items.map(i => i.id);
    sessionStorage.setItem('checkoutItems', JSON.stringify(ids));
    closeCart();
    navigate('/checkout');
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-50"
        onClick={closeCart}
      />
      <div className="fixed right-0 top-0 h-full w-full sm:w-96 bg-white z-50 flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-primary-600" />
            <h2 className="text-base font-semibold text-gray-900">Your Cart</h2>
            {itemCount > 0 && (
              <span className="text-xs font-medium bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">
                {itemCount}
              </span>
            )}
          </div>
          <button
            onClick={closeCart}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <ShoppingBag className="w-7 h-7 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-700">Your cart is empty</p>
              <p className="text-xs text-gray-400 mt-1">Add items from the marketplace to get started.</p>
              <Link
                to="/marketplace"
                onClick={closeCart}
                className="mt-4 text-sm text-primary-600 font-medium hover:underline"
              >
                Browse marketplace →
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map(item => {
                const listing = item.listing || {};
                return (
                  <div key={item.id} className="flex gap-3">
                    <div className="w-14 h-14 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                      {listing.images?.[0] ? (
                        <img src={listing.images[0]} alt={listing.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary-50 to-emerald-50" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{listing.name}</p>
                      <p className="text-xs text-gray-500 truncate">{listing.business?.name}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-sm font-semibold text-gray-900">
                          ₱{parseFloat(listing.price || 0).toLocaleString('en-PH', { minimumFractionDigits: 0 })}
                          {' '}× {item.quantity}
                        </span>
                        <button
                          onClick={() => removeItem(item.id)}
                          aria-label="Remove item"
                          className="p-2 -m-1 text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="px-5 py-4 border-t border-gray-100 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Subtotal</span>
              <span className="text-base font-bold text-gray-900">
                ₱{parseFloat(subtotal).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <button
              onClick={handleCheckout}
              className="w-full bg-primary-600 text-white text-sm font-semibold py-3 rounded-xl hover:bg-primary-700 transition-colors flex items-center justify-center gap-2"
            >
              Checkout <ArrowRight className="w-4 h-4" />
            </button>
            <Link
              to="/cart"
              onClick={closeCart}
              className="block w-full text-center text-sm text-gray-600 hover:text-gray-900 py-2 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors"
            >
              View full cart
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
