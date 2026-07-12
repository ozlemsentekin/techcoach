const fs = require('fs')
const path = require('path')

const DEFAULT_COOKIE_NAME = 'techcoach_session'
const LOCAL_SETTINGS_PATH = path.join(__dirname, '..', 'local.settings.json')

let localSettingsLoaded = false

class ConfigError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ConfigError'
    this.code = 'CONFIG_ERROR'
  }
}

function loadLocalSettings() {
  if (localSettingsLoaded) {
    return
  }

  localSettingsLoaded = true

  if (!fs.existsSync(LOCAL_SETTINGS_PATH)) {
    return
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(LOCAL_SETTINGS_PATH, 'utf8'))

    Object.entries(parsed.Values || {}).forEach(([key, value]) => {
      if (!process.env[key] && typeof value === 'string') {
        process.env[key] = value
      }
    })
  } catch (error) {
    console.warn('local.settings.json could not be loaded', error.message)
  }
}

function getRequiredEnv(name, options = {}) {
  loadLocalSettings()

  const value = process.env[name]
  const placeholders = options.placeholders || []

  if (!value) {
    throw new ConfigError(`Missing required environment variable: ${name}`)
  }

  if (placeholders.some((placeholder) => value.includes(placeholder))) {
    throw new ConfigError(`Environment variable ${name} still contains a placeholder value`)
  }

  return value
}

function isProductionLike() {
  loadLocalSettings()
  return process.env.NODE_ENV === 'production' || process.env.WEBSITE_SITE_NAME
}

function getRuntimeConfig() {
  loadLocalSettings()

  return {
    cookieName: process.env.AUTH_COOKIE_NAME || DEFAULT_COOKIE_NAME,
    cookieSecure:
      (process.env.AUTH_COOKIE_SECURE || '').toLowerCase() === 'true' || isProductionLike(),
    tokenTtlSeconds: 60 * 60 * 24 * 7,
  }
}

function getConfig() {
  return {
    ...getRuntimeConfig(),
    sqlConnectionString: getRequiredEnv('SQL_CONNECTION_STRING', {
      placeholders: [
        'REPLACE_WITH_SQL_ADMIN_PASSWORD',
        '<server>',
        '<database>',
        '<user>',
        '<password>',
      ],
    }),
    jwtSecret: getRequiredEnv('AUTH_JWT_SECRET', {
      placeholders: ['replace-with-a-32-byte-random-secret'],
    }),
  }
}

function isConfigError(error) {
  return error?.code === 'CONFIG_ERROR'
}

module.exports = {
  DEFAULT_COOKIE_NAME,
  getConfig,
  getRuntimeConfig,
  isConfigError,
}
