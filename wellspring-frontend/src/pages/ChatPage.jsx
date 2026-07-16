import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/apiClient';

export function ChatPage() {
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    api
      .createChatSession('New chat')
      .then((s) => setSessionId(s._id))
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || !sessionId || streaming) return;

    setInput('');
    setError(null);
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setStreaming(true);

    try {
      const res = await api.sendChatMessage(sessionId, text);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      const contentType = res.headers.get('content-type') || '';

      // ---- Path 1: safety agent intercepted the message. The backend
      // replies with plain JSON here instead of a stream — the general
      // LLM never generated this text. ----
      if (contentType.includes('application/json')) {
        const data = await res.json();
        setMessages((prev) => [...prev, { role: 'assistant', content: data.content, safety: !!data.safety }]);
        setStreaming(false);
        return;
      }

      // ---- Path 2: normal SSE stream. EventSource can't send a POST body,
      // so this reads the ReadableStream by hand, buffering partial chunks
      // across `data: ...\n\n` boundaries. ----
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = '';
      let buffer = '';
      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split('\n\n');
        buffer = events.pop(); // last element may be an incomplete event — keep it for next read

        for (const evt of events) {
          const line = evt.trim();
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (payload === '[DONE]') continue;

          try {
            const { delta, error: streamError } = JSON.parse(payload);
            if (streamError) assistantText += `\n(${streamError})`;
            if (delta) assistantText += delta;
            setMessages((prev) => {
              const next = [...prev];
              next[next.length - 1] = { role: 'assistant', content: assistantText };
              return next;
            });
          } catch {
            // ignore malformed/partial JSON — shouldn't happen given the
            // buffering above, but don't crash the stream over it
          }
        }
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-160px)] bg-[var(--surface)] border border-[var(--panel-border)] rounded-[20px] overflow-hidden mt-4">
      <div className="flex-1 overflow-y-auto px-7 py-6 flex flex-col gap-4">
        {messages.length === 0 && (
          <div className="m-auto text-center text-[var(--mist)] max-w-[280px]">
            <div className="font-label text-[11px] uppercase tracking-wide text-[var(--line-teal)] mb-2.5">New chat</div>
            <div className="font-display italic text-2xl text-[var(--paper)]">What's on your mind?</div>
          </div>
        )}

        {messages.map((m, i) =>
          m.safety ? (
            <div key={i} className="bg-[color-mix(in_srgb,var(--glow-amber)_9%,transparent)] border border-[color-mix(in_srgb,var(--glow-amber)_45%,transparent)] rounded-2xl px-5 py-4">
              <div className="font-label text-[10.5px] font-semibold uppercase tracking-wide text-[var(--glow-amber)] mb-2">
                Safety layer response
              </div>
              <div className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</div>
            </div>
          ) : (
            <div key={i} className={`flex gap-3 max-w-[75%] ${m.role === 'user' ? 'self-end flex-row-reverse' : ''}`}>
              {m.role === 'assistant' && (
                <span className="w-3.5 h-3.5 rounded-full bg-[var(--line-teal)] mt-2 flex-shrink-0" />
              )}
              <div
                className="rounded-2xl px-4 py-3 text-[14.5px] leading-relaxed"
                style={{ background: m.role === 'user' ? 'var(--surface-active)' : 'var(--bubble)' }}
              >
                {m.content || (streaming && i === messages.length - 1 ? '…' : '')}
              </div>
            </div>
          )
        )}
        <div ref={bottomRef} />
      </div>

      {error && <div className="px-7 pb-2 font-label text-[11px] text-[var(--glow-amber)]">{error}</div>}

      <div className="flex gap-2.5 px-6 py-5 border-t border-[var(--divider)]">
        <textarea
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Say what's actually going on…"
          className="flex-1 resize-none bg-[var(--surface-active)] rounded-2xl px-4 py-3 outline-none text-[14.5px] text-[var(--paper)] placeholder:text-[var(--mist)] max-h-[120px]"
        />
        <button
          onClick={send}
          disabled={streaming}
          className="font-label text-xs font-semibold uppercase tracking-wider bg-[var(--glow-amber)] text-[var(--bg)] rounded-full px-6 disabled:opacity-60"
        >
          Send
        </button>
      </div>
    </div>
  );
}
