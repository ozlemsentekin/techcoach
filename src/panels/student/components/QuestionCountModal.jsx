import { useState } from 'react'
import { X } from 'lucide-react'

function buildResultMessage({ task, completedQuestionCount, status }) {
  if (task.targetQuestionCount && completedQuestionCount < task.targetQuestionCount) {
    const remaining = task.targetQuestionCount - completedQuestionCount
    return `${task.targetQuestionCount} sorudan ${completedQuestionCount}'ini çözdün. Kalan ${remaining} soruyu yeniden planlayabiliriz.`
  }
  if (status === 'kismen-tamamlandi') {
    return 'Bugün çözebildiğin kadarını tamamladın. Kalan kısmı uygun bir güne birlikte yerleştirebiliriz.'
  }
  return 'Emeğini görüyoruz. Çözmeye devam ettikçe hedefe yaklaşıyorsun.'
}

export default function QuestionCountModal({ task, onSave, onClose }) {
  const [completedQuestionCount, setCompletedQuestionCount] = useState(0)
  const [result, setResult] = useState(null)

  const max = task.targetQuestionCount || undefined

  const handleChange = (event) => {
    const value = Number(event.target.value)
    const clamped = max ? Math.min(max, Math.max(0, value)) : Math.max(0, value)
    setCompletedQuestionCount(clamped)
  }

  const handleSubmit = (status) => {
    onSave({ completedQuestionCount, status })
    setResult(buildResultMessage({ task, completedQuestionCount, status }))
  }

  if (result) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
        <div className="w-full max-w-md panel-card p-6 text-center">
          <p className="text-base text-panel-text">{result}</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-5 w-full rounded-xl bg-student-theme-primary px-4 py-3 text-base font-semibold text-student-theme-button-text hover:bg-student-theme-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-student-theme-primary"
          >
            Kapat
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto panel-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-panel-text">Soru İlerlemesi</h2>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">
              Kaç soru çözdün?{max ? ` (Toplam: ${max})` : ''}
            </span>
            <input
              type="number"
              min="0"
              max={max}
              value={completedQuestionCount}
              onChange={handleChange}
              className="rounded-xl border border-panel-border p-3 text-base text-panel-text"
            />
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleSubmit('tamamlandi')}
              className="flex-1 rounded-xl bg-student-theme-primary px-4 py-3 text-base font-semibold text-student-theme-button-text hover:bg-student-theme-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-student-theme-primary"
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
