import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { CheckCircle2, Loader2, Lock, XCircle } from 'lucide-react'
import { useAuth } from '../context/useAuth'
import { authRequest } from '../services/authClient'
import { initiateIyzicoCheckout, initiateIyzicoCheckoutForNewParent } from '../services/paymentService'
import { injectCheckoutFormContent } from './iyzicoCheckoutForm'
import { formatTRY, usePublicPricing } from '../utils/pricing'
import './LandingPage.css'

function BrandIcon() {
  return <img src="/logo-mark.png" alt="" className="logo-mark-img" />
}

const IDLE_COUPON_CHECK = { status: 'idle', code: '', message: '', discountPercent: null, monthlyPrice: null, yearlyPrice: null }

export default function PaymentPage() {
  const { authUser } = useAuth()
  const location = useLocation()
  const pendingRegistration = location.state?.pendingRegistration || null

  const [billingCycle, setBillingCycle] = useState('monthly')
  const [email, setEmail] = useState('')
  const [identityNumber, setIdentityNumber] = useState('')
  const [addressLine, setAddressLine] = useState('')
  const [city, setCity] = useState('')
  const [zipCode, setZipCode] = useState('')
  const [couponCode, setCouponCode] = useState('')
  // Kupon kodu canlı doğrulama: 'idle' | 'checking' | 'valid' | 'invalid'
  const [couponCheck, setCouponCheck] = useState(IDLE_COUPON_CHECK)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkoutFormContent, setCheckoutFormContent] = useState(null)
  const formContainerRef = useRef(null)

  const parentPlan = usePublicPricing().parent

  useEffect(() => {
    if (checkoutFormContent && formContainerRef.current) {
      injectCheckoutFormContent(formContainerRef.current, checkoutFormContent)
    }
  }, [checkoutFormContent])

  useEffect(() => {
    const code = couponCode.trim()
    if (!code) return

    let ignore = false
    const timer = setTimeout(() => {
      authRequest('/api/auth/validate-coupon', {
        method: 'POST',
        body: JSON.stringify({ code }),
      })
        .then((data) => {
          if (ignore) return
          // /api/auth/validate-coupon hem öğretmenin "DENEME" (hesap anında ücretsiz açılır,
          // yüzdelik indirim yok) hem velinin gerçek yüzdelik indirim kuponlarını (dbo.Coupons)
          // aynı uçtan doğrular. Veli ödeme sayfasında sadece ikincisi anlamlı — discountPercent
          // yoksa (DENEME gibi) "Uygulandı" demek yanıltıcı olur, çünkü bu kod veli ödemesinde
          // hiçbir indirim/atlama sağlamaz (initiateIyzicoCheckoutForNewParentHandler yalnızca
          // resolveCoupon'u tanır).
          if (data?.valid && data.discountPercent != null) {
            setCouponCheck({
              status: 'valid',
              code: data.code || code,
              message: data.description || 'Kupon kodu uygulandı.',
              discountPercent: data.discountPercent,
              monthlyPrice: data.monthlyPrice ?? null,
              yearlyPrice: data.yearlyPrice ?? null,
            })
          } else {
            setCouponCheck({
              ...IDLE_COUPON_CHECK,
              status: 'invalid',
              message: data?.valid ? 'Bu kupon veli paketi için geçerli değil.' : data?.error || 'Kupon kodu geçersiz.',
            })
          }
        })
        .catch((error) => {
          if (ignore) return
          setCouponCheck({
            ...IDLE_COUPON_CHECK,
            status: 'invalid',
            message: error?.message || 'Kupon kodu doğrulanamadı. Lütfen tekrar deneyin.',
          })
        })
    }, 500)

    return () => {
      ignore = true
      clearTimeout(timer)
    }
  }, [couponCode])

  const handleCouponChange = (event) => {
    const { value } = event.target
    setCouponCheck({ ...IDLE_COUPON_CHECK, status: value.trim() ? 'checking' : 'idle' })
    setCouponCode(value)
  }

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
    if (!authUser && couponCode.trim() && couponCheck.status === 'checking') {
      setError('Kupon kodu kontrol ediliyor, lütfen bekleyin.')
      return
    }
    if (!authUser && couponCode.trim() && couponCheck.status === 'invalid') {
      setError('Kupon kodu geçersiz. Kodu düzeltin veya alanı boş bırakın.')
      return
    }

    setLoading(true)
    try {
      const address = { addressLine: addressLine.trim(), city: city.trim(), zipCode: zipCode.trim() }
      const trimmedEmail = email.trim()
      const appliedCouponCode = couponCheck.status === 'valid' && couponCheck.code ? couponCheck.code : couponCode.trim()

      const result = authUser
        ? await initiateIyzicoCheckout({ billingCycle, email: trimmedEmail, identityNumber, address })
        : await initiateIyzicoCheckoutForNewParent({
            ...pendingRegistration,
            couponCode: appliedCouponCode,
            billingCycle,
            email: trimmedEmail,
            identityNumber,
            address,
          })

      setCheckoutFormContent(result.checkoutFormContent)
    } catch (submitError) {
      setError(submitError.message || 'Ödeme başlatılamadı.')
    } finally {
      setLoading(false)
    }
  }

  // Yeni veli akışında geçerli bir kupon varsa "Toplam" bu indirimli tutarı gösterir — gerçek
  // tahsilat da (submit'teki appliedCouponCode üzerinden) aynı tutara sabitlenmiş kupon-özel
  // iyzico planından yapılır, bkz. payments.js resolveCoupon.
  const hasAppliedDiscount = !authUser && couponCheck.status === 'valid' && couponCheck.discountPercent != null
  const discountedMonthly = hasAppliedDiscount && couponCheck.monthlyPrice != null ? couponCheck.monthlyPrice : null
  const discountedYearly = hasAppliedDiscount && couponCheck.yearlyPrice != null ? couponCheck.yearlyPrice : null

  const billingOptions = {
    monthly: {
      price: formatTRY(discountedMonthly ?? parentPlan.monthlyPrice),
      originalPrice: discountedMonthly != null ? formatTRY(parentPlan.monthlyPrice) : null,
      period: 'TL / ay',
    },
    ...(parentPlan.yearlyPrice != null
      ? {
          yearly: {
            price: formatTRY(discountedYearly ?? parentPlan.yearlyPrice),
            originalPrice: discountedYearly != null ? formatTRY(parentPlan.yearlyPrice) : null,
            period: 'TL / yıl',
            ...(parentPlan.yearlyBadge && discountedYearly == null ? { badge: parentPlan.yearlyBadge } : {}),
          },
        }
      : {}),
  }
  const activeBilling = billingOptions[billingCycle] || billingOptions.monthly

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

                  {!authUser ? (
                    <div className="signup-coupon-field">
                      <input
                        name="couponCode"
                        type="text"
                        placeholder="Kupon kodu (varsa)"
                        aria-label="Kupon Kodu"
                        autoComplete="off"
                        value={couponCode}
                        onChange={handleCouponChange}
                      />
                      {couponCheck.status === 'checking' ? (
                        <p className="signup-coupon-status is-checking" role="status">
                          <Loader2 size={15} className="spin" aria-hidden="true" />
                          Kupon kodu kontrol ediliyor...
                        </p>
                      ) : null}
                      {couponCheck.status === 'valid' ? (
                        <p className="signup-coupon-status is-valid" role="status">
                          <CheckCircle2 size={15} aria-hidden="true" />
                          Uygulandı{couponCheck.message ? ` — ${couponCheck.message}` : ''}
                        </p>
                      ) : null}
                      {couponCheck.status === 'invalid' ? (
                        <p className="signup-coupon-status is-invalid" role="alert">
                          <XCircle size={15} aria-hidden="true" />
                          {couponCheck.message}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </form>
              </div>

              <aside className="checkout-summary-card">
                <h4>Sepetiniz</h4>

                <div className="checkout-summary-plan-row">
                  <span className="checkout-summary-plan-name">{parentPlan.title}</span>
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
                  {parentPlan.features.map((feature) => (
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
                    {activeBilling.originalPrice ? (
                      <span className="checkout-summary-total-price-original">{activeBilling.originalPrice} TL</span>
                    ) : null}
                    {activeBilling.price} <small>{activeBilling.period}</small>
                  </div>
                </div>
                {activeBilling.badge ? <span className="badge signup-price-badge">{activeBilling.badge}</span> : null}
                {hasAppliedDiscount ? (
                  <span className="badge signup-price-badge">Kupon: %{couponCheck.discountPercent} indirim</span>
                ) : null}

                <button
                  type="submit"
                  form="payment-form"
                  className="btn btn-primary checkout-submit"
                  disabled={loading || (!authUser && couponCode.trim() !== '' && couponCheck.status === 'checking')}
                >
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
