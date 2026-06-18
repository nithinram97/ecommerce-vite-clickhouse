import { Router } from 'express';
import { optionalAuth } from '../middleware/auth.js';
import log from '../utils/logger.js';

const router = Router();

const GOOGLE_KEY = process.env.GOOGLE_KEY;
const MODEL      = process.env.LIBRECHAT_MODEL || 'gemini-1.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

function buildSystemPrompt(context = {}, user = null) {
  const lines = [
    'You are a friendly and helpful shopping assistant for ShopKit, an online store.',
    'Help customers find products, answer questions about orders, and guide them through checkout.',
    'Be concise and warm. Never make up prices, stock levels, or order details — only use context below.',
  ];
  if (user) lines.push(`Customer name: ${user.name}. Email: ${user.email}.`);
  if (context.product) {
    const p = context.product;
    lines.push(`\nProduct being viewed: ${p.name} — $${parseFloat(p.price).toFixed(2)}, ${p.stock > 0 ? p.stock + ' in stock' : 'OUT OF STOCK'}. ${p.description || ''}`);
  }
  if (context.cartItems?.length) {
    lines.push('\nCart: ' + context.cartItems.map(i => `${i.name} x${i.quantity}`).join(', '));
    lines.push(`Cart total: $${context.cartTotal?.toFixed(2)}`);
  }
  if (context.recentOrders?.length) {
    lines.push('\nRecent orders: ' + context.recentOrders.slice(0,3).map(o =>
      `#${o.id} $${o.total} (${o.status})`).join(', '));
  }
  lines.push('\nOnly answer shopping-related questions. Decline unrelated topics politely.');
  return lines.join('\n');
}

// POST /api/chat
router.post('/', optionalAuth, async (req, res) => {
  const { messages = [], context = {} } = req.body;

  if (!GOOGLE_KEY) {
    return res.status(503).json({ error: 'GOOGLE_KEY not set in environment.' });
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  const systemPrompt = buildSystemPrompt(context, req.user ?? null);

  // Gemini uses "contents" array; system instruction is separate
  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: messages.slice(-20).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
  };

  try {
    const upstream = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key' : GOOGLE_KEY},
      body: JSON.stringify(body),
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      log.error('Gemini API error', { status: upstream.status, data });
      return res.status(502).json({ error: data.error?.message || 'AI service error' });
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    res.json({ reply });

  } catch (err) {
    log.error('Chat error', { message: err.message });
    res.status(502).json({ error: 'AI service unavailable' });
  }
});

export default router;