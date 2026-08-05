import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import './LandingPage.css'

const NAV_ITEMS = [
  { id: 'nasil', label: 'Nedir?' },
  { id: 'paketler', label: 'Paketler' },
  { id: 'paneller', label: 'Paneller' },
]

function getLgsCountdown() {
  const today = new Date()
  const currentYear = today.getFullYear()
  const target = new Date(currentYear, 5, 14)

  if (today > target) {
    target.setFullYear(currentYear + 1)
  }

  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate())
  const msPerDay = 24 * 60 * 60 * 1000

  return Math.max(0, Math.ceil((startOfTarget - startOfToday) / msPerDay))
}

function BrandIcon() {
  return <img src="/logo-mark.png" alt="" className="logo-mark-img" />
}

function TecoMessageIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="tecoMessageGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3ED6C3" />
          <stop offset="100%" stopColor="#2B2F77" />
        </linearGradient>
      </defs>
      <path
        d="M12 14 Q12 8 18 8 L46 8 Q52 8 52 14 L52 34 Q52 40 46 40 L28 40 L20 48 L20 40 L18 40 Q12 40 12 34 Z"
        fill="url(#tecoMessageGradient)"
      />
      <circle cx="24" cy="24" r="3" fill="white" />
      <circle cx="32" cy="24" r="3" fill="white" />
      <circle cx="40" cy="24" r="3" fill="white" />
    </svg>
  )
}

function DashboardPreview({ days, compact = false }) {
  return (
    <div className={`plan-dashboard ${compact ? 'plan-dashboard-compact' : 'plan-dashboard-desktop'}`}>
      <div className="plan-dashboard-shell">
        <div className="plan-dashboard-banner">
          <span>TECHCOACH</span>
          <strong>Aylin, bugünkü planın hazır.</strong>
        </div>

        <div className="plan-dashboard-rhythm">
          <span>BUGÜNÜN RİTMİ</span>
          <b>CANLI</b>
        </div>

        <div className="plan-dashboard-score">
          <div className="plan-dashboard-score-line">
            <strong>%82</strong>
            <span>Tamamlandı</span>
          </div>
          <p>Başlamak işin yarısını tamamlamaktır.</p>
        </div>

        <div className="plan-dashboard-progress" aria-hidden="true">
          <span />
        </div>

        <div className="plan-dashboard-countdown">
          <div>
            <strong>14 Haziran&apos;da LGS var</strong>
            <span>Hazırlık ritmini koru.</span>
          </div>
          <b>{days} gün</b>
        </div>

        <div className="plan-dashboard-discipline">
          <div className="plan-dashboard-discipline-head">
            <strong>Disiplin skoru</strong>
            <b>%74</b>
          </div>
          <div className="plan-dashboard-discipline-progress" aria-hidden="true">
            <span />
          </div>
          <p>48 dk / 120 dk · 5 gün seri</p>
        </div>

        <div className="plan-dashboard-message">
          <div className="plan-dashboard-message-head">
            <div className="plan-dashboard-message-icon">
              <TecoMessageIcon />
            </div>
            <strong>
              <span className="teco-accent">Teco</span>&apos;dan mesajın var!
            </strong>
          </div>

          <div className="plan-dashboard-guidance">
            <div className="plan-dashboard-guidance-path" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div className="plan-dashboard-guidance-copy">
              <small>Matematik sınavına 3 gün kaldı</small>
              <strong>Önce olasılık tekrarını tamamla.</strong>
              <p>25 dakikalık kısa tekrar ve 8 soruluk mini turla ritmi başlat.</p>
            </div>
          </div>

          <div className="plan-dashboard-tags" aria-hidden="true">
            <span>ÖNCELİK: OLASILIK</span>
            <span>BUGÜN · 25 DK</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function panelPathForRole(role) {
  return role === 'ebeveyn' ? '/parent/dashboard' : '/student/today'
}

export default function LandingPage() {
  const navigate = useNavigate()
  const { authUser, sessionLoading, authLoading, logout } = useAuth()

  const [activeSection, setActiveSection] = useState('nasil')
  const showPricing = false
  const lgsCountdown = getLgsCountdown()

  const handlePrimaryCta = (event) => {
    event.preventDefault()
    if (authUser?.role) {
      navigate(panelPathForRole(authUser.role))
    } else {
      navigate('/uye-ol')
    }
  }

  const handleLogout = async () => {
    try {
      await logout()
    } catch {
      // error surfaced via authError from context
    }
  }

  useEffect(() => {
    const onScroll = () => {
      const scrollPos = window.scrollY + 140
      let current = NAV_ITEMS[0].id

      NAV_ITEMS.forEach((item) => {
        const section = document.getElementById(item.id)
        if (section && section.offsetTop <= scrollPos) {
          current = item.id
        }
      })

      setActiveSection(current)
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const primaryCtaLabel = sessionLoading
    ? 'Oturum Kontrol Ediliyor'
    : authUser
      ? `${authUser.fullName.split(' ')[0]}`
      : 'Başla'

  return (
    <div className="landing-page">
      <header className="topbar">
        <div className="container topbar-inner">
          <a href="#" className="logo" aria-label="TechCoach">
            <span className="logo-mark">
              <BrandIcon />
            </span>
            <span className="logo-title">
              Tech<span>Coach</span>
            </span>
          </a>
          <nav className="nav">
            {NAV_ITEMS.filter((item) => item.id !== 'paketler').map((item) => (
              <a
                key={item.id}
                className={`nav-link ${activeSection === item.id ? 'active' : ''}`}
                href={`#${item.id}`}
              >
                {item.label.includes('Teco') ? <span className="teco-accent">{item.label}</span> : item.label}
              </a>
            ))}
          </nav>
          {authUser && !sessionLoading ? (
            <div className="auth-chip" aria-live="polite">
              <strong>{authUser.fullName}</strong>
              <span>{authUser.email || authUser.phone}</span>
              <button type="button" className="inline-link" onClick={handleLogout} disabled={authLoading}>
                {authLoading ? 'Çıkış Yapılıyor...' : 'Çıkış Yap'}
              </button>
            </div>
          ) : null}
          <a className="btn btn-primary nav-cta" href="#" onClick={handlePrimaryCta}>
            <span className="cta-full">{primaryCtaLabel}</span>
            <span className="cta-short">{authUser ? 'Hesap' : 'Başla'}</span>
          </a>
        </div>
      </header>

      <main>
        <section className="section hero" id="hero">
          <div className="container hero-grid">
            <div className="hero-copy">
              <div className="hero-copy-main">
                <div className="eyebrow">Akademik performansın dijital sistemi</div>
                <div className="hero-mobile-device" aria-hidden="true">
                  <span className="hero-mobile-device-notch" />
                  <span className="hero-mobile-device-side hero-mobile-device-side-top" />
                  <span className="hero-mobile-device-side hero-mobile-device-side-bottom" />
                  <div className="hero-mobile-device-screen">
                    <div className="hero-mobile-statusbar">
                      <span>9:41</span>
                      <div className="hero-mobile-status-icons">
                        <i className="hero-mobile-signal" />
                        <i className="hero-mobile-wifi" />
                        <i className="hero-mobile-battery" />
                      </div>
                    </div>
                    <DashboardPreview days={lgsCountdown} compact />
                    <span className="hero-mobile-home-indicator" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="container quote">
            <strong>“Ölçemediğiniz şeyi geliştiremezsiniz.”</strong>
            Peter Drucker
          </div>
        </section>

        <section className="section" id="nasil">
          <div className="container">
            <div className="about-shell">
              <h2 className="section-title">TechCoach Nedir?</h2>
              <p className="section-subtitle about-subtitle">
                TechCoach; öğrencinin hedeflerini planlara dönüştüren, ilerlemesini görünür hâle
                getiren ve öğrenci, veli ile öğretmeni aynı gelişim sürecinde buluşturan akademik
                gelişim platformudur.
              </p>
              <div className="about-highlights">
                <span>Planlı çalışma süreci</span>
                <span>Görünür akademik gelişim</span>
                <span>Öğrenci • Veli • Öğretmen iş birliği.</span>
              </div>
            </div>

            <div className="steps about-steps">
              <article className="step">
                <div className="step-head">
                  <div className="step-num">1</div>
                  <h3>Amacı</h3>
                </div>
                <p>
                  Öğrencinin ne çalışacağını, ne kadar ilerlediğini ve nerede zorlandığını görünür
                  hale getirerek sürdürülebilir çalışma disiplini oluşturmak.
                </p>
              </article>

              <article className="step">
                <div className="step-head">
                  <div className="step-num">2</div>
                  <h3>Vizyonu</h3>
                </div>
                <p>
                  Sınava hazırlık sürecini ezbere ve baskıyla değil; ölçüm, analiz ve kişiselleştirilmiş
                  yönlendirme ile yönetilen bir standarda dönüştürmek.
                </p>
              </article>

              <article className="step">
                <div className="step-head">
                  <div className="step-num">3</div>
                  <h3>Özet Değer</h3>
                </div>
                <p>
                  Öğrenci uygular, veli takip eder, öğretmen yön verir. TechCoach bu üç rolü tek bir
                  veri diliyle birleştirir.
                </p>
              </article>
            </div>
          </div>
        </section>

        {showPricing ? (
          <section className="section pricing" id="paketler">
            <div className="container">
              <h2 className="section-title">Eğitim Paketleri</h2>
              <p className="section-subtitle">
                Premium bir akademik sistem deneyimi. Ciddiyet, ölçüm ve süreklilik isteyen aileler
                için tasarlandı.
              </p>

              <div className="pricing-grid">
                <article className="plan">
                  <h3>Temel</h3>
                  <div className="price">490 <small>TL / ay</small></div>
                  <ul>
                    <li>Günlük çalışma planı</li>
                    <li>Ders bazlı ajanda</li>
                    <li>Kaynak takibi</li>
                    <li>Temel analiz ekranları</li>
                  </ul>
                  <a className="btn btn-outline" href="#">Paketi Seç</a>
                </article>

                <article className="plan featured">
                  <div className="badge">En Çok Tercih Edilen</div>
                  <h3>Gelişmiş</h3>
                  <div className="price">690 <small>TL / ay</small></div>
                  <ul>
                    <li>AI hata defteri analizi</li>
                    <li>Sınav takvimi foto ile içeri alma</li>
                    <li>Detaylı raporlama</li>
                    <li>Veli paneli</li>
                  </ul>
                  <a className="btn btn-primary" href="#">Paketi Seç</a>
                </article>

                <article className="plan">
                  <h3>Premium</h3>
                  <div className="price">990 <small>TL / ay</small></div>
                  <ul>
                    <li>Öğretmen paneli erişimi</li>
                    <li>Öncelikli analiz ve yönlendirme</li>
                    <li>Derin performans raporları</li>
                    <li>Gelişmiş öğretmen görünümü</li>
                  </ul>
                  <a className="btn btn-outline" href="#">Paketi Seç</a>
                </article>
              </div>
            </div>
          </section>
        ) : null}

        <section className="section" id="paneller">
          <div className="container">
            <h2 className="section-title">Öğrenci, veli ve öğretmen için kişiye özel paneller</h2>
            <p className="section-subtitle">
              Her kullanıcı yalnızca ihtiyacı olan veriyi görür. Öğrenci uygular, veli izler, öğretmen
              yön verir.
            </p>

            <div className="panels-grid">
              <article className="panel-card">
                <div className="panel-card-head">
                  <div className="mock-device phone-style" />
                  <div className="panel-card-copy">
                    <h3>Öğrenci</h3>
                    <p>Günlük plan, streak, ders ajandası, hata defteri ve kaynak kaydı tek mobil akışta.</p>
                  </div>
                </div>
                <div className="panel-card-tags">
                  <span>Günlük plan</span>
                  <span>Hata defteri</span>
                </div>
              </article>

              <article className="panel-card">
                <div className="panel-card-head">
                  <div className="mock-device laptop-style" />
                  <div className="panel-card-copy">
                    <h3>Veli</h3>
                    <p>Haftalık rapor, riskli dersler ve plan takibi. Müdahale değil, görünürlük.</p>
                  </div>
                </div>
                <div className="panel-card-tags">
                  <span>Haftalık rapor</span>
                  <span>Risk görünürlüğü</span>
                </div>
              </article>

              <article className="panel-card">
                <div className="panel-card-head">
                  <div className="mock-device laptop-style" />
                  <div className="panel-card-copy">
                    <h3>Öğretmen</h3>
                    <p>Öğrencinin hata yoğunluğu, yaklaşan sınavları ve haftalık öncelik alanları tek yerde.</p>
                  </div>
                </div>
                <div className="panel-card-tags">
                  <span>Öncelik alanları</span>
                  <span>Müdahale önerisi</span>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <div className="cta-strip">
              <div>
                <h2>Hedefler netleşsin, gelişim görünür olsun.</h2>
                <p>
                  TechCoach; öğrencinin çalışma sürecini planlayan, ilerlemesini ölçen ve öğrenci,
                  veli ve öğretmen arasındaki iletişimi güçlendiren akademik gelişim platformudur.
                </p>
              </div>
              <a className="btn btn-primary cta-action" href="#" onClick={handlePrimaryCta}>
                <span>TechCoach&apos;u Keşfet</span>
                <span className="cta-action-icon" aria-hidden="true">→</span>
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer id="sss">
        <div className="container">© 2026 TechCoach · Disiplin. Analiz. Başarı.</div>
      </footer>
    </div>
  )
}
