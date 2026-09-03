const DEFAULT_AUTH_TIMEOUT_MS = 25000
const DEFAULT_CACHE_TTL_MS = 30000

const getCache = new Map() // path -> { expiresAt, promise }

let consentRequiredHandler = null
let accountDisabledHandler = null

/** AuthContext, backend'in herhangi bir istekte CONSENT_REQUIRED döndüğü anı yakalayıp
 * authUser.needsConsent'i güncelleyebilmek için burada bir dinleyici kaydeder. */
export function setConsentRequiredHandler(handler) {
  consentRequiredHandler = handler
}

/** AuthContext, backend'in herhangi bir istekte ACCOUNT_DISABLED döndüğü anı yakalayıp
 * (admin panelinden pasife alınmış hesap) oturumu anında kapatabilmek için dinleyici kaydeder. */
export function setAccountDisabledHandler(handler) {
  accountDisabledHandler = handler
}

/**
 * GET isteklerini kısa süreliğine (varsayılan 30sn) önbelleğe alır ve eşzamanlı çağrılarda
 * aynı bekleyen promise'i paylaşır. Sık gezilen ekranlar arasında (ör. öğrenci/öğretmen roster'ı)
 * her navigasyonda aynı verinin yeniden çekilmesini önlemek içindir. TTL kısa tutulur ki bir
 * mutasyondan sonra invalidateCache çağrılması unutulsa bile veri kendiliğinden tazelensin.
 */
export function cachedGet(path, { ttlMs = DEFAULT_CACHE_TTL_MS } = {}) {
  const cached = getCache.get(path)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.promise
  }

  const promise = authRequest(path, { method: 'GET' }).catch((error) => {
    getCache.delete(path)
    throw error
  })
  getCache.set(path, { expiresAt: Date.now() + ttlMs, promise })
  return promise
}

/** Bir path'in (veya path'le başlayan tüm girişlerin) önbelleğini temizler. */
export function invalidateCache(path) {
  if (!path) {
    getCache.clear()
    return
  }
  for (const key of getCache.keys()) {
    if (key === path || key.startsWith(`${path}/`) || key.startsWith(`${path}?`)) getCache.delete(key)
  }
}

export async function authRequest(path, options = {}) {
  const { headers, timeoutMs = DEFAULT_AUTH_TIMEOUT_MS, ...fetchOptions } = options
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(path, {
      credentials: 'include',
      headers: {
        ...(fetchOptions.body ? { 'Content-Type': 'application/json' } : {}),
        ...(headers || {}),
      },
      signal: controller.signal,
      ...fetchOptions,
    })

    const contentType = response.headers.get('content-type') || ''
    const data = contentType.includes('application/json')
      ? await response.json().catch(() => ({}))
      : {}

    if (!response.ok) {
      const fallbackMessage =
        response.status >= 500 && !contentType.includes('application/json')
          ? 'Kimlik doğrulama servisine ulaşılamadı. API sunucusunun çalıştığını kontrol edin.'
          : 'İşlem tamamlanamadı.'

      if (data.code === 'CONSENT_REQUIRED') {
        consentRequiredHandler?.()
      }

      if (data.code === 'ACCOUNT_DISABLED') {
        accountDisabledHandler?.()
      }

      const requestError = new Error(data.error || fallbackMessage)
      requestError.code = data.code
      throw requestError
    }

    return data
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Sunucu zamanında yanıt vermedi. Lütfen tekrar deneyin.')
    }

    if (error instanceof TypeError) {
      throw new Error('Kimlik doğrulama servisine ulaşılamadı. API sunucusunun çalıştığını kontrol edin.')
    }

    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }
}
