import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/index.js';
import { useAuth } from '../hooks/useAuth.jsx';
import { useCart } from '../hooks/useCart.jsx';
import analytics from '../analytics.js';
import './ProductDetail.css';

export default function ProductDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.getProduct(id).then((p) => {
      setProduct(p);
      analytics.track('product_view', {
        product_id: p.id,
        product_name: p.name,
        price: p.price,
        category: p.category,
      });
    }).catch(() => navigate('/products'));
  }, [id]);

  const handleAdd = async () => {
    if (!user) { navigate('/login'); return; }
    setAdding(true);
    try {
      await addToCart(product.id, qty);
      analytics.track('add_to_cart', {
        product_id: product.id,
        product_name: product.name,
        price: product.price,
        quantity: qty,
        source: 'product_detail',
      });
      setMsg('Added to cart!');
      setTimeout(() => setMsg(''), 2000);
    } catch (e) {
      setMsg(e.message);
    } finally {
      setAdding(false);
    }
  };

  if (!product) return <div className="spinner">Loading…</div>;

  return (
    <div className="container page">
      <button className="btn btn-outline back-btn" onClick={() => navigate(-1)}>← Back</button>
      <div className="product-detail card">
        <div className="pd-image">
          {product.image_url
            ? <img src={product.image_url} alt={product.name} />
            : <div className="pd-placeholder" />}
        </div>
        <div className="pd-info">
          {product.category && <span className="pd-category">{product.category}</span>}
          <h1 className="pd-name">{product.name}</h1>
          <p className="pd-price">${parseFloat(product.price).toFixed(2)}</p>
          {product.description && <p className="pd-desc">{product.description}</p>}
          <p className="pd-stock">{product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}</p>

          {product.stock > 0 && (
            <div className="pd-actions">
              <div className="qty-control">
                <button className="btn btn-outline" onClick={() => setQty(q => Math.max(1, q - 1))}>−</button>
                <span>{qty}</span>
                <button className="btn btn-outline" onClick={() => setQty(q => Math.min(product.stock, q + 1))}>+</button>
              </div>
              <button className="btn btn-primary" onClick={handleAdd} disabled={adding}>
                {adding ? 'Adding…' : 'Add to cart'}
              </button>
            </div>
          )}
          {msg && <p style={{ color: msg.startsWith('Added') ? 'var(--success)' : 'var(--danger)', marginTop: 8 }}>{msg}</p>}
        </div>
      </div>
    </div>
  );
}
