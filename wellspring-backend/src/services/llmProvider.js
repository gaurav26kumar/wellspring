const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');

const gemini = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
// xAI's API is OpenAI-SDK-compatible — same client, just a different base URL.
const grok = process.env.XAI_API_KEY
  ? new OpenAI({ apiKey: process.env.XAI_API_KEY, baseURL: 'https://api.x.ai/v1' })
  : null;
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

async function callGemini({ system, messages, stream, onChunk }) {
  if (!gemini) throw new Error('GEMINI_API_KEY not configured');
  const model = gemini.getGenerativeModel({ model: 'gemini-1.5-flash', systemInstruction: system });

  // Gemini wants alternating user/model turns in `history`, with the most
  // recent message sent separately via sendMessage — no combined array
  // like Anthropic/OpenAI take.
  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  const last = messages[messages.length - 1];
  const chat = model.startChat({ history });

  if (!stream) {
    const res = await chat.sendMessage(last.content);
    return res.response.text();
  }
  const res = await chat.sendMessageStream(last.content);
  let full = '';
  for await (const chunk of res.stream) {
    const text = chunk.text();
    if (text) {
      full += text;
      onChunk && onChunk(text);
    }
  }
  return full;
}

async function callGrok({ system, messages, stream, onChunk }) {
  if (!grok) throw new Error('XAI_API_KEY not configured');
  const chatMessages = [{ role: 'system', content: system }, ...messages];
  if (!stream) {
    const res = await grok.chat.completions.create({ model: 'grok-4.3', messages: chatMessages });
    return res.choices[0].message.content;
  }
  const s = await grok.chat.completions.create({ model: 'grok-4.3', messages: chatMessages, stream: true });
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
// the loop below just moves on, so it's fine to leave all four wired up
// and only fill in the ones you're actually using.
const PROVIDERS = [
  { name: 'gemini', call: callGemini },
  { name: 'grok', call: callGrok },
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
