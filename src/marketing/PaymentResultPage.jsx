import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { panelPathForRole } from '../utils/panelPath'
import './LandingPage.css'

function BrandIcon() {
  return <img src="/logo-mark.png" alt="" className="logo-mark-img" />
}

export default function PaymentResultPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { authUser, refreshSession } = useAuth()
  const durum = searchParams.get('durum')
  const [status, setStatus] = useState(durum === 'basarili' ? 'checking' : 'hata')

  useEffect(() => {
    if (durum !== 'basarili') {
      return
    }

    let ignore = false
    refreshSession()
      .then((user) => {
        if (ignore) return
        setStatus('basarili')
        navigate(panelPathForRole(user.role), { replace: true })
      })
      .catch(() => {
        if (!ignore) setStatus('hata')
      })

    return () => {
      ignore = true
    }
  }, [durum, navigate, refreshSession])

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
            {status === 'checking' || status === 'basarili' ? (
              <>
                <h3>Ödeme kontrol ediliyor...</h3>
                <p>Aboneliğiniz aktifleştiriliyor, birazdan panele yönlendirileceksiniz.</p>
              </>
            ) : (
              <>
                <h3>Ödeme tamamlanamadı</h3>
                <p>Ödeme işlemi başarısız oldu ya da onaylanamadı. Tekrar deneyebilirsiniz.</p>
                <Link to="/odeme" className="btn btn-primary">
                  Tekrar Dene
                </Link>
              </>
            )}
            {!authUser ? (
              <p className="auth-hint">
                <Link to="/login">Giriş yap</Link>
              </p>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  )
}
