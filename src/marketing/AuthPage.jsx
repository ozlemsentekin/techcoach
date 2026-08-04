import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { LEGAL_CONTENT } from './legalContent'
import TurnstileWidget from './TurnstileWidget'
import './LandingPage.css'

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY

const OTP_SECONDS = 60

const INITIAL_FORM = {
  fullName: '',
  phone: '0',
  email: '',
  acceptAydinlatma: false,
  acceptKvkk: false,
}

function BrandIcon() {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="60" r="54" fill="#2B2F77" />
      <path
        d="M30 60L54 84L92 40"
        fill="none"
        stroke="#3ED6C3"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function panelPathForRole(role) {
  return role === 'ebeveyn' ? '/parent/dashboard' : '/student/today'
}

function normalizePhoneInput(value) {
  return value.replace(/\D/g, '').slice(0, 11)
}

export default function AuthPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const {
    authUser,
    sessionLoading,
    authLoading,
    authError,
    authMessage,
    requestOtp,
    verifyOtp,
    clearAuthFeedback,
    setAuthError,
  } = useAuth()

  const initialMode = searchParams.get('mode') === 'register' ? 'register' : 'login'
  const [mode, setMode] = useState(initialMode)
  const [step, setStep] = useState('form')
  const [form, setForm] = useState(INITIAL_FORM)
  const [code, setCode] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(OTP_SECONDS)
  const [infoModal, setInfoModal] = useState(null)
  const [turnstileToken, setTurnstileToken] = useState('')
  const intervalRef = useRef(null)
  const turnstileRef = useRef(null)

  useEffect(() => {
    if (!sessionLoading && authUser?.role) {
      navigate(panelPathForRole(authUser.role), { replace: true })
    }
  }, [authUser, sessionLoading, navigate])

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current)
      }
    }
  }, [])

  const startCountdown = () => {
    setSecondsLeft(OTP_SECONDS)
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current)
    }
    intervalRef.current = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(intervalRef.current)
          return 0
        }
        return current - 1
      })
    }, 1000)
  }

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login')
    setStep('form')
    setForm(INITIAL_FORM)
    setCode('')
    clearAuthFeedback()
  }

  const handleInputChange = (event) => {
    const { name, type, value, checked } = event.target
    setForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : name === 'phone' ? normalizePhoneInput(value) : value,
    }))
  }

  const validateForm = () => {
    if (!/^0?5\d{9}$/.test(form.phone)) {
      return 'Geçerli bir telefon numarası girin (05XXXXXXXXX).'
    }
    if (mode === 'register') {
      if (form.fullName.trim().length < 3 || form.fullName.trim().length > 120) {
        return 'Ad soyad 3 ile 120 karakter arasında olmalı.'
      }
      if (!form.acceptAydinlatma || !form.acceptKvkk) {
        return 'Devam etmek için aydınlatma ve KVKK onaylarını vermelisiniz.'
      }
    }
    return null
  }

  const sendCode = async () => {
    const validationError = validateForm()
    if (validationError) {
      setAuthError(validationError)
      return
    }

    try {
      await requestOtp({
        phone: form.phone,
        purpose: mode,
        fullName: mode === 'register' ? form.fullName.trim() : undefined,
        email: mode === 'register' ? form.email.trim() : undefined,
        acceptAydinlatma: mode === 'register' ? form.acceptAydinlatma : undefined,
        acceptKvkk: mode === 'register' ? form.acceptKvkk : undefined,
        turnstileToken: turnstileToken || undefined,
      })
      setCode('')
      setStep('code')
      startCountdown()
    } catch {
      // hata authError üzerinden gösteriliyor
      setTurnstileToken('')
      turnstileRef.current?.reset()
    }
  }

  const handleFormSubmit = (event) => {
    event.preventDefault()
    sendCode()
  }

  const handleResend = () => {
    if (secondsLeft > 0) return
    sendCode()
  }

  const handleVerifySubmit = async (event) => {
    event.preventDefault()
    if (!/^\d{6}$/.test(code)) {
      setAuthError('6 haneli kodu girin.')
      return
    }

    try {
      const user = await verifyOtp({ phone: form.phone, code, purpose: mode })
      if (user?.role) {
        navigate(panelPathForRole(user.role))
      }
    } catch {
      // hata authError üzerinden gösteriliyor
    }
  }

  const handleBackToForm = () => {
    setStep('form')
    setCode('')
    clearAuthFeedback()
  }

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

      <main className="auth-page">
        <div className="container auth-page-shell">
          <div className="login-card auth-page-card">
            <h3>{mode === 'login' ? 'Giriş Yap' : 'Üye Ol'}</h3>
            <p>
              {step === 'form'
                ? mode === 'login'
                  ? 'Telefon numaranla giriş yap, sana 6 haneli bir kod gönderelim.'
                  : 'TechCoach deneyimine başlamak için üyelik bilgilerini doldur.'
                : `${form.phone} numarasına gönderilen 6 haneli kodu gir.`}
            </p>

            {authMessage ? <div className="auth-feedback auth-feedback-success">{authMessage}</div> : null}
            {authError ? <div className="auth-feedback auth-feedback-error">{authError}</div> : null}

            {step === 'form' ? (
              <form className="login-form" onSubmit={handleFormSubmit}>
                {mode === 'register' && (
                  <>
                    <label htmlFor="auth-name">Ad Soyad</label>
                    <input
                      id="auth-name"
                      name="fullName"
                      type="text"
                      placeholder="Adınızı ve soyadınızı girin"
                      autoComplete="name"
                      minLength="3"
                      maxLength="120"
                      required
                      value={form.fullName}
                      onChange={handleInputChange}
                    />
                  </>
                )}

                <label htmlFor="auth-phone">Telefon</label>
                <input
                  id="auth-phone"
                  name="phone"
                  type="tel"
                  inputMode="numeric"
                  placeholder="05XXXXXXXXX"
                  maxLength="11"
                  autoComplete="tel"
                  required
                  value={form.phone}
                  onChange={handleInputChange}
                />

                {mode === 'register' && (
                  <>
                    <label htmlFor="auth-email">Email Adresi (tercihen)</label>
                    <input
                      id="auth-email"
                      name="email"
                      type="email"
                      placeholder="ornek@mail.com"
                      autoComplete="email"
                      value={form.email}
                      onChange={handleInputChange}
                    />
                  </>
                )}

                {mode === 'register' && (
                  <>
                    <label className="check-row">
                      <input
                        name="acceptAydinlatma"
                        type="checkbox"
                        checked={form.acceptAydinlatma}
                        onChange={handleInputChange}
                      />
                      <span>
                        <button
                          type="button"
                          className="inline-link"
                          onClick={() => setInfoModal('aydinlatma')}
                        >
                          Aydınlatma metni
                        </button>{' '}
                        okudum ve onaylıyorum.
                      </span>
                    </label>

                    <label className="check-row">
                      <input
                        name="acceptKvkk"
                        type="checkbox"
                        checked={form.acceptKvkk}
                        onChange={handleInputChange}
                      />
                      <span>
                        <button
                          type="button"
                          className="inline-link"
                          onClick={() => setInfoModal('kvkk')}
                        >
                          KVKK
                        </button>{' '}
                        kapsamında kişisel verilerimin işlenmesine izin veriyorum.
                      </span>
                    </label>
                  </>
                )}

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
                  {authLoading ? 'Kod Gönderiliyor...' : 'Kod Gönder'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline login-register"
                  onClick={switchMode}
                  disabled={authLoading}
                >
                  {mode === 'login' ? 'Üye Olmak İstiyorum' : 'Zaten Üyeyim'}
                </button>
              </form>
            ) : (
              <form className="login-form" onSubmit={handleVerifySubmit}>
                <label htmlFor="auth-code">Doğrulama Kodu</label>
                <input
                  id="auth-code"
                  name="code"
                  type="text"
                  inputMode="numeric"
                  placeholder="6 haneli kod"
                  maxLength="6"
                  autoComplete="one-time-code"
                  required
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                />
                <div className="auth-hint">
                  {secondsLeft > 0 ? `Kod ${secondsLeft} saniye geçerli.` : 'Kodun süresi doldu.'}
                </div>

                <button type="submit" className="btn btn-primary login-submit" disabled={authLoading}>
                  {authLoading ? 'Doğrulanıyor...' : 'Doğrula ve Giriş Yap'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline login-register"
                  onClick={handleResend}
                  disabled={authLoading || secondsLeft > 0}
                >
                  Kodu Tekrar Gönder
                </button>
                <button
                  type="button"
                  className="btn btn-outline login-register"
                  onClick={handleBackToForm}
                  disabled={authLoading}
                >
                  Telefon Numarasını Değiştir
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      {infoModal && (
        <div
          className="login-overlay info-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={LEGAL_CONTENT[infoModal].title}
        >
          <div className="login-card info-card">
            <button
              type="button"
              className="login-close"
              aria-label="Kapat"
              onClick={() => setInfoModal(null)}
            >
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
