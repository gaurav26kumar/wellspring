# What was wrong, and what changed

## 1. Chat not responding

Root cause: every backend route (`chat.routes.js` especially) was an `async`
Express handler with no `try/catch`. Express 4 does **not** catch rejected
promises thrown inside async handlers — if anything in the chain throws,
the request just hangs forever with no response, no error, nothing. The
frontend sits in its "streaming…" state indefinitely.

The most likely trigger for chat specifically: `POST /sessions/:id/message`
calls `retrieveRelevantMemories()`, which runs a MongoDB Atlas
`$vectorSearch` query. That requires the vector indexes to already exist
(`npm run create-vector-indexes` in `wellspring-backend/README.md`), and a
working `GEMINI_API_KEY` for embeddings. If that one-time setup step was
skipped, or the index name doesn't match, the aggregate throws — and with
no `try/catch`, the request never responds.

Fixes:
- Added `src/middleware/asyncHandler.js` and wrapped **every** route handler
  in it, so any thrown/rejected error is forwarded to Express's error
  middleware, which always sends a response.
- `chat.routes.js`: retrieval failures are now caught and logged, and the
  chat continues without memory grounding for that turn instead of hanging.
- `chat.routes.js`: if every LLM provider fails before any SSE bytes are
  written, the client gets a clean `502 JSON` instead of a hung connection.
- `server.js`: added `process.on('unhandledRejection'/'uncaughtException')`
  logging, and the error middleware now checks `res.headersSent` so it
  doesn't try to double-send a response mid-stream.

**You still need to run the one-time setup** if you haven't:
```bash
cd wellspring-backend
npm run create-vector-indexes   # requires MONGODB_URI to point at Atlas
```
Without this, chat will now fail fast with a clear response/log line
instead of hanging — check the server logs for
`[chat.routes] retrieval failed` or `[llmProvider] ... failed` if replies
still don't come through.

## 2. Landing page missing from the deployed site

The landing page *was* correctly wired in `App.jsx` (`/` → `LandingPage`).
The problem was the `dist/` folder shipped in the project: it was a stale
production build made **before** the landing page (and the chat page) were
added — I confirmed neither `LandingPage` nor `ChatPage` content existed
anywhere in the built JS. Whatever was serving that `dist/` folder was
serving an old app.

Fix: rebuilt the frontend from current source (`npm run build`). The new
`wellspring-frontend/dist/` now includes the landing page. If you deploy by
uploading `dist/`, redeploy this one; if you build on your host/CI, just
make sure the build step actually runs on each deploy instead of reusing a
cached `dist/`.

## 3. Font & light theme

- Dropped Space Grotesk from the label typeface and consolidated on
  **Fraunces** (display) + **Manrope** (everything else) — fewer competing
  typefaces reads calmer and more deliberate.
- Replaced `tracking-widest` with `tracking-wide` and heavy `font-bold
  uppercase` labels with `font-semibold uppercase` app-wide — the
  wide-tracked bold caps on tiny text was the biggest source of the "loud"
  feeling.
- Light theme palette: warmed up the neutrals (`--bg`, `--paper`, `--mist`)
  away from a cool clinical grey-green, and slightly muted the teal/amber
  accents so they read as intentional rather than bright. Dark theme
  untouched.
- Added antialiasing + a touch of negative letter-spacing on body text for
  a more polished, less default look.

You can push further from here (e.g. a true single-typeface system, or
softer border-radius) — these were the highest-leverage, lowest-risk
changes given everything else in the app already references these classes
and variables.

## Also worth knowing (didn't touch, but flagging)

`wellspring-backend/.env.example` in the original upload contains what
look like **real** credentials (a live-looking MongoDB Atlas URI with a
username/password, and API-key-shaped strings for Gemini/xAI) committed as
"example" values. If those are real, rotate them — an `.env.example`
committed to a repo (or a zip you share) is not a safe place for live
secrets, example or not.
