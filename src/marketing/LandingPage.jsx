import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LogIn, UserPlus, Quote } from 'lucide-react'
import { useAuth } from '../context/useAuth'
import { panelPathForRole } from '../utils/panelPath'
import './LandingPage.css'
import RolePanels from './RolePanels'

const NAV_ITEMS = [
  { id: 'nasil', label: 'Nedir?' },
  { id: 'paketler', label: 'Paketler' },
  { id: 'paneller', label: 'Paneller' },
]

function BrandIcon() {
  return <img src="/logo-mark.png" alt="" className="logo-mark-img" />
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
      ? authUser.fullName.split(' ')[0]
      : ''

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
          {sessionLoading ? (
            <a className="btn btn-primary nav-cta" href="#" aria-disabled="true">
              <span>{primaryCtaLabel}</span>
            </a>
          ) : authUser ? (
            <a className="btn btn-primary nav-cta" href="#" onClick={handlePrimaryCta}>
              <span className="cta-full">{primaryCtaLabel}</span>
              <span className="cta-short">Hesap</span>
              <span className="nav-cta-icon" aria-hidden="true">→</span>
            </a>
          ) : (
            <div className="nav-cta-group">
              <Link className="btn btn-outline nav-cta nav-cta-secondary" to="/uye-ol">
                <UserPlus size={17} aria-hidden="true" />
                <span className="cta-full">Üye Ol</span>
                <span className="cta-short">Üye</span>
              </Link>
              <Link className="btn btn-primary nav-cta" to="/login">
                <LogIn size={17} aria-hidden="true" />
                <span className="cta-full">Giriş Yap</span>
                <span className="cta-short">Giriş</span>
              </Link>
            </div>
          )}
        </div>
      </header>

      <main>
        <section className="section hero" id="hero">
          <div className="container">
            <figure className="quote">
              <blockquote>
                <Quote className="quote-mark quote-mark-open" aria-hidden="true" />
                Ölçemediğiniz şeyi geliştiremezsiniz.
                <Quote className="quote-mark quote-mark-close" aria-hidden="true" />
              </blockquote>
              <figcaption>Peter Drucker</figcaption>
            </figure>
          </div>
        </section>

        <section className="section" id="nasil">
          <div className="container">
            <div className="about-shell">
              <p className="about-kicker">8. SINIF • LGS HAZIRLIK VE TAKİP PLATFORMU</p>
              <h2 className="section-title">
                LGS Hazırlığını Ölçün, Görün ve Doğru Adımı Planlayın
              </h2>
              <p className="section-subtitle about-subtitle">
                TechCoach; öğrencinin kendi soru bankaları, testleri ve denemelerindeki
                çalışmalarını ölçülebilir veriye dönüştürür. Konu, kaynak ve soru bazında
                gelişimi görünür hâle getirir; hataları dijital hata defterine taşır ve bir
                sonraki çalışma adımını belirlemeyi kolaylaştırır.
                <br />
                Öğrenci, veli ve öğretmen aynı süreci aynı veriler üzerinden takip eder.
              </p>
              <div className="about-highlights">
                <span>Kendi kaynaklarınla ölçülebilir takip</span>
                <span>Hata analizi &amp; dijital hata defteri</span>
                <span>Öğrenci • Veli • Öğretmen aynı veride</span>
              </div>
            </div>

            <div className="steps about-steps">
              <article className="step">
                <div className="step-head">
                  <div className="step-num">01</div>
                  <h3>Kendi Kaynaklarınla Çalış</h3>
                </div>
                <p>
                  TechCoach öğrencinin çalışma düzenini değiştirmesini istemez. Öğrenci
                  kullandığı soru bankalarından testlerini çözer, denemelerine girer ve
                  çalışmalarına devam eder.
                </p>
                <p>
                  Amaç daha fazla kaynak sunmak değil; <strong>zaten yapılan çalışmayı
                  anlamlı ve takip edilebilir hâle getirmektir.</strong>
                </p>
              </article>

              <article className="step">
                <div className="step-head">
                  <div className="step-num">02</div>
                  <h3>Çalışmanı Veriye Dönüştür</h3>
                </div>
                <p>
                  Çözülen testler ve denemeler sisteme işlendiğinde; kaynak, konu ve soru
                  bazındaki sonuçlar görünür hâle gelir.
                </p>
                <p>
                  Başarı ve tamamlanma oranları takip edilir, yanlış yapılan sorular{' '}
                  <strong>dijital hata defterinde</strong> toplanır ve öğrencinin hangi
                  konularda ilerlediği, hangi noktalarda tekrar ihtiyacı olduğu daha kolay
                  fark edilir.
                </p>
              </article>

              <article className="step">
                <div className="step-head">
                  <div className="step-num">03</div>
                  <h3>Sonraki Adımını Belirle</h3>
                </div>
                <p>
                  Ölçülen çalışmalar yalnızca bir rapor olarak kalmaz;{' '}
                  <strong>bir sonraki çalışma adımını belirlemeye yardımcı olur.</strong>
                </p>
                <p>
                  Öğrenci kendi gelişimini ve eksiklerini görerek sürecini yönetebilir.
                  Veli ilerlemeyi takip edip planlamaya destek olabilir. Özel öğretmeni
                  varsa öğretmen de aynı veriler üzerinden öğrenciyi değerlendirebilir
                  ve yönlendirebilir.
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

        <RolePanels />

        <section className="section">
          <div className="container">
            <div className="cta-strip">
              <div>
                <h2>Çalışmanı görünür kıl, sonraki adımını netleştir.</h2>
                <p>
                  TechCoach, öğrencinin kendi kaynaklarındaki çalışmalarını ölçülebilir veriye
                  dönüştürür; ilerlemesini ve hatalarını görünür hâle getirir. Öğrenci sürecini
                  yönetir, veli takip eder; varsa özel öğretmen aynı veriler üzerinden destek olur.
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
        <div className="container footer-inner">
          <nav className="footer-links" aria-label="Yasal bağlantılar">
            <Link to="/hakkimizda">Hakkımızda</Link>
            <Link to="/gizlilik-sozlesmesi">Gizlilik Sözleşmesi</Link>
            <Link to="/mesafeli-satis-sozlesmesi">Mesafeli Satış Sözleşmesi</Link>
            <Link to="/teslimat-iade-sartlari">Teslimat ve İade Şartları</Link>
          </nav>
          <div className="footer-payment-logos" aria-label="Kabul edilen ödeme yöntemleri">
            <img src="/payment-visa.svg" alt="Visa" height="20" />
            <img src="/payment-mastercard.svg" alt="Mastercard" height="20" />
            <img src="/payment-iyzico.svg" alt="iyzico ile öde" height="20" />
          </div>
          <div className="footer-contact">
            <a href="mailto:admin@techcoach.com.tr">admin@techcoach.com.tr</a>
          </div>
          <div className="footer-copyright">© 2026 TechCoach · Disiplin. Analiz. Başarı.</div>
        </div>
      </footer>
    </div>
  )
}
