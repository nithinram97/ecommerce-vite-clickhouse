import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import './Auth.css';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      await register(form.email, form.password, form.name);
      navigate('/products');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card card">
        <h1>Create account</h1>
        <p className="auth-sub">Join ShopKit today</p>
        <div className="auth-form">
          <label>Name</label>
          <input className="input" value={form.name} onChange={set('name')} placeholder="Your name" />
          <label>Email</label>
          <input className="input" type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" />
          <label>Password</label>
          <input className="input" type="password" value={form.password} onChange={set('password')} placeholder="Min 8 characters" />
          {error && <p className="error-msg">{error}</p>}
          <button className="btn btn-primary" style={{width:'100%',marginTop:8}} onClick={handleSubmit} disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </div>
        <p className="auth-footer">Already have an account? <Link to="/login">Log in</Link></p>
      </div>
    </div>
  );
}
