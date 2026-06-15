import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { useCart } from '../hooks/useCart.jsx';
import { useState } from 'react';
import analytics from '../analytics.js';
import './ProductCard.css';

export default function ProductCard({ product }) {
  const { user } = useAuth();
  const { addToCart } = useCart();
  const [adding, setAdding] = useState(false);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!user) { window.location.href = '/login'; return; }
    setAdding(true);
    try {
      await addToCart(product.id);
      analytics.track('add_to_cart', {
        product_id: product.id,
        product_name: product.name,
        price: product.price,
        category: product.category,
        source: 'product_card',
      });
    } finally {
      setAdding(false);
    }
  };

  return (
    <Link to={`/products/${product.id}`} className="product-card card">
      <div className="product-image">
        {product.image_url
          ? <img src={product.image_url} alt={product.name} loading="lazy" />
          : <div className="product-image-placeholder" />}
      </div>
      <div className="product-info">
        {product.category && <span className="product-category">{product.category}</span>}
        <h3 className="product-name">{product.name}</h3>
        <div className="product-footer">
          <span className="product-price">${parseFloat(product.price).toFixed(2)}</span>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleAdd}
            disabled={adding || product.stock === 0}
          >
            {product.stock === 0 ? 'Out of stock' : adding ? '...' : 'Add to cart'}
          </button>
        </div>
      </div>
    </Link>
  );
}
