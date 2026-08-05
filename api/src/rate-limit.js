const { sql, withRequest } = require('./db')

const WINDOW_MS = 15 * 60 * 1000
const MAX_REQUESTS = 10

// DB-backed so limits are enforced consistently across Azure Functions scale-out/cold
// starts (an in-memory Map only protects a single warm instance).
//
// Single round-trip: count hits still inside the window and conditionally insert
// in one batch, instead of DELETE + SELECT + INSERT as three separate round-trips.
// This runs on every login/register/OTP request, so the extra latency multiplied
// across concurrent auth traffic mattered. Stale-row cleanup is decoupled from the
// hot path (fire-and-forget, sampled) since it's just housekeeping, not correctness
// — the window filter on created_at already makes counts correct regardless.
async function consumeRateLimit(key, options = {}) {
  const windowMs = options.windowMs || WINDOW_MS
  const maxRequests = options.maxRequests || MAX_REQUESTS
  const windowStart = new Date(Date.now() - windowMs)

  const request = await withRequest({
    key: { type: sql.NVarChar(200), value: key },
    windowStart: { type: sql.DateTime2, value: windowStart },
    maxRequests: { type: sql.Int, value: maxRequests },
  })

  const result = await request.query(`
    DECLARE @hitCount INT;
    SELECT @hitCount = COUNT(*) FROM dbo.RateLimitHits WHERE rate_key = @key AND created_at > @windowStart;

    IF @hitCount < @maxRequests
      INSERT INTO dbo.RateLimitHits (rate_key) VALUES (@key);

    SELECT @hitCount AS hitCount;
  `)

  if (Math.random() < 0.01) {
    withRequest({
      cutoff: { type: sql.DateTime2, value: new Date(Date.now() - WINDOW_MS) },
    })
      .then((cleanupRequest) =>
        cleanupRequest.query(`DELETE FROM dbo.RateLimitHits WHERE created_at <= @cutoff;`)
      )
      .catch(() => {})
  }

  return result.recordset[0].hitCount < maxRequests
}

module.exports = { consumeRateLimit }
