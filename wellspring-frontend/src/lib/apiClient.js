const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const TOKEN_KEY = 'wellspring_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

/**
 * `stream: true` returns the raw fetch Response instead of parsed JSON —
 * used only by sendChatMessage, since that endpoint replies with either
 * a normal JSON object (safety-agent intercept) or an SSE body (normal
 * reply), and the caller needs to check the content-type to know which.
 */
async function request(path, { method = 'GET', body, headers = {}, stream = false } = {}) {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (stream) return res;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  register: (email, password) => request('/api/v1/auth/register', { method: 'POST', body: { email, password } }),
  login: (email, password) => request('/api/v1/auth/login', { method: 'POST', body: { email, password } }),
  getMe: () => request('/api/v1/auth/me'),

  getJournal: () => request('/api/v1/journal'),
  postJournal: (content, moodScore) => request('/api/v1/journal', { method: 'POST', body: { content, moodScore } }),

  createChatSession: (title) => request('/api/v1/chat/sessions', { method: 'POST', body: { title } }),
  getChatSession: (id) => request(`/api/v1/chat/sessions/${id}`),
  sendChatMessage: (id, message) =>
    request(`/api/v1/chat/sessions/${id}/message`, { method: 'POST', body: { message }, stream: true }),

  getInsights: () => request('/api/v1/insights'),
  getNudges: () => request('/api/v1/nudges'),
  updateNudge: (id, status) => request(`/api/v1/nudges/${id}`, { method: 'PATCH', body: { status } }),
};
