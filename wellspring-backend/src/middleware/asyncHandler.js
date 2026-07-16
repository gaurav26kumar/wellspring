/**
 * Express 4 does NOT catch rejected promises thrown inside async route
 * handlers. Left unwrapped, an error thrown mid-handler (a bad DB query,
 * a missing Atlas Vector Search index, an LLM call throwing) never reaches
 * an error middleware and never sends a response — the request just hangs
 * until the client times out. This was the cause of "chat never responds":
 * chat.routes.js's POST /sessions/:id/message calls retrieveRelevantMemories()
 * (Atlas $vectorSearch) with no try/catch; if the vector indexes haven't
 * been created (see scripts/createVectorIndex.js) or the query throws for
 * any other reason, the request silently hangs forever.
 *
 * Wrap every async route handler with this so thrown/rejected errors are
 * always forwarded to Express's error-handling middleware, which always
 * sends a response.
 */
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { asyncHandler };
