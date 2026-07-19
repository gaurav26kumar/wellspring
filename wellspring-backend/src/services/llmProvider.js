const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');

/**
 * Groq's API is OpenAI-SDK-compatible — same client, different base URL.
 * Groq has been retiring chat models fast this year: llama-3.3-70b-versatile
 * and llama-3.1-8b-instant (the models in most tutorials) were both
 * deprecated June 17, 2026. openai/gpt-oss-20b below is their current
 * recommended replacement. If this 404s later too, check what's actually
 * live for your key with:
 *   curl https://api.groq.com/openai/v1/models -H "Authorization: Bearer YOUR_KEY"
 * and set GROQ_CHAT_MODEL in .env rather than editing this file again.
 */
const GROQ_CHAT_MODEL = process.env.GROQ_CHAT_MODEL || 'openai/gpt-oss-20b';
const groq = process.env.GROQ_API_KEY
  ? new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' })
  : null;
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

async function callGroq({ system, messages, stream, onChunk }) {
  if (!groq) throw new Error('GROQ_API_KEY not configured');
  const chatMessages = [{ role: 'system', content: system }, ...messages];
  if (!stream) {
    const res = await groq.chat.completions.create({ model: GROQ_CHAT_MODEL, messages: chatMessages });
    return res.choices[0].message.content;
  }
  const s = await groq.chat.completions.create({ model: GROQ_CHAT_MODEL, messages: chatMessages, stream: true });
  let full = '';
  for await (const part of s) {
    const chunk = part.choices[0]?.delta?.content || '';
    if (chunk) {
      full += chunk;
      onChunk && onChunk(chunk);
    }
  }
  return full;
}

async function callAnthropic({ system, messages, stream, onChunk }) {
  if (!anthropic) throw new Error('ANTHROPIC_API_KEY not configured');
  if (!stream) {
    const res = await anthropic.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 800, system, messages });
    return res.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  }
  const s = await anthropic.messages.stream({ model: 'claude-sonnet-4-6', max_tokens: 800, system, messages });
  let full = '';
  s.on('text', (chunk) => {
    full += chunk;
    onChunk && onChunk(chunk);
  });
  await s.finalMessage();
  return full;
}

async function callOpenAI({ system, messages, stream, onChunk }) {
  if (!openai) throw new Error('OPENAI_API_KEY not configured');
  const chatMessages = [{ role: 'system', content: system }, ...messages];
  if (!stream) {
    const res = await openai.chat.completions.create({ model: 'gpt-4.1', messages: chatMessages });
    return res.choices[0].message.content;
  }
  const s = await openai.chat.completions.create({ model: 'gpt-4.1', messages: chatMessages, stream: true });
  let full = '';
  for await (const part of s) {
    const chunk = part.choices[0]?.delta?.content || '';
    if (chunk) {
      full += chunk;
      onChunk && onChunk(chunk);
    }
  }
  return full;
}

// Tried in this order. Only providers with a key set in .env actually get
// attempted — each call*() throws immediately if its key is missing, and
// the loop below just moves to the next one.
const PROVIDERS = [
  { name: 'groq', call: callGroq },
  { name: 'anthropic', call: callAnthropic },
  { name: 'openai', call: callOpenAI },
];

async function generate({ system, messages, stream = false, onChunk }) {
  let lastError;
  for (const provider of PROVIDERS) {
    try {
      return await provider.call({ system, messages, stream, onChunk });
    } catch (err) {
      lastError = err;
      console.error(`[llmProvider] ${provider.name} failed, trying next — ${err.message}`);
    }
  }
  throw new Error(`All LLM providers failed: ${lastError?.message}`);
}

module.exports = { generate };
