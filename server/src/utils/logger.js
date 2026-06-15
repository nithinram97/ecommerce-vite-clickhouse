/**
 * logger.js
 * Structured logger — every line goes to:
 *  1. stdout (JSON, for docker logs / k8s sidecar)
 *  2. HyperDX / ClickStack via OTLP HTTP (async, non-blocking)
 *
 * Usage:
 *   import log from './logger.js';
 *   log.info('order created', { orderId, userId });
 *   log.error('db failure',   { error: err.message, stack: err.stack });
 */

import { sendLog } from './otel.js';

function write(level, message, context = {}) {
  // 1. Structured JSON → stdout (visible in `docker compose logs`)
  process.stdout.write(
    JSON.stringify({ level, message, ...context, ts: new Date().toISOString() }) + '\n'
  );

  // 2. Ship to HyperDX via OTLP — fire-and-forget
  sendLog(level, message, context);
}

const log = {
  debug: (msg, ctx) => write('debug', msg, ctx),
  info:  (msg, ctx) => write('info',  msg, ctx),
  warn:  (msg, ctx) => write('warn',  msg, ctx),
  error: (msg, ctx) => write('error', msg, ctx),
};

export default log;