import { useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { CheckCircle2, Lock, Smartphone, X } from 'lucide-react'
import Button from '../../ui/Button'
import { initiateChildSeatCheckout } from '../../../services/paymentService'
import { injectCheckoutFormContent } from '../../../marketing/iyzicoCheckoutForm'

const BILLING_OPTIONS = {
  monthly: { price: '1.999', period: 'TL / ay' },
  yearly: { price: '14.999', period: 'TL / yıl', badge: '2 ay bedava' },
}

const INCLUDED_FEATURES = [
  'Ek bir çocuk için tam panel erişimi',
  'Günlük çalışma planı ve ders ajandası',
  'Hata defteri ve haftalık ilerleme raporu',
  'Çocuğa özel kaynak kitaplığı',
]

export default function ChildSeatPurchaseModal({ onClose }) {
  const isNative = Capacitor.isNativePlatform()

  const [billingCycle, setBillingCycle] = useState('monthly')
  const [email, setEmail] = useState('')
  const [identityNumber, setIdentityNumber] = useState('')
  const [addressLine, setAddressLine] = useState('')
  const [city, setCity] = useState('')
  const [zipCode, setZipCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkoutFormContent, setCheckoutFormContent] = useState(null)
  const formContainerRef = useRef(null)

  useEffect(() => {
    if (checkoutFormContent && formContainerRef.current) {
      injectCheckoutFormContent(formContainerRef.current, checkoutFormContent)
    }
  }, [checkoutFormContent])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Geçerli bir e-posta adresi girin.')
      return
    }
    if (!/^\d{11}$/.test(identityNumber)) {
      setError('Geçerli bir TC Kimlik No girin.')
      return
    }
    if (!addressLine.trim() || !city.trim() || !zipCode.trim()) {
      setError('Adres, il ve posta kodu bilgilerini girin.')
      return
    }

    setLoading(true)
    try {
      const result = await initiateChildSeatCheckout({
        billingCycle,
        email: email.trim(),
        identityNumber,
        address: { addressLine: addressLine.trim(), city: city.trim(), zipCode: zipCode.trim() },
      })
      setCheckoutFormContent(result.checkoutFormContent)
    } catch (submitError) {
      setError(submitError.message || 'Ödeme başlatılamadı.')
    } finally {
      setLoading(false)
    }
  }

  const activeBilling = BILLING_OPTIONS[billingCycle]

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <div className="flex h-full w-full max-w-2xl flex-col overflow-hidden bg-white shadow-panel-2 sm:h-auto sm:max-h-[90vh] sm:rounded-2xl">
        <div className="flex items-center justify-between gap-4 px-4 pb-3 pt-3 sm:px-6 sm:pb-3.5 sm:pt-4">
          <h2 className="text-lg font-semibold text-panel-text">Ek Çocuk Paketi</h2>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto border-t border-[#edf0f1] px-4 py-4 sm:px-6 sm:py-5">
          <p className="mb-4 text-sm text-panel-text-muted">
            Mevcut planınızın kapsadığı çocuk hakkını kullandınız. Yeni bir çocuk profili eklemek için ek
            paket satın alın.
          </p>

          {isNative ? (
            <div className="flex flex-col items-center gap-3 rounded-xl bg-panel-blue-soft px-4 py-6 text-center">
              <Smartphone size={22} aria-hidden="true" className="text-panel-blue" />
              <p className="text-sm text-panel-text">
                Ek çocuk paketini şimdilik yalnızca web üzerinden techcoach.com.tr adresinden satın
                alabilirsiniz.
              </p>
            </div>
          ) : checkoutFormContent ? (
            <div>
              <h3 className="mb-1 text-base font-semibold text-panel-text">Kart Bilgilerini Girin</h3>
              <p className="mb-3 text-sm text-panel-text-muted">
                Ödeme adımını iyzico'nun güvenli sayfası üzerinden tamamlayın.
              </p>
              <div ref={formContainerRef} />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="rounded-xl border border-panel-border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-panel-text">Ek Çocuk Paketi</span>
                  <div className="flex overflow-hidden rounded-lg border border-panel-border text-xs">
                    <button
                      type="button"
                      className={`px-3 py-1.5 ${billingCycle === 'monthly' ? 'bg-panel-blue text-white' : 'text-panel-text'}`}
                      onClick={() => setBillingCycle('monthly')}
                    >
                      Aylık
                    </button>
                    <button
                      type="button"
                      className={`px-3 py-1.5 ${billingCycle === 'yearly' ? 'bg-panel-blue text-white' : 'text-panel-text'}`}
                      onClick={() => setBillingCycle('yearly')}
                    >
                      Yıllık
                    </button>
                  </div>
                </div>

                <ul className="flex flex-col gap-1.5">
                  {INCLUDED_FEATURES.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-panel-text">
                      <CheckCircle2 size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-panel-sage" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-3 flex items-center justify-between border-t border-panel-border pt-3">
                  <span className="text-sm text-panel-text-muted">Toplam</span>
                  <span className="text-lg font-semibold text-panel-text">
                    {activeBilling.price} <small className="text-sm font-normal">{activeBilling.period}</small>
                  </span>
                </div>
                {activeBilling.badge ? (
                  <div className="mt-1 text-right text-xs font-medium text-panel-sage">{activeBilling.badge}</div>
                ) : null}
              </div>

              {error ? (
                <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-sm text-panel-warm">{error}</div>
              ) : null}

              <form id="child-seat-payment-form" className="flex flex-col gap-2.5" onSubmit={handleSubmit}>
                <input
                  type="email"
                  placeholder="E-posta"
                  aria-label="E-posta"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-xl border border-panel-border p-2 text-base text-panel-text"
                />
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="TC Kimlik No"
                  aria-label="TC Kimlik No"
                  maxLength="11"
                  required
                  value={identityNumber}
                  onChange={(event) => setIdentityNumber(event.target.value.replace(/\D/g, '').slice(0, 11))}
                  className="w-full rounded-xl border border-panel-border p-2 text-base text-panel-text"
                />
                <input
                  type="text"
                  placeholder="Adres"
                  aria-label="Adres"
                  required
                  value={addressLine}
                  onChange={(event) => setAddressLine(event.target.value)}
                  className="w-full rounded-xl border border-panel-border p-2 text-base text-panel-text"
                />
                <div className="flex gap-2.5">
                  <input
                    type="text"
                    placeholder="İl"
                    aria-label="İl"
                    required
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                    className="w-full rounded-xl border border-panel-border p-2 text-base text-panel-text"
                  />
                  <input
                    type="text"
                    placeholder="Posta Kodu"
                    aria-label="Posta Kodu"
                    required
                    value={zipCode}
                    onChange={(event) => setZipCode(event.target.value)}
                    className="w-full rounded-xl border border-panel-border p-2 text-base text-panel-text"
                  />
                </div>
              </form>

              <div className="flex items-center gap-1.5 text-xs text-panel-text-muted">
                <Lock size={13} aria-hidden="true" />
                <span>iyzico ile güvenli ödeme</span>
              </div>
            </div>
          )}
        </div>

        {!isNative && !checkoutFormContent ? (
          <div className="flex justify-end gap-3 border-t border-[#edf0f1] px-4 py-3 sm:px-6">
            <Button type="button" variant="secondary" size="md" onClick={onClose} disabled={loading}>
              Vazgeç
            </Button>
            <Button type="submit" form="child-seat-payment-form" size="md" disabled={loading}>
              {loading ? 'Yönlendiriliyor...' : 'Öde'}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
