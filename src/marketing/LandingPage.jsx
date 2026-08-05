import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import './LandingPage.css'

const NAV_ITEMS = [
  { id: 'nasil', label: 'Nedir?' },
  { id: 'paketler', label: 'Paketler' },
  { id: 'paneller', label: 'Paneller' },
]

function BrandIcon() {
  return <img src="/logo-mark.png" alt="" className="logo-mark-img" />
}

function panelPathForRole(role) {
  return role === 'ebeveyn' ? '/parent/dashboard' : '/student/today'
}

export default function LandingPage() {
  const navigate = useNavigate()
  const { authUser, sessionLoading, authLoading, logout } = useAuth()

  const [activeSection, setActiveSection] = useState('nasil')
  const showPricing = false

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
            <span className="nav-cta-icon" aria-hidden="true">→</span>
          </a>
        </div>
      </header>

      <main>
        <section className="section hero" id="hero">
          <div className="container hero-grid">
            <div className="hero-copy">
              <div className="hero-copy-main">
                <div className="eyebrow">Akademik performansın dijital sistemi</div>
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
