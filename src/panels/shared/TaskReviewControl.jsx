import { useState } from 'react'
import { Check, RotateCcw, SquareCheck } from 'lucide-react'

// Öğretmenin, tamamlanmış bir ödev/görevin sonucunu "kontrol edildi" olarak işaretlediği
// onay kutusu. Haftalık plan kartında optik sonucun altında ve açılan optik form içinde
// aynı görünümle kullanılır. İşaretli durumda kimin / ne zaman kontrol ettiği yazılır ve
// öğretmen "Geri al" ile işareti kaldırabilir.
function formatReviewStamp(isoString) {
  if (!isoString) return null
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return null
  const datePart = date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })
  const timePart = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  return `${datePart} · ${timePart}`
}

export default function TaskReviewControl({ reviewed, reviewedAt, reviewedByName, onToggle }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const handleToggle = async (next) => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await onToggle(next)
    } catch (err) {
      setError(err?.message || 'İşlem tamamlanamadı.')
    } finally {
      setBusy(false)
    }
  }

  if (reviewed) {
    const stamp = formatReviewStamp(reviewedAt)
    return (
      <div className="mt-0.5 flex flex-col gap-1 rounded-xl border-2 border-emerald-200 bg-emerald-50 px-2.5 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-[11px] font-extrabold text-emerald-700">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] bg-emerald-600 text-white">
              <Check size={12} strokeWidth={3} aria-hidden="true" />
            </span>
            Kontrol edildi
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={(event) => {
              event.stopPropagation()
              handleToggle(false)
            }}
            className="flex shrink-0 items-center gap-1 rounded-lg px-1.5 py-0.5 text-[10px] font-bold text-emerald-700/80 transition-colors duration-150 hover:bg-emerald-100 hover:text-emerald-800 disabled:opacity-50"
          >
            <RotateCcw size={11} aria-hidden="true" />
            Geri al
          </button>
        </div>
        {reviewedByName || stamp ? (
          <span className="pl-[22px] text-[10px] font-semibold leading-snug text-emerald-700/80">
            {[reviewedByName, stamp].filter(Boolean).join(' · ')}
          </span>
        ) : null}
        {error ? <span className="pl-[22px] text-[10px] font-semibold text-panel-red">{error}</span> : null}
      </div>
    )
  }

  return (
    <div className="mt-0.5 flex flex-col gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={(event) => {
          event.stopPropagation()
          handleToggle(true)
        }}
        className="flex w-full items-center gap-2 rounded-xl border-2 border-dashed border-panel-border bg-white px-2.5 py-2 text-[11px] font-bold text-panel-text-muted transition-colors duration-150 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50"
      >
        <SquareCheck size={15} className="shrink-0" aria-hidden="true" />
        Kontrol edildi olarak işaretle
      </button>
      {error ? <span className="pl-1 text-[10px] font-semibold text-panel-red">{error}</span> : null}
    </div>
  )
}
