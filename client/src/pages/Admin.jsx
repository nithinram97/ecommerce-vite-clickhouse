import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/index.js';
import { useAuth } from '../hooks/useAuth.jsx';
import './Admin.css';

const EMPTY = { name: '', description: '', price: '', stock: '', category: '', image_url: '' };

export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('products');
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!user || user.role !== 'admin') navigate('/'); }, [user]);

  const loadProducts = () => api.getProducts({ limit: 100 }).then(d => setProducts(d.products));
  const loadOrders = () => api.getOrders().then(setOrders);

  useEffect(() => { loadProducts(); loadOrders(); }, []);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const data = { ...form, price: parseFloat(form.price), stock: parseInt(form.stock) };
      if (editing) { await api.updateProduct(editing, data); }
      else { await api.createProduct(data); }
      setForm(EMPTY);
      setEditing(null);
      await loadProducts();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this product?')) return;
    await api.deleteProduct(id);
    await loadProducts();
  };

  const editProduct = (p) => {
    setEditing(p.id);
    setForm({ name: p.name, description: p.description || '', price: p.price, stock: p.stock, category: p.category || '', image_url: p.image_url || '' });
    setTab('products');
    window.scrollTo(0, 0);
  };

  return (
    <div className="container page">
      <h1>Admin</h1>
      <div className="admin-tabs">
        {['products', 'orders'].map(t => (
          <button key={t} className={`btn ${tab === t ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'products' && (
        <>
          <div className="admin-form card">
            <h2>{editing ? 'Edit product' : 'New product'}</h2>
            <div className="form-grid">
              {[['name','Name'],['category','Category'],['price','Price'],['stock','Stock'],['image_url','Image URL']].map(([k,l]) => (
                <div key={k} className="form-field">
                  <label>{l}</label>
                  <input className="input" value={form[k]} onChange={set(k)} placeholder={l} />
                </div>
              ))}
              <div className="form-field full">
                <label>Description</label>
                <textarea className="input" value={form.description} onChange={set('description')} rows={2} />
              </div>
            </div>
            {error && <p className="error-msg">{error}</p>}
            <div className="form-actions">
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : editing ? 'Update' : 'Create'}</button>
              {editing && <button className="btn btn-outline" onClick={() => { setEditing(null); setForm(EMPTY); }}>Cancel</button>}
            </div>
          </div>

          <table className="admin-table card">
            <thead><tr><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th></th></tr></thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.category || '—'}</td>
                  <td>${parseFloat(p.price).toFixed(2)}</td>
                  <td>{p.stock}</td>
                  <td>
                    <button className="btn btn-outline btn-sm" onClick={() => editProduct(p)}>Edit</button>
                    {' '}
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {tab === 'orders' && (
        <table className="admin-table card">
          <thead><tr><th>ID</th><th>Customer</th><th>Status</th><th>Total</th><th>Date</th><th></th></tr></thead>
          <tbody>
            {orders.map(o => (
              <tr key={o.id}>
                <td className="mono">#{o.id.slice(0,8)}</td>
                <td>{o.customer_name || '—'}</td>
                <td><span className={`badge badge-${o.status}`}>{o.status}</span></td>
                <td>${parseFloat(o.total).toFixed(2)}</td>
                <td>{new Date(o.created_at).toLocaleDateString()}</td>
                <td><a href={`/orders/${o.id}`} className="btn btn-outline btn-sm">View</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
