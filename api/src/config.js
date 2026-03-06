const DEFAULT_COOKIE_NAME = 'techcoach_session'

function getRequiredEnv(name, options = {}) {
  const value = process.env[name]
  const placeholders = options.placeholders || []

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  if (placeholders.some((placeholder) => value.includes(placeholder))) {
    throw new Error(`Environment variable ${name} still contains a placeholder value`)
  }

  return value
}

function isProductionLike() {
  return process.env.NODE_ENV === 'production' || process.env.WEBSITE_SITE_NAME
}

const config = {
  sqlConnectionString: getRequiredEnv('SQL_CONNECTION_STRING', {
    placeholders: ['REPLACE_WITH_SQL_ADMIN_PASSWORD', '<server>', '<database>', '<user>', '<password>'],
  }),
  jwtSecret: getRequiredEnv('AUTH_JWT_SECRET', {
    placeholders: ['replace-with-a-32-byte-random-secret'],
  }),
  cookieName: process.env.AUTH_COOKIE_NAME || DEFAULT_COOKIE_NAME,
  cookieSecure:
    (process.env.AUTH_COOKIE_SECURE || '').toLowerCase() === 'true' || isProductionLike(),
  tokenTtlSeconds: 60 * 60 * 24 * 7,
}

module.exports = { config }
