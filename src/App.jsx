import { useEffect, useState } from 'react'
import './App.css'

const NAV_ITEMS = [
  { id: 'nasil', label: 'Nedir?' },
  { id: 'how', label: 'Nasıl Çalışır?' },
  { id: 'teco', label: 'Teco' },
  { id: 'arena', label: 'Teco Arena' },
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
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="60" r="54" fill="#2B2F77" />
      <path
        d="M30 60L54 84L92 40"
        fill="none"
        stroke="#3ED6C3"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function App() {
  const [activeSection, setActiveSection] = useState('nasil')
  const [showLogin, setShowLogin] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [infoModal, setInfoModal] = useState(null)
  const showPricing = false
  const lgsCountdown = getLgsCountdown()

  const openLogin = (event) => {
    event.preventDefault()
    setAuthMode('login')
    setShowLogin(true)
  }

  const closeAuthModal = () => {
    setShowLogin(false)
    setAuthMode('login')
    setInfoModal(null)
  }

  const infoModalContent = {
    aydinlatma: {
      title: 'Aydınlatma Metni',
      intro:
        'TechCoach olarak paylaştığınız kişisel verileri üyelik oluşturma, hesabınıza erişim sağlama, hizmet deneyimini iyileştirme ve gerekli durumlarda sizinle iletişime geçme amaçlarıyla işliyoruz.',
      body: [
        'Toplanan veriler; kimlik, iletişim ve kullanım bilgileri ile sınırlıdır. Veriler, yalnızca hizmetin sunulması, destek süreçlerinin yürütülmesi ve yasal yükümlülüklerin yerine getirilmesi kapsamında kullanılacaktır.',
        'Kişisel verileriniz, açık rızanız veya ilgili mevzuatta belirtilen hukuki sebepler bulunmadıkça üçüncü taraflarla paylaşılmaz. Mevzuat kapsamındaki erişim, düzeltme, silme ve itiraz haklarınızı dilediğiniz zaman kullanabilirsiniz.',
        'Detaylı talepleriniz için destek kanallarımız üzerinden bizimle iletişime geçebilirsiniz.',
      ],
    },
    kvkk: {
      title: 'KVKK Onay Metni',
      intro:
        '6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında, TechCoach ile paylaştığınız kişisel verilerin belirtilen amaçlarla işlenmesine ilişkin açık rızanızı bu metin üzerinden sunarsınız.',
      body: [
        'Verileriniz; üyelik işlemlerinin tamamlanması, hesabınızın güvenli şekilde yönetilmesi, öğrenci-veli-koç deneyiminin kişiselleştirilmesi ve hizmet kalitesinin artırılması amacıyla işlenebilir.',
        'İşlenen kişisel veriler, gerekli teknik ve idari tedbirler alınarak korunur. Yasal zorunluluklar dışında üçüncü kişilere aktarım yapılmaz; gerekli durumlarda yalnızca hizmetin sürdürülebilmesi için sınırlı paylaşım yapılır.',
        'KVKK kapsamındaki açık rızanızı dilediğiniz zaman geri çekebilir, veri işleme faaliyetlerine ilişkin bilgi talep edebilir ve kanuni haklarınızı kullanabilirsiniz.',
      ],
    },
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

  return (
    <>
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
          <a className="btn btn-primary nav-cta" href="#" onClick={openLogin}>
            <span className="cta-full">Çalışmaya Başla</span>
            <span className="cta-short">Başla</span>
          </a>
        </div>
      </header>

      <main>
        <section className="section hero" id="hero">
          <div className="container hero-grid">
            <div>
              <div className="eyebrow">Akademik performansın dijital sistemi</div>
              <h1 className="hero-title">
                <span className="hero-title-line hero-title-lead">
                  <span className="hero-title-brand">TechCoach</span>{' '}
                  <span className="hero-title-word">planlar</span>
                </span>
                <span className="hero-title-line hero-title-subline">
                  <span className="hero-title-accent">Teco</span>{' '}
                  <span className="hero-title-word">ilerletir</span>
                </span>
              </h1>
              <p>
                TechCoach öğrencinin akademik sürecini yöneten dijital sistemdir; Teco ise günlük
                planı oluşturan ve öğrenciyi yönlendiren akıllı çalışma asistanıdır.
              </p>
              <div className="hero-mobile-stack" aria-hidden="true">
                <div className="hero-mobile-quote">
                  <span className="hero-mobile-quote-line" />
                  <strong>“Ölçemediğiniz şeyi geliştiremezsiniz.”</strong>
                  <span>Peter Drucker</span>
                </div>
                <div className="hero-mobile-points">
                  <div className="hero-mobile-point">
                    <b>Plan</b>
                    <span>Teco gunluk calisma akisini olusturur.</span>
                  </div>
                  <div className="hero-mobile-point">
                    <b>Takip</b>
                    <span>Veli ve koc ayni veriyi tek ekranda gorur.</span>
                  </div>
                </div>
              </div>
              <div className="hero-flow">
                <span><b>1</b><span className="teco-accent">Teco</span>’ya soralım</span>
                <span><b>2</b><span className="teco-accent">Teco</span>’da planlayalım</span>
                <span><b>3</b><span className="teco-accent">Teco</span> Arena’da kapışalım</span>
              </div>

              <div className="mini-stats hero-metrics">
                <div className="mini-stat">
                  <strong>Takvimden Plana</strong>
                  <span>Sınav takvimini içeri al, Teco çalışma planını otomatik oluştursun.</span>
                </div>
                <div className="mini-stat">
                  <strong><span className="teco-accent">Teco</span> Dijital Asistan</strong>
                  <span>Günlük görevleri hatırlatır, hata analizi yapar, öğrenciyi adım adım yönlendirir.</span>
                </div>
                <div className="mini-stat">
                  <strong>3 Rol Senkronu</strong>
                  <span>Öğrenci uygular, veli takip eder, koç veriye göre yön verir.</span>
                </div>
              </div>
            </div>

            <div className="hero-visual">
              <div className="glow" />

              <div className="laptop">
                <div className="laptop-screen">
                  <div className="screen-left">
                    <div className="screen-title">Tech<span>Coach</span></div>
                    <div className="screen-subtitle">
                      Planlama + Hata Analizi + Koçluk görünürlüğü tek panelde
                    </div>
                    <div className="illustration">
                      <div className="feature-pill">Takvim OCR</div>
                      <div className="feature-pill">AI Hata Defteri</div>
                      <div className="feature-pill">Veli + Koç Paneli</div>
                      <div className="feature-pill">Kaynak Takibi</div>
                      <div className="feature-pill">Disiplin Skoru</div>
                      <div className="feature-pill">Risk Alarmı</div>
                    </div>
                    <div className="mini-metrics">
                      <div><strong>7s 25dk</strong><span>Haftalık süre</span></div>
                      <div><strong>42</strong><span>Çöz. kayıt</span></div>
                      <div><strong>%82</strong><span>Plan tamamlama</span></div>
                    </div>
                  </div>

                  <div className="screen-right">
                    <div className="ui-card">
                      <div className="web-score-head">
                        <div className="today-title">Disiplin Skoru</div>
                        <div className="web-score-value">%74</div>
                      </div>
                      <div className="web-progress"><span /></div>
                      <div className="today-sub">48 dk / 120 dk · 5 gün seri</div>
                    </div>

                    <div className="ui-card">
                      <div className="card-title">Bugünkü Plan</div>
                      <div className="web-plan-list">
                        <div className="web-plan-row done">
                          <span className="dot">✓</span>
                          <div>
                            <strong>Matematik - Problemler</strong>
                            <small>20 soru · 28 dk</small>
                          </div>
                          <em>Tamam</em>
                        </div>
                        <div className="web-plan-row">
                          <span className="dot" />
                          <div>
                            <strong>Fen - Deneme</strong>
                            <small>1 test · 35 dk</small>
                          </div>
                        </div>
                        <div className="web-plan-row">
                          <span className="dot" />
                          <div>
                            <strong>Türkçe - Paragraf</strong>
                            <small>15 soru · 20 dk</small>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="ui-card">
                      <div className="card-title">AI Hata Defteri Özeti</div>
                      <div className="today-sub">
                        Riskli konu yoğunluğu <strong className="indigo">Matematik %17.8</strong>
                      </div>
                      <div className="today-sub mt8">Öneri: 48 saat içinde Olasılık mini-kampı</div>
                    </div>

                    <div className="ui-card compact-grid">
                      <div className="micro-kpi">
                        <strong>+5</strong>
                        <span>Yeni sınav</span>
                      </div>
                      <div className="micro-kpi">
                        <strong>126</strong>
                        <span>İşlenen hata</span>
                      </div>
                      <div className="micro-kpi">
                        <strong>3</strong>
                        <span>Riskli konu</span>
                      </div>
                      <div className="micro-kpi">
                        <strong>8</strong>
                        <span>Koç müdahalesi</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="phone">
                <div className="phone-screen">
                  <div className="phone-notch" />
                  <div className="phone-hero">
                    <div className="phone-hero-brand">TechCoach</div>
                    <div className="phone-hero-title">Aylin, bugünkü planın hazır.</div>
                    <p>“Başlamak, işin yarısını tamamlamaktır.”</p>
                  </div>

                  <div className="phone-countdown" aria-label="LGS geri sayimi">
                    <div>
                      <strong>14 Haziran&apos;da LGS var</strong>
                      <span>Hazirlik ritmini koru.</span>
                    </div>
                    <b>{lgsCountdown} gun</b>
                  </div>

                  <div className="phone-panel">
                    <div className="phone-panel-head">
                      <h4>Disiplin skoru</h4>
                      <strong>%74</strong>
                    </div>
                    <div className="phone-progress">
                      <span />
                    </div>
                    <div className="phone-panel-meta">48 dk / 120 dk · 5 gün seri</div>
                  </div>

                  <div className="phone-panel">
                    <div className="phone-panel-head">
                      <h4>Bugünkü plan</h4>
                    </div>
                    <div className="phone-plan-item done">
                      <span className="check">✓</span>
                      <div>
                        <div className="name">Matematik - Problemler</div>
                        <div className="meta">20 soru · 28 dk</div>
                      </div>
                      <span className="status">Tamam</span>
                    </div>
                    <div className="phone-plan-item">
                      <span className="check" />
                      <div>
                        <div className="name">Fen - Deneme</div>
                        <div className="meta">1 test · 35 dk</div>
                      </div>
                    </div>
                    <div className="phone-plan-item">
                      <span className="check" />
                      <div>
                        <div className="name">Türkçe - Paragraf</div>
                        <div className="meta">15 soru · 20 dk</div>
                      </div>
                    </div>
                  </div>

                  <div className="phone-panel">
                    <div className="phone-panel-head">
                      <h4>Bugün aktif öğrenciler</h4>
                    </div>
                    <div className="phone-list-item">
                      <span>Nova34</span>
                      <strong>120 soru</strong>
                    </div>
                    <div className="phone-list-item">
                      <span>Delta07</span>
                      <strong>45 dk tekrar</strong>
                    </div>
                    <div className="phone-list-item">
                      <span>Axis12</span>
                      <strong>2 konu tamamladı</strong>
                    </div>
                  </div>

                  <div className="phone-panel">
                    <div className="phone-panel-head">
                      <h4>Teco Arena</h4>
                    </div>
                    <div className="phone-list-item">
                      <span>Matematik de benden iyisi yok</span>
                      <strong>#2</strong>
                    </div>
                    <div className="phone-list-item">
                      <span>Türkçe’de kapışalım</span>
                      <strong>+120 puan</strong>
                    </div>
                    <div className="phone-list-item">
                      <span>Genel deneme ligi</span>
                      <strong>Takım: Paragraf Avcıları</strong>
                    </div>
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
                TechCoach; LGS sürecinde öğrencinin akademik disiplinini sistemleştiren, veliye net
                görünürlük sağlayan ve koçluk kararlarını veriye dayandıran dijital performans
                platformudur.
              </p>
              <div className="about-highlights">
                <span>Disiplin odaklı çalışma sistemi</span>
                <span>Veriye dayalı koçluk kararları</span>
                <span>Öğrenci + Veli + Koç tek akış</span>
              </div>
            </div>

            <div className="steps about-steps">
              <article className="step">
                <div className="step-num">1</div>
                <h3>Amacı</h3>
                <p>
                  Öğrencinin ne çalışacağını, ne kadar ilerlediğini ve nerede zorlandığını görünür
                  hale getirerek sürdürülebilir çalışma disiplini oluşturmak.
                </p>
              </article>

              <article className="step">
                <div className="step-num">2</div>
                <h3>Vizyonu</h3>
                <p>
                  Sınava hazırlık sürecini ezbere ve baskıyla değil; ölçüm, analiz ve kişiselleştirilmiş
                  yönlendirme ile yönetilen bir standarda dönüştürmek.
                </p>
              </article>

              <article className="step">
                <div className="step-num">3</div>
                <h3>Özet Değer</h3>
                <p>
                  Öğrenci uygular, veli takip eder, koç yön verir. TechCoach bu üç rolü tek bir
                  veri diliyle birleştirir.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="section" id="how">
          <div className="container">
            <div className="how-mission how-unified">
              <div className="how-intro">
                <h2>Nasıl Çalışır?</h2>
                <p>
                  Öğrenci verisi her gün küçük adımlarla toplanır; sistem bu veriyi plan, analiz ve
                  yönlendirmeye dönüştürür.
                </p>
              </div>

              <article className="how-rail how-modern-rail">
                <div className="flow-grid">
                  <div className="flow-card">
                    <div className="flow-meta">
                      <span className="flow-step">01</span>
                      <span className="flow-state is-done">Tamamlandı</span>
                    </div>
                    <h3>Kurulum ve Hedefleme</h3>
                    <p>Takvim yüklenir, hedef dersler seçilir, kişisel başlangıç profili çıkarılır.</p>
                  </div>
                  <div className="flow-card">
                    <div className="flow-meta">
                      <span className="flow-step">02</span>
                      <span className="flow-state is-live">Aktif</span>
                    </div>
                    <h3>Günlük Operasyon</h3>
                    <p>Otomatik plan üretilir; öğrenci süre, kaynak ve soru verisini akışta işler.</p>
                  </div>
                  <div className="flow-card">
                    <div className="flow-meta">
                      <span className="flow-step">03</span>
                      <span className="flow-state is-next">Sıradaki</span>
                    </div>
                    <h3>AI Hata Analizi</h3>
                    <p>Yanlışlar konu/hata tipi bazında ayrıştırılır, tekrar seti ve öncelik listesi oluşur.</p>
                  </div>
                  <div className="flow-card">
                    <div className="flow-meta">
                      <span className="flow-step">04</span>
                      <span className="flow-state is-next">Sıradaki</span>
                    </div>
                    <h3>Haftalık Yeniden Planlama</h3>
                    <p>Raporlar öğrenci-veli-koç paneline düşer, sistem bir sonraki haftayı otomatik revize eder.</p>
                  </div>
                </div>
              </article>

              <aside className="how-control how-modern-control">
                <div className="control-head">
                  <div>
                    <p className="control-kicker">Mission Control</p>
                    <h3>Canlı Süreç Durumu</h3>
                  </div>
                  <span className="live-pill">
                    <i className="live-dot" />
                    LIVE
                  </span>
                </div>
                <div className="control-grid">
                  <div className="control-card">
                    <span>Bu Hafta Plan Tamamlama</span>
                    <strong>%82</strong>
                    <p className="kpi-meta">+6 puan / geçen hafta</p>
                  </div>
                  <div className="control-card">
                    <span>AI ile İşlenen Hata</span>
                    <strong>126</strong>
                    <p className="kpi-meta">47 soru görselden analiz edildi</p>
                  </div>
                  <div className="control-card">
                    <span>Riskli Konular</span>
                    <strong>3</strong>
                    <p className="kpi-meta">Olasılık, Cebir, Paragraf</p>
                  </div>
                  <div className="control-card">
                    <span>Önerilen Müdahale</span>
                    <strong>8</strong>
                    <p className="kpi-meta">Koç paneline push edildi</p>
                  </div>
                </div>
                <div className="control-queue">
                  <p className="queue-title">Öncelikli Karar Kuyruğu</p>
                  <div className="queue-item">
                    <span>1</span>
                    Olasılık mini-kampı (48 saat)
                  </div>
                  <div className="queue-item">
                    <span>2</span>
                    Fen deneme telafisi (30 dk)
                  </div>
                  <div className="queue-item">
                    <span>3</span>
                    Türkçe paragraf ritmi (günlük 15 soru)
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </section>

        <section className="section split-section" id="teco">
          <div className="container split-grid">
            <div>
              <p className="split-label"><span className="teco-accent">Teco</span></p>
              <h2 className="section-title split-title"><span className="teco-accent">Teco</span>, öğrencinin dijital asistanı</h2>
              <p className="split-text">
                Teco emir vermez; yön gösterir. "Teco’ya soralım" dediğinde günlük planını oluşturur,
                hata defterinden zayıf başlıkları çıkarır ve gün içinde mini görevlerle ritmi korur.
              </p>
              <ul className="split-list">
                <li><span>✓</span>Teco’da planlama yaptım: gün otomatik başlar</li>
                <li><span>✓</span>Yüklenen sorudan konu ve hata türü tespiti yapar</li>
                <li><span>✓</span>Her ders için kısa tekrar seti ve öncelik önerir</li>
              </ul>
              <a className="btn btn-primary" href="#arena">Teco Arena’yı Keşfet</a>
            </div>
            <div className="split-visual">
              <div className="teco-board">
                <div className="teco-board-head">
                  <strong><span className="teco-accent">Teco</span> / Günlük Akış</strong>
                  <span>Canlı</span>
                </div>
                <div className="teco-board-row">
                  <h4>Bugün</h4>
                  <p>Matematik tekrar · 28 dk</p>
                </div>
                <div className="teco-board-row">
                  <h4>Hata Defteri</h4>
                  <p>2 soru analiz edildi · Olasılık</p>
                </div>
                <div className="teco-board-row">
                  <h4>Öneri</h4>
                  <p>Cebir mini seti · 12 soru</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section split-section" id="arena">
          <div className="container split-grid split-grid-reverse">
            <div className="split-visual">
              <div className="arena-board">
                <div className="arena-head">
                  <strong>Teco Arena</strong>
                  <span>Haftalık Lig</span>
                </div>
                <div className="arena-item">
                  <b>1</b>
                  <p>Matematik de benden iyisi yok</p>
                  <em>1.240 puan</em>
                </div>
                <div className="arena-item">
                  <b>2</b>
                  <p>Türkçe’de kapışalım</p>
                  <em>1.180 puan</em>
                </div>
                <div className="arena-item">
                  <b>3</b>
                  <p>Genel deneme ligi</p>
                  <em>1.040 puan</em>
                </div>
              </div>
            </div>
            <div>
              <p className="split-label"><span className="teco-accent">Teco</span> Arena</p>
              <h2 className="section-title split-title">Arkadaşlarınla güvenli performans yarışı</h2>
              <p className="split-text">
                Öğrenciler takım kurar, birbirini yarışa davet eder ve ders bazlı liglerde kapışır.
                Sosyal medya dağınıklığı yok; sadece görev, puan, rozet ve sıralama var.
              </p>
              <ul className="split-list">
                <li><span>✓</span>Takım kur, arkadaşlarını davet et</li>
                <li><span>✓</span>Türkçe, Matematik veya genel deneme liglerine katıl</li>
                <li><span>✓</span>Haftalık rozetlerle motivasyonu canlı tut</li>
              </ul>
              <a className="btn btn-primary" href="#">Teco Arena’ya Katıl</a>
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
                    <li>Koç paneli erişimi</li>
                    <li>Öncelikli analiz ve yönlendirme</li>
                    <li>Derin performans raporları</li>
                    <li>Gelişmiş koç görünümü</li>
                  </ul>
                  <a className="btn btn-outline" href="#">Paketi Seç</a>
                </article>
              </div>
            </div>
          </section>
        ) : null}

        <section className="section" id="paneller">
          <div className="container">
            <h2 className="section-title">Öğrenci, veli ve koç için kişiye özel paneller</h2>
            <p className="section-subtitle">
              Her kullanıcı yalnızca ihtiyacı olan veriyi görür. Öğrenci uygular, veli izler, koç
              yön verir.
            </p>

            <div className="panels-grid">
              <article className="panel-card">
                <div className="mock-device phone-style" />
                <h3>Öğrenci</h3>
                <p>Günlük plan, streak, ders ajandası, hata defteri ve kaynak kaydı tek mobil akışta.</p>
              </article>

              <article className="panel-card">
                <div className="mock-device laptop-style" />
                <h3>Veli</h3>
                <p>Haftalık rapor, riskli dersler ve plan takibi. Müdahale değil, görünürlük.</p>
              </article>

              <article className="panel-card">
                <div className="mock-device laptop-style" />
                <h3>Koç</h3>
                <p>Öğrencinin hata yoğunluğu, yaklaşan sınavları ve haftalık öncelik alanları tek yerde.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <div className="cta-strip">
              <div>
                <h2>Disiplinli bir akademik sistem kurmak için doğru yerdesin.</h2>
                <p>
                  TechCoach, öğrenciyi yönlendiren, veliyi rahatlatan ve koçu veriyle güçlendiren
                  premium bir akademik performans sistemidir.
                </p>
              </div>
              <a className="btn btn-primary cta-action" href="#">
                <span>Hemen Başla</span>
                <span className="cta-action-icon" aria-hidden="true">→</span>
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer id="sss">
        <div className="container">© 2026 TechCoach · Disiplin. Analiz. Başarı.</div>
      </footer>

      {showLogin && (
        <div className="login-overlay" role="dialog" aria-modal="true" aria-label="Giriş Ekranı">
          <div className="login-card">
            <button
              type="button"
              className="login-close"
              aria-label="Kapat"
              onClick={closeAuthModal}
            >
              ×
            </button>
            <h3>{authMode === 'login' ? 'Giriş Yap' : 'Üye Ol'}</h3>
            <p>
              {authMode === 'login'
                ? 'TechCoach ve Teco deneyimi için hesabına giriş yap.'
                : 'TechCoach deneyimine başlamak için üyelik bilgilerini doldur.'}
            </p>

            <form className="login-form" onSubmit={(event) => event.preventDefault()}>
              {authMode === 'register' && (
                <>
                  <label htmlFor="tc-name">Ad Soyad</label>
                  <input id="tc-name" type="text" placeholder="Adınızı ve soyadınızı girin" />
                </>
              )}

              <label htmlFor="tc-identity">Email Adresi / Telefon</label>
              <input id="tc-identity" type="text" placeholder="ornek@mail.com veya 05xx xxx xx xx" />

              <label htmlFor="tc-password">Şifre</label>
              <input id="tc-password" type="password" placeholder="Şifrenizi girin" />

              {authMode === 'register' && (
                <>
                  <label htmlFor="tc-password-repeat">Şifre Tekrar</label>
                  <input
                    id="tc-password-repeat"
                    type="password"
                    placeholder="Şifrenizi tekrar girin"
                  />
                </>
              )}

              <label className="check-row">
                <input type="checkbox" />
                <span>
                  <button
                    type="button"
                    className="inline-link"
                    onClick={() => setInfoModal('aydinlatma')}
                  >
                    Aydınlatma metni
                  </button>{' '}
                  okudum ve onaylıyorum.
                </span>
              </label>

              <label className="check-row">
                <input type="checkbox" />
                <span>
                  <button
                    type="button"
                    className="inline-link"
                    onClick={() => setInfoModal('kvkk')}
                  >
                    KVKK
                  </button>{' '}
                  kapsamında kişisel verilerimin işlenmesine izin veriyorum.
                </span>
              </label>

              <button type="submit" className="btn btn-primary login-submit">
                {authMode === 'login' ? 'Giriş Yap' : 'Üyeliği Oluştur'}
              </button>
              <button
                type="button"
                className="btn btn-outline login-register"
                onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
              >
                {authMode === 'login' ? 'Üye Olmak İstiyorum' : 'Zaten Üyeyim'}
              </button>
            </form>
          </div>
        </div>
      )}

      {infoModal && (
        <div
          className="login-overlay info-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={infoModalContent[infoModal].title}
        >
          <div className="login-card info-card">
            <button
              type="button"
              className="login-close"
              aria-label="Kapat"
              onClick={() => setInfoModal(null)}
            >
              ×
            </button>
            <h3>{infoModalContent[infoModal].title}</h3>
            <p>{infoModalContent[infoModal].intro}</p>
            <div className="info-content">
              {infoModalContent[infoModal].body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default App
