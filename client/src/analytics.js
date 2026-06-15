/**
 * analytics.js
 *
 * Lightweight browser analytics SDK.
 * - Generates a persistent session_id (sessionStorage)
 * - Auto-captures: pageviews, all click events, unhandled JS errors
 * - Wraps fetch() to record api_call events with duration
 * - Batches events and flushes every 5 s or when the batch hits 20 events
 * - Uses sendBeacon on page unload so nothing is lost
 *
 * Usage:
 *   import analytics from './analytics.js';
 *   analytics.track('add_to_cart', { productId, price });
 */

const ENDPOINT = '/api/events';
const BATCH_SIZE = 20;
const FLUSH_INTERVAL = 5000; // ms

// ── Session ──────────────────────────────────────────────────────────────────
function getSessionId() {
  let id = sessionStorage.getItem('sk_session');
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem('sk_session', id);
  }
  return id;
}

const SESSION_ID = getSessionId();

// ── Queue & flush ────────────────────────────────────────────────────────────
let queue = [];

function flush() {
  if (queue.length === 0) return;
  const batch = queue.splice(0);
  const payload = JSON.stringify({ events: batch });

  // sendBeacon is preferred on unload (guaranteed delivery); fetch otherwise
  if (navigator.sendBeacon) {
    const blob = new Blob([payload], { type: 'application/json' });
    navigator.sendBeacon(ENDPOINT, blob);
  } else {
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  }
}

setInterval(flush, FLUSH_INTERVAL);
window.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flush();
});
window.addEventListener('pagehide', flush);

// ── Core track ───────────────────────────────────────────────────────────────
function track(eventType, properties = {}, { page, target, duration_ms } = {}) {
  queue.push({
    session_id:  SESSION_ID,
    event_type:  eventType,
    page:        page ?? window.location.pathname,
    target:      target ?? '',
    properties,
    duration_ms: duration_ms ?? 0,
    ts:          new Date().toISOString(),
  });
  if (queue.length >= BATCH_SIZE) flush();
}

// ── Auto: pageview ────────────────────────────────────────────────────────────
// Call this on every route change from your router
export function trackPageView(path) {
  track('pageview', {}, { page: path ?? window.location.pathname });
}

// ── Auto: clicks ─────────────────────────────────────────────────────────────
document.addEventListener('click', (e) => {
  const el = e.target;
  // Build a short CSS-selector-style label
  const tag = el.tagName?.toLowerCase() ?? 'unknown';
  const id = el.id ? `#${el.id}` : '';
  const cls = el.className && typeof el.className === 'string'
    ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.')
    : '';
  const text = el.textContent?.trim().slice(0, 60) ?? '';
  const target = `${tag}${id}${cls}`;

  track('click', { text }, { target });
}, { passive: true, capture: true });

// ── Auto: unhandled errors ────────────────────────────────────────────────────
window.addEventListener('error', (e) => {
  track('error', {
    message: e.message,
    source:  e.filename,
    lineno:  e.lineno,
    colno:   e.colno,
  }, { target: 'window.onerror' });
});

window.addEventListener('unhandledrejection', (e) => {
  track('error', {
    message: String(e.reason?.message ?? e.reason ?? 'unhandled rejection'),
    stack:   e.reason?.stack ?? '',
  }, { target: 'window.onunhandledrejection' });
});

// ── Fetch instrumentation ─────────────────────────────────────────────────────
// Wraps the global fetch so every API call gets tracked automatically.
// Only instruments calls to /api/* to avoid noise from third-party fetches.
const _originalFetch = window.fetch.bind(window);
window.fetch = async function instrumentedFetch(input, init) {
  const url = typeof input === 'string' ? input : input.url;
  const isApi = url.startsWith('/api/') || url.includes(window.location.origin + '/api/');

  if (!isApi) return _originalFetch(input, init);

  const method = init?.method?.toUpperCase() ?? 'GET';
  const t0 = performance.now();
  try {
    const response = await _originalFetch(input, init);
    const duration = Math.round(performance.now() - t0);
    // Don't track the event ingest endpoint itself (infinite loop guard)
    if (!url.includes('/api/events')) {
      track('api_call', { method, status: response.status, ok: response.ok }, {
        page:   window.location.pathname,
        target: url.replace(window.location.origin, ''),
        duration_ms: duration,
      });
    }
    return response;
  } catch (err) {
    const duration = Math.round(performance.now() - t0);
    track('api_call', { method, status: 0, ok: false, error: err.message }, {
      page:   window.location.pathname,
      target: url.replace(window.location.origin, ''),
      duration_ms: duration,
    });
    throw err;
  }
};

// ── Manual API ────────────────────────────────────────────────────────────────
const analytics = { track, trackPageView, flush };
export default analytics;
