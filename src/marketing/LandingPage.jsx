import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LogIn, UserPlus, Quote } from 'lucide-react'
import { useAuth } from '../context/useAuth'
import { panelPathForRole } from '../utils/panelPath'
import './LandingPage.css'

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
              <p className="about-kicker">8. Sınıf • LGS Hazırlık Platformu</p>
              <h2 className="section-title">
                LGS Hazırlığını Planlı, Ölçülebilir ve Birlikte Yönetin
              </h2>
              <p className="section-subtitle about-subtitle">
                TechCoach; 8. sınıf öğrencisinin günlük çalışmalarını LGS hedeflerine göre
                planlayan, konu ve soru bazlı gelişimini görünür hâle getiren; öğrenci, veli ve
                öğretmeni aynı hazırlık sürecinde buluşturan akademik gelişim platformudur.
              </p>
              <div className="about-highlights">
                <span>LGS’ye özel çalışma planı</span>
                <span>Konu ve soru bazlı gelişim takibi</span>
                <span>Öğrenci • Veli • Öğretmen iş birliği</span>
              </div>
            </div>

            <div className="steps about-steps">
              <article className="step">
                <div className="step-head">
                  <div className="step-num">1</div>
                  <h3>Amacı</h3>
                </div>
                <p>
                  Her öğrencinin LGS hazırlığını kendi gelişimine, ihtiyaçlarına ve öğrenme hızına
                  göre planlamak; öğrenciyi başkalarıyla değil, kendi ilerlemesiyle değerlendirerek
                  potansiyelini en yüksek seviyede ortaya çıkarmasına yardımcı olmak.
                </p>
              </article>

              <article className="step">
                <div className="step-head">
                  <div className="step-num">2</div>
                  <h3>Vizyonu</h3>
                </div>
                <p>
                  Her öğrencinin LGS hazırlığını kendi gelişimine uygun bir planla sürdürebildiği;
                  ilerlemenin düzenli olarak takip edildiği, eksiklerin zamanında fark edildiği ve
                  doğru yönlendirmeyle desteklendiği bir eğitim süreci oluşturmak.
                </p>
              </article>

              <article className="step">
                <div className="step-head">
                  <div className="step-num">3</div>
                  <h3>Çalışma Modeli</h3>
                </div>
                <p>
                  TechCoach; öğrencinin tamamladığı görevleri, çalışma sürelerini, çözdüğü
                  soruları, konu bazlı başarı durumunu ve verdiği geri bildirimleri bir araya
                  getirerek gelişim sürecini görünür hâle getirir. Bu veriler doğrultusunda
                  öğrencinin ihtiyaçlarına ve öğrenme hızına uygun bir yol haritası oluşturulur;
                  öğrenci planını uygular, veli süreci takip eder, öğretmen ise ihtiyaç duyulan
                  noktada yönlendirme yapar.
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
          <div className="footer-copyright">© 2026 TechCoach · Disiplin. Analiz. Başarı.</div>
        </div>
      </footer>
    </div>
  )
}
