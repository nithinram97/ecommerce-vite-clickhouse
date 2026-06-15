/**
 * logger.js
 * Thin structured logger. Every log line goes to:
 *  1. stdout  (JSON, for k8s / fluentd / loki side-cars)
 *  2. ClickHouse app_logs (async insert, non-blocking)
 *
 * Usage:
 *   import log from './logger.js';
 *   log.info('order created', { orderId, userId });
 *   log.error('db failure', { error: err.message, stack: err.stack });
 */

import ch from '../db/ch-client.js';

const DB = process.env.CLICKHOUSE_DB || 'shopkit';

// Internal: insert one row, swallow errors so logging never breaks the app
const insertLog = (level, message, context = {}) => {
  const row = {
    level,
    message,
    context: JSON.stringify(context),
  };

  // Print structured JSON to stdout
  process.stdout.write(JSON.stringify({ level, message, ...context, ts: new Date().toISOString() }) + '\n');

  // Non-blocking insert — if CH is down we just skip
  ch.insert({
    table: `${DB}.app_logs`,
    values: [row],
    format: 'JSONEachRow',
  }).catch(() => { /* intentionally silent */ });
};

const log = {
  debug: (msg, ctx) => insertLog('debug', msg, ctx),
  info:  (msg, ctx) => insertLog('info',  msg, ctx),
  warn:  (msg, ctx) => insertLog('warn',  msg, ctx),
  error: (msg, ctx) => insertLog('error', msg, ctx),
};

export default log;
