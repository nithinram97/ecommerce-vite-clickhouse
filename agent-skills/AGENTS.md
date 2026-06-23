# ClickHouse Agent Skills — ShopKit Edition

**Version 0.1.0** | ClickHouse 24.1+ | Based on [ClickHouse/agent-skills](https://github.com/ClickHouse/agent-skills)

You are a ClickHouse expert agent with deep knowledge of ShopKit's analytics schema.
Apply these best practices automatically when writing, reviewing, or optimizing ClickHouse SQL.

---

## ShopKit Schema Reference

```sql
-- Browser interactions, API calls, funnel events
shopkit.click_events
  session_id   String                     ORDER BY (session_id, ts)
  user_id      String DEFAULT ''
  event_type   LowCardinality(String)     -- pageview, add_to_cart, checkout_complete, api_call, error …
  page         String
  target       String
  duration_ms  UInt32
  properties   String                     -- JSON blob
  ts           DateTime64(3,'UTC')
  TTL: 90 days | PARTITION BY toYYYYMM(ts)

-- Every HTTP request (Express requestLogger middleware)
shopkit.server_logs
  request_id   String                     ORDER BY (ts, path)
  method       LowCardinality(String)
  path         String
  status       UInt16
  duration_ms  UInt32
  user_id      String DEFAULT ''
  ip           String
  user_agent   String
  ts           DateTime64(3,'UTC')
  TTL: 90 days | PARTITION BY toYYYYMM(ts)

-- Structured Node.js application logs
shopkit.app_logs
  level        LowCardinality(String)     ORDER BY (level, ts)
  message      String
  context      String                     -- JSON blob
  ts           DateTime64(3,'UTC')
  TTL: 60 days | PARTITION BY toYYYYMM(ts)
```

---

## CRITICAL Rules (apply always)

### 1. Primary Key & ORDER BY
- `click_events` ORDER BY is `(session_id, ts)` — always filter on `session_id` first for index use
- `server_logs` ORDER BY is `(ts, path)` — range on `ts` then filter `path`
- `app_logs` ORDER BY is `(level, ts)` — filter `level` first (low cardinality = best pruning)
- Never filter on `user_id`, `ip`, or `target` alone — these are not in ORDER BY; add bloom_filter index if needed

### 2. Avoid Nullable
- All columns use DEFAULT '' or DEFAULT 0, not Nullable — do not wrap in isNull()/isNotNull()
- Use `user_id != ''` to filter authenticated events, not `user_id IS NOT NULL`

### 3. Use LowCardinality columns efficiently
- `event_type`, `method`, `level` are LowCardinality — safe to GROUP BY and filter; very fast
- Always put LowCardinality equality filters before range filters on ts

### 4. Batch inserts / async_insert
- ShopKit uses `async_insert=1, wait_for_async_insert=0` (fire-and-forget) for click_events
- Never suggest synchronous single-row inserts to these tables

### 5. Never mutate
- Do NOT suggest `ALTER TABLE DELETE` or `ALTER TABLE UPDATE` on ShopKit tables
- Use TTL (already configured) for data expiry — never `DELETE FROM`
- To fix bad data: insert corrected rows (for ReplacingMergeTree patterns) or DROP PARTITION

### 6. Partition awareness
- Partitioned by `toYYYYMM(ts)` — always include a `ts` range filter to get partition pruning
- Example: `WHERE ts >= toStartOfMonth(now()) - INTERVAL 1 MONTH` prunes to 1-2 partitions
- Avoid queries with no `ts` filter — they scan all partitions

---

## Query Optimization Rules

### Use quantile() for latency analysis
```sql
-- CORRECT: p50/p95 API latency
SELECT
    target,
    quantile(0.5)(duration_ms)  AS p50_ms,
    quantile(0.95)(duration_ms) AS p95_ms,
    count()                      AS calls
FROM shopkit.click_events
WHERE event_type = 'api_call'
  AND ts >= now() - INTERVAL 1 DAY    -- partition filter
GROUP BY target
ORDER BY p95_ms DESC
LIMIT 20;

-- WRONG: do not use avg() for latency (hides tail latency)
```

### Funnel analysis with uniqExact
```sql
-- Conversion funnel (session-level, last 30 days)
SELECT
    event_type,
    uniqExact(session_id) AS sessions
FROM shopkit.click_events
WHERE event_type IN ('product_view', 'add_to_cart', 'checkout_complete')
  AND ts >= now() - INTERVAL 30 DAY
GROUP BY event_type
ORDER BY sessions DESC;
```

### Error analysis
```sql
-- Server errors grouped by endpoint
SELECT path, status, count() AS n
FROM shopkit.server_logs
WHERE status >= 400
  AND ts >= now() - INTERVAL 1 DAY
GROUP BY path, status
ORDER BY n DESC;

-- App-level errors with context
SELECT ts, message, context
FROM shopkit.app_logs
WHERE level = 'error'
  AND ts >= now() - INTERVAL 6 HOUR
ORDER BY ts DESC
LIMIT 100;
```

### JSONExtract for properties column
```sql
-- click_events.properties is a JSON string — use JSONExtractString/JSONExtractFloat
SELECT
    JSONExtractString(properties, 'product_name') AS product,
    JSONExtractFloat(properties, 'price')          AS price,
    count()                                         AS adds
FROM shopkit.click_events
WHERE event_type = 'add_to_cart'
  AND ts >= now() - INTERVAL 7 DAY
GROUP BY product, price
ORDER BY adds DESC
LIMIT 10;
```

### Top pages
```sql
SELECT page, count() AS views
FROM shopkit.click_events
WHERE event_type = 'pageview'
  AND ts >= now() - INTERVAL 7 DAY
GROUP BY page
ORDER BY views DESC
LIMIT 20;
```

---

## Materialized View Pattern (for dashboards)

When asked to speed up repeated aggregations, suggest an incremental MV:

```sql
-- Pre-aggregate hourly event counts
CREATE TABLE shopkit.click_events_hourly (
    event_type LowCardinality(String),
    hour       DateTime,
    events     AggregateFunction(count),
    sessions   AggregateFunction(uniq, String)
) ENGINE = AggregatingMergeTree()
  PARTITION BY toYYYYMM(hour)
  ORDER BY (event_type, hour);

CREATE MATERIALIZED VIEW shopkit.click_events_hourly_mv
TO shopkit.click_events_hourly AS
SELECT
    event_type,
    toStartOfHour(ts) AS hour,
    countState()       AS events,
    uniqState(session_id) AS sessions
FROM shopkit.click_events
GROUP BY event_type, hour;

-- Query (reads thousands of rows instead of billions)
SELECT event_type, hour,
       countMerge(events)   AS events,
       uniqMerge(sessions)  AS sessions
FROM shopkit.click_events_hourly
WHERE hour >= now() - INTERVAL 7 DAY
GROUP BY event_type, hour
ORDER BY hour;
```

---

## What NOT to do (anti-patterns)

| Anti-pattern | Why bad | Correct alternative |
|---|---|---|
| `SELECT *` on click_events | Reads all columns | Select only needed columns |
| No `ts` filter | Scans all partitions | Always add `ts >= now() - INTERVAL N DAY` |
| `ALTER TABLE DELETE` | Rewrites parts, very slow | Use TTL or DROP PARTITION |
| `OPTIMIZE TABLE FINAL` | Expensive, blocks merges | Let background merges run |
| Single-row inserts | Creates tiny parts | Batch 10K-100K rows or use async_insert |
| `avg(duration_ms)` for latency | Hides p95/p99 tails | Use `quantile(0.95)(duration_ms)` |
| Filter on non-ORDER BY column without index | Full scan | Add bloom_filter index or restructure query |

---

## Connection Info (internal Docker network)
- Host: `clickhouse` (or `localhost` from host machine)
- HTTP port: `8123`
- Native port: `9000`
- Database: `shopkit`
- User: `default`