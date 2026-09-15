import { useEffect, useState } from 'react'
import { Camera, ChevronLeft, ChevronRight, Image as ImageIcon, Loader2, Printer, Trash2, X } from 'lucide-react'
import MistakePhotoCaptureModal from '../student/components/MistakePhotoCaptureModal'
import ConfirmationDialog from './ConfirmationDialog'

// Bir sorunun Hata Analiz görsellerini slayt gibi gezmeyi (birden fazla görsel olabilir),
// yazdırmayı/PDF indirmeyi ve (veli için) yeni görsel eklemeyi/kaldırmayı sağlayan tam ekran
// galeri. WrongQuestionGalleryModal'daki ana soru fotoğrafı galerisiyle aynı görsel dil, ama
// kendi başına (soru fotoğrafından bağımsız) — hem Hata Defteri'nden hem "Hata Analizlerim"
// menüsünden (AnalysisPhotosPage.jsx) aynı bileşen kullanılır.
export default function AnalysisPhotoViewer({
  wrongQuestionId,
  fetchPhotos,
  onClose,
  onAddPhoto,
  onDeletePhoto,
  title = 'Hata Analiz',
  contextLabel,
}) {
  const [photos, setPhotos] = useState(null)
  const [index, setIndex] = useState(0)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [deletingPhoto, setDeletingPhoto] = useState(null)
  const [busy, setBusy] = useState(false)
  const [printing, setPrinting] = useState(false)

  useEffect(() => {
    let ignore = false
    fetchPhotos(wrongQuestionId)
      .then((data) => {
        if (ignore) return
        setError('')
        setPhotos(data)
      })
      .catch((err) => {
        if (!ignore) setError(err.message || 'Hata analiz görselleri yüklenemedi.')
      })
    return () => {
      ignore = true
    }
  }, [wrongQuestionId, fetchPhotos])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (adding || deletingPhoto) return
      if (event.key === 'Escape') onClose()
      else if (event.key === 'ArrowLeft' && photos?.length > 1) goTo(index - 1)
      else if (event.key === 'ArrowRight' && photos?.length > 1) goTo(index + 1)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, photos, adding, deletingPhoto])

  const goTo = (nextIndex) => {
    if (!photos?.length) return
    setIndex((nextIndex + photos.length) % photos.length)
  }

  const handleAddPhoto = async (dataUrl) => {
    const newPhoto = await onAddPhoto(wrongQuestionId, dataUrl)
    setPhotos((prev) => {
      const next = [...(prev || []), newPhoto]
      setIndex(next.length - 1)
      return next
    })
  }

  const handleConfirmDelete = async () => {
    if (!deletingPhoto || busy) return
    setBusy(true)
    try {
      await onDeletePhoto(wrongQuestionId, deletingPhoto.id)
      setPhotos((prev) => {
        const next = (prev || []).filter((photo) => photo.id !== deletingPhoto.id)
        setIndex((current) => Math.min(current, Math.max(0, next.length - 1)))
        return next
      })
      setDeletingPhoto(null)
    } finally {
      setBusy(false)
    }
  }

  const handlePrint = async () => {
    if (!photos?.length || printing) return
    setPrinting(true)
    try {
      const [{ buildAnalysisPhotosPdf, buildAnalysisPhotosPdfFileName }, { savePdfDocument }] = await Promise.all([
        import('../../utils/analysisPhotosPdf'),
        import('../../utils/savePdfDocument'),
      ])
      const doc = await buildAnalysisPhotosPdf({ title, subtitle: contextLabel, photos })
      await savePdfDocument(doc, buildAnalysisPhotosPdfFileName(contextLabel || title))
    } finally {
      setPrinting(false)
    }
  }

  const hasMultiple = (photos?.length || 0) > 1
  const currentPhoto = photos?.[index]

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col overflow-y-auto bg-panel-text"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="flex shrink-0 items-center justify-between gap-3 px-4 pb-2"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-white">{title}</h2>
          {contextLabel ? <p className="truncate text-xs text-white/70">{contextLabel}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {photos?.length ? (
            <button
              type="button"
              onClick={handlePrint}
              disabled={printing}
              className="flex h-10 items-center gap-1.5 rounded-full bg-white/15 px-3 text-xs font-semibold text-white hover:bg-white/25 disabled:opacity-50"
            >
              {printing ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Printer size={16} aria-hidden="true" />}
              Yazdır
            </button>
          ) : null}
          {onAddPhoto ? (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex h-10 items-center gap-1.5 rounded-full bg-white/15 px-3 text-xs font-semibold text-white hover:bg-white/25"
            >
              <Camera size={16} aria-hidden="true" />
              Ekle
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

      <div className="relative flex flex-1 min-h-0 items-center justify-center px-3 py-2">
        {hasMultiple ? (
          <button
            type="button"
            aria-label="Önceki görsel"
            onClick={() => goTo(index - 1)}
            className="absolute left-2 z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-panel-surface text-panel-text shadow-panel-2 hover:bg-panel-surface-soft md:left-6"
          >
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
        ) : null}

        <div className="flex h-full min-h-[200px] max-w-full items-center justify-center">
          {photos === null ? (
            <div className="flex flex-col items-center gap-2 text-white/70">
              <Loader2 size={28} className="animate-spin" aria-hidden="true" />
              <span className="text-xs">Görseller yükleniyor...</span>
            </div>
          ) : error ? (
            <p className="max-w-xs text-center text-sm text-white/70">{error}</p>
          ) : currentPhoto ? (
            <img
              loading="lazy"
              decoding="async"
              src={currentPhoto.photoUrl}
              alt={`${title} ${index + 1}`}
              className="max-h-full max-w-full rounded-xl object-contain shadow-panel-2"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-white/70">
              <ImageIcon size={28} aria-hidden="true" />
              <span className="text-xs">Henüz görsel eklenmedi.</span>
            </div>
          )}
        </div>

        {hasMultiple ? (
          <button
            type="button"
            aria-label="Sonraki görsel"
            onClick={() => goTo(index + 1)}
            className="absolute right-2 z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-panel-surface text-panel-text shadow-panel-2 hover:bg-panel-surface-soft md:right-6"
          >
            <ChevronRight size={22} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {photos?.length ? (
        <div
          className="flex shrink-0 items-center justify-center gap-4 px-4 pb-4 pt-1"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
          <span className="text-xs font-semibold text-white/70">
            {index + 1} / {photos.length}
          </span>
          {onDeletePhoto && currentPhoto ? (
            <button
              type="button"
              onClick={() => setDeletingPhoto(currentPhoto)}
              className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25"
            >
              <Trash2 size={14} aria-hidden="true" />
              Bu Görseli Kaldır
            </button>
          ) : null}
        </div>
      ) : null}

      {adding ? (
        <MistakePhotoCaptureModal
          title="Hata Analiz Ekle"
          description="Çocuğunuzun bu soruyu neden yanlış yaptığını gösteren bir görsel ekleyin (çözüm, açıklama vb.)."
          onClose={() => setAdding(false)}
          onSave={handleAddPhoto}
        />
      ) : null}

      {deletingPhoto ? (
        <ConfirmationDialog
          title="Görseli kaldır"
          description="Bu Hata Analiz görselini kaldırmak istediğine emin misin? Bu işlem geri alınamaz."
          confirmLabel={busy ? 'Kaldırılıyor...' : 'Kaldır'}
          cancelLabel="Vazgeç"
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeletingPhoto(null)}
        />
      ) : null}
    </div>
  )
}
