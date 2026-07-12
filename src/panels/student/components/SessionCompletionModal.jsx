import { useState } from 'react'
import { X } from 'lucide-react'
import { DIFFICULTY_OPTIONS, EMOTION_OPTIONS } from '../../../data/taskTypes'
import { calculateNet } from '../../../utils/netCalculator'

function buildResultMessage({ task, completedQuestionCount, status }) {
  if (task.targetQuestionCount && completedQuestionCount < task.targetQuestionCount) {
    const remaining = task.targetQuestionCount - completedQuestionCount
    return `${task.targetQuestionCount} sorudan ${completedQuestionCount}'ini tamamladın. Kalan ${remaining} soruyu yeniden planlayabiliriz.`
  }
  if (status === 'kismen-tamamlandi') {
    return 'Bugün yapabildiğin bölümü tamamladın. Kalan kısmı uygun bir güne birlikte yerleştirebiliriz.'
  }
  return task.completionMessage || 'Emeğini görüyoruz. Yanlışların da sana neyi tekrar etmen gerektiğini gösterir.'
}

export default function SessionCompletionModal({ task, initialCompletedQuestionCount = 0, onSave, onClose }) {
  const hasQuestionTarget = Boolean(task.targetQuestionCount)
  const [completedQuestionCount, setCompletedQuestionCount] = useState(initialCompletedQuestionCount)
  const [correctCount, setCorrectCount] = useState(0)
  const [wrongCount, setWrongCount] = useState(0)
  const [blankCount, setBlankCount] = useState(0)
  const [difficulty, setDifficulty] = useState('')
  const [emotion, setEmotion] = useState('')
  const [note, setNote] = useState('')
  const [validationError, setValidationError] = useState('')
  const [result, setResult] = useState(null)

  const handleSubmit = (status) => {
    if (hasQuestionTarget && correctCount + wrongCount + blankCount > completedQuestionCount) {
      setValidationError('Doğru, yanlış ve boş toplamı çözdüğün soru sayısını aşamaz.')
      return
    }
    setValidationError('')

    const payload = {
      completedQuestionCount,
      correctCount: hasQuestionTarget ? correctCount : undefined,
      wrongCount: hasQuestionTarget ? wrongCount : undefined,
      blankCount: hasQuestionTarget ? blankCount : undefined,
      net: hasQuestionTarget ? calculateNet(correctCount, wrongCount) : undefined,
      difficulty,
      emotion,
      note,
      status,
    }

    onSave(payload)
    setResult(buildResultMessage({ task, completedQuestionCount, status }))
  }

  if (result) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
        <div className="w-full max-w-md rounded-2xl border border-panel-border bg-panel-surface p-6 text-center">
          <p className="text-base text-panel-text">{result}</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-5 w-full rounded-xl bg-panel-blue px-4 py-3 text-base font-semibold text-white"
          >
            Kapat
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-panel-border bg-panel-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-panel-text">Çalışma Değerlendirmesi</h2>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">
              Kaç soru çözdün?{hasQuestionTarget ? ` (Hedef: ${task.targetQuestionCount})` : ''}
            </span>
            <input
              type="number"
              min="0"
              value={completedQuestionCount}
              onChange={(event) => setCompletedQuestionCount(Math.max(0, Number(event.target.value)))}
              className="rounded-xl border border-panel-border p-3 text-base text-panel-text"
            />
          </label>

          {hasQuestionTarget ? (
            <div className="grid grid-cols-3 gap-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-panel-text-muted">Doğru</span>
                <input
                  type="number"
                  min="0"
                  value={correctCount}
                  onChange={(event) => setCorrectCount(Math.max(0, Number(event.target.value)))}
                  className="rounded-xl border border-panel-border p-3 text-base text-panel-text"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-panel-text-muted">Yanlış</span>
                <input
                  type="number"
                  min="0"
                  value={wrongCount}
                  onChange={(event) => setWrongCount(Math.max(0, Number(event.target.value)))}
                  className="rounded-xl border border-panel-border p-3 text-base text-panel-text"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-panel-text-muted">Boş</span>
                <input
                  type="number"
                  min="0"
                  value={blankCount}
                  onChange={(event) => setBlankCount(Math.max(0, Number(event.target.value)))}
                  className="rounded-xl border border-panel-border p-3 text-base text-panel-text"
                />
              </label>
            </div>
          ) : null}

          {validationError ? <p className="text-sm text-panel-warm">{validationError}</p> : null}

          <div>
            <p className="mb-2 text-sm font-medium text-panel-text-muted">Bu çalışma sana nasıl geldi?</p>
            <div className="flex flex-wrap gap-2">
              {DIFFICULTY_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setDifficulty(option)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                    difficulty === option
                      ? 'border-panel-blue bg-panel-blue-soft text-panel-blue'
                      : 'border-panel-border text-panel-text'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-panel-text-muted">Çalışırken nasıl hissettin?</p>
            <div className="flex flex-wrap gap-2">
              {EMOTION_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setEmotion(option)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                    emotion === option
                      ? 'border-panel-blue bg-panel-blue-soft text-panel-blue'
                      : 'border-panel-border text-panel-text'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">Koçuma not bırak (isteğe bağlı)</span>
            <textarea
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="rounded-xl border border-panel-border p-3 text-base text-panel-text"
            />
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleSubmit('tamamlandi')}
              className="flex-1 rounded-xl bg-panel-blue px-4 py-3 text-base font-semibold text-white"
            >
              Tamamladım
            </button>
            <button
              type="button"
              onClick={() => handleSubmit('kismen-tamamlandi')}
              className="flex-1 rounded-xl border border-panel-border px-4 py-3 text-base font-medium text-panel-text"
            >
              Kısmen Tamamladım
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
