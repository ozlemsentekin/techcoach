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
          {content.sections ? (
            <div className="login-card info-card legal-page-card about-page-card">
              <p className="about-page-eyebrow">{content.title}</p>
              <h1 className="about-page-hero">{content.hero}</h1>
              {content.sections.map((section) => (
                <section className="about-section" key={section.heading}>
                  <h3>{section.heading}</h3>
                  {section.blocks.map((block, blockIndex) => {
                    if (block.type === 'list') {
                      return (
                        <ul className="about-list" key={blockIndex}>
                          {block.items.map((item) => <li key={item}>{item}</li>)}
                        </ul>
                      )
                    }
                    if (block.type === 'quote') {
                      return <p className="about-quote" key={blockIndex}>{block.text}</p>
                    }
                    return <p key={blockIndex}>{block.text}</p>
                  })}
                </section>
              ))}
              <div className="about-closing">
                <strong>{content.closing.brand}</strong>
                <ul>
                  {content.closing.lines.map((line) => <li key={line}>{line}</li>)}
                </ul>
                <p>{content.closing.note}</p>
              </div>
              <div className="about-corporate">
                <h4>{content.corporate.heading}</h4>
                {content.corporate.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </div>
          ) : (
            <div className="login-card info-card legal-page-card">
              <h3>{content.title}</h3>
              <p>{content.intro}</p>
              <div className="info-content">
                {content.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </div>
          )}
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
