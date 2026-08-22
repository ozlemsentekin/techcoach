import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LogIn } from 'lucide-react'
import { useAuth } from '../context/useAuth'
import { panelPathForRole } from '../utils/panelPath'
import './LandingPage.css'

const INITIAL_FORM = {
  phone: '',
  password: '',
}

function BrandIcon() {
  return <img src="/logo-mark.png" alt="" className="logo-mark-img" />
}

function normalizePhoneInput(value) {
  return value.replace(/\D/g, '').slice(0, 11)
}

function blurActiveControl() {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur()
  }
}

export default function AuthPage() {
  const navigate = useNavigate()
  const { authUser, sessionLoading, authLoading, authError, authMessage, login, setAuthError } = useAuth()

  const [form, setForm] = useState(INITIAL_FORM)

  useEffect(() => {
    if (!sessionLoading && authUser?.role) {
      blurActiveControl()
      navigate(panelPathForRole(authUser.role), { replace: true })
    }
  }, [authUser, sessionLoading, navigate])

  const handleInputChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({
      ...current,
      [name]: name === 'phone' ? normalizePhoneInput(value) : value,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!/^0?5\d{9}$/.test(form.phone)) {
      setAuthError('Geçerli bir telefon numarası girin (05XXXXXXXXX).')
      return
    }
    if (!form.password.trim()) {
      setAuthError('Şifrenizi girin.')
      return
    }

    blurActiveControl()

    try {
      const user = await login({ phone: form.phone, password: form.password })
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
            <h3>Giriş Yap</h3>
            <p>Telefon numaranı ve şifreni girerek giriş yap.</p>

            {authMessage ? <div className="auth-feedback auth-feedback-success">{authMessage}</div> : null}
            {authError ? <div className="auth-feedback auth-feedback-error">{authError}</div> : null}

            <form className="login-form" onSubmit={handleSubmit}>
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

              <label htmlFor="auth-password">Şifre</label>
              <input
                id="auth-password"
                name="password"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Şifreniz"
                autoComplete="current-password"
                required
                value={form.password}
                onChange={handleInputChange}
              />
              <div className="auth-hint">Şifreniz, telefon numaranızın son 6 hanesidir.</div>

              <button type="submit" className="btn btn-primary login-submit" disabled={authLoading}>
                <LogIn size={18} aria-hidden="true" />
                {authLoading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
              </button>
              <Link to="/uye-ol" className="btn btn-outline login-register">
                Üye Olmak İstiyorum
              </Link>
            </form>
          </div>
        </div>
      </main>
    </>
  )
}
