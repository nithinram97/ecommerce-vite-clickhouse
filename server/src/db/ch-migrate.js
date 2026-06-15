/**
 * ClickHouse schema migration.
 * Run once: `npm run ch:migrate --workspace=server`
 *
 * Tables
 * ──────
 * click_events   – browser-side user interactions (clicks, page views, etc.)
 * server_logs    – every inbound HTTP request + response metadata
 * app_logs       – structured application log lines from the server process
 */

import { createClient } from '@clickhouse/client';
import dotenv from 'dotenv';
dotenv.config();

const DB = process.env.CLICKHOUSE_DB || 'shopkit';

const ch = createClient({
  url:      process.env.CLICKHOUSE_URL      || 'http://localhost:8123',
  username: process.env.CLICKHOUSE_USER     || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || '',
  // No database yet — we're creating it here
});

const exec = (query) => ch.exec({ query, clickhouse_settings: { wait_end_of_query: 1 } });

await exec(`CREATE DATABASE IF NOT EXISTS ${DB}`);

// ── click_events ─────────────────────────────────────────────────────────────
await exec(`
  CREATE TABLE IF NOT EXISTS ${DB}.click_events (
    event_id      UUID            DEFAULT generateUUIDv4(),
    session_id    String,
    user_id       String,         -- empty string if anonymous
    event_type    LowCardinality(String),   -- 'click' | 'pageview' | 'api_call' | 'error' | custom
    page          String,
    target        String,         -- CSS selector or element description
    properties    String,         -- JSON blob for extra k/v
    duration_ms   UInt32,         -- for api_call: round-trip ms; 0 otherwise
    ts            DateTime64(3, 'UTC') DEFAULT now64()
  )
  ENGINE = MergeTree()
  PARTITION BY toYYYYMM(ts)
  ORDER BY (event_type, session_id, ts)
  TTL toDateTime(ts) + INTERVAL 90 DAY
  SETTINGS index_granularity = 8192;
`);

// ── server_logs ───────────────────────────────────────────────────────────────
await exec(`
  CREATE TABLE IF NOT EXISTS ${DB}.server_logs (
    request_id    UUID            DEFAULT generateUUIDv4(),
    method        LowCardinality(String),
    path          String,
    status        UInt16,
    user_id       String,
    ip            String,
    user_agent    String,
    referer       String,
    duration_ms   UInt32,
    request_body  String,         -- JSON; omitted for GET, sanitised (no passwords)
    response_size UInt32,
    ts            DateTime64(3, 'UTC') DEFAULT now64()
  )
  ENGINE = MergeTree()
  PARTITION BY toYYYYMM(ts)
  ORDER BY (path, method, ts)
  TTL toDateTime(ts) + INTERVAL 90 DAY
  SETTINGS index_granularity = 8192;
`);

// ── app_logs ──────────────────────────────────────────────────────────────────
await exec(`
  CREATE TABLE IF NOT EXISTS ${DB}.app_logs (
    log_id     UUID            DEFAULT generateUUIDv4(),
    level      LowCardinality(String),  -- 'info' | 'warn' | 'error' | 'debug'
    message    String,
    context    String,         -- JSON blob (request_id, user_id, stack trace, …)
    ts         DateTime64(3, 'UTC') DEFAULT now64()
  )
  ENGINE = MergeTree()
  PARTITION BY toYYYYMM(ts)
  ORDER BY (level, ts)
  TTL toDateTime(ts) + INTERVAL 30 DAY
  SETTINGS index_granularity = 8192;
`);

await ch.close();
console.log(`✅ ClickHouse migration complete — database: ${DB}`);