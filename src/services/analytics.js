// Google Analytics (GA4) — yalnızca kullanıcı açıkça izin verdiğinde yüklenir (KVKK/GDPR:
// pazarlama/analitik çerezleri opt-in olmalı, opt-out değil). Onay durumu CookieConsentBanner
// tarafından yönetilir, burası sadece "izin varsa gtag.js'i yükle" mekanizmasını sağlar.
const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID
const CONSENT_STORAGE_KEY = 'tc.cookieConsent'

function readStoredConsent() {
  try {
    return localStorage.getItem(CONSENT_STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStoredConsent(value) {
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, value)
  } catch {
    // Gizli sekme/engellenmiş depolama: banner bu oturumda tekrar sorar, kritik değil.
  }
}

// null = henüz karar verilmedi (banner gösterilmeli), 'granted' | 'denied' = karar verilmiş.
export function getConsentStatus() {
  return readStoredConsent()
}

function loadGtagScript() {
  if (!GA_MEASUREMENT_ID || document.getElementById('ga4-script')) return

  const script = document.createElement('script')
  script.id = 'ga4-script'
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`
  document.head.appendChild(script)

  window.dataLayer = window.dataLayer || []
  window.gtag = (...args) => window.dataLayer.push(args)
  window.gtag('js', new Date())
  // IP'nin son oktetini maskeler (KVKK'da kişisel veri minimizasyonu için standart pratik).
  window.gtag('config', GA_MEASUREMENT_ID, { anonymize_ip: true })
}

// Sayfa her açıldığında çağrılır: kullanıcı daha önce izin verdiyse GA'yı sessizce yükler,
// karar vermediyse veya reddettiyse hiçbir şey yapmaz (banner tekrar sorar / hiç sormaz).
export function initAnalyticsIfConsented() {
  if (readStoredConsent() === 'granted') {
    loadGtagScript()
  }
}

export function grantAnalyticsConsent() {
  writeStoredConsent('granted')
  loadGtagScript()
}

export function denyAnalyticsConsent() {
  writeStoredConsent('denied')
}
