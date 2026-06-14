const BASE = '/api';

const getToken = () => localStorage.getItem('token');

const headers = (extra = {}) => ({
  'Content-Type': 'application/json',
  ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
  ...extra,
});

const request = async (method, path, body) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(),
    ...(body != null ? { body: JSON.stringify(body) } : {}),
  });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
};

export const api = {
  // Auth
  register: (body) => request('POST', '/auth/register', body),
  login: (body) => request('POST', '/auth/login', body),
  me: () => request('GET', '/auth/me'),

  // Products
  getProducts: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request('GET', `/products${qs ? `?${qs}` : ''}`);
  },
  getProduct: (id) => request('GET', `/products/${id}`),
  getCategories: () => request('GET', '/products/categories'),
  createProduct: (body) => request('POST', '/products', body),
  updateProduct: (id, body) => request('PATCH', `/products/${id}`, body),
  deleteProduct: (id) => request('DELETE', `/products/${id}`),

  // Cart
  getCart: () => request('GET', '/cart'),
  updateCart: (body) => request('PUT', '/cart', body),
  removeFromCart: (productId) => request('DELETE', `/cart/${productId}`),
  clearCart: () => request('DELETE', '/cart'),

  // Orders
  checkout: () => request('POST', '/orders'),
  getOrders: () => request('GET', '/orders'),
  getOrder: (id) => request('GET', `/orders/${id}`),
  updateOrderStatus: (id, status) => request('PATCH', `/orders/${id}/status`, { status }),
};
