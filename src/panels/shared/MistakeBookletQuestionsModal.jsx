import { useEffect, useState } from 'react'
import { ImageOff, Printer, X } from 'lucide-react'
import Button from '../ui/Button'
import LoadingState from './LoadingState'
import { getMistakeBookletQuestions } from '../../services/wrongQuestionService'

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
}

// Kitapçığı kağıda basmak için ayrı bir pencerede sade bir sayfa açar (panel stilleri yazdırmayı
// bozmasın diye). Görsellerdeki numara orijinal kitabın numarası olduğu için her sorunun üstüne
// kitapçıktaki sırası ("Soru 3") yazılır — optik bu sırayla doldurulur.
function printBooklet(testName, questions) {
  const win = window.open('', '_blank')
  if (!win) return false
  const blocks = questions
    .map(
      (question) => `
        <section>
          <h2>Soru ${question.orderNo}</h2>
          ${question.photoUrl ? `<img src="${question.photoUrl}" alt="Soru ${question.orderNo}" />` : '<p>Görsel bulunamadı</p>'}
        </section>`,
    )
    .join('')
  win.document.write(`<!doctype html><html lang="tr"><head><meta charset="utf-8" />
    <title>${escapeHtml(testName)}</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 16px; color: #111; }
      h1 { font-size: 18px; margin: 0 0 12px; }
      section { break-inside: avoid; page-break-inside: avoid; margin-bottom: 18px; }
      h2 { font-size: 14px; margin: 0 0 6px; }
      img { max-width: 100%; max-height: 120mm; border: 1px solid #ddd; border-radius: 6px; }
    </style></head><body><h1>${escapeHtml(testName)}</h1>${blocks}
    <script>window.onload = function () { window.print(); }</script></body></html>`)
  win.document.close()
  return true
}

/** Hata Kitapçığı testinin soru görselleri — öğrenci test çözerken / admin yazdırırken açar. */
export default function MistakeBookletQuestionsModal({ testId, studentId, onClose }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false
    getMistakeBookletQuestions(testId, studentId)
      .then((result) => {
        if (!ignore) setData(result)
      })
      .catch((err) => {
        if (!ignore) setError(err.message || 'Sorular yüklenemedi.')
      })
    return () => {
      ignore = true
    }
  }, [testId, studentId])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Kitapçık soruları">
      <div className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl border border-panel-border bg-panel-surface shadow-lg sm:max-w-3xl sm:rounded-2xl">
        <div className="flex items-center justify-between gap-2 border-b border-panel-border px-4 py-3">
          <h2 className="min-w-0 truncate text-base font-semibold text-panel-text">{data?.testName || 'Kitapçık Soruları'}</h2>
          <div className="flex shrink-0 items-center gap-2">
            {data?.questions?.length ? (
              <Button type="button" variant="secondary" size="sm" onClick={() => printBooklet(data.testName, data.questions)}>
                <Printer size={15} aria-hidden="true" />
                Yazdır
              </Button>
            ) : null}
            <button type="button" onClick={onClose} aria-label="Kapat" className="rounded-lg p-1.5 text-panel-text-muted hover:bg-panel-surface-soft">
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {error ? (
            <p className="rounded-xl bg-panel-accent-soft px-4 py-3 text-sm text-panel-warm">{error}</p>
          ) : !data ? (
            <LoadingState label="Sorular yükleniyor..." />
          ) : (
            <div className="flex flex-col gap-5">
              {data.questions.map((question) => (
                <section key={question.orderNo} className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold text-panel-text">Soru {question.orderNo}</h3>
                  {question.photoUrl ? (
                    <img src={question.photoUrl} alt={`Soru ${question.orderNo}`} className="w-full rounded-xl border border-panel-border" />
                  ) : (
                    <div className="flex items-center gap-2 rounded-xl border border-dashed border-panel-border px-4 py-6 text-sm text-panel-text-muted">
                      <ImageOff size={16} aria-hidden="true" /> Görsel bulunamadı
                    </div>
                  )}
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
