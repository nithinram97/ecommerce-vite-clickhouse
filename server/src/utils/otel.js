/**
 * otel.js
 * Minimal OpenTelemetry OTLP/HTTP log exporter → ClickStack / HyperDX.
 *
 * Required env var:
 *   OTEL_EXPORTER_OTLP_ENDPOINT  e.g. http://clickstack:4318   (default)
 *   OTEL_EXPORTER_OTLP_HEADERS   e.g. Authorization=Bearer <key>
 *                                 Comma-separated key=value pairs.
 *                                 Get the key from HyperDX UI →
 *                                 Team Settings → API Keys → copy key → use as:
 *                                 Authorization=Bearer <YOUR_API_KEY>
 *
 * Optional:
 *   OTEL_SERVICE_NAME             default: ecommerce-server
 *   OTEL_SERVICE_VERSION          default: 1.0.0
 */

const OTLP_ENDPOINT =
  (process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://clickstack:4318') + '/v1/logs';

const SERVICE_NAME    = process.env.OTEL_SERVICE_NAME    || 'ecommerce-server';
const SERVICE_VERSION = process.env.OTEL_SERVICE_VERSION || '1.0.0';
process.env.OTEL_EXPORTER_OTLP_HEADERS = "Authorization= 6444616d-61f1-4631-93a3-1bfb054c8616";

/**
 * Parse OTEL_EXPORTER_OTLP_HEADERS into a plain object.
 * Format: "Key1=Value1,Key2=Value2"
 * Example: "Authorization=Bearer abc123"
 */
function parseOtlpHeaders(raw = '') {
  const headers = {};
  for (const pair of raw.split(',')) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    if (key) headers[key] = val;
  }
  return headers;//
}

const EXTRA_HEADERS = parseOtlpHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS || '');

// Severity text → OTLP severity number
const SEVERITY = {
  debug: { text: 'DEBUG', number: 5  },
  info:  { text: 'INFO',  number: 9  },
  warn:  { text: 'WARN',  number: 13 },
  error: { text: 'ERROR', number: 17 },
};

/**
 * Send one log record to ClickStack via OTLP HTTP.
 * Fire-and-forget — never throws into the caller.
 */
export async function sendLog(level, message, attrs = {}) {
  const sev   = SEVERITY[level] ?? SEVERITY.info;
  const nowNs = (BigInt(Date.now()) * 1_000_000n).toString();

  const kvList = Object.entries(attrs).map(([key, value]) => ({
    key,
    value: { stringValue: String(value) },
  }));

  const body = {
    resourceLogs: [{
      resource: {
        attributes: [
          { key: 'service.name',    value: { stringValue: SERVICE_NAME } },
          { key: 'service.version', value: { stringValue: SERVICE_VERSION } },
        ],
      },
      scopeLogs: [{
        scope: { name: 'ecommerce' },
        logRecords: [{
          timeUnixNano:         nowNs,
          observedTimeUnixNano: nowNs,
          severityNumber:       sev.number,
          severityText:         sev.text,
          body:                 { stringValue: message },
          attributes:           kvList,
        }],
      }],
    }],
  };

  try {
    const res = await fetch(OTLP_ENDPOINT, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        ...EXTRA_HEADERS,   // injects Authorization: Bearer <key>
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      process.stderr.write(`[otel] export failed ${res.status}: ${text}\n`);
    }
  } catch (err) {
    process.stderr.write(`[otel] unreachable: ${err.message}\n`);
  }
}