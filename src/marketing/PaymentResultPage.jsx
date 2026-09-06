import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authRequest } from '../services/authClient'
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
  const ott = searchParams.get('ott')
  const [status, setStatus] = useState(durum === 'basarili' ? 'checking' : 'hata')

  // Öğretmen ek öğrenci koltuğu / veli çocuk koltuğu ödemeleri başarısızlıkta doğrudan ilgili
  // panele döner; buraya düşen öğretmen olursa "Tekrar Dene" onu veli ödeme sayfasına değil
  // öğrenci ekranına götürsün.
  const retryPath = authUser?.role === 'ogretmen' ? '/teacher/students' : '/odeme'

  useEffect(() => {
    if (durum !== 'basarili') {
      return
    }

    let ignore = false

    const goToPanel = (role) => {
      if (ignore) return
      setStatus('basarili')
      navigate(panelPathForRole(role), { replace: true })
    }

    const activate = async () => {
      // iyzico yeni veli hesabı için URL'de kısa ömürlü handoff token'ı bırakır — önce onu
      // aynı-origin bir istekle gerçek oturum çerezine çeviriyoruz. Mevcut velinin yenileme
      // ödemesinde ott gelmez; o zaman doğrudan mevcut çerezle /me'yi tazeleriz.
      if (ott) {
        try {
          const data = await authRequest('/api/auth/session-from-handoff', {
            method: 'POST',
            body: JSON.stringify({ token: ott }),
          })
          // ott'u URL'den temizle (paylaşılmasın / geri tuşunda tekrar denenmesin).
          window.history.replaceState(null, '', '/odeme/sonuc?durum=basarili')
          await refreshSession().catch(() => {})
          return goToPanel(data.user?.role)
        } catch {
          // handoff başarısızsa (token süresi doldu vb.) mevcut çerezi dene.
        }
      }

      // Çerez zaten set olabildiyse birkaç kez deneriz (callback'in çerez yazması + yayılması gecikebilir).
      for (let attempt = 0; attempt < 4 && !ignore; attempt += 1) {
        try {
          const user = await refreshSession()
          return goToPanel(user.role)
        } catch {
          await new Promise((resolve) => window.setTimeout(resolve, 1500))
        }
      }
      if (!ignore) setStatus('hata')
    }

    activate()

    return () => {
      ignore = true
    }
  }, [durum, ott, navigate, refreshSession])

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
            {status === 'checking' ? (
              <>
                <h3>Ödeme kontrol ediliyor...</h3>
                <p>Aboneliğiniz aktifleştiriliyor, birazdan panele yönlendirileceksiniz.</p>
              </>
            ) : status === 'basarili' ? (
              <>
                <h3>Ödeme alındı</h3>
                <p>Panele yönlendiriliyorsunuz...</p>
              </>
            ) : durum === 'basarili' ? (
              <>
                <h3>Ödemeniz alındı</h3>
                <p>
                  Aboneliğiniz aktif. Otomatik giriş yapılamadı — telefon numaranız ve şifrenizle
                  giriş yapabilirsiniz.
                </p>
                <Link to="/login" className="btn btn-primary">
                  Giriş Yap
                </Link>
              </>
            ) : (
              <>
                <h3>Ödeme tamamlanamadı</h3>
                <p>Ödeme işlemi başarısız oldu ya da onaylanamadı. Tekrar deneyebilirsiniz.</p>
                <Link to={retryPath} className="btn btn-primary">
                  Tekrar Dene
                </Link>
              </>
            )}
            {!authUser && status !== 'hata' ? (
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
