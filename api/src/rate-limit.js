const { sql, withRequest } = require('./db')

const WINDOW_MS = 15 * 60 * 1000
const MAX_REQUESTS = 10

// DB-backed so limits are enforced consistently across Azure Functions scale-out/cold
// starts (an in-memory Map only protects a single warm instance).
async function consumeRateLimit(key, options = {}) {
  const windowMs = options.windowMs || WINDOW_MS
  const maxRequests = options.maxRequests || MAX_REQUESTS
  const windowStart = new Date(Date.now() - windowMs)

  const cleanupRequest = await withRequest({
    key: { type: sql.NVarChar(200), value: key },
    windowStart: { type: sql.DateTime2, value: windowStart },
  })
  await cleanupRequest.query(`
    DELETE FROM dbo.RateLimitHits WHERE rate_key = @key AND created_at <= @windowStart;
  `)

  const countRequest = await withRequest({
    key: { type: sql.NVarChar(200), value: key },
  })
  const countResult = await countRequest.query(`
    SELECT COUNT(*) AS hitCount FROM dbo.RateLimitHits WHERE rate_key = @key;
  `)
  if (countResult.recordset[0].hitCount >= maxRequests) {
    return false
  }

  const insertRequest = await withRequest({
    key: { type: sql.NVarChar(200), value: key },
  })
  await insertRequest.query(`
    INSERT INTO dbo.RateLimitHits (rate_key) VALUES (@key);
  `)

  return true
}

module.exports = { consumeRateLimit }
