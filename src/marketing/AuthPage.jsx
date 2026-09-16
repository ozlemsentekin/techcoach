import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { KeyRound, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/useAuth'
import { panelPathForRole } from '../utils/panelPath'
import TurnstileWidget from './TurnstileWidget'
import './LandingPage.css'

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY
const OTP_CODE_LENGTH = 6
const RESEND_COOLDOWN_SECONDS = 60

function BrandIcon() {
  return <img src="/logo-mark.png" alt="" className="logo-mark-img" />
}

function normalizePhoneInput(value) {
  return value.replace(/\D/g, '').slice(0, 11)
}

function normalizeCodeInput(value) {
  return value.replace(/\D/g, '').slice(0, OTP_CODE_LENGTH)
}

function blurActiveControl() {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur()
  }
}

export default function AuthPage() {
  const navigate = useNavigate()
  const { authUser, sessionLoading, authLoading, authError, authMessage, requestOtp, verifyLoginOtp, setAuthError } = useAuth()

  const [step, setStep] = useState('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const [turnstileToken, setTurnstileToken] = useState('')
  const turnstileRef = useRef(null)

  useEffect(() => {
    if (!sessionLoading && authUser?.role) {
      blurActiveControl()
      navigate(panelPathForRole(authUser.role), { replace: true })
    }
  }, [authUser, sessionLoading, navigate])

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  const handleRequestOtp = async (event) => {
    event.preventDefault()

    if (!/^0?5\d{9}$/.test(phone)) {
      setAuthError('Geçerli bir telefon numarası girin (05XXXXXXXXX).')
      return
    }

    blurActiveControl()

    try {
      const data = await requestOtp('login', phone, turnstileToken || undefined)
      setCooldown(data?.expiresInSeconds || RESEND_COOLDOWN_SECONDS)
      setCode('')
      setStep('otp')
    } catch {
      setTurnstileToken('')
      turnstileRef.current?.reset()
    }
  }

  const handleVerifyOtp = async (event) => {
    event.preventDefault()

    if (code.length !== OTP_CODE_LENGTH) {
      setAuthError('6 haneli kodu girin.')
      return
    }

    blurActiveControl()

    try {
      const user = await verifyLoginOtp(phone, code)
      if (user?.role) {
        blurActiveControl()
        navigate(panelPathForRole(user.role))
      }
    } catch {
      // hata authError üzerinden gösteriliyor
    }
  }

  const handleResendOtp = async () => {
    if (cooldown > 0) return
    try {
      const data = await requestOtp('login', phone, turnstileToken || undefined)
      setCooldown(data?.expiresInSeconds || RESEND_COOLDOWN_SECONDS)
      setCode('')
    } catch {
      // hata authError üzerinden gösteriliyor
    }
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
            {step === 'phone' ? (
              <>
                <h3>Giriş Yap</h3>
                <p>Telefon numaranı gir, sana SMS ile bir doğrulama kodu gönderelim.</p>

                {authMessage ? <div className="auth-feedback auth-feedback-success">{authMessage}</div> : null}
                {authError ? <div className="auth-feedback auth-feedback-error">{authError}</div> : null}

                <form className="login-form" onSubmit={handleRequestOtp}>
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
                    value={phone}
                    onChange={(event) => setPhone(normalizePhoneInput(event.target.value))}
                  />

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
                    <KeyRound size={18} aria-hidden="true" />
                    {authLoading ? 'Kod gönderiliyor...' : 'Kod Gönder'}
                  </button>
                  <Link to="/uye-ol" className="btn btn-outline login-register">
                    Üye Olmak İstiyorum
                  </Link>
                </form>
              </>
            ) : null}

            {step === 'otp' ? (
              <>
                <h3>Doğrulama Kodu</h3>
                <p>{phone} numarasına gönderilen 6 haneli kodu gir.</p>
                <div className="auth-notice">Marka tescil sürecimiz henüz tamamlanmadığı için kod, şu an "Ugur Sisman" gönderici adıyla gelecek — TechCoach değil, endişelenmeyin, güvendesiniz.</div>

                {authMessage ? <div className="auth-feedback auth-feedback-success">{authMessage}</div> : null}
                {authError ? <div className="auth-feedback auth-feedback-error">{authError}</div> : null}

                <form className="login-form" onSubmit={handleVerifyOtp}>
                  <label htmlFor="auth-code">Doğrulama Kodu</label>
                  <input
                    id="auth-code"
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
                    value={code}
                    onChange={(event) => setCode(normalizeCodeInput(event.target.value))}
                  />

                  <button type="submit" className="btn btn-primary login-submit" disabled={authLoading}>
                    <ShieldCheck size={18} aria-hidden="true" />
                    {authLoading ? 'Doğrulanıyor...' : 'Giriş Yap'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline login-register"
                    disabled={authLoading || cooldown > 0}
                    onClick={handleResendOtp}
                  >
                    {cooldown > 0 ? `Tekrar Gönder (${cooldown}sn)` : 'Kodu Tekrar Gönder'}
                  </button>
                </form>
              </>
            ) : null}
          </div>
        </div>
      </main>
    </>
  )
}
