import { Link, Navigate, useParams } from 'react-router-dom'
import { LEGAL_CONTENT } from './legalContent'
import './LandingPage.css'

function BrandIcon() {
  return <img src="/logo-mark.png" alt="" className="logo-mark-img" />
}

export default function LegalPage({ slug: slugProp }) {
  const params = useParams()
  const slug = slugProp || params.slug
  const content = LEGAL_CONTENT[slug]

  if (!content) {
    return <Navigate to="/" replace />
  }

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
          <div className="login-card info-card legal-page-card">
            <h3>{content.title}</h3>
            <p>{content.intro}</p>
            <div className="info-content">
              {content.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </div>
        </div>
      </main>

      <footer>
        <div className="container footer-inner">
          <div className="footer-contact">
            <a href="mailto:admin@techcoach.com.tr">admin@techcoach.com.tr</a>
          </div>
          <div className="footer-copyright">© 2026 TechCoach · Disiplin. Analiz. Başarı.</div>
        </div>
      </footer>
    </div>
  )
}
