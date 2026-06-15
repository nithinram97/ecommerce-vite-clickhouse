import { useCart } from '../hooks/useCart.jsx';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import analytics from '../analytics.js';
import './Cart.css';

export default function Cart() {
  const { cart, loading, updateQty, removeFromCart, checkout } = useCart();
  const [ordering, setOrdering] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleRemove = async (item) => {
    analytics.track('remove_from_cart', {
      product_id: item.product_id,
      product_name: item.name,
      price: item.price,
    });
    await removeFromCart(item.product_id);
  };

  const handleCheckout = async () => {
    analytics.track('checkout_start', {
      item_count: cart.items.reduce((s, i) => s + i.quantity, 0),
      total: cart.total,
    });
    setOrdering(true);
    setError('');
    try {
      const order = await checkout();
      analytics.track('checkout_complete', {
        order_id: order.id,
        total: order.total,
        item_count: order.items?.length ?? cart.items.length,
      });
      navigate(`/orders/${order.id}`);
    } catch (e) {
      analytics.track('checkout_error', { error: e.message });
      setError(e.message);
    } finally {
      setOrdering(false);
    }
  };

  if (loading) return <div className="spinner">Loading…</div>;

  return (
    <div className="container page">
      <h1>Your Cart</h1>
      {cart.items.length === 0
        ? <div className="empty-state">Your cart is empty.<br /><a href="/products">Browse products →</a></div>
        : (
          <div className="cart-layout">
            <div className="cart-items">
              {cart.items.map(item => (
                <div key={item.id} className="cart-item card">
                  <div className="ci-image">
                    {item.image_url ? <img src={item.image_url} alt={item.name} /> : <div className="ci-placeholder" />}
                  </div>
                  <div className="ci-details">
                    <p className="ci-name">{item.name}</p>
                    <p className="ci-price">${parseFloat(item.price).toFixed(2)} each</p>
                  </div>
                  <div className="qty-control">
                    <button className="btn btn-outline" onClick={() => updateQty(item.product_id, item.quantity - 1)}>−</button>
                    <span>{item.quantity}</span>
                    <button className="btn btn-outline" onClick={() => updateQty(item.product_id, item.quantity + 1)} disabled={item.quantity >= item.stock}>+</button>
                  </div>
                  <p className="ci-subtotal">${(item.price * item.quantity).toFixed(2)}</p>
                  <button className="btn btn-outline ci-remove" onClick={() => handleRemove(item)}>✕</button>
                </div>
              ))}
            </div>
            <div className="cart-summary card">
              <h2>Summary</h2>
              <div className="summary-row"><span>Items</span><span>{cart.items.reduce((s,i)=>s+i.quantity,0)}</span></div>
              <div className="summary-row total"><span>Total</span><span>${cart.total.toFixed(2)}</span></div>
              {error && <p className="error-msg">{error}</p>}
              <button className="btn btn-primary" style={{width:'100%',marginTop:16}} onClick={handleCheckout} disabled={ordering}>
                {ordering ? 'Placing order…' : 'Checkout'}
              </button>
            </div>
          </div>
        )
      }
    </div>
  );
}
