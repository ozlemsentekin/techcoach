import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { KeyRound, Loader2, ShieldCheck } from 'lucide-react'
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

function onlyDigits(value) {
  return value.replace(/\D/g, '').slice(0, 72)
}

function blurActiveControl() {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur()
  }
}

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const { authLoading, authError, authMessage, setAuthError, requestPasswordReset, verifyPasswordResetOtp, confirmPasswordReset } = useAuth()

  const [step, setStep] = useState('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const [turnstileToken, setTurnstileToken] = useState('')
  const turnstileRef = useRef(null)

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
      const data = await requestPasswordReset(phone, turnstileToken || undefined)
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
      const data = await verifyPasswordResetOtp(phone, code)
      setResetToken(data.resetToken)
      setStep('password')
    } catch {
      // hata authError üzerinden gösteriliyor
    }
  }

  const handleResendOtp = async () => {
    if (cooldown > 0) return
    try {
      const data = await requestPasswordReset(phone, turnstileToken || undefined)
      setCooldown(data?.expiresInSeconds || RESEND_COOLDOWN_SECONDS)
      setCode('')
    } catch {
      // hata authError üzerinden gösteriliyor
    }
  }

  const handleConfirmReset = async (event) => {
    event.preventDefault()

    if (!/^\d+$/.test(newPassword)) {
      setAuthError('Yeni şifre yalnızca rakamlardan oluşmalı.')
      return
    }
    if (newPassword.length < 6) {
      setAuthError('Yeni şifre en az 6 rakam olmalı.')
      return
    }
    if (newPassword !== confirmPassword) {
      setAuthError('Yeni şifre ile tekrarı aynı olmalı.')
      return
    }

    blurActiveControl()

    try {
      const user = await confirmPasswordReset(resetToken, newPassword)
      if (user?.role) {
        blurActiveControl()
        navigate(panelPathForRole(user.role))
      }
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
                <h3>Şifremi Unuttum</h3>
                <p>Telefon numaranı gir, sana doğrulama kodu gönderelim.</p>

                {authMessage ? <div className="auth-feedback auth-feedback-success">{authMessage}</div> : null}
                {authError ? <div className="auth-feedback auth-feedback-error">{authError}</div> : null}

                <form className="login-form" onSubmit={handleRequestOtp}>
                  <label htmlFor="reset-phone">Telefon</label>
                  <input
                    id="reset-phone"
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
                  <Link to="/login" className="btn btn-outline login-register">
                    Girişe Dön
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
                  <label htmlFor="reset-code">Doğrulama Kodu</label>
                  <input
                    id="reset-code"
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
                    {authLoading ? 'Doğrulanıyor...' : 'Kodu Doğrula'}
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

            {step === 'password' ? (
              <>
                <h3>Yeni Şifre Belirle</h3>
                <p>Hesabına giriş yapmak için kullanacağın yeni şifreni belirle.</p>

                {authError ? <div className="auth-feedback auth-feedback-error">{authError}</div> : null}

                <form className="login-form" onSubmit={handleConfirmReset}>
                  <label htmlFor="reset-new-password">Yeni Şifre</label>
                  <input
                    id="reset-new-password"
                    name="newPassword"
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="Yeni şifreniz"
                    autoComplete="new-password"
                    required
                    value={newPassword}
                    onChange={(event) => setNewPassword(onlyDigits(event.target.value))}
                  />

                  <label htmlFor="reset-confirm-password">Yeni Şifre (Tekrar)</label>
                  <input
                    id="reset-confirm-password"
                    name="confirmPassword"
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="Yeni şifreniz (tekrar)"
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(onlyDigits(event.target.value))}
                  />
                  <div className="auth-hint">Yeni şifreniz yalnızca rakamlardan oluşmalı ve en az 6 haneli olmalı.</div>

                  <button type="submit" className="btn btn-primary login-submit" disabled={authLoading}>
                    {authLoading ? <Loader2 size={18} className="spin" aria-hidden="true" /> : <KeyRound size={18} aria-hidden="true" />}
                    {authLoading ? 'Kaydediliyor...' : 'Şifreyi Kaydet ve Giriş Yap'}
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
