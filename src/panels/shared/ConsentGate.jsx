import { useState } from 'react'
import { useAuth } from '../../context/useAuth'
import { LEGAL_CONTENT } from '../../marketing/legalContent'
import '../../marketing/LandingPage.css'

export default function ConsentGate() {
  const { acceptConsent, logout } = useAuth()
  const [acceptAydinlatma, setAcceptAydinlatma] = useState(false)
  const [acceptKvkk, setAcceptKvkk] = useState(false)
  const [infoModal, setInfoModal] = useState(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const canSubmit = acceptAydinlatma && acceptKvkk && !submitting

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!canSubmit) return

    setSubmitting(true)
    setError('')
    try {
      await acceptConsent()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <main className="login-main">
        <div className="login-card">
          <h2>Devam etmeden önce</h2>
          <p>Panele erişebilmek için aydınlatma metnini ve KVKK onayını kabul etmeniz gerekiyor.</p>

          <form onSubmit={handleSubmit} className="login-form">
            <label className="check-row">
              <input
                type="checkbox"
                checked={acceptAydinlatma}
                onChange={(event) => setAcceptAydinlatma(event.target.checked)}
              />
              <span>
                <button type="button" className="inline-link" onClick={() => setInfoModal('aydinlatma')}>
                  Aydınlatma metni
                </button>{' '}
                okudum ve onaylıyorum.
              </span>
            </label>

            <label className="check-row">
              <input
                type="checkbox"
                checked={acceptKvkk}
                onChange={(event) => setAcceptKvkk(event.target.checked)}
              />
              <span>
                <button type="button" className="inline-link" onClick={() => setInfoModal('kvkk')}>
                  KVKK
                </button>{' '}
                kapsamında kişisel verilerimin işlenmesine izin veriyorum.
              </span>
            </label>

            {error ? <div className="auth-error">{error}</div> : null}

            <button type="submit" className="btn btn-primary login-submit" disabled={!canSubmit}>
              {submitting ? 'Onaylanıyor...' : 'Onayla ve Devam Et'}
            </button>
            <button type="button" className="btn btn-outline login-register" onClick={logout}>
              Çıkış Yap
            </button>
          </form>
        </div>
      </main>

      {infoModal && (
        <div
          className="login-overlay info-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={LEGAL_CONTENT[infoModal].title}
        >
          <div className="login-card info-card">
            <button type="button" className="login-close" aria-label="Kapat" onClick={() => setInfoModal(null)}>
              ×
            </button>
            <h3>{LEGAL_CONTENT[infoModal].title}</h3>
            <p>{LEGAL_CONTENT[infoModal].intro}</p>
            <div className="info-content">
              {LEGAL_CONTENT[infoModal].body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
