# Wellspring frontend (React + Vite + Tailwind)

Real port of the HTML mockups (`wellspring-intro.html`, `-journal.html`, `-chat.html`,
`-growth.html`, `-community.html`) into an actual app, wired to `wellspring-backend`.

## Setup

```bash
npm install
cp .env.example .env      # set VITE_API_URL to wherever the backend is running
npm run dev                # http://localhost:5173
```

Run `wellspring-backend` alongside this (see its own README) — nothing here works
without it; there's no mock-data fallback.

## What's real vs. not

| Screen | Status |
|---|---|
| Login / Register | Fully wired — `src/pages/LoginPage.jsx`, `RegisterPage.jsx`, plus session restore via `GET /api/v1/auth/me` on refresh |
| Journal | Fully wired — real GET/POST against `/api/v1/journal`, immutable past entries, mood picker posts an actual 1-5 score |
| Chat | Fully wired — real SSE-over-POST streaming (`src/pages/ChatPage.jsx`), handles both the streamed-reply path and the safety-agent JSON-intercept path |
| Growth dashboard | Fully wired — real three.js phyllotaxis graph built from `/api/v1/journal`, `/api/v1/insights`, `/api/v1/nudges`. Per-entry themes are inferred client-side by substring-matching against the theme vocabulary Insight docs already contain (same heuristic `workers/taskNudges.js` uses server-side) — there's no dedicated themes field on JournalEntry yet |
| Community rooms | **Stub only** — needs new backend routes and its own moderation model first, not just a frontend port; see `src/pages/CommunityPage.jsx` |

## Design tokens

`src/index.css` is the single source of truth for colors (dark/light via
`:root[data-theme]`), replacing the five copy-pasted `<style>` blocks in the
original HTML mockups. `tailwind.config.js` only adds the three font-family
aliases (`font-display` / `font-label` / `font-ui`) — colors intentionally stay
as CSS variables referenced via Tailwind's arbitrary-value syntax
(`bg-[var(--surface)]`) rather than being duplicated into the Tailwind theme,
so there's exactly one place to change a color.

## The SSE parsing in ChatPage.jsx is worth reading once

`EventSource` can't send a POST body, and the chat endpoint needs one (the
message text), so this reads `res.body.getReader()` by hand instead of using
`EventSource`. It buffers across `data: ...\n\n` boundaries because a single
stream chunk from the network won't line up with SSE event boundaries — this
is the part people usually get wrong when hand-rolling SSE parsing.
