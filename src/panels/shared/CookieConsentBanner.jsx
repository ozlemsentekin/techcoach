import { useState } from 'react'
import { getConsentStatus, grantAnalyticsConsent, denyAnalyticsConsent } from '../../services/analytics'

// Siteye ilk gelişte (herhangi bir rotada — panel dahil) kullanıcı karar verene kadar
// gösterilen alt bant. GA4 sadece "Kabul Et" ile yüklenir (opt-in) — reddedilirse veya
// karar verilmediyse hiç yüklenmez (bkz. analytics.js).
export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(() => getConsentStatus() === null)

  if (!visible) {
    return null
  }

  const handleAccept = () => {
    grantAnalyticsConsent()
    setVisible(false)
  }

  const handleReject = () => {
    denyAnalyticsConsent()
    setVisible(false)
  }

  return (
    <div
      role="dialog"
      aria-label="Çerez onayı"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-panel-border bg-panel-surface px-4 py-4 shadow-panel-2 sm:px-6"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-panel-text-muted">
          Siteyi nasıl kullandığınızı anlayıp deneyimi iyileştirmek için analitik çerezleri
          kullanıyoruz. Detaylar için{' '}
          <a href="/gizlilik-sozlesmesi" className="font-medium text-panel-blue underline">
            Gizlilik Sözleşmesi
          </a>
          ’ni inceleyebilirsiniz.
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={handleReject}
            className="rounded-lg border border-panel-border px-3 py-1.5 text-sm font-medium text-panel-text hover:bg-panel-surface-soft"
          >
            Reddet
          </button>
          <button
            type="button"
            onClick={handleAccept}
            className="rounded-lg bg-panel-blue px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Kabul Et
          </button>
        </div>
      </div>
    </div>
  )
}
