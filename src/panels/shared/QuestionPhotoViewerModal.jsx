import { useEffect, useRef, useState } from 'react'
import { Loader2, X } from 'lucide-react'

export default function QuestionPhotoViewerModal({
  title,
  subtitle,
  photoId,
  photoUrl,
  fetchPhoto,
  onLoaded,
  onClose,
}) {
  const fetchPhotoRef = useRef(fetchPhoto)
  const onLoadedRef = useRef(onLoaded)
  const [loadedPhoto, setLoadedPhoto] = useState({ photoId: null, url: '', error: '' })

  useEffect(() => {
    fetchPhotoRef.current = fetchPhoto
  }, [fetchPhoto])

  useEffect(() => {
    onLoadedRef.current = onLoaded
  }, [onLoaded])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  useEffect(() => {
    let ignore = false

    if (photoUrl || !photoId || !fetchPhotoRef.current) {
      return undefined
    }

    fetchPhotoRef.current(photoId)
      .then((loadedPhotoUrl) => {
        if (ignore) return
        setLoadedPhoto({ photoId, url: loadedPhotoUrl, error: '' })
        onLoadedRef.current?.(loadedPhotoUrl)
      })
      .catch((err) => {
        if (!ignore) setLoadedPhoto({ photoId, url: '', error: err.message || 'Fotoğraf yüklenemedi.' })
      })

    return () => {
      ignore = true
    }
  }, [photoId, photoUrl])

  const resolvedPhotoUrl = photoUrl || (loadedPhoto.photoId === photoId ? loadedPhoto.url : '')
  const error =
    loadedPhoto.photoId === photoId && loadedPhoto.error
      ? loadedPhoto.error
      : !photoUrl && (!photoId || !fetchPhoto)
        ? 'Fotoğraf bulunamadı.'
        : ''

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-panel-text"
      role="dialog"
      aria-modal="true"
      aria-label={title ? `${title} fotoğrafı` : 'Soru fotoğrafı'}
    >
      <div
        className="flex shrink-0 items-center justify-between gap-3 px-4 pb-2"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-white">{title || 'Soru Fotoğrafı'}</h2>
          {subtitle ? <p className="truncate text-xs text-white/70">{subtitle}</p> : null}
        </div>
        <button
          type="button"
          aria-label="Kapat"
          onClick={onClose}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center p-3">
        {resolvedPhotoUrl ? (
          <img
            loading="lazy"
            decoding="async"
            src={resolvedPhotoUrl}
            alt={title ? `${title} fotoğrafı` : 'Soru fotoğrafı'}
            className="max-h-full max-w-full rounded-xl object-contain shadow-panel-2"
          />
        ) : error ? (
          <p className="max-w-xs text-center text-sm text-white/70">{error}</p>
        ) : (
          <div className="flex flex-col items-center gap-2 text-white/70">
            <Loader2 size={28} className="animate-spin" aria-hidden="true" />
            <span className="text-xs">Fotoğraf yükleniyor...</span>
          </div>
        )}
      </div>
    </div>
  )
}
