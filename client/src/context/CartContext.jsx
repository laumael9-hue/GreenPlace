import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [subtotal, setSubtotal] = useState(0);
  const [itemCount, setItemCount] = useState(0);

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
      return { success: true, cartItem: data.cartItem };
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to add item';
      return { success: false, error: message };
    }
  }, [fetchCart]);

  const updateQuantity = useCallback(async (cartItemId, quantity) => {
    try {
      await api.patch(`/marketplace/cart/${cartItemId}`, { quantity });
      await fetchCart();
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to update quantity';
      return { success: false, error: message };
    }
  }, [fetchCart]);

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
    addItem,
    updateQuantity,
    removeItem,
    clearAll,
    refresh: fetchCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}

export default CartContext;
