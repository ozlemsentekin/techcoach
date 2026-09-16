import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, GraduationCap, Loader2, ShieldCheck, UserPlus, Users, XCircle } from 'lucide-react'
import { useAuth } from '../context/useAuth'
import { panelPathForRole } from '../utils/panelPath'
import { authRequest } from '../services/authClient'
import { formatTRY, usePublicPricing } from '../utils/pricing'
import { LEGAL_CONTENT } from './legalContent'
import TurnstileWidget from './TurnstileWidget'
import './LandingPage.css'

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY
const OTP_CODE_LENGTH = 6
const RESEND_COOLDOWN_SECONDS = 60

function normalizeCodeInput(value) {
  return value.replace(/\D/g, '').slice(0, OTP_CODE_LENGTH)
}

const INITIAL_FORM = {
  firstName: '',
  lastName: '',
  phone: '',
  couponCode: '',
  parentType: '',
  acceptAydinlatma: false,
  acceptKvkk: false,
}

// Fiyat / özellik / metin bilgisi admin "Üyelik Paketleri" ekranından yönetilir
// (usePublicPricing). Burada yalnızca role'e özel sabit görsel meta tutulur.
const PLAN_META = {
  ebeveyn: { badgeLabel: 'Veliyim', badgeIcon: Users, cta: 'Veli Planını Seç', pricingKey: 'parent' },
  ogretmen: {
    badgeLabel: 'Öğretmenim', badgeIcon: GraduationCap, cta: 'Öğretmen Planını Seç', pricingKey: 'teacher',
    subtitle: 'Takip ettiğiniz öğrencinin ne çalıştığını, nerede ilerlediğini ve nerede desteğe ihtiyaç duyduğunu tek ekranda görün.',
  },
}

function buildBilling(source) {
  const billing = { monthly: { price: formatTRY(source.monthlyPrice), period: 'TL / ay' } }
  if (source.yearlyPrice != null) {
    billing.yearly = {
      price: formatTRY(source.yearlyPrice),
      period: 'TL / yıl',
      ...(source.yearlyBadge ? { badge: source.yearlyBadge } : {}),
    }
  }
  return billing
}

function buildPlans(pricing) {
  return Object.fromEntries(
    Object.entries(PLAN_META).map(([role, meta]) => {
      const source = pricing[meta.pricingKey]
      return [
        role,
        {
          badgeLabel: meta.badgeLabel,
          badgeIcon: meta.badgeIcon,
          cta: meta.cta,
          subtitle: meta.subtitle,
          title: source.title,
          features: source.features,
          note: source.note,
          billing: buildBilling(source),
        },
      ]
    }),
  )
}

function BrandIcon() {
  return <img src="/logo-mark.png" alt="" className="logo-mark-img" />
}

function normalizePhoneInput(value) {
  return value.replace(/\D/g, '').slice(0, 11)
}

function PricingCard({ planKey, plan, billingCycle, onBillingChange, selected, onSelect }) {
  const Icon = plan.badgeIcon
  const activeBilling = plan.billing[billingCycle] || plan.billing.monthly

  return (
    <article className={`pricing-card-v2 ${selected ? 'dark selected' : ''}`}>
      <div className="pricing-card-v2-badge">
        <Icon size={16} aria-hidden="true" />
        {plan.badgeLabel}
      </div>

      <h3>{plan.title}</h3>
      {plan.subtitle ? <p className="pricing-card-v2-subtitle">{plan.subtitle}</p> : null}
      <div className="pricing-card-v2-divider" />

      <div className="pricing-card-v2-services-head">
        <span>Hizmetler</span>
        {plan.billing.yearly ? (
          <div className="billing-toggle" role="tablist" aria-label="Fatura periyodu">
            <button
              type="button"
              className={billingCycle === 'monthly' ? 'active' : ''}
              onClick={() => onBillingChange('monthly')}
            >
              Aylık
            </button>
            <button
              type="button"
              className={billingCycle === 'yearly' ? 'active' : ''}
              onClick={() => onBillingChange('yearly')}
            >
              Yıllık
            </button>
          </div>
        ) : null}
      </div>

      <ul className="pricing-card-v2-features">
        {plan.features.map((feature) => (
          <li key={feature}>
            <CheckCircle2 size={18} aria-hidden="true" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <div className="pricing-card-v2-price-row">
        <span className="pricing-card-v2-price-label">Fiyat</span>
        <div className="price pricing-card-v2-price">
          {activeBilling.price} <small>{activeBilling.period}</small>
          {activeBilling.badge ? <span className="badge signup-price-badge">{activeBilling.badge}</span> : null}
        </div>
      </div>

      {plan.note ? <div className="pricing-card-v2-note">{plan.note}</div> : null}

      <button type="button" className="btn pricing-card-v2-cta" onClick={() => onSelect(planKey)}>
        {plan.cta}
      </button>
    </article>
  )
}

export default function SignUpPage() {
  const navigate = useNavigate()
  const { authLoading, authError, authMessage, requestOtp, verifyRegisterOtp, register, setAuthError, clearAuthFeedback } = useAuth()

  const [selectedPlan, setSelectedPlan] = useState(null)
  const [role, setRole] = useState('ebeveyn')
  const [billingCycle, setBillingCycle] = useState('monthly')
  const [form, setForm] = useState(INITIAL_FORM)
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [infoModal, setInfoModal] = useState(null)
  const [turnstileToken, setTurnstileToken] = useState('')
  const [subjects, setSubjects] = useState(null)
  const [subjectIds, setSubjectIds] = useState([])
  // Kupon kodu canlı doğrulama: 'idle' | 'checking' | 'valid' | 'invalid'
  const [couponCheck, setCouponCheck] = useState({ status: 'idle', code: '', message: '' })
  const turnstileRef = useRef(null)

  // Ödemeye bağlı olmayan kayıt (öğretmen) artık iki adımlı: form doldurulur, telefona SMS
  // kodu gönderilir, kod doğrulanınca hesap açılır. Veli kaydı (isPaymentBound) bu adıma hiç
  // girmez — /odeme'ye yönlenir, telefon doğrulaması o akışta yok (bkz. plan karar #8).
  const [signupStep, setSignupStep] = useState('form')
  const [otpCode, setOtpCode] = useState('')
  const [otpCooldown, setOtpCooldown] = useState(0)

  useEffect(() => {
    if (otpCooldown <= 0) return undefined
    const timer = setInterval(() => setOtpCooldown((value) => Math.max(0, value - 1)), 1000)
    return () => clearInterval(timer)
  }, [otpCooldown])

  const pricing = usePublicPricing()
  const plans = useMemo(() => buildPlans(pricing), [pricing])
  const plan = plans[role]

  useEffect(() => {
    if (role !== 'ogretmen' || subjects !== null) return
    let ignore = false
    authRequest('/api/auth/subjects', { method: 'GET' })
      .then((data) => {
        if (!ignore) setSubjects(data.subjects)
      })
      .catch(() => {
        if (!ignore) setSubjects([])
      })
    return () => {
      ignore = true
    }
  }, [role, subjects])

  useEffect(() => {
    const code = form.couponCode.trim()
    if (!code) return

    let ignore = false
    const timer = setTimeout(() => {
      authRequest('/api/auth/validate-coupon', {
        method: 'POST',
        body: JSON.stringify({ code }),
      })
        .then((data) => {
          if (ignore) return
          if (data?.valid) {
            setCouponCheck({
              status: 'valid',
              code: data.code || code,
              message: data.description || 'Kupon kodu uygulandı.',
            })
          } else {
            setCouponCheck({ status: 'invalid', code: '', message: data?.error || 'Kupon kodu geçersiz.' })
          }
        })
        .catch((error) => {
          if (ignore) return
          setCouponCheck({
            status: 'invalid',
            code: '',
            message: error?.message || 'Kupon kodu doğrulanamadı. Lütfen tekrar deneyin.',
          })
        })
    }, 500)

    return () => {
      ignore = true
      clearTimeout(timer)
    }
  }, [form.couponCode])

  const toggleSubject = (subjectId) => {
    setSubjectIds((current) =>
      current.includes(subjectId) ? current.filter((id) => id !== subjectId) : [...current, subjectId],
    )
  }

  const handleSelectPlan = (nextRole) => {
    clearAuthFeedback()
    setSelectedPlan(nextRole)
    setRole(nextRole)
    setBillingCycle('monthly')
    setSubjectIds([])
    setForm((current) => ({ ...current, parentType: '' }))
    setShowRegisterModal(true)
  }

  const closeRegisterModal = () => {
    setShowRegisterModal(false)
    setSignupStep('form')
    setOtpCode('')
  }

  const handleInputChange = (event) => {
    const { name, type, value, checked } = event.target
    if (name === 'couponCode') {
      setCouponCheck({ status: value.trim() ? 'checking' : 'idle', code: '', message: '' })
    }
    setForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : name === 'phone' ? normalizePhoneInput(value) : value,
    }))
  }

  const combinedFullName = () => `${form.firstName.trim()} ${form.lastName.trim()}`.trim()

  const validateForm = () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      return 'Ad ve soyadınızı girin.'
    }
    if (combinedFullName().length < 3 || combinedFullName().length > 120) {
      return 'Ad soyad 3 ile 120 karakter arasında olmalı.'
    }
    if (!/^0?5\d{9}$/.test(form.phone)) {
      return 'Geçerli bir telefon numarası girin (05XXXXXXXXX).'
    }
    if (!form.acceptAydinlatma || !form.acceptKvkk) {
      return 'Devam etmek için aydınlatma ve KVKK onaylarını vermelisiniz.'
    }
    if (role === 'ogretmen' && subjectIds.length === 0) {
      return 'Branşınızı seçmelisiniz.'
    }
    if (role === 'ebeveyn' && !form.parentType) {
      return 'Anne mi baba mı olduğunuzu seçin.'
    }
    if (role === 'ogretmen' && form.couponCode.trim() && couponCheck.status === 'checking') {
      return 'Kupon kodu kontrol ediliyor, lütfen bekleyin.'
    }
    if (role === 'ogretmen' && form.couponCode.trim() && couponCheck.status === 'invalid') {
      return 'Kupon kodu geçersiz. Kodu düzeltin veya alanı boş bırakın.'
    }
    return null
  }

  // Veli, kayıt formunda kupon girmiyor — kupon kodu ödeme sayfasında toplanıyor. Hesabı hemen
  // açmıyoruz, ödeme adımına geçiyoruz; gerçek hesap yalnızca ödeme başarılı olunca (veya ödeme
  // sayfasında geçerli bir deneme kuponu girilince) backend'de oluşturuluyor (bkz. PaymentPage.jsx).
  const isPaymentBound = role === 'ebeveyn'

  const handleSubmit = async (event) => {
    event.preventDefault()

    const validationError = validateForm()
    if (validationError) {
      setAuthError(validationError)
      return
    }

    if (isPaymentBound) {
      navigate('/odeme', {
        state: {
          pendingRegistration: {
            fullName: combinedFullName(),
            phone: form.phone,
            parentType: form.parentType,
            acceptAydinlatma: form.acceptAydinlatma,
            acceptKvkk: form.acceptKvkk,
            turnstileToken: turnstileToken || undefined,
          },
        },
      })
      return
    }

    // Öğretmen kaydı: önce telefona SMS kodu gönderilir, hesap kodun doğrulanmasından sonra
    // açılır (bkz. handleVerifyAndRegister).
    try {
      const data = await requestOtp('register', form.phone, turnstileToken || undefined)
      setOtpCooldown(data?.expiresInSeconds || RESEND_COOLDOWN_SECONDS)
      setOtpCode('')
      setSignupStep('otp')
    } catch {
      setTurnstileToken('')
      turnstileRef.current?.reset()
    }
  }

  const handleVerifyAndRegister = async (event) => {
    event.preventDefault()

    if (otpCode.length !== OTP_CODE_LENGTH) {
      setAuthError('6 haneli kodu girin.')
      return
    }

    try {
      const { phoneVerifiedToken } = await verifyRegisterOtp(form.phone, otpCode)
      const user = await register({
        fullName: combinedFullName(),
        phoneVerifiedToken,
        couponCode: form.couponCode.trim(),
        acceptAydinlatma: form.acceptAydinlatma,
        acceptKvkk: form.acceptKvkk,
        role,
        subjectIds,
      })
      if (user?.role) {
        navigate(panelPathForRole(user.role))
      }
    } catch {
      // hata authError üzerinden gösteriliyor
    }
  }

  const handleResendRegisterOtp = async () => {
    if (otpCooldown > 0) return
    try {
      const data = await requestOtp('register', form.phone, turnstileToken || undefined)
      setOtpCooldown(data?.expiresInSeconds || RESEND_COOLDOWN_SECONDS)
      setOtpCode('')
    } catch {
      // hata authError üzerinden gösteriliyor
    }
  }

  const PlanBadgeIcon = plan.badgeIcon

  return (
    <>
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

      <main className="auth-page signup-page">
        <div className="container signup-pricing-section">
          <h1 className="section-title signup-pricing-title">Üyelik Paketleri</h1>

          <div className="pricing-cards-grid">
            {Object.entries(plans).map(([key, value]) => (
              <PricingCard
                key={key}
                planKey={key}
                plan={value}
                billingCycle={key === 'ebeveyn' ? billingCycle : 'monthly'}
                onBillingChange={setBillingCycle}
                selected={selectedPlan === key}
                onSelect={handleSelectPlan}
              />
            ))}
          </div>
        </div>
      </main>

      {showRegisterModal && (
        <div className="login-overlay" role="dialog" aria-modal="true" aria-label="Üye Ol">
          <div className="login-card signup-card">
            <button type="button" className="login-close" aria-label="Kapat" onClick={closeRegisterModal}>
              ×
            </button>

            <div className="signup-selected-plan">
              <PlanBadgeIcon size={16} aria-hidden="true" />
              <span>{plan.title} için üye oluyorsun</span>
            </div>

            {signupStep === 'form' ? (
              <>
            <h3>Üye Ol</h3>
            <p>Üyelik bilgilerini doldur, hemen başla.</p>

            {authMessage ? <div className="auth-feedback auth-feedback-success">{authMessage}</div> : null}
            {authError ? <div className="auth-feedback auth-feedback-error">{authError}</div> : null}

            <form className="login-form" onSubmit={handleSubmit}>
              <div className="signup-name-row">
                <input
                  name="firstName"
                  type="text"
                  placeholder="Ad"
                  aria-label="Ad"
                  autoComplete="given-name"
                  maxLength="60"
                  required
                  value={form.firstName}
                  onChange={handleInputChange}
                />
                <input
                  name="lastName"
                  type="text"
                  placeholder="Soyad"
                  aria-label="Soyad"
                  autoComplete="family-name"
                  maxLength="60"
                  required
                  value={form.lastName}
                  onChange={handleInputChange}
                />
              </div>

              <input
                name="phone"
                type="tel"
                inputMode="numeric"
                placeholder="Telefon (05XXXXXXXXX)"
                aria-label="Telefon"
                maxLength="11"
                autoComplete="tel"
                required
                value={form.phone}
                onChange={handleInputChange}
              />

              {role === 'ebeveyn' ? (
                <div className="signup-parent-type">
                  <span className="signup-subjects-label">Veli Tipi</span>
                  <div className="billing-toggle" role="tablist" aria-label="Veli tipi">
                    <button
                      type="button"
                      className={form.parentType === 'anne' ? 'active' : ''}
                      onClick={() => setForm((current) => ({ ...current, parentType: 'anne' }))}
                    >
                      Anne
                    </button>
                    <button
                      type="button"
                      className={form.parentType === 'baba' ? 'active' : ''}
                      onClick={() => setForm((current) => ({ ...current, parentType: 'baba' }))}
                    >
                      Baba
                    </button>
                  </div>
                </div>
              ) : null}

              {role === 'ogretmen' ? (
                <div className="signup-coupon-field">
                  <input
                    name="couponCode"
                    type="text"
                    placeholder="Kupon kodu (varsa)"
                    aria-label="Kupon Kodu"
                    autoComplete="off"
                    value={form.couponCode}
                    onChange={handleInputChange}
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

              {role === 'ogretmen' ? (
                <div className="signup-subjects">
                  <span className="signup-subjects-label">Branşınız</span>
                  {subjects === null ? (
                    <p className="signup-subjects-loading">Dersler yükleniyor...</p>
                  ) : (
                    <div className="signup-subjects-list">
                      {subjects.map((subject) => (
                        <label key={subject.id} className="check-row signup-subject-row">
                          <input
                            type="checkbox"
                            checked={subjectIds.includes(subject.id)}
                            onChange={() => toggleSubject(subject.id)}
                          />
                          <span>{subject.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              <div className="auth-hint">Devam etmek için telefonuna SMS ile bir doğrulama kodu göndereceğiz.</div>

              <label className="check-row">
                <input
                  name="acceptAydinlatma"
                  type="checkbox"
                  checked={form.acceptAydinlatma}
                  onChange={handleInputChange}
                />
                <span>
                  <button type="button" className="inline-link" onClick={() => setInfoModal('aydinlatma')}>
                    Aydınlatma metni
                  </button>{' '}
                  okudum ve onaylıyorum.
                </span>
              </label>

              <label className="check-row">
                <input name="acceptKvkk" type="checkbox" checked={form.acceptKvkk} onChange={handleInputChange} />
                <span>
                  <button type="button" className="inline-link" onClick={() => setInfoModal('kvkk')}>
                    KVKK Açık Rıza Metni
                  </button>{' '}
                  kapsamında açık rıza gerektiren işlemlere (yurt dışına aktarım, kişiselleştirme ve
                  ticari elektronik ileti) onay veriyorum.
                </span>
              </label>

              <TurnstileWidget
                ref={turnstileRef}
                onToken={setTurnstileToken}
                onExpire={() => setTurnstileToken('')}
                onError={() => setTurnstileToken('')}
              />

              <button
                type="submit"
                className="btn btn-primary login-submit"
                disabled={
                  authLoading ||
                  (Boolean(TURNSTILE_SITE_KEY) && !turnstileToken) ||
                  (form.couponCode.trim() !== '' && couponCheck.status === 'checking')
                }
              >
                <UserPlus size={18} aria-hidden="true" />
                {authLoading ? 'Kod gönderiliyor...' : isPaymentBound ? 'Ödemeye Geç' : 'Kod Gönder'}
              </button>
              <Link to="/login" className="btn btn-outline login-register">
                Zaten Üyeyim
              </Link>
            </form>
              </>
            ) : null}

            {signupStep === 'otp' ? (
              <>
                <h3>Doğrulama Kodu</h3>
                <p>{form.phone} numarasına gönderilen 6 haneli kodu gir.</p>
                <div className="auth-notice">Marka tescil sürecimiz henüz tamamlanmadığı için kod, şu an "Ugur Sisman" gönderici adıyla gelecek — TechCoach değil, endişelenmeyin, güvendesiniz.</div>

                {authError ? <div className="auth-feedback auth-feedback-error">{authError}</div> : null}

                <form className="login-form" onSubmit={handleVerifyAndRegister}>
                  <label htmlFor="signup-otp-code">Doğrulama Kodu</label>
                  <input
                    id="signup-otp-code"
                    name="code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="123456"
                    maxLength={OTP_CODE_LENGTH}
                    autoComplete="one-time-code"
                    className="otp-code-input"
                    required
                    autoFocus
                    value={otpCode}
                    onChange={(event) => setOtpCode(normalizeCodeInput(event.target.value))}
                  />

                  <button type="submit" className="btn btn-primary login-submit" disabled={authLoading}>
                    <ShieldCheck size={18} aria-hidden="true" />
                    {authLoading ? 'Üye olunuyor...' : 'Kodu Doğrula ve Üye Ol'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline login-register"
                    disabled={authLoading || otpCooldown > 0}
                    onClick={handleResendRegisterOtp}
                  >
                    {otpCooldown > 0 ? `Tekrar Gönder (${otpCooldown}sn)` : 'Kodu Tekrar Gönder'}
                  </button>
                </form>
              </>
            ) : null}
          </div>
        </div>
      )}

      {infoModal && (
        <div
          className="login-overlay info-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={LEGAL_CONTENT[infoModal].title}
        >
          <div className="login-card info-card">
            <button type="button" className="login-close" aria-label="Kapat" onClick={() => setInfoModal(null)}>
              ×
            </button>
            <h3>{LEGAL_CONTENT[infoModal].title}</h3>
            <p>{LEGAL_CONTENT[infoModal].intro}</p>
            <div className="info-content">
              {LEGAL_CONTENT[infoModal].body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
