const { getCaptchaConfig, isConfigError } = require('./config')

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

async function verifyTurnstileToken(token, remoteIp) {
  if (!token) {
    return { success: false }
  }

  let config
  try {
    config = getCaptchaConfig()
  } catch (error) {
    if (isConfigError(error)) {
      return { success: false }
    }
    throw error
  }

  const body = new URLSearchParams({ secret: config.turnstileSecretKey, response: token })
  if (remoteIp && remoteIp !== 'unknown') {
    body.append('remoteip', remoteIp)
  }

  const response = await fetch(TURNSTILE_VERIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  const result = await response.json().catch(() => null)

  if (!response.ok || !result?.success) {
    console.warn('verifyTurnstileToken: doğrulama başarısız', response.status, result)
    return { success: false }
  }

  return { success: true }
}

module.exports = { verifyTurnstileToken }
