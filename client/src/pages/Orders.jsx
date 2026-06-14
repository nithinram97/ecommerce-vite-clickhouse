import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/index.js';
import './Orders.css';

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getOrders().then(setOrders).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="spinner">Loading…</div>;

  return (
    <div className="container page">
      <h1>Your Orders</h1>
      {orders.length === 0
        ? <div className="empty-state">No orders yet.</div>
        : (
          <div className="orders-list">
            {orders.map(o => (
              <Link to={`/orders/${o.id}`} key={o.id} className="order-row card">
                <div>
                  <p className="order-id">#{o.id.slice(0, 8)}</p>
                  <p className="order-date">{new Date(o.created_at).toLocaleDateString()}</p>
                </div>
                <span className={`badge badge-${o.status}`}>{o.status}</span>
                <p className="order-total">${parseFloat(o.total).toFixed(2)}</p>
                <span className="order-arrow">→</span>
              </Link>
            ))}
          </div>
        )
      }
    </div>
  );
}
