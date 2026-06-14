import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import './Auth.css';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(form.email, form.password);
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
        <h1>Log in</h1>
        <p className="auth-sub">Welcome back to ShopKit</p>
        <div className="auth-form">
          <label>Email</label>
          <input className="input" type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" />
          <label>Password</label>
          <input className="input" type="password" value={form.password} onChange={set('password')} placeholder="••••••••" />
          {error && <p className="error-msg">{error}</p>}
          <button className="btn btn-primary" style={{width:'100%',marginTop:8}} onClick={handleSubmit} disabled={loading}>
            {loading ? 'Logging in…' : 'Log in'}
          </button>
        </div>
        <p className="auth-footer">Don't have an account? <Link to="/register">Sign up</Link></p>
      </div>
    </div>
  );
}
