import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react'
import { cn } from '../ui/utils'

const MISTAKE_REASON_OPTIONS = [
  { value: 'dikkat-hatasi', label: 'Dikkat Hatası' },
  { value: 'bilgi-eksikligi', label: 'Bilgi Eksikliği' },
]

function CaptionRow({ label, value }) {
  if (!value) return null
  return (
    <div className="flex items-baseline gap-1.5 text-xs">
      <span className="text-white/60">{label}</span>
      <span className="font-semibold text-white">{value}</span>
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

  const item = items[index]
  const hasMultiple = items.length > 1
  const currentPhotoUrl = item ? photosById[item.id] : undefined

  const goTo = (nextIndex) => {
    setIndex((nextIndex + items.length) % items.length)
  }

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
      else if (event.key === 'ArrowLeft' && hasMultiple) goTo(index - 1)
      else if (event.key === 'ArrowRight' && hasMultiple) goTo(index + 1)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, hasMultiple])

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
      className="fixed inset-0 z-[60] flex flex-col bg-black/90"
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

      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4">
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

        <div className="relative flex max-h-[62vh] min-h-[240px] max-w-full items-center justify-center">
          {currentPhotoUrl ? (
            <img
              src={currentPhotoUrl}
              alt={`${item.topic || title || 'Soru'} fotoğrafı`}
              className="max-h-[62vh] max-w-full rounded-xl object-contain shadow-2xl"
            />
          ) : photoError ? (
            <p className="max-w-xs text-center text-sm text-white/70">{photoError}</p>
          ) : (
            <div className="flex flex-col items-center gap-2 text-white/60">
              <Loader2 size={28} className="animate-spin" aria-hidden="true" />
              <span className="text-xs">Fotoğraf yükleniyor...</span>
            </div>
          )}
          {currentPhotoUrl ? (
            <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 rounded-b-xl bg-gradient-to-t from-black/85 to-transparent px-4 pb-3 pt-8">
              <CaptionRow label="Kaynak:" value={item.publisherName} />
              <CaptionRow label="Konu:" value={item.topic} />
              <CaptionRow label="Test:" value={item.testName} />
              <CaptionRow label="Soru No:" value={item.questionNumber} />
            </div>
          ) : null}
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

      <div className="flex flex-col items-center gap-3 px-4 pb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-white/70">Bu soruyu neden yanlış yaptın?</span>
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
                  : 'border-white/25 text-white hover:border-white/50',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        {hasMultiple ? (
          <div className="flex w-full max-w-full gap-2 overflow-x-auto pb-1">
            {items.map((thumb, thumbIndex) => (
              <button
                key={thumb.id}
                type="button"
                aria-label={`${thumbIndex + 1}. fotoğrafı göster`}
                onClick={() => setIndex(thumbIndex)}
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 text-xs font-bold transition-colors',
                  thumbIndex === index
                    ? 'border-panel-blue bg-panel-blue text-white'
                    : 'border-white/20 text-white/70 hover:border-white/50',
                )}
              >
                {thumb.questionNumber || thumbIndex + 1}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
