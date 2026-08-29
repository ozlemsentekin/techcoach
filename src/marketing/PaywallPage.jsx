import { Capacitor } from '@capacitor/core'
import { Link } from 'react-router-dom'
import { CheckCircle2, Lock, Smartphone } from 'lucide-react'
import { useAuth } from '../context/useAuth'
import './LandingPage.css'

const INCLUDED_FEATURES = [
  '2 öğrenciye kadar tam erişim',
  'Günlük çalışma planı ve ders ajandası',
  'Hata defteri ile konu bazlı tekrar takibi',
  'Haftalık ilerleme raporu ve risk uyarıları',
]

function BrandIcon() {
  return <img src="/logo-mark.png" alt="" className="logo-mark-img" />
}

export default function PaywallPage() {
  const { authUser, logout } = useAuth()
  const isNative = Capacitor.isNativePlatform()
  const status = authUser?.entitlement?.status || 'none'
  const canPayOnWeb = !isNative && authUser?.role === 'ebeveyn'
  const isRenewal = status === 'expired' || status === 'cancelled'

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
          <div className="login-card paywall-card">
            <div className="paywall-icon">
              {canPayOnWeb ? <Lock size={22} aria-hidden="true" /> : <Smartphone size={22} aria-hidden="true" />}
            </div>

            <h3>Abonelik Gerekli</h3>
            <p>
              {isRenewal
                ? 'Aboneliğiniz sona erdi. Kaldığınız yerden devam etmek için yenilemeniz gerekiyor.'
                : "TechCoach'u kullanmaya devam etmek için bir abonelik gerekiyor."}
            </p>

            {canPayOnWeb ? (
              <ul className="paywall-features">
                {INCLUDED_FEATURES.map((feature) => (
                  <li key={feature}>
                    <CheckCircle2 size={16} aria-hidden="true" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            {isNative ? (
              <p className="paywall-note">Abonelik satın alma yakında burada açılacak.</p>
            ) : !canPayOnWeb ? (
              <p className="paywall-note">Abonelik satın almak için TechCoach mobil uygulamasını indirin.</p>
            ) : null}

            <div className="paywall-actions">
              {canPayOnWeb ? (
                <Link to="/odeme" className="btn btn-primary paywall-cta">
                  Paketi Seç ve Öde
                </Link>
              ) : (
                <button type="button" className="btn btn-primary paywall-cta" onClick={() => window.location.reload()}>
                  Tekrar Dene
                </button>
              )}
              <button type="button" className="paywall-logout" onClick={logout}>
                Oturumu kapat
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
