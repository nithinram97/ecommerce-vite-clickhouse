import jwt from 'jsonwebtoken';

export const authenticate = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

export const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Like authenticate but never rejects — attaches user if token present, otherwise continues anonymously
export const optionalAuth = (req, _res, next) => {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
    } catch { /* ignore invalid tokens */ }
  }
  next();
};