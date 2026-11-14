import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { KeyRound, LogIn, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/useAuth'
import { postLoginPath } from '../utils/panelPath'
import TurnstileWidget from './TurnstileWidget'
import './LandingPage.css'

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY
const OTP_CODE_LENGTH = 6
const PASSWORD_LENGTH = 6
const RESEND_COOLDOWN_SECONDS = 60

function BrandIcon() {
  return <img src="/logo-mark.png" alt="" className="logo-mark-img" />
}

function normalizePhoneInput(value) {
  return value.replace(/\D/g, '').slice(0, 11)
}

function normalizeDigitsInput(value, maxLength) {
  return value.replace(/\D/g, '').slice(0, maxLength)
}

function blurActiveControl() {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur()
  }
}

export default function AuthPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const nextPath = searchParams.get('next')
  const {
    authUser,
    sessionLoading,
    authLoading,
    authError,
    authMessage,
    login,
    requestOtp,
    verifyLoginOtp,
    setAuthError,
    clearAuthFeedback,
  } = useAuth()

  // 'credentials': telefon+şifre; 'otp': hesap hâlâ varsayılan şifredeyse (login()
  // { requiresOtp: true } dönünce) devreye giren ikinci faktör — SMS kodu.
  const [step, setStep] = useState('credentials')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const [turnstileToken, setTurnstileToken] = useState('')
  const turnstileRef = useRef(null)

  // authError/authMessage AuthContext'te tek, paylaşılan state — başka bir sayfadan (ör.
  // /uye-ol'daki "bu numara zaten kayıtlı" hatası) buraya "Zaten Üyeyim"/"Giriş yapın" ile
  // geçildiğinde eski mesaj temizlenmeden kalmasın diye mount'ta sıfırlanıyor.
  useEffect(() => {
    clearAuthFeedback()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!sessionLoading && authUser?.role) {
      blurActiveControl()
      navigate(postLoginPath(authUser.role, nextPath), { replace: true })
    }
  }, [authUser, sessionLoading, navigate, nextPath])

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  const handleLogin = async (event) => {
    event.preventDefault()

    if (!/^0?5\d{9}$/.test(phone)) {
      setAuthError('Geçerli bir telefon numarası girin (05XXXXXXXXX).')
      return
    }
    if (password.length !== PASSWORD_LENGTH) {
      setAuthError('6 haneli şifreni gir.')
      return
    }

    blurActiveControl()

    try {
      const data = await login(phone, password)
      if (data?.requiresOtp) {
        // Hesap hâlâ varsayılan (telefonun son 6 hanesi) şifrede — şifreyi tahmin edip
        // gerçek sahibinden önce girmeye çalışan biri, telefona gelen SMS kodunu da
        // doğrulamak zorunda kalır. Kod otomatik istenir.
        const otpData = await requestOtp('login', phone, turnstileToken || undefined)
        setCooldown(otpData?.expiresInSeconds || RESEND_COOLDOWN_SECONDS)
        setCode('')
        setStep('otp')
      }
      // Başarılı normal giriş: authUser güncellenir, üstteki effect panele yönlendirir.
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
      const { phoneVerifiedToken } = await verifyLoginOtp(phone, code)
      await login(phone, password, phoneVerifiedToken)
      // Başarı: authUser güncellenir, üstteki effect panele yönlendirir.
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
            {step === 'credentials' ? (
              <>
                <h3>Giriş Yap</h3>
                <p>Telefon numaranı ve şifreni gir.</p>

                {authMessage ? <div className="auth-feedback auth-feedback-success">{authMessage}</div> : null}
                {authError ? <div className="auth-feedback auth-feedback-error">{authError}</div> : null}

                <form className="login-form" onSubmit={handleLogin}>
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

                  <label htmlFor="auth-password">Şifre</label>
                  <input
                    id="auth-password"
                    name="password"
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="••••••"
                    maxLength={PASSWORD_LENGTH}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(normalizeDigitsInput(event.target.value, PASSWORD_LENGTH))}
                  />

                  <TurnstileWidget
                    ref={turnstileRef}
                    onToken={setTurnstileToken}
                    onExpire={() => setTurnstileToken('')}
                    onError={() => setTurnstileToken('')}
                  />

                  <button type="submit" className="btn btn-primary login-submit" disabled={authLoading}>
                    <LogIn size={18} aria-hidden="true" />
                    {authLoading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
                  </button>
                  <Link to="/sifremi-unuttum" className="auth-forgot-link">
                    Şifremi Unuttum
                  </Link>
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
                    onChange={(event) => setCode(normalizeDigitsInput(event.target.value, OTP_CODE_LENGTH))}
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
                    <KeyRound size={16} aria-hidden="true" />
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
