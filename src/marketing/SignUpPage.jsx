import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, GraduationCap, UserPlus, Users } from 'lucide-react'
import { useAuth } from '../context/useAuth'
import { panelPathForRole } from '../utils/panelPath'
import { authRequest } from '../services/authClient'
import { LEGAL_CONTENT } from './legalContent'
import TurnstileWidget from './TurnstileWidget'
import './LandingPage.css'

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY

const INITIAL_FORM = {
  firstName: '',
  lastName: '',
  phone: '',
  couponCode: '',
  acceptAydinlatma: false,
  acceptKvkk: false,
}

const PLANS = {
  ebeveyn: {
    badgeLabel: 'Veliyim',
    badgeIcon: Users,
    title: 'Veli Takip Paketi',
    features: [
      '2 öğrenciye kadar tam erişim',
      'Günlük çalışma planı ve ders ajandası görünürlüğü',
      'Hata defteri ile konu bazlı tekrar takibi',
      'Haftalık ilerleme raporu ve risk uyarıları',
      'Sınav takvimini fotoğrafla saniyeler içinde içe aktarma',
      'Öğretmenle paylaşımlı görünüm ve bildirimler',
    ],
    billing: {
      monthly: { price: '3000', period: 'TL / ay' },
      yearly: { price: '24000', period: 'TL / yıl', badge: '%20 indirim' },
    },
    cta: 'Veli Planını Seç',
  },
  ogretmen: {
    badgeLabel: 'Öğretmenim',
    badgeIcon: GraduationCap,
    title: 'Öğretmen İş Paketi',
    features: [
      '4 öğrenciye kadar dahil, ek öğrenci 200 TL / ay',
      'Sınıf geneli hata yoğunluğu ve öncelik alanları analizi',
      'Öğrenci bazlı haftalık performans raporları',
      'Ödev ve sınav atama, teslim takibi',
      'Velilerle otomatik paylaşım ve bildirim akışı',
      'Öncelikli destek hattı',
    ],
    billing: {
      monthly: { price: '3000', period: 'TL / ay' },
    },
    note: 'Kart tahsilatı yakında aktif olacak; üye olduğunuzda hesabınız deneme durumunda hemen açılır.',
    cta: 'Öğretmen Planını Seç',
  },
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
  const { authLoading, authError, authMessage, register, setAuthError, clearAuthFeedback } = useAuth()

  const [selectedPlan, setSelectedPlan] = useState(null)
  const [role, setRole] = useState('ebeveyn')
  const [billingCycle, setBillingCycle] = useState('monthly')
  const [form, setForm] = useState(INITIAL_FORM)
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [infoModal, setInfoModal] = useState(null)
  const [turnstileToken, setTurnstileToken] = useState('')
  const [subjects, setSubjects] = useState(null)
  const [subjectIds, setSubjectIds] = useState([])
  const turnstileRef = useRef(null)

  const plan = PLANS[role]

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
    setShowRegisterModal(true)
  }

  const closeRegisterModal = () => setShowRegisterModal(false)

  const handleInputChange = (event) => {
    const { name, type, value, checked } = event.target
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
    return null
  }

  const hasTrialCoupon = form.couponCode.trim().toUpperCase() === 'DENEME'
  // Veli, kupon kodu yoksa hesabı hemen açmıyoruz — ödeme adımına geçiyoruz, gerçek hesap
  // yalnızca ödeme başarılı olunca backend'de oluşturuluyor (bkz. PaymentPage.jsx).
  const isPaymentBound = role === 'ebeveyn' && !hasTrialCoupon

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
            couponCode: form.couponCode.trim(),
            acceptAydinlatma: form.acceptAydinlatma,
            acceptKvkk: form.acceptKvkk,
            turnstileToken: turnstileToken || undefined,
          },
        },
      })
      return
    }

    try {
      const user = await register({
        fullName: combinedFullName(),
        phone: form.phone,
        couponCode: form.couponCode.trim(),
        acceptAydinlatma: form.acceptAydinlatma,
        acceptKvkk: form.acceptKvkk,
        role,
        turnstileToken: turnstileToken || undefined,
        ...(role === 'ogretmen' ? { subjectIds } : {}),
      })
      if (user?.role) {
        navigate(panelPathForRole(user.role))
      }
    } catch {
      // hata authError üzerinden gösteriliyor
      setTurnstileToken('')
      turnstileRef.current?.reset()
    }
  }

  const defaultPasswordHint = form.phone.length >= 6 ? form.phone.slice(-6) : null
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
            {Object.entries(PLANS).map(([key, value]) => (
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

              <input
                name="couponCode"
                type="text"
                placeholder="Kupon kodu (varsa)"
                aria-label="Kupon Kodu"
                autoComplete="off"
                value={form.couponCode}
                onChange={handleInputChange}
              />

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

              <div className="auth-hint">
                Şifreniz otomatik olarak telefon numaranızın son 6 hanesi olacaktır
                {defaultPasswordHint ? ` (${defaultPasswordHint})` : ''}.
              </div>

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
                    KVKK
                  </button>{' '}
                  kapsamında kişisel verilerimin işlenmesine izin veriyorum.
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
                disabled={authLoading || (Boolean(TURNSTILE_SITE_KEY) && !turnstileToken)}
              >
                <UserPlus size={18} aria-hidden="true" />
                {authLoading ? 'Üye olunuyor...' : isPaymentBound ? 'Ödemeye Geç' : 'Üye Ol'}
              </button>
              <Link to="/login" className="btn btn-outline login-register">
                Zaten Üyeyim
              </Link>
            </form>
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
