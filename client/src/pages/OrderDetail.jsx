import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/index.js';
import { useAuth } from '../hooks/useAuth.jsx';
import './OrderDetail.css';

const STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

export default function OrderDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [updating, setUpdating] = useState(false);

  const load = () => api.getOrder(id).then(setOrder).catch(() => navigate('/orders'));

  useEffect(() => { load(); }, [id]);

  const updateStatus = async (status) => {
    setUpdating(true);
    try { setOrder(await api.updateOrderStatus(id, status)); } finally { setUpdating(false); }
  };

  if (!order) return <div className="spinner">Loading…</div>;

  return (
    <div className="container page">
      <button className="btn btn-outline" style={{marginBottom:24}} onClick={() => navigate(-1)}>← Back</button>
      <div className="od-header">
        <div>
          <h1>Order #{order.id.slice(0, 8)}</h1>
          <p className="od-date">{new Date(order.created_at).toLocaleString()}</p>
        </div>
        <span className={`badge badge-${order.status}`}>{order.status}</span>
      </div>

      {user?.role === 'admin' && (
        <div className="od-admin card">
          <p><strong>Update status:</strong></p>
          <div className="od-status-buttons">
            {STATUSES.map(s => (
              <button key={s} className={`btn ${order.status === s ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => updateStatus(s)} disabled={updating || order.status === s}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="od-items card">
        <h2>Items</h2>
        {order.items?.map(item => (
          <div key={item.id} className="od-item">
            <div className="od-item-img">
              {item.image_url ? <img src={item.image_url} alt={item.name} /> : <div className="od-placeholder" />}
            </div>
            <span className="od-item-name">{item.name}</span>
            <span className="od-item-qty">× {item.quantity}</span>
            <span className="od-item-total">${(item.unit_price * item.quantity).toFixed(2)}</span>
          </div>
        ))}
        <div className="od-total">Total: <strong>${parseFloat(order.total).toFixed(2)}</strong></div>
      </div>
    </div>
  );
}
