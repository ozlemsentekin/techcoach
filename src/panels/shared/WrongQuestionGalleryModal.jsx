import { useEffect, useState } from 'react'
import { BookOpen, Camera, Check, ChevronLeft, ChevronRight, FileText, Hash, HelpCircle, Loader2, X } from 'lucide-react'
import { cn } from '../ui/utils'

const MISTAKE_REASON_OPTIONS = [
  { value: 'dikkat-hatasi', label: 'Dikkat Hatası' },
  { value: 'bilgi-eksikligi', label: 'Bilgi Eksikliği' },
  { value: 'soruyu-anlamadim', label: 'Soruyu Anlamadım' },
]

function InfoField({ icon, label, value }) {
  if (!value) return null
  const Icon = icon
  return (
    <div className="flex min-w-0 items-start gap-2">
      <Icon size={14} className="mt-0.5 shrink-0 text-panel-text-muted" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-panel-text-muted">{label}</p>
        <p className="line-clamp-2 break-words text-sm font-semibold text-panel-text" title={value}>
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
// getWrongQuestionPhotoHandler). Bir item `photoUrl` taşıyorsa (ör. cevap kağıdında yeni çekilen
// fotoğraf) tembel çekim atlanır. `onCapturePhoto` verilirse fotoğrafı değiştirme butonu çıkar
// (öğrencinin kendi cevap kağıdı akışı). `onIndexChange` üst bileşenin aktif index'i takip
// etmesini sağlar (galeri fotoğraf çekimi sırasında geçici olarak kapanıp açılabildiği için).
export default function WrongQuestionGalleryModal({
  title,
  items,
  initialIndex = 0,
  fetchPhoto,
  onClose,
  onUpdateMistakeReason,
  onUpdateMistakeMeta,
  onCapturePhoto,
  onIndexChange,
}) {
  const [index, setIndex] = useState(initialIndex)
  const [savingReason, setSavingReason] = useState(false)
  const [photosById, setPhotosById] = useState({})
  const [photoError, setPhotoError] = useState('')
  const [zoomed, setZoomed] = useState(false)
  // Konu/Not alanları: item değişince testin içerik adıyla ön-dolu gelir, alandan çıkınca (blur)
  // yalnızca değişmişse kaydedilir. savedMeta son kaydedilen/başlangıç değerini tutar.
  const [meta, setMeta] = useState({ topic: '', studentNote: '' })
  const [savedMeta, setSavedMeta] = useState({ topic: '', studentNote: '' })
  const [metaStatus, setMetaStatus] = useState('idle') // idle | saving | saved | error

  const item = items[index]
  const hasMultiple = items.length > 1
  const currentPhotoUrl = item ? item.photoUrl || photosById[item.id] : undefined

  const goTo = (nextIndex) => {
    setZoomed(false)
    setIndex((nextIndex + items.length) % items.length)
  }

  useEffect(() => {
    onIndexChange?.(index)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

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
    if (!item || item.photoUrl || photosById[item.id]) return
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
      if (neighbor && !neighbor.photoUrl && !photosById[neighbor.id]) {
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

  // Konu alanı için varsayılan: kayıtlı konu yoksa testin içerik/test adı otomatik dolar.
  useEffect(() => {
    const initial = {
      topic: item ? item.topic || item.testName || title || '' : '',
      studentNote: item?.studentNote || '',
    }
    setMeta(initial)
    setSavedMeta(initial)
    setMetaStatus('idle')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id])

  const commitMetaField = async (field) => {
    if (!item || !onUpdateMistakeMeta) return
    const value = meta[field].trim()
    if (value === (savedMeta[field] || '').trim()) return
    setMetaStatus('saving')
    try {
      await onUpdateMistakeMeta(item.id, { [field]: value })
      setSavedMeta((prev) => ({ ...prev, [field]: value }))
      setMeta((prev) => ({ ...prev, [field]: value }))
      setMetaStatus('saved')
    } catch {
      setMetaStatus('error')
    }
  }

  if (!item) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-panel-text"
      role="dialog"
      aria-modal="true"
      aria-label={title ? `${title} fotoğraf galerisi` : 'Soru fotoğrafı galerisi'}
    >
      <div
        className="flex shrink-0 items-center justify-between gap-3 px-4 pb-2"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-white">{title || 'Genel'}</h2>
          <p className="text-xs text-white/70">
            {index + 1} / {items.length}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onCapturePhoto ? (
            <button
              type="button"
              onClick={() => onCapturePhoto(item)}
              className="flex h-10 items-center gap-1.5 rounded-full bg-white/15 px-3 text-xs font-semibold text-white hover:bg-white/25"
            >
              <Camera size={16} aria-hidden="true" />
              {currentPhotoUrl ? 'Fotoğrafı Değiştir' : 'Fotoğraf Ekle'}
            </button>
          ) : null}
          <button
            type="button"
            aria-label="Kapat"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-center gap-2 px-3 pb-2">
        <div className="w-full max-w-2xl rounded-2xl border-2 border-panel-accent bg-panel-surface px-4 py-3 shadow-panel-2">
          <div className="flex flex-col items-center gap-2">
            <span className="flex items-center gap-2 text-base font-extrabold uppercase tracking-wide text-panel-warm sm:text-lg">
              <HelpCircle size={22} className="shrink-0" aria-hidden="true" />
              Bu soruyu neden yanlış yaptın?
            </span>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
              {MISTAKE_REASON_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={item.mistakeReason === option.value}
                  disabled={savingReason}
                  onClick={() => handleSelectReason(option.value)}
                  className={cn(
                    'rounded-full border-2 px-4 py-2 text-center text-sm font-bold transition-colors disabled:opacity-50',
                    item.mistakeReason === option.value
                      ? 'border-panel-blue bg-panel-blue text-white'
                      : 'border-panel-border text-panel-text hover:border-panel-blue hover:text-panel-blue',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {onUpdateMistakeMeta ? (
            <div className="mt-3 grid grid-cols-1 gap-2 border-t border-panel-border pt-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-panel-text-muted">Konu</span>
                <input
                  type="text"
                  value={meta.topic}
                  onChange={(event) => setMeta((prev) => ({ ...prev, topic: event.target.value }))}
                  onBlur={() => commitMetaField('topic')}
                  placeholder="Konu"
                  className="w-full rounded-lg border border-panel-border bg-panel-surface px-3 py-1.5 text-sm text-panel-text focus:border-panel-blue focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-panel-text-muted">
                  Not <span className="font-normal normal-case">(isteğe bağlı)</span>
                </span>
                <textarea
                  rows={2}
                  value={meta.studentNote}
                  onChange={(event) => setMeta((prev) => ({ ...prev, studentNote: event.target.value }))}
                  onBlur={() => commitMetaField('studentNote')}
                  placeholder="Bu hataya dair bir not ekleyebilirsin"
                  className="w-full resize-none rounded-lg border border-panel-border bg-panel-surface px-3 py-1.5 text-sm text-panel-text focus:border-panel-blue focus:outline-none"
                />
              </label>
              <div className="sm:col-span-2">
                {metaStatus === 'saving' ? (
                  <span className="flex items-center gap-1 text-[11px] text-panel-text-muted">
                    <Loader2 size={12} className="animate-spin" aria-hidden="true" /> Kaydediliyor...
                  </span>
                ) : metaStatus === 'saved' ? (
                  <span className="flex items-center gap-1 text-[11px] text-emerald-600">
                    <Check size={12} aria-hidden="true" /> Kaydedildi
                  </span>
                ) : metaStatus === 'error' ? (
                  <span className="text-[11px] text-panel-red">Kaydedilemedi, tekrar dene.</span>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="relative flex flex-1 min-h-0 items-center justify-center px-3 py-2">
        {hasMultiple ? (
          <button
            type="button"
            aria-label="Önceki fotoğraf"
            onClick={() => goTo(index - 1)}
            className="absolute left-2 z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-panel-surface text-panel-text shadow-panel-2 hover:bg-panel-surface-soft md:left-6"
          >
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
        ) : null}

        <div className="flex h-full min-h-[200px] max-w-full items-center justify-center">
          {currentPhotoUrl ? (
            <img loading="lazy" decoding="async"
              src={currentPhotoUrl}
              alt={`${item.topic || title || 'Soru'} fotoğrafı`}
              onClick={() => setZoomed(true)}
              className="max-h-full max-w-full cursor-zoom-in rounded-xl object-contain shadow-panel-2"
            />
          ) : photoError ? (
            <div className="flex flex-col items-center gap-3 text-white/70">
              <p className="max-w-xs text-center text-sm">{photoError}</p>
              {onCapturePhoto ? (
                <button
                  type="button"
                  onClick={() => onCapturePhoto(item)}
                  className="flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/25"
                >
                  <Camera size={16} aria-hidden="true" />
                  Fotoğraf Ekle
                </button>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-white/70">
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
            className="absolute right-2 z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-panel-surface text-panel-text shadow-panel-2 hover:bg-panel-surface-soft md:right-6"
          >
            <ChevronRight size={22} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div
        className="shrink-0 rounded-t-2xl bg-panel-surface px-4 pt-2 shadow-panel-2"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-panel-border" aria-hidden="true" />
        <div className="mx-auto grid w-full max-w-4xl grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
          <InfoField icon={BookOpen} label="Kaynak" value={item.publisherName} />
          <InfoField icon={FileText} label="Test" value={item.testName} />
          <InfoField icon={Hash} label="Soru No" value={item.questionNumber} />
        </div>
      </div>

      {zoomed && currentPhotoUrl ? (
        <div
          className="fixed inset-0 z-[70] flex cursor-zoom-out items-center justify-center bg-panel-text/95 p-4"
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
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  )
}
