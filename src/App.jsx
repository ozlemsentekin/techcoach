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

const INITIAL_AUTH_FORM = {
  fullName: '',
  email: '',
  password: '',
  passwordRepeat: '',
  acceptAydinlatma: false,
  acceptKvkk: false,
}

async function authRequest(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.error || 'İşlem tamamlanamadı.')
  }

  return data
}

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
  const [authForm, setAuthForm] = useState(INITIAL_AUTH_FORM)
  const [authUser, setAuthUser] = useState(null)
  const [authError, setAuthError] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [sessionLoading, setSessionLoading] = useState(true)
  const showPricing = false
  const lgsCountdown = getLgsCountdown()

  const openLogin = (event) => {
    event.preventDefault()
    setAuthMode('login')
    setAuthError('')
    setAuthMessage('')
    setShowLogin(true)
  }

  const closeAuthModal = () => {
    setShowLogin(false)
    setAuthMode('login')
    setInfoModal(null)
    setAuthError('')
    setAuthMessage('')
  }

  const switchAuthMode = () => {
    setAuthMode(authMode === 'login' ? 'register' : 'login')
    setAuthError('')
    setAuthMessage('')
    setAuthForm(INITIAL_AUTH_FORM)
  }

  const handleAuthInputChange = (event) => {
    const { name, type, value, checked } = event.target
    setAuthForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleLogout = async () => {
    setAuthLoading(true)
    setAuthError('')
    setAuthMessage('')

    try {
      await authRequest('/api/auth/logout', {
        method: 'POST',
        body: JSON.stringify({}),
      })
      setAuthUser(null)
      setAuthForm(INITIAL_AUTH_FORM)
      setAuthMessage('Oturum kapatıldı.')
    } catch (error) {
      setAuthError(error.message)
    } finally {
      setAuthLoading(false)
    }
  }

  const handleAuthSubmit = async (event) => {
    event.preventDefault()
    setAuthLoading(true)
    setAuthError('')
    setAuthMessage('')

    const payload =
      authMode === 'register'
        ? authForm
        : { email: authForm.email, password: authForm.password }

    try {
      const data = await authRequest(
        authMode === 'login' ? '/api/auth/login' : '/api/auth/register',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
      )

      setAuthUser(data.user)
      setAuthForm(INITIAL_AUTH_FORM)
      setAuthMessage(
        authMode === 'login'
          ? 'Giriş başarılı. Oturumunuz güvenli çerez ile açıldı.'
          : 'Üyelik oluşturuldu ve giriş yapıldı.',
      )
      setShowLogin(false)
    } catch (error) {
      setAuthError(error.message)
    } finally {
      setAuthLoading(false)
    }
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

  useEffect(() => {
    let ignore = false

    const loadSession = async () => {
      try {
        const data = await authRequest('/api/auth/me', { method: 'GET' })
        if (!ignore) {
          setAuthUser(data.user)
        }
      } catch {
        if (!ignore) {
          setAuthUser(null)
        }
      } finally {
        if (!ignore) {
          setSessionLoading(false)
        }
      }
    }

    loadSession()

    return () => {
      ignore = true
    }
  }, [])

  const primaryCtaLabel = sessionLoading
    ? 'Oturum Kontrol Ediliyor'
    : authUser
      ? `${authUser.fullName.split(' ')[0]}`
      : 'Çalışmaya Başla'

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
          {authUser && !sessionLoading ? (
            <div className="auth-chip" aria-live="polite">
              <strong>{authUser.fullName}</strong>
              <span>{authUser.email}</span>
            </div>
          ) : null}
          <a className="btn btn-primary nav-cta" href="#" onClick={openLogin}>
            <span className="cta-full">{primaryCtaLabel}</span>
            <span className="cta-short">{authUser ? 'Hesap' : 'Başla'}</span>
          </a>
        </div>
      </header>

      <main>
        <section className="section hero" id="hero">
          <div className="container hero-grid">
            <div className="hero-copy">
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
                <div className="hero-mobile-summary">
                  <div className="hero-mobile-banner">
                    <span>TechCoach</span>
                    <strong>Aylin, bugünkü planın hazır.</strong>
                  </div>
                  <div className="hero-mobile-summary-top">
                    <span>Bugünün ritmi</span>
                    <b>Canlı</b>
                  </div>
                  <div className="hero-mobile-score">
                    <div className="hero-mobile-score-line">
                      <strong>%82</strong>
                      <span>Tamamlandı</span>
                    </div>
                    <p>Başlamak işin yarısını tamamlamaktır.</p>
                  </div>
                  <div className="hero-mobile-progress" aria-hidden="true">
                    <span />
                  </div>
                  <div className="hero-mobile-countdown">
                    <div>
                      <strong>14 Haziran&apos;da LGS var</strong>
                      <span>Hazırlık ritmini koru.</span>
                    </div>
                    <b>{lgsCountdown} gün</b>
                  </div>
                  <div className="hero-mobile-stats">
                      <div className="hero-mobile-suggestion">
                        <div className="hero-mobile-assistant-shell">
                        <div className="hero-mobile-assistant-avatar" aria-hidden="true">
                          <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
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
                        </div>
                        <div className="hero-mobile-assistant-copy">
                          <strong><span className="teco-accent">Teco</span>&apos; dan mesajın var!</strong>
                        </div>
                      </div>
                      <div className="hero-mobile-guidance-card">
                        <div className="hero-mobile-guidance-path" aria-hidden="true">
                          <span />
                          <span />
                          <span />
                        </div>
                        <div className="hero-mobile-guidance-body">
                          <small>Matematik sınavına 3 gün kaldı</small>
                          <strong>Önce olasılık tekrarını tamamla.</strong>
                          <p>25 dakikalık kısa tekrar ve 8 soruluk mini turla ritmi başlat.</p>
                        </div>
                      </div>
                      <div className="hero-mobile-guidance-tags" aria-hidden="true">
                        <span>Öncelik: Olasılık</span>
                        <span>Bugün · 25 dk</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="hero-mobile-points">
                  <div className="hero-mobile-point">
                    <b>Plan</b>
                    <span>Teco günlük çalışma akışını otomatik kurar.</span>
                  </div>
                  <div className="hero-mobile-point">
                    <b>Takip</b>
                    <span>Veli ve koç aynı veriyi tek ekranda görür.</span>
                  </div>
                </div>
              </div>
              <div className="hero-journey" aria-label="Teco akışı">
                <div className="hero-journey-intro">
                  <span className="hero-journey-kicker">Tek akış</span>
                  <strong>
                    Takvim gelir, plan oluşur, <span className="teco-accent">Teco</span> süreci
                    yürütür.
                  </strong>
                  <p>
                    Öğrenci, veli ve varsa öğrenci koçunuz aynı akışın içinde kalır. Ayrı modüller
                    değil, tek yönlü ilerleyen bir sistem.
                  </p>
                </div>
                <ol className="hero-journey-list">
                  <li className="hero-journey-item">
                    <b>1</b>
                    <div>
                      <span><span className="teco-accent">Teco</span>’ya sor</span>
                      <p>Sınav takvimini içeri al, çalışma planı otomatik çıksın.</p>
                    </div>
                  </li>
                  <li className="hero-journey-item">
                    <b>2</b>
                    <div>
                      <span><span className="teco-accent">Teco</span> planı yürütür</span>
                      <p>Günlük görevleri hatırlatır, hata analizi yapar, öğrenciyi yönlendirir.</p>
                    </div>
                  </li>
                  <li className="hero-journey-item">
                    <b>3</b>
                    <div>
                      <span>Herkes aynı veriyi görür</span>
                      <p>Öğrenci uygular, veli takip eder, koç veriye göre müdahale eder.</p>
                    </div>
                  </li>
                </ol>
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
                görünürlük sağlayan ve varsa öğrenci koçunuzun kararlarını veriye dayandıran
                dijital performans platformudur.
              </p>
              <div className="about-highlights">
                <span>Disiplin odaklı çalışma sistemi</span>
                <span>Veriye dayalı öğrenci koçu kararları</span>
                <span>Öğrenci + Veli + Öğrenci Koçu tek akış</span>
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
                    <div className="flow-heading">
                      <span className="flow-step">01</span>
                      <h3>Kurulum ve Hedefleme</h3>
                    </div>
                    <p>Takvim yüklenir, hedef dersler seçilir, kişisel başlangıç profili çıkarılır.</p>
                  </div>
                  <div className="flow-card">
                    <div className="flow-heading">
                      <span className="flow-step">02</span>
                      <h3>Günlük Operasyon</h3>
                    </div>
                    <p>Otomatik plan üretilir; öğrenci süre, kaynak ve soru verisini akışta işler.</p>
                  </div>
                  <div className="flow-card">
                    <div className="flow-heading">
                      <span className="flow-step">03</span>
                      <h3>AI Hata Analizi</h3>
                    </div>
                    <p>Yanlışlar konu/hata tipi bazında ayrıştırılır, tekrar seti ve öncelik listesi oluşur.</p>
                  </div>
                  <div className="flow-card">
                    <div className="flow-heading">
                      <span className="flow-step">04</span>
                      <h3>Haftalık Yeniden Planlama</h3>
                    </div>
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
          <div className="container">
            <div className="split-shell">
              <div className="split-grid">
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
            </div>
          </div>
        </section>

        <section className="section split-section" id="arena">
          <div className="container">
            <div className="split-shell">
              <div className="split-grid split-grid-reverse">
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
                  <h2 className="section-title split-title"><span className="teco-accent">Teco</span> Arena&apos; da arkadaşlarınla güvenli performans yarışı</h2>
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
                    <h3>Koç</h3>
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
                <h2>Disiplinli bir akademik sistem kurmak için doğru yerdesin.</h2>
                <p>
                  TechCoach, öğrenciyi yönlendiren, veliyi rahatlatan ve koçu veriyle güçlendiren
                  premium bir akademik performans sistemidir.
                </p>
              </div>
              <a className="btn btn-primary cta-action" href="#" onClick={openLogin}>
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
            {authMessage ? <div className="auth-feedback auth-feedback-success">{authMessage}</div> : null}
            {authError ? <div className="auth-feedback auth-feedback-error">{authError}</div> : null}

            {authUser && authMode === 'login' ? (
              <div className="account-panel">
                <div className="account-panel-row">
                  <span>Aktif kullanıcı</span>
                  <strong>{authUser.fullName}</strong>
                </div>
                <div className="account-panel-row">
                  <span>E-posta</span>
                  <strong>{authUser.email}</strong>
                </div>
                <div className="account-panel-row">
                  <span>Son giriş</span>
                  <strong>{authUser.lastLoginAt ? 'Kaydedildi' : 'Yeni hesap'}</strong>
                </div>
                <button
                  type="button"
                  className="btn btn-outline login-register"
                  onClick={handleLogout}
                  disabled={authLoading}
                >
                  {authLoading ? 'Çıkış Yapılıyor...' : 'Oturumu Kapat'}
                </button>
              </div>
            ) : (
              <form className="login-form" onSubmit={handleAuthSubmit}>
                {authMode === 'register' && (
                  <>
                    <label htmlFor="tc-name">Ad Soyad</label>
                    <input
                      id="tc-name"
                      name="fullName"
                      type="text"
                      placeholder="Adınızı ve soyadınızı girin"
                      autoComplete="name"
                      value={authForm.fullName}
                      onChange={handleAuthInputChange}
                    />
                  </>
                )}

                <label htmlFor="tc-email">Email Adresi</label>
                <input
                  id="tc-email"
                  name="email"
                  type="email"
                  placeholder="ornek@mail.com"
                  autoComplete="email"
                  value={authForm.email}
                  onChange={handleAuthInputChange}
                />

                <label htmlFor="tc-password">Şifre</label>
                <input
                  id="tc-password"
                  name="password"
                  type="password"
                  placeholder="Şifrenizi girin"
                  autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                  value={authForm.password}
                  onChange={handleAuthInputChange}
                />

                {authMode === 'register' && (
                  <>
                    <label htmlFor="tc-password-repeat">Şifre Tekrar</label>
                    <input
                      id="tc-password-repeat"
                      name="passwordRepeat"
                      type="password"
                      placeholder="Şifrenizi tekrar girin"
                      autoComplete="new-password"
                      value={authForm.passwordRepeat}
                      onChange={handleAuthInputChange}
                    />
                    <div className="auth-hint">
                      Şifre en az 12 karakter olmalı; büyük harf, küçük harf, rakam ve özel
                      karakter içermelidir.
                    </div>
                  </>
                )}

                {authMode === 'register' && (
                  <>
                    <label className="check-row">
                      <input
                        name="acceptAydinlatma"
                        type="checkbox"
                        checked={authForm.acceptAydinlatma}
                        onChange={handleAuthInputChange}
                      />
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
                      <input
                        name="acceptKvkk"
                        type="checkbox"
                        checked={authForm.acceptKvkk}
                        onChange={handleAuthInputChange}
                      />
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
                  </>
                )}

                <button type="submit" className="btn btn-primary login-submit" disabled={authLoading}>
                  {authLoading
                    ? authMode === 'login'
                      ? 'Giriş Yapılıyor...'
                      : 'Üyelik Oluşturuluyor...'
                    : authMode === 'login'
                      ? 'Giriş Yap'
                      : 'Üyeliği Oluştur'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline login-register"
                  onClick={switchAuthMode}
                  disabled={authLoading}
                >
                  {authMode === 'login' ? 'Üye Olmak İstiyorum' : 'Zaten Üyeyim'}
                </button>
              </form>
            )}
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
