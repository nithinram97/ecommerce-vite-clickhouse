import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes     from './routes/auth.js';
import productRoutes  from './routes/products.js';
import cartRoutes     from './routes/cart.js';
import orderRoutes    from './routes/orders.js';
import eventRoutes    from './routes/events.js';

import { requestLogger } from './middleware/requestLogger.js';
import log               from './utils/logger.js';

dotenv.config();

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());

// ── Observability: log every request to ClickHouse ──────────────────────────
app.use(requestLogger);

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart',     cartRoutes);
app.use('/api/orders',   orderRoutes);
app.use('/api/events',   eventRoutes);      // client-side event ingest

app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date() }));

// ── Global error handler: also logs to ClickHouse ───────────────────────────
app.use((err, req, res, _next) => {
  log.error('Unhandled error', {
    message: err.message,
    stack:   err.stack,
    path:    req.path,
    method:  req.method,
    request_id: req.requestId,
  });
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  log.info('Server started', { port: PORT, env: process.env.NODE_ENV });
});

export default app;
