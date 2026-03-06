const WINDOW_MS = 15 * 60 * 1000
const MAX_REQUESTS = 10

const buckets = new Map()

function consumeRateLimit(key) {
  const now = Date.now()
  const existing = buckets.get(key)

  if (!existing || existing.expiresAt <= now) {
    buckets.set(key, { count: 1, expiresAt: now + WINDOW_MS })
    return true
  }

  if (existing.count >= MAX_REQUESTS) {
    return false
  }

  existing.count += 1
  return true
}

module.exports = { consumeRateLimit }
