/**
 * /api/chat  — Proxy to LibreChat's OpenAI-compatible endpoint.
 *
 * The client sends:
 *   POST /api/chat
 *   { messages: [{role, content}], context?: { product?, cartItems?, orders? } }
 *
 * This route:
 *  1. Injects a system prompt with live store context (product, cart, etc.)
 *  2. Streams the LibreChat response back to the browser using SSE so the
 *     UI can render tokens as they arrive.
 *  3. Optionally authenticates the user so the AI knows their name / order history.
 */

import { Router } from 'express';
import { optionalAuth } from '../middleware/auth.js';
import log from '../utils/logger.js';

const router = Router();

const LIBRECHAT_URL     = process.env.LIBRECHAT_URL     || 'http://librechat:3080';
const LIBRECHAT_API_KEY = process.env.LIBRECHAT_API_KEY || 'user_librechat';
// Model must match one configured in librechat.yaml
const LIBRECHAT_MODEL   = process.env.LIBRECHAT_MODEL   || 'gpt-4o-mini';

function buildSystemPrompt(context = {}, user = null) {
  const lines = [
    'You are a friendly and helpful shopping assistant for ShopKit, an online store.',
    'You help customers find products, answer questions about their orders, and guide them through checkout.',
    'Be concise, warm, and proactive. If a customer seems stuck, suggest next steps.',
    'Never make up prices, stock levels, or order details — only use the context provided below.',
    '',
  ];

  if (user) {
    lines.push(`The customer's name is ${user.name}. Their email is ${user.email}.`);
  }

  if (context.product) {
    const p = context.product;
    lines.push('');
    lines.push('## Product the customer is currently viewing:');
    lines.push(`- Name: ${p.name}`);
    lines.push(`- Price: $${parseFloat(p.price).toFixed(2)}`);
    lines.push(`- Category: ${p.category || 'Uncategorised'}`);
    lines.push(`- Description: ${p.description || 'No description'}`);
    lines.push(`- Stock: ${p.stock > 0 ? `${p.stock} units available` : 'Out of stock'}`);
  }

  if (context.cartItems?.length) {
    lines.push('');
    lines.push('## Customer\'s current cart:');
    for (const item of context.cartItems) {
      lines.push(`- ${item.name} × ${item.quantity} @ $${parseFloat(item.price).toFixed(2)}`);
    }
    lines.push(`Cart total: $${context.cartTotal?.toFixed(2) ?? '?'}`);
  }

  if (context.recentOrders?.length) {
    lines.push('');
    lines.push('## Customer\'s recent orders:');
    for (const o of context.recentOrders.slice(0, 3)) {
      lines.push(`- Order #${o.id} — $${parseFloat(o.total).toFixed(2)} — Status: ${o.status} — Placed: ${new Date(o.created_at).toLocaleDateString()}`);
    }
  }

  lines.push('');
  lines.push('Answer only questions relevant to shopping, products, orders, and the store. Decline unrelated topics politely.');

  return lines.join('\n');
}

// POST /api/chat  — streaming SSE response
router.post('/', optionalAuth, async (req, res) => {
  const { messages = [], context = {} } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  const systemPrompt = buildSystemPrompt(context, req.user ?? null);

  const payload = {
    model:  LIBRECHAT_MODEL,
    stream: true,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages.slice(-20),   // keep last 20 turns to stay within context limits
    ],
  };

  try {
    const upstream = await fetch(`${LIBRECHAT_URL}/api/ask/openAI`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LIBRECHAT_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!upstream.ok) {
      const err = await upstream.text();
      log.error('LibreChat upstream error', { status: upstream.status, body: err });
      return res.status(502).json({ error: 'AI service unavailable' });
    }

    // Forward as SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');   // disable nginx buffering

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(decoder.decode(value, { stream: true }));
    }

    res.end();
  } catch (err) {
    log.error('Chat proxy error', { message: err.message });
    if (!res.headersSent) {
      res.status(502).json({ error: 'AI service unavailable' });
    }
  }
});

export default router;