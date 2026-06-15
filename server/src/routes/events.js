/**
 * POST /api/events
 * Receives a batch of click/pageview/api_call events from the browser and
 * bulk-inserts them into ClickHouse click_events.
 *
 * Body: { events: ClickEvent[] }
 * ClickEvent: {
 *   session_id: string
 *   event_type: 'click' | 'pageview' | 'api_call' | 'error' | string
 *   page:       string   (window.location.pathname)
 *   target:     string   (element selector or label)
 *   properties: object   (any extra data)
 *   duration_ms: number
 *   ts:         string   (ISO)
 * }
 *
 * Auth is optional — anonymous events are stored with user_id = ''.
 */

import { Router } from 'express';
import jwt from 'jsonwebtoken';
import ch from '../db/ch-client.js';

const router = Router();
const DB = process.env.CLICKHOUSE_DB || 'shopkit';

// Optional auth resolution (no hard failure if token is absent/invalid)
function resolveUserId(req) {
  try {
    const auth = req.headers.authorization || '';
    if (!auth.startsWith('Bearer ')) return '';
    const payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
    return payload.id ?? '';
  } catch {
    return '';
  }
}

router.post('/', async (req, res) => {
  const { events } = req.body;
  if (!Array.isArray(events) || events.length === 0) {
    return res.status(400).json({ error: 'events array required' });
  }
  if (events.length > 500) {
    return res.status(400).json({ error: 'max 500 events per batch' });
  }

  const userId = resolveUserId(req);

  const rows = events.map((e) => ({
    session_id:  String(e.session_id  || ''),
    user_id:     userId || String(e.user_id || ''),
    event_type:  String(e.event_type  || 'custom'),
    page:        String(e.page        || ''),
    target:      String(e.target      || ''),
    properties:  JSON.stringify(e.properties || {}),
    duration_ms: Math.round(Number(e.duration_ms) || 0),
  }));

  try {
    await ch.insert({
      table: `${DB}.click_events`,
      values: rows,
      format: 'JSONEachRow',
    });
    res.status(202).json({ inserted: rows.length });
  } catch (err) {
    // Don't expose CH internals, but do log
    console.error('ClickHouse insert error:', err.message);
    res.status(500).json({ error: 'Failed to store events' });
  }
});

export default router;
