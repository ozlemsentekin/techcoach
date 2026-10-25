import { useState } from 'react'
import { CheckCircle2, X } from 'lucide-react'
import Button from '../ui/Button'
import { cn } from '../ui/utils'
import { createMistakeBookletTest } from '../../services/wrongQuestionService'
import MistakeBookletQuestionsModal from './MistakeBookletQuestionsModal'

const OPTIONS = ['A', 'B', 'C', 'D']

function questionCaption(item) {
  const number = item.questionNumber != null && item.questionNumber !== '' ? item.questionNumber : '-'
  return `${item.bookName ? `${item.bookName} · ` : ''}${item.testName || 'Test'} - Soru ${number}`
}

/**
 * Hata Defteri'nde seçilen sorulardan Hata Kitapçığı testi oluşturur (yalnız admin). Doğru cevap
 * kaynak testin cevap anahtarından gelir; deneme/serbest kayıtlarda anahtar olmadığı için seçilmeli.
 */
export default function MistakeBookletTestModal({ studentId, subject, items, onClose, onCreated }) {
  const [testName, setTestName] = useState('')
  const [labels, setLabels] = useState(() =>
    Object.fromEntries(items.map((item) => [item.id, item.correctAnswer && OPTIONS.includes(item.correctAnswer) ? item.correctAnswer : ''])),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [createdTest, setCreatedTest] = useState(null)
  const [showQuestions, setShowQuestions] = useState(false)

  const missingCount = items.filter((item) => !labels[item.id]).length

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!testName.trim()) {
      setError('Test adı girilmeli.')
      return
    }
    if (missingCount) {
      setError(`${missingCount} sorunun doğru cevabı seçilmedi.`)
      return
    }
    setSaving(true)
    setError('')
    try {
      const test = await createMistakeBookletTest({
        studentId,
        testName: testName.trim(),
        questions: items.map((item) => ({ wrongQuestionId: item.id, correctLabel: labels[item.id] })),
      })
      setCreatedTest(test)
      onCreated?.(test)
    } catch (err) {
      setError(err.message || 'Test oluşturulamadı.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Teste Dönüştür">
      <div className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl border border-panel-border bg-panel-surface shadow-lg sm:max-w-lg sm:rounded-2xl">
        <div className="flex items-center justify-between gap-2 border-b border-panel-border px-5 py-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-panel-text">Teste Dönüştür</h2>
            <p className="text-xs text-panel-text-muted">
              {subject} · {items.length} soru → Kitaplık › Hata Kitapçığı
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Kapat" className="rounded-lg p-1.5 text-panel-text-muted hover:bg-panel-surface-soft">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {createdTest ? (
          <div className="flex flex-col items-center gap-3 px-5 py-8 text-center">
            <CheckCircle2 size={40} className="text-panel-sage" aria-hidden="true" />
            <p className="text-base font-semibold text-panel-text">"{createdTest.name}" oluşturuldu</p>
            <p className="text-sm text-panel-text-muted">
              {createdTest.questionCount} soru ve cevap anahtarıyla {createdTest.subject} › Hata Kitapçığı altına eklendi.
              Görev Ekle ekranından bu testi atayabilirsin.
            </p>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              <Button type="button" variant="secondary" onClick={() => setShowQuestions(true)}>
                Kitapçığı Görüntüle / Yazdır
              </Button>
              <Button type="button" onClick={onClose}>
                Tamam
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-panel-text">Test adı</span>
                <input
                  type="text"
                  value={testName}
                  onChange={(event) => setTestName(event.target.value)}
                  maxLength={200}
                  autoFocus
                  placeholder="ör. Çarpanlar Hata Testi 1"
                  className="h-11 rounded-xl border border-panel-border bg-panel-surface px-3 text-base text-panel-text focus:border-panel-blue focus:outline-none"
                />
              </label>

              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-panel-text">Sorular ve cevap anahtarı</span>
                <ol className="flex flex-col divide-y divide-panel-border rounded-xl border border-panel-border">
                  {items.map((item, index) => (
                    <li key={item.id} className="flex items-center justify-between gap-2 px-3 py-2">
                      <span className="min-w-0 text-xs text-panel-text">
                        <span className="font-semibold">{index + 1}.</span>{' '}
                        <span className="text-panel-text-muted">{questionCaption(item)}</span>
                      </span>
                      <span className="flex shrink-0 gap-1" role="radiogroup" aria-label={`${index + 1}. soru doğru cevap`}>
                        {OPTIONS.map((option) => (
                          <button
                            key={option}
                            type="button"
                            role="radio"
                            aria-checked={labels[item.id] === option}
                            onClick={() => setLabels((prev) => ({ ...prev, [item.id]: option }))}
                            className={cn(
                              'h-7 w-7 rounded-full border text-xs font-semibold',
                              labels[item.id] === option
                                ? 'border-panel-sage bg-panel-sage text-white'
                                : 'border-panel-border text-panel-text-muted hover:border-panel-sage',
                            )}
                          >
                            {option}
                          </button>
                        ))}
                      </span>
                    </li>
                  ))}
                </ol>
                {missingCount ? (
                  <p className="text-xs text-amber-700">
                    {missingCount} sorunun cevap anahtarı kaynakta yok (ör. deneme sınavı) — doğru şıkkı seç.
                  </p>
                ) : null}
              </div>
              {error ? <p className="rounded-xl bg-panel-accent-soft px-3 py-2 text-sm text-panel-warm">{error}</p> : null}
            </div>
            <div className="flex gap-2 border-t border-panel-border px-5 py-3">
              <Button type="button" variant="secondary" className="flex-1" onClick={onClose} disabled={saving}>
                Vazgeç
              </Button>
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving ? 'Oluşturuluyor...' : 'Testi Oluştur'}
              </Button>
            </div>
          </form>
        )}
      </div>
      {showQuestions && createdTest ? (
        <MistakeBookletQuestionsModal testId={createdTest.id} studentId={studentId} onClose={() => setShowQuestions(false)} />
      ) : null}
    </div>
  )
}
