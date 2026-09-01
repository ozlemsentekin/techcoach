import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { CheckCircle2, Lock } from 'lucide-react'
import { useAuth } from '../context/useAuth'
import { panelPathForRole } from '../utils/panelPath'
import { initiateIyzicoCheckout, initiateIyzicoCheckoutForNewParent } from '../services/paymentService'
import { injectCheckoutFormContent } from './iyzicoCheckoutForm'
import './LandingPage.css'

const BILLING_OPTIONS = {
  monthly: { price: '1', period: 'TL / ay' },
  yearly: { price: '24000', period: 'TL / yıl', badge: '%20 indirim' },
}

const INCLUDED_FEATURES = [
  '2 öğrenciye kadar tam erişim',
  'Günlük çalışma planı ve ders ajandası',
  'Hata defteri ile konu bazlı tekrar takibi',
  'Haftalık ilerleme raporu ve risk uyarıları',
  'Sınav takvimini fotoğrafla içe aktarma',
]

function BrandIcon() {
  return <img src="/logo-mark.png" alt="" className="logo-mark-img" />
}

export default function PaymentPage() {
  const { authUser, refreshSession } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const pendingRegistration = location.state?.pendingRegistration || null

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

  // Var olan bir veli (yenileme ödemesi) ya da /uye-ol'dan gelen bekleyen kayıt bilgisiyle
  // (henüz hesabı yok, ödeme sonrası hesap oluşacak) buraya girilebilir. İkisi de yoksa ödeme
  // başlatılamaz.
  if (!authUser && !pendingRegistration) {
    return <Navigate to="/uye-ol" replace />
  }
  if (authUser && authUser.role !== 'ebeveyn') {
    return <Navigate to="/" replace />
  }

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
      const address = { addressLine: addressLine.trim(), city: city.trim(), zipCode: zipCode.trim() }
      const trimmedEmail = email.trim()

      const result = authUser
        ? await initiateIyzicoCheckout({ billingCycle, email: trimmedEmail, identityNumber, address })
        : await initiateIyzicoCheckoutForNewParent({
            ...pendingRegistration,
            billingCycle,
            email: trimmedEmail,
            identityNumber,
            address,
          })

      if (result.user) {
        // Savunma amaçlı: pendingRegistration'a bir "DENEME" kupon kodu sızarsa backend hesabı
        // ödemesiz anında açar — bu durumda normal panele geçilir.
        await refreshSession()
        navigate(panelPathForRole(result.user.role), { replace: true })
        return
      }

      setCheckoutFormContent(result.checkoutFormContent)
    } catch (submitError) {
      setError(submitError.message || 'Ödeme başlatılamadı.')
    } finally {
      setLoading(false)
    }
  }

  const activeBilling = BILLING_OPTIONS[billingCycle]

  return (
    <div className="landing-page">
      <header className="topbar auth-topbar">
        <div className="container topbar-inner">
          <Link to="/" className="logo" aria-label="TechCoach">
            <span className="logo-mark">
              <BrandIcon />
            </span>
            <span className="logo-title">
              Tech<span>Coach</span>
            </span>
          </Link>
        </div>
      </header>

      <main className="auth-page checkout-page">
        <div className="container checkout-shell">
          {checkoutFormContent ? (
            <div className="login-card checkout-iyzico-card">
              <h3>Kart Bilgilerini Girin</h3>
              <p>Ödeme adımını iyzico'nun güvenli sayfası üzerinden tamamlayın.</p>
              <div ref={formContainerRef} />
            </div>
          ) : (
            <div className="checkout-layout">
              <div className="login-card checkout-form-card">
                <h3>Fatura Bilgileri</h3>
                <p>Aboneliğini başlatmak için TC Kimlik No ve adres bilgilerini gir.</p>

                {error ? <div className="auth-feedback auth-feedback-error">{error}</div> : null}

                <form id="payment-form" className="login-form" onSubmit={handleSubmit}>
                  <input
                    name="email"
                    type="email"
                    placeholder="E-posta"
                    aria-label="E-posta"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />

                  <input
                    name="identityNumber"
                    type="text"
                    inputMode="numeric"
                    placeholder="TC Kimlik No"
                    aria-label="TC Kimlik No"
                    maxLength="11"
                    required
                    value={identityNumber}
                    onChange={(event) => setIdentityNumber(event.target.value.replace(/\D/g, '').slice(0, 11))}
                  />

                  <input
                    name="addressLine"
                    type="text"
                    placeholder="Adres"
                    aria-label="Adres"
                    required
                    value={addressLine}
                    onChange={(event) => setAddressLine(event.target.value)}
                  />

                  <div className="signup-name-row">
                    <input
                      name="city"
                      type="text"
                      placeholder="İl"
                      aria-label="İl"
                      required
                      value={city}
                      onChange={(event) => setCity(event.target.value)}
                    />
                    <input
                      name="zipCode"
                      type="text"
                      placeholder="Posta Kodu"
                      aria-label="Posta Kodu"
                      required
                      value={zipCode}
                      onChange={(event) => setZipCode(event.target.value)}
                    />
                  </div>
                </form>
              </div>

              <aside className="checkout-summary-card">
                <h4>Sepetiniz</h4>

                <div className="checkout-summary-plan-row">
                  <span className="checkout-summary-plan-name">Veli Takip Paketi</span>
                  <div className="billing-toggle" role="tablist" aria-label="Fatura periyodu">
                    <button
                      type="button"
                      className={billingCycle === 'monthly' ? 'active' : ''}
                      onClick={() => setBillingCycle('monthly')}
                    >
                      Aylık
                    </button>
                    <button
                      type="button"
                      className={billingCycle === 'yearly' ? 'active' : ''}
                      onClick={() => setBillingCycle('yearly')}
                    >
                      Yıllık
                    </button>
                  </div>
                </div>

                <ul className="checkout-summary-features">
                  {INCLUDED_FEATURES.map((feature) => (
                    <li key={feature}>
                      <CheckCircle2 size={15} aria-hidden="true" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="checkout-summary-divider" />

                <div className="checkout-summary-total-row">
                  <span>Toplam</span>
                  <div className="checkout-summary-total-price">
                    {activeBilling.price} <small>{activeBilling.period}</small>
                  </div>
                </div>
                {activeBilling.badge ? <span className="badge signup-price-badge">{activeBilling.badge}</span> : null}

                <button type="submit" form="payment-form" className="btn btn-primary checkout-submit" disabled={loading}>
                  {loading ? 'Yönlendiriliyor...' : 'Öde'}
                </button>

                <div className="checkout-summary-trust">
                  <Lock size={13} aria-hidden="true" />
                  <span>iyzico ile güvenli ödeme</span>
                </div>
              </aside>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
