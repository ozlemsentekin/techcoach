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

// getRequiredEnv gibi ama eksik/placeholder değerde fırlatmak yerine null döner.
function getOptionalEnv(name, options = {}) {
  loadLocalSettings()

  const value = process.env[name]
  const placeholders = options.placeholders || []

  if (!value) {
    return null
  }
  if (placeholders.some((placeholder) => value.includes(placeholder))) {
    return null
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
    tokenTtlSeconds: 60 * 60 * 24 * 365,
  }
}

function getSqlConfig() {
  return {
    sqlConnectionString: getRequiredEnv('SQL_CONNECTION_STRING', {
      placeholders: [
        'REPLACE_WITH_SQL_ADMIN_PASSWORD',
        '<server>',
        '<database>',
        '<user>',
        '<password>',
      ],
    }),
  }
}

function getAuthConfig() {
  return {
    ...getRuntimeConfig(),
    jwtSecret: getRequiredEnv('AUTH_JWT_SECRET', {
      placeholders: ['replace-with-a-32-byte-random-secret'],
    }),
  }
}

function getAnthropicConfig() {
  return {
    anthropicApiKey: getRequiredEnv('ANTHROPIC_API_KEY'),
  }
}

function getBillingConfig() {
  loadLocalSettings()

  return {
    revenueCatWebhookAuthHeader: getRequiredEnv('REVENUECAT_WEBHOOK_AUTH_HEADER', {
      placeholders: ['replace-with-the-revenuecat-webhook-auth-header'],
    }),
    // Öğretmenin sabit panel ücretine (3000 TL/ay, 4 öğrenci dahil) ek olarak satın aldığı
    // öğrenci başı (200 TL/ay) koltuk ürünlerinin RevenueCat product_id listesi.
    teacherSeatProductIds: (process.env.REVENUECAT_TEACHER_SEAT_PRODUCT_IDS || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  }
}

function getSmsConfig() {
  return {
    netgsmUsercode: getRequiredEnv('NETGSM_USERCODE', {
      placeholders: ['replace-with-netgsm-usercode'],
    }),
    netgsmPassword: getRequiredEnv('NETGSM_PASSWORD', {
      placeholders: ['replace-with-netgsm-password'],
    }),
    netgsmHeader: getRequiredEnv('NETGSM_HEADER', {
      placeholders: ['replace-with-netgsm-header'],
    }),
  }
}

function getIyzicoConfig() {
  return {
    apiKey: getRequiredEnv('IYZICO_API_KEY', {
      placeholders: ['replace-with-iyzico-api-key'],
    }),
    secretKey: getRequiredEnv('IYZICO_SECRET_KEY', {
      placeholders: ['replace-with-iyzico-secret-key'],
    }),
    baseUrl: getRequiredEnv('IYZICO_BASE_URL'),
    parentMonthlyPlanRef: getRequiredEnv('IYZICO_PARENT_MONTHLY_PLAN_REF', {
      placeholders: ['replace-with-iyzico-parent-monthly-plan-ref'],
    }),
    parentYearlyPlanRef: getRequiredEnv('IYZICO_PARENT_YEARLY_PLAN_REF', {
      placeholders: ['replace-with-iyzico-parent-yearly-plan-ref'],
    }),
    // Ek çocuk (çocuk-koltuğu) paketi — aylık 1.999 TL / yıllık 14.999 TL. Planlar iyzico
    // panelinde oluşturulunca gerçek reference code'lar app settings'e girilecek. Opsiyonel:
    // henüz set edilmediyse null döner (çocuk-koltuğu satın alma handler'ı 503 verir), taban
    // veli aboneliği akışı etkilenmez.
    childMonthlyPlanRef: getOptionalEnv('IYZICO_CHILD_MONTHLY_PLAN_REF', {
      placeholders: ['replace-with-iyzico-child-monthly-plan-ref'],
    }),
    childYearlyPlanRef: getOptionalEnv('IYZICO_CHILD_YEARLY_PLAN_REF', {
      placeholders: ['replace-with-iyzico-child-yearly-plan-ref'],
    }),
    callbackUrl: getRequiredEnv('IYZICO_CALLBACK_URL', {
      placeholders: ['replace-with-iyzico-callback-url'],
    }),
    webRedirectBaseUrl: getRequiredEnv('IYZICO_WEB_REDIRECT_BASE_URL', {
      placeholders: ['replace-with-iyzico-web-redirect-base-url'],
    }),
  }
}

function getCaptchaConfig() {
  return {
    turnstileSecretKey: getRequiredEnv('TURNSTILE_SECRET_KEY', {
      placeholders: ['replace-with-turnstile-secret-key'],
    }),
  }
}

function isCaptchaConfigured() {
  loadLocalSettings()
  const value = process.env.TURNSTILE_SECRET_KEY
  return Boolean(value) && value !== 'replace-with-turnstile-secret-key'
}

function isConfigError(error) {
  return error?.code === 'CONFIG_ERROR'
}

module.exports = {
  DEFAULT_COOKIE_NAME,
  getSqlConfig,
  getAuthConfig,
  getAnthropicConfig,
  getBillingConfig,
  getSmsConfig,
  getIyzicoConfig,
  getCaptchaConfig,
  isCaptchaConfigured,
  getRuntimeConfig,
  isConfigError,
  isProductionLike,
}
