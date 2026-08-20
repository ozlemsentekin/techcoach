import { useEffect, useState } from 'react'
import { BookOpen, ChevronLeft, ChevronRight, FileText, Hash, Layers, Loader2, X } from 'lucide-react'
import { cn } from '../ui/utils'

const MISTAKE_REASON_OPTIONS = [
  { value: 'dikkat-hatasi', label: 'Dikkat Hatası' },
  { value: 'bilgi-eksikligi', label: 'Bilgi Eksikliği' },
]

function InfoField({ icon, label, value }) {
  if (!value) return null
  const Icon = icon
  return (
    <div className="flex min-w-0 items-start gap-2">
      <Icon size={14} className="mt-0.5 shrink-0 text-white/40" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40">{label}</p>
        <p className="break-words text-sm font-semibold text-white" title={value}>
          {value}
        </p>
      </div>
    </div>
  )
}

// Hata Defterim'de bir içeriğe (konuya) ait tüm fotoğrafları gezip her soruyu "Dikkat Hatası" /
// "Bilgi Eksikliği" olarak etiketlemeyi sağlayan tam ekran galeri. Tek fotoğraflık eski
// PhotoLightbox'ın yerine geçer. `items` gelirken fotoğrafları içermez (sadece hasPhoto bayrağı,
// bkz. WrongQuestionsView) — her fotoğraf sadece görüntülendiği an fetchPhoto ile tembel çekilir,
// onlarca fotoğrafı tek seferde indirmenin getirdiği yavaşlığı önlemek için (bkz. progress.js'deki
// getWrongQuestionPhotoHandler).
export default function WrongQuestionGalleryModal({ title, items, initialIndex = 0, fetchPhoto, onClose, onUpdateMistakeReason }) {
  const [index, setIndex] = useState(initialIndex)
  const [savingReason, setSavingReason] = useState(false)
  const [photosById, setPhotosById] = useState({})
  const [photoError, setPhotoError] = useState('')
  const [zoomed, setZoomed] = useState(false)

  const item = items[index]
  const hasMultiple = items.length > 1
  const currentPhotoUrl = item ? photosById[item.id] : undefined

  const goTo = (nextIndex) => {
    setZoomed(false)
    setIndex((nextIndex + items.length) % items.length)
  }

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (zoomed) setZoomed(false)
        else onClose()
      } else if (event.key === 'ArrowLeft' && hasMultiple) goTo(index - 1)
      else if (event.key === 'ArrowRight' && hasMultiple) goTo(index + 1)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, hasMultiple, zoomed])

  useEffect(() => {
    if (!item || photosById[item.id]) return
    let ignore = false
    setPhotoError('')
    fetchPhoto(item.id)
      .then((photoUrl) => {
        if (!ignore) setPhotosById((prev) => ({ ...prev, [item.id]: photoUrl }))
      })
      .catch((err) => {
        if (!ignore) setPhotoError(err.message || 'Fotoğraf yüklenemedi.')
      })
    return () => {
      ignore = true
    }
  }, [item, fetchPhoto, photosById])

  // Prev/next'e basınca beklemeden görünsün diye komşu fotoğrafları sessizce önceden çeker.
  useEffect(() => {
    if (!hasMultiple) return
    ;[items[(index + 1) % items.length], items[(index - 1 + items.length) % items.length]].forEach((neighbor) => {
      if (neighbor && !photosById[neighbor.id]) {
        fetchPhoto(neighbor.id)
          .then((photoUrl) => setPhotosById((prev) => (prev[neighbor.id] ? prev : { ...prev, [neighbor.id]: photoUrl })))
          .catch(() => {})
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, items, hasMultiple])

  const handleSelectReason = async (reason) => {
    if (!item || savingReason) return
    setSavingReason(true)
    try {
      await onUpdateMistakeReason(item.id, reason)
    } finally {
      setSavingReason(false)
    }
  }

  if (!item) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-black/95"
      role="dialog"
      aria-modal="true"
      aria-label={title ? `${title} fotoğraf galerisi` : 'Soru fotoğrafı galerisi'}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-white">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">{title || 'Genel'}</h2>
          <p className="text-xs text-white/60">
            {index + 1} / {items.length}
          </p>
        </div>
        <button
          type="button"
          aria-label="Kapat"
          onClick={onClose}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="flex flex-col items-center gap-2 px-4 pb-3">
        <div className="flex w-full max-w-2xl flex-wrap items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 shadow-lg">
          <span className="text-xs font-semibold text-slate-700">Bu soruyu neden yanlış yaptın?</span>
          {MISTAKE_REASON_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={item.mistakeReason === option.value}
              disabled={savingReason}
              onClick={() => handleSelectReason(option.value)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50',
                item.mistakeReason === option.value
                  ? 'border-panel-blue bg-panel-blue text-white'
                  : 'border-slate-300 text-slate-700 hover:border-panel-blue hover:text-panel-blue',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center px-4 py-2">
        {hasMultiple ? (
          <button
            type="button"
            aria-label="Önceki fotoğraf"
            onClick={() => goTo(index - 1)}
            className="absolute left-2 z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 md:left-6"
          >
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
        ) : null}

        <div className="flex min-h-[240px] max-h-[50vh] max-w-full items-center justify-center">
          {currentPhotoUrl ? (
            <img loading="lazy" decoding="async"
              src={currentPhotoUrl}
              alt={`${item.topic || title || 'Soru'} fotoğrafı`}
              onClick={() => setZoomed(true)}
              className="max-h-[50vh] max-w-full cursor-zoom-in rounded-xl object-contain shadow-2xl"
            />
          ) : photoError ? (
            <p className="max-w-xs text-center text-sm text-white/70">{photoError}</p>
          ) : (
            <div className="flex flex-col items-center gap-2 text-white/60">
              <Loader2 size={28} className="animate-spin" aria-hidden="true" />
              <span className="text-xs">Fotoğraf yükleniyor...</span>
            </div>
          )}
        </div>

        {hasMultiple ? (
          <button
            type="button"
            aria-label="Sonraki fotoğraf"
            onClick={() => goTo(index + 1)}
            className="absolute right-2 z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 md:right-6"
          >
            <ChevronRight size={22} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div className="flex flex-col items-center gap-4 px-4 pb-6">
        <div className="grid w-full max-w-4xl grid-cols-2 gap-x-6 gap-y-3 rounded-2xl border border-white/10 bg-white/[0.06] px-6 py-3 sm:grid-cols-4">
          <InfoField icon={BookOpen} label="Kaynak" value={item.publisherName} />
          <InfoField icon={Layers} label="Konu" value={item.topic} />
          <InfoField icon={FileText} label="Test" value={item.testName} />
          <InfoField icon={Hash} label="Soru No" value={item.questionNumber} />
        </div>
      </div>

      {zoomed && currentPhotoUrl ? (
        <div
          className="fixed inset-0 z-[70] flex cursor-zoom-out items-center justify-center bg-black/90 p-4"
          role="button"
          tabIndex={-1}
          aria-label="Fotoğrafı kapat"
          onClick={() => setZoomed(false)}
        >
          <img loading="lazy" decoding="async"
            src={currentPhotoUrl}
            alt={`${item.topic || title || 'Soru'} fotoğrafı büyütülmüş`}
            className="max-h-[95vh] max-w-[95vw] rounded-xl object-contain shadow-2xl"
          />
          <button
            type="button"
            aria-label="Kapat"
            onClick={() => setZoomed(false)}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  )
}
