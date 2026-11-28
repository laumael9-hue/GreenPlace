import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AlertCircle, X } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [subtotal, setSubtotal] = useState(0);
  const [itemCount, setItemCount] = useState(0);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartError, setCartError] = useState('');
  const errorTimer = useRef(null);

  // One shared error banner, so every "Add to cart" button tells the user why it failed.
  const showError = useCallback((message) => {
    setCartError(message);
    clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setCartError(''), 5000);
  }, []);

  useEffect(() => () => clearTimeout(errorTimer.current), []);

  const fetchCart = useCallback(async () => {
    if (!isAuthenticated) {
      setItems([]);
      setSubtotal(0);
      setItemCount(0);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get('/marketplace/cart');
      setItems(data.items || []);
      setSubtotal(data.subtotal || 0);
      setItemCount(data.itemCount || 0);
    } catch (err) {
      console.error('Failed to fetch cart:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const addItem = useCallback(async (listingId, quantity = 1) => {
    try {
      const { data } = await api.post('/marketplace/cart', { listingId, quantity });
      await fetchCart();
      setIsCartOpen(true);
      return { success: true, cartItem: data.cartItem };
    } catch (err) {
      const message = err.response?.data?.error
        || (err.response ? 'Could not add this item to your cart. Please try again.' : 'Could not reach the server. Check your connection and try again.');
      showError(message);
      return { success: false, error: message };
    }
  }, [fetchCart, showError]);

  const updateQuantity = useCallback(async (cartItemId, quantity) => {
    try {
      await api.patch(`/marketplace/cart/${cartItemId}`, { quantity });
      await fetchCart();
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to update quantity';
      showError(message);
      return { success: false, error: message };
    }
  }, [fetchCart, showError]);

  const removeItem = useCallback(async (cartItemId) => {
    try {
      await api.delete(`/marketplace/cart/${cartItemId}`);
      await fetchCart();
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to remove item';
      return { success: false, error: message };
    }
  }, [fetchCart]);

  const clearAll = useCallback(async () => {
    try {
      await api.delete('/marketplace/cart');
      setItems([]);
      setSubtotal(0);
      setItemCount(0);
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to clear cart';
      return { success: false, error: message };
    }
  }, []);

  const value = {
    items,
    loading,
    subtotal,
    itemCount,
    isCartOpen,
    openCart: () => setIsCartOpen(true),
    closeCart: () => setIsCartOpen(false),
    addItem,
    updateQuantity,
    removeItem,
    clearAll,
    refresh: fetchCart,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
      {cartError && (
        <div
          role="alert"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-2rem)] max-w-md flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl shadow-lg px-4 py-3"
        >
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="flex-1 text-sm">{cartError}</p>
          <button onClick={() => setCartError('')} className="text-red-400 hover:text-red-600" aria-label="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}

export default CartContext;
