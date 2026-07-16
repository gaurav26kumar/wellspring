# Wellspring backend (MERN)

Express + MongoDB (Atlas Vector Search) implementation of the architecture in
`wellspring-architecture.pdf`, adapted from the original FastAPI + Postgres/pgvector plan.

## Setup

```bash
npm install
cp .env.example .env   # fill in MONGODB_URI, JWT_SECRET, and GEMINI_API_KEY (required — also powers embeddings)
npm run create-vector-indexes   # one-time, requires an Atlas cluster
npm run dev
```

## Folder structure

```
src/
├── server.js              # entry point — connects DB, starts scheduler, mounts routes
├── config/db.js           # mongoose connection
├── models/                # one file per collection (users, journal_entries, chat_sessions,
│                           #   chat_messages, insights, nudges, safety_flags)
├── middleware/auth.js      # JWT verification
├── services/
│   ├── embeddings.js       # embedding provider wrapper
│   ├── retrieval.js        # Atlas $vectorSearch — the pgvector-equivalent step
│   ├── llmProvider.js      # Claude/GPT abstraction with fallback chain
│   └── agents/
│       ├── safetyAgent.js      # runs first, every message, no exceptions
│       ├── reflectionAgent.js  # builds the prompt, streams the reply
│       └── insightAgent.js     # weekly summarization
├── api/v1/                 # route handlers
├── workers/                 # scheduler + background jobs (embeddings, insights, nudges)
└── scripts/createVectorIndex.js
```

## What changed from the original plan, and why

| Original (FastAPI/Postgres) | Here (Express/Mongo) | Note |
|---|---|---|
| pgvector similarity search | Atlas `$vectorSearch` | Same "one DB, no separate vector store" property |
| SQLAlchemy + Alembic | Mongoose, schemaless | No migration tool needed; schema validation lives in the Mongoose models themselves |
| APScheduler | `node-cron` | Fine for one instance — see the comment in `workers/scheduler.js` about Agenda if you scale to more |
| SSE via FastAPI | SSE via raw Express `res.write` | Same wire format, `chat.routes.js` |
| — | Gemini for embeddings, Gemini/Grok/Anthropic/OpenAI for chat (in that order) | Gemini has a genuine no-credit-card free tier and is the only one of the four with a public embeddings endpoint — see `services/embeddings.js` and `services/llmProvider.js` |

## The one thing not to skip

`services/agents/safetyAgent.js` runs before retrieval, before the reflection
agent, before the general-purpose LLM sees anything. `chat.routes.js` enforces
that ordering in code, not just in the diagram. Read the comments in both
files before changing that flow — building this out for real users without
it working, tested, and reviewed first isn't a "get to it later" item.

`models/SafetyFlag.js` is intentionally not exposed by any CRUD route.
Decide access and retention for that collection on purpose before you add one.
