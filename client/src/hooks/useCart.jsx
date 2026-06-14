import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api/index.js';
import { useAuth } from './useAuth.jsx';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [cart, setCart] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);

  const fetchCart = useCallback(async () => {
    if (!user) { setCart({ items: [], total: 0 }); return; }
    setLoading(true);
    try { setCart(await api.getCart()); } finally { setLoading(false); }
  }, [user]);

  useEffect(() => { fetchCart(); }, [fetchCart]);

  const addToCart = async (productId, quantity = 1) => {
    const existing = cart.items.find(i => i.product_id === productId);
    await api.updateCart({ product_id: productId, quantity: (existing?.quantity || 0) + quantity });
    await fetchCart();
  };

  const updateQty = async (productId, quantity) => {
    if (quantity < 1) return removeFromCart(productId);
    await api.updateCart({ product_id: productId, quantity });
    await fetchCart();
  };

  const removeFromCart = async (productId) => {
    await api.removeFromCart(productId);
    await fetchCart();
  };

  const checkout = async () => {
    const order = await api.checkout();
    await fetchCart();
    return order;
  };

  return (
    <CartContext.Provider value={{ cart, loading, addToCart, updateQty, removeFromCart, checkout, fetchCart }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
