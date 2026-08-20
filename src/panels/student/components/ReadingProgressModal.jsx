import { useState } from 'react'
import { X } from 'lucide-react'

function buildResultMessage({ task, completedPageCount, status }) {
  if (task.targetPageCount && completedPageCount < task.targetPageCount) {
    const remaining = task.targetPageCount - completedPageCount
    return `${task.targetPageCount} sayfadan ${completedPageCount}'ini okudun. Kalan ${remaining} sayfayı yeniden planlayabiliriz.`
  }
  if (status === 'kismen-tamamlandi') {
    return 'Bugün okuyabildiğin bölümü tamamladın. Kalan kısmı uygun bir güne birlikte yerleştirebiliriz.'
  }
  return 'Emeğini görüyoruz. Okumaya devam ettikçe kitabı bitirmeye yaklaşıyorsun.'
}

export default function ReadingProgressModal({ task, onSave, onClose }) {
  const [completedPageCount, setCompletedPageCount] = useState(0)
  const [currentPageNumber, setCurrentPageNumber] = useState(task.currentPageNumber || '')
  const [result, setResult] = useState(null)

  const handleSubmit = (status) => {
    onSave({
      completedPageCount,
      currentPageNumber: currentPageNumber === '' ? undefined : Number(currentPageNumber),
      status,
    })
    setResult(buildResultMessage({ task, completedPageCount, status }))
  }

  if (result) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4">
        <div className="w-full max-w-md rounded-t-3xl border border-panel-border bg-panel-surface p-5 text-center shadow-panel-1 sm:rounded-2xl sm:p-6">
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-panel-border bg-panel-surface p-5 shadow-panel-1 sm:rounded-2xl sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-panel-text">Okuma İlerlemesi</h2>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">
              Kaç sayfa okudun?{task.targetPageCount ? ` (Hedef: ${task.targetPageCount})` : ''}
            </span>
            <input
              type="number"
              min="0"
              value={completedPageCount}
              onChange={(event) => setCompletedPageCount(Math.max(0, Number(event.target.value)))}
              className="rounded-xl border border-panel-border p-3 text-base text-panel-text"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">Kitapta hangi sayfadasın?</span>
            <input
              type="number"
              min="1"
              value={currentPageNumber}
              onChange={(event) => setCurrentPageNumber(event.target.value)}
              className="rounded-xl border border-panel-border p-3 text-base text-panel-text"
            />
          </label>

          <div className="flex flex-col gap-2 min-[420px]:flex-row">
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
