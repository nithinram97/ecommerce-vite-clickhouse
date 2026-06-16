/**
 * ChatWidget — floating AI shopping assistant powered by LibreChat.
 *
 * Usage (no props required — works on any page):
 *   <ChatWidget />
 *
 * With product context (on ProductDetail page):
 *   <ChatWidget product={product} />
 *
 * With full context:
 *   <ChatWidget product={product} />
 *   The widget reads cart and orders from their hooks automatically.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import { useCart } from '../hooks/useCart.jsx';
import './ChatWidget.css';

const WELCOME = "Hi! 👋 I'm your ShopKit assistant. Ask me anything about products, your cart, or orders!";

export default function ChatWidget({ product = null }) {
  const { user } = useAuth();
  const { cart }  = useCart();

  const [open,     setOpen]     = useState(false);
  const [messages, setMessages] = useState([{ role: 'assistant', content: WELCOME }]);
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);
  const abortRef   = useRef(null);

  // Scroll to bottom whenever messages update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: 'user', content: text };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput('');
    setLoading(true);

    // Placeholder for streaming assistant reply
    const assistantMsg = { role: 'assistant', content: '' };
    setMessages([...history, assistantMsg]);

    // Build context snapshot
    const context = {
      product:      product  ?? null,
      cartItems:    cart.items ?? [],
      cartTotal:    cart.total ?? 0,
      recentOrders: null,   // could be fetched if needed
    };

    try {
      abortRef.current = new AbortController();

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token')
            ? { Authorization: `Bearer ${localStorage.getItem('token')}` }
            : {}),
        },
        body: JSON.stringify({
          messages: history.filter(m => m.role !== 'system'),
          context,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        throw new Error('AI service unavailable');
      }

      // Stream SSE tokens
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   buffer  = '';
      let   full    = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;
          try {
            const json  = JSON.parse(data);
            const token = json.choices?.[0]?.delta?.content ?? '';
            full += token;
            setMessages(prev => {
              const next = [...prev];
              next[next.length - 1] = { role: 'assistant', content: full };
              return next;
            });
          } catch { /* skip malformed SSE lines */ }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      setMessages(prev => {
        const next = [...prev];
        next[next.length - 1] = {
          role: 'assistant',
          content: "Sorry, I couldn't connect to the AI service right now. Please try again in a moment.",
        };
        return next;
      });
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, product, cart]);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const clearChat = () => {
    abortRef.current?.abort();
    setMessages([{ role: 'assistant', content: WELCOME }]);
    setLoading(false);
  };

  return (
    <div className="chat-widget">
      {/* Floating bubble */}
      <button
        className={`chat-bubble ${open ? 'chat-bubble--open' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close chat' : 'Open AI assistant'}
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        )}
        {!open && messages.length > 1 && (
          <span className="chat-bubble__badge">{messages.filter(m => m.role === 'assistant').length}</span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="chat-panel card">
          {/* Header */}
          <div className="chat-header">
            <div className="chat-header__info">
              <div className="chat-header__avatar">🛍️</div>
              <div>
                <div className="chat-header__name">ShopKit Assistant</div>
                <div className="chat-header__status">
                  <span className="chat-header__dot" />
                  {loading ? 'Typing…' : 'Online'}
                </div>
              </div>
            </div>
            <button className="chat-clear" onClick={clearChat} title="Clear conversation">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/>
              </svg>
            </button>
          </div>

          {/* Context pill — shown when on a product page */}
          {product && (
            <div className="chat-context">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              Asking about <strong>{product.name}</strong>
            </div>
          )}

          {/* Messages */}
          <div className="chat-messages">
            {messages.map((msg, i) => (
              <div key={i} className={`chat-msg chat-msg--${msg.role}`}>
                {msg.role === 'assistant' && (
                  <div className="chat-msg__avatar">🛍️</div>
                )}
                <div className="chat-msg__bubble">
                  {msg.content
                    ? msg.content
                    : <span className="chat-typing"><span/><span/><span/></span>}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions — shown only at start */}
          {messages.length === 1 && (
            <div className="chat-suggestions">
              {[
                product ? `Tell me more about ${product.name}` : 'What\'s popular right now?',
                'What\'s in my cart?',
                'How do I track my order?',
              ].map(s => (
                <button key={s} className="chat-suggestion" onClick={() => { setInput(s); inputRef.current?.focus(); }}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="chat-input-row">
            <textarea
              ref={inputRef}
              className="chat-input input"
              rows={1}
              placeholder="Ask me anything…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              disabled={loading}
            />
            <button
              className="chat-send btn btn-primary"
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              aria-label="Send"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
