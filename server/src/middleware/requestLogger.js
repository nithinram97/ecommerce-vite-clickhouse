/**
 * requestLogger.js
 * Express middleware — logs every HTTP request to HyperDX (ClickStack)
 * via OTLP, and keeps a copy in ClickHouse server_logs for raw analytics.
 *
 * Non-blocking: both exports are fire-and-forget so an outage in either
 * sink never affects API response times.
 */

import { randomUUID } from 'crypto';
import ch from '../db/ch-client.js';
import { sendLog } from '../utils/otel.js';

const DB = process.env.CLICKHOUSE_DB || 'shopkit';

const STRIP = new Set(['password', 'password_hash', 'token', 'authorization', 'secret']);

function sanitise(body) {
  if (!body || typeof body !== 'object') return body;
  return Object.fromEntries(
    Object.entries(body).map(([k, v]) =>
      STRIP.has(k.toLowerCase()) ? [k, '[REDACTED]'] : [k, v]
    )
  );
}

export function requestLogger(req, res, next) {
  const start     = Date.now();
  const requestId = randomUUID();
  req.requestId   = requestId;

  res.on('finish', () => {
    const duration  = Date.now() - start;
    const userId    = req.user?.id ?? '';
    const status    = res.statusCode;
    const level     = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';

    const attrs = {
      'http.method':      req.method,
      'http.target':      req.path,
      'http.status_code': String(status),
      'http.user_agent':  req.headers['user-agent'] || '',
      'http.referer':     req.headers['referer'] || '',
      'http.duration_ms': String(duration),
      'net.peer.ip':      req.ip || req.socket?.remoteAddress || '',
      'enduser.id':       userId,
      'request.id':       requestId,
    };

    // ── 1. HyperDX via OTLP ─────────────────────────────────────────────
    sendLog(level, `${req.method} ${req.path} ${status} ${duration}ms`, attrs);

    // ── 2. ClickHouse server_logs (raw analytics) ────────────────────────
    ch.insert({
      table: `${DB}.server_logs`,
      values: [{
        method:        req.method,
        path:          req.path,
        status,
        user_id:       userId,
        ip:            attrs['net.peer.ip'],
        user_agent:    attrs['http.user_agent'],
        referer:       attrs['http.referer'],
        duration_ms:   duration,
        request_body:  req.method !== 'GET'
                         ? JSON.stringify(sanitise(req.body) ?? {})
                         : '',
        response_size: parseInt(res.getHeader('content-length') || '0', 10) || 0,
      }],
      format: 'JSONEachRow',
    }).catch(() => {});
  });

  next();
}