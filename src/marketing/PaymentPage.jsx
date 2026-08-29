import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { panelPathForRole } from '../utils/panelPath'
import { initiateIyzicoCheckout, initiateIyzicoCheckoutForNewParent } from '../services/paymentService'
import './LandingPage.css'

const BILLING_OPTIONS = {
  monthly: { price: '1', period: 'TL / ay' },
  yearly: { price: '24000', period: 'TL / yıl', badge: '%20 indirim' },
}

function BrandIcon() {
  return <img src="/logo-mark.png" alt="" className="logo-mark-img" />
}

function injectCheckoutFormContent(container, html) {
  container.innerHTML = ''
  const template = document.createElement('template')
  template.innerHTML = html

  Array.from(template.content.childNodes).forEach((node) => {
    if (node.tagName === 'SCRIPT') {
      const script = document.createElement('script')
      Array.from(node.attributes).forEach((attr) => script.setAttribute(attr.name, attr.value))
      script.textContent = node.textContent
      container.appendChild(script)
    } else {
      container.appendChild(node.cloneNode(true))
    }
  })
}

export default function PaymentPage() {
  const { authUser, refreshSession } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const pendingRegistration = location.state?.pendingRegistration || null

  const [billingCycle, setBillingCycle] = useState('monthly')
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

      const result = authUser
        ? await initiateIyzicoCheckout({ billingCycle, identityNumber, address })
        : await initiateIyzicoCheckoutForNewParent({ ...pendingRegistration, billingCycle, identityNumber, address })

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

      <main className="auth-page">
        <div className="container auth-page-shell">
          <div className="login-card">
            <h3>Aboneliğini Başlat</h3>
            <p>Paket seç, ödeme bilgilerini gir ve panele hemen eriş.</p>

            {checkoutFormContent ? (
              <div ref={formContainerRef} />
            ) : (
              <form className="login-form" onSubmit={handleSubmit}>
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

                <div className="price">
                  {BILLING_OPTIONS[billingCycle].price} <small>{BILLING_OPTIONS[billingCycle].period}</small>
                  {BILLING_OPTIONS[billingCycle].badge ? (
                    <span className="badge signup-price-badge">{BILLING_OPTIONS[billingCycle].badge}</span>
                  ) : null}
                </div>

                {error ? <div className="auth-feedback auth-feedback-error">{error}</div> : null}

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

                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Yönlendiriliyor...' : 'Öde'}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
