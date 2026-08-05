import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { LEGAL_CONTENT } from './legalContent'
import TurnstileWidget from './TurnstileWidget'
import './LandingPage.css'

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY

const INITIAL_FORM = {
  fullName: '',
  phone: '',
  email: '',
  password: '',
  acceptAydinlatma: false,
  acceptKvkk: false,
}

function BrandIcon() {
  return <img src="/logo-mark.png" alt="" className="logo-mark-img" />
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
    login,
    register,
    clearAuthFeedback,
    setAuthError,
  } = useAuth()

  const initialMode = searchParams.get('mode') === 'register' ? 'register' : 'login'
  const [mode, setMode] = useState(initialMode)
  const [form, setForm] = useState(INITIAL_FORM)
  const [infoModal, setInfoModal] = useState(null)
  const [turnstileToken, setTurnstileToken] = useState('')
  const turnstileRef = useRef(null)

  useEffect(() => {
    if (!sessionLoading && authUser?.role) {
      navigate(panelPathForRole(authUser.role), { replace: true })
    }
  }, [authUser, sessionLoading, navigate])

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login')
    setForm(INITIAL_FORM)
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
    if (mode === 'login') {
      if (!form.password.trim()) {
        return 'Şifrenizi girin.'
      }
    } else {
      if (form.fullName.trim().length < 3 || form.fullName.trim().length > 120) {
        return 'Ad soyad 3 ile 120 karakter arasında olmalı.'
      }
      if (!form.acceptAydinlatma || !form.acceptKvkk) {
        return 'Devam etmek için aydınlatma ve KVKK onaylarını vermelisiniz.'
      }
    }
    return null
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const validationError = validateForm()
    if (validationError) {
      setAuthError(validationError)
      return
    }

    try {
      const user =
        mode === 'login'
          ? await login({ phone: form.phone, password: form.password })
          : await register({
              fullName: form.fullName.trim(),
              phone: form.phone,
              email: form.email.trim(),
              acceptAydinlatma: form.acceptAydinlatma,
              acceptKvkk: form.acceptKvkk,
              turnstileToken: turnstileToken || undefined,
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
              {mode === 'login'
                ? 'Telefon numaranı ve şifreni girerek giriş yap.'
                : 'TechCoach deneyimine başlamak için üyelik bilgilerini doldur.'}
            </p>

            {authMessage ? <div className="auth-feedback auth-feedback-success">{authMessage}</div> : null}
            {authError ? <div className="auth-feedback auth-feedback-error">{authError}</div> : null}

            <form className="login-form" onSubmit={handleSubmit}>
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

              {mode === 'login' ? (
                <>
                  <label htmlFor="auth-password">Şifre</label>
                  <input
                    id="auth-password"
                    name="password"
                    type="password"
                    placeholder="Şifreniz"
                    autoComplete="current-password"
                    required
                    value={form.password}
                    onChange={handleInputChange}
                  />
                  <div className="auth-hint">Şifreniz, telefon numaranızın son 6 hanesidir.</div>
                </>
              ) : (
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
                    <input
                      name="acceptKvkk"
                      type="checkbox"
                      checked={form.acceptKvkk}
                      onChange={handleInputChange}
                    />
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
                </>
              )}

              <button
                type="submit"
                className="btn btn-primary login-submit"
                disabled={
                  authLoading || (mode === 'register' && Boolean(TURNSTILE_SITE_KEY) && !turnstileToken)
                }
              >
                {authLoading ? (mode === 'login' ? 'Giriş yapılıyor...' : 'Üye olunuyor...') : mode === 'login' ? 'Giriş Yap' : 'Üye Ol'}
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
