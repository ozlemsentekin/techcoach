import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react'
import Badge from '../../ui/Badge'
import { PANEL_REQUEST_STATUS_LABELS } from '../../../services/panelRequestService'
import { STATUS_TONE } from './requestFormat'

export function RequestStatusBadge({ status }) {
  return (
    <Badge tone={STATUS_TONE[status] || 'neutral'}>
      {PANEL_REQUEST_STATUS_LABELS[status] || status}
    </Badge>
  )
}

/** Fotoğraf ızgarası + tıklayınca tam ekran büyütme, oklarla gezinme ve indirme. */
export function PhotoGrid({ title, photos }) {
  const [activeIndex, setActiveIndex] = useState(null)
  const urls = photos ? photos.map((photo) => (typeof photo === 'string' ? photo : photo.url)) : []

  useEffect(() => {
    if (activeIndex === null) return undefined
    function handleKeyDown(event) {
      if (event.key === 'Escape') setActiveIndex(null)
      else if (event.key === 'ArrowLeft') setActiveIndex((current) => (current - 1 + urls.length) % urls.length)
      else if (event.key === 'ArrowRight') setActiveIndex((current) => (current + 1) % urls.length)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeIndex, urls.length])

  if (!photos || photos.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold text-panel-text">
        {title} <span className="font-normal text-panel-text-muted">({urls.length})</span>
      </p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {urls.map((url, index) => (
          <button
            key={index}
            type="button"
            onClick={() => setActiveIndex(index)}
            className="aspect-square overflow-hidden rounded-lg border border-panel-border bg-white"
          >
            <img src={url} alt={`${title} ${index + 1}`} className="h-full w-full object-cover" loading="lazy" decoding="async" />
          </button>
        ))}
      </div>

      {activeIndex !== null ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" role="presentation">
          <div
            className="absolute inset-0"
            onClick={() => setActiveIndex(null)}
            role="presentation"
          />

          <button
            type="button"
            aria-label="Kapat"
            onClick={() => setActiveIndex(null)}
            className="absolute right-4 top-4 z-10 rounded-full bg-black/40 p-2 text-white hover:bg-black/60"
          >
            <X size={20} />
          </button>

          {urls.length > 1 ? (
            <>
              <button
                type="button"
                aria-label="Önceki fotoğraf"
                onClick={(event) => {
                  event.stopPropagation()
                  setActiveIndex((current) => (current - 1 + urls.length) % urls.length)
                }}
                className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white hover:bg-black/60 sm:left-4"
              >
                <ChevronLeft size={24} />
              </button>
              <button
                type="button"
                aria-label="Sonraki fotoğraf"
                onClick={(event) => {
                  event.stopPropagation()
                  setActiveIndex((current) => (current + 1) % urls.length)
                }}
                className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white hover:bg-black/60 sm:right-4"
              >
                <ChevronRight size={24} />
              </button>
            </>
          ) : null}

          <img
            src={urls[activeIndex]}
            alt=""
            className="relative max-h-full max-w-full rounded-lg object-contain"
            onClick={(event) => event.stopPropagation()}
          />

          <a
            href={urls[activeIndex]}
            download
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/40 px-4 py-2 text-sm text-white hover:bg-black/60"
          >
            <Download size={16} />
            İndir
          </a>

          {urls.length > 1 ? (
            <span className="absolute bottom-4 right-4 z-10 rounded-full bg-black/40 px-2.5 py-1 text-xs text-white">
              {activeIndex + 1} / {urls.length}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
