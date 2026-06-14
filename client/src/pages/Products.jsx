import { useState, useEffect } from 'react';
import { api } from '../api/index.js';
import ProductCard from '../components/ProductCard.jsx';
import './Products.css';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const limit = 12;

  useEffect(() => {
    api.getCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    api.getProducts({ ...(category && { category }), ...(q && { q }), page, limit })
      .then(data => { setProducts(data.products); setTotal(data.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [category, q, page]);

  const pages = Math.ceil(total / limit);

  return (
    <div className="container page">
      <div className="products-header">
        <h1>All Products</h1>
        <div className="products-filters">
          <input
            className="input search-input"
            placeholder="Search products…"
            value={q}
            onChange={e => { setQ(e.target.value); setPage(1); }}
          />
          <select className="input" value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}>
            <option value="">All categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {loading
        ? <div className="spinner">Loading…</div>
        : products.length === 0
          ? <div className="empty-state">No products found.</div>
          : <div className="products-grid">
              {products.map(p => <ProductCard key={p.id} product={p} />)}
            </div>
      }

      {pages > 1 && (
        <div className="pagination">
          <button className="btn btn-outline" onClick={() => setPage(p => p - 1)} disabled={page === 1}>← Prev</button>
          <span>{page} / {pages}</span>
          <button className="btn btn-outline" onClick={() => setPage(p => p + 1)} disabled={page === pages}>Next →</button>
        </div>
      )}
    </div>
  );
}
