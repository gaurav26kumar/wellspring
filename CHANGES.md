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

## 4. `retrievalFailed` was computed and passed, then silently dropped

`chat.routes.js` already tracked whether the Atlas `$vectorSearch` retrieval
step failed for a given message (`retrievalFailed`) and passed it into
`runReflectionAgent(...)`. But `reflectionAgent.js`'s function signature only
destructured `{ message, memories, sessionId }` — the flag was thrown away
before it ever reached `formatMemories()`. Net effect: on a retrieval failure,
the model's system prompt said "No relevant past entries or messages were
retrieved for this message" — worded identically to the case where the person
genuinely has no matching history — so a degraded turn could read to the model
(and via its reply, to the person) as "I checked your memories and there's
nothing there," which isn't true; retrieval was never actually run.

Fix: `runReflectionAgent` now accepts `retrievalFailed` and `formatMemories()`
returns a distinct message for that case, explicit that this is an infra
issue and to proceed without implying the memories were checked.

## 5. Missing `wellspring-backend/.env.example`

Both READMEs instruct `cp .env.example .env`, but only the frontend actually
shipped one — the backend's was missing entirely from this upload (most
likely stripped after the real-credential issue in item 3 above, without a
clean placeholder being committed back). Anyone following the README setup
steps for the backend would hit a `cp: cannot stat '.env.example'` dead end
with no indication of which environment variables to set. Added a
placeholder-only `wellspring-backend/.env.example` covering every variable
the backend code actually reads (`MONGODB_URI`, `JWT_SECRET`,
`GEMINI_API_KEY`, `JWT_EXPIRES_IN`, `FRONTEND_URL`, `PORT`,
`EMBEDDING_DIMENSIONS`, `EMBEDDING_MODEL`, `XAI_API_KEY`, `ANTHROPIC_API_KEY`,
`OPENAI_API_KEY`, `ADMIN_ALERT_EMAIL`), with short notes on which are
required.

## 6. Mood slider could get stuck mid-drag

`MoodPicker.jsx` handled `pointerdown` on the track but `pointermove` /
`pointerup` on its parent, with no `setPointerCapture`. Without capture,
pointer events only fire while the cursor is literally over the listening
element — a fast drag that crossed outside the ~34px-tall track (easy to do)
would stop updating the slider and never fire the `pointerup` that ends the
drag, leaving `dragging` stuck `true` until the next click anywhere. Fixed by
capturing the pointer on `pointerdown` so the element keeps receiving
move/up events for that pointer regardless of where it travels.

## 7. `animate-fade-in` did nothing

`LandingPage.jsx`'s intro badge used `className="... animate-fade-in"`, but
no such utility existed — it's not a built-in Tailwind class and nothing in
`tailwind.config.js` defined it, so Tailwind silently dropped it and the
badge just appeared with no animation. Added a `fadeIn` keyframe and
`fade-in` animation to `tailwind.config.js` so the intended entrance
animation actually renders.

## Also fixed in passing

- Removed a dead, no-op variable (`showingEntry`) in `JournalPage.jsx` that
  was assigned but never read anywhere in the component.
