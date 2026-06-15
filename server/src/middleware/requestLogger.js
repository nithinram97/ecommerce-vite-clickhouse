/**
 * requestLogger.js
 * Express middleware — fires after the response is sent, inserts one row into
 * ClickHouse server_logs. Non-blocking: failures are swallowed so a CH outage
 * never affects the API.
 *
 * Sensitive fields (password, token) are stripped from the request body before
 * storage.
 */

import { randomUUID } from 'crypto';
import ch from '../db/ch-client.js';

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
  const start = Date.now();
  const requestId = randomUUID();
  req.requestId = requestId;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const userId = req.user?.id ?? '';

    const row = {
      method:        req.method,
      path:          req.path,
      status:        res.statusCode,
      user_id:       userId,
      ip:            req.ip || req.socket?.remoteAddress || '',
      user_agent:    req.headers['user-agent'] || '',
      referer:       req.headers['referer'] || '',
      duration_ms:   duration,
      request_body:  req.method !== 'GET'
                       ? JSON.stringify(sanitise(req.body) ?? {})
                       : '',
      response_size: parseInt(res.getHeader('content-length') || '0', 10) || 0,
    };

    ch.insert({
      table: `${DB}.server_logs`,
      values: [row],
      format: 'JSONEachRow',
    }).catch(() => { /* silent — CH outage must not surface to callers */ });
  });

  next();
}
