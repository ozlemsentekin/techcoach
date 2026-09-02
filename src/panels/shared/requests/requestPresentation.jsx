import { useState } from 'react'
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

/** Fotoğraf ızgarası + tıklayınca tam ekran büyütme. */
export function PhotoGrid({ title, photos }) {
  const [active, setActive] = useState(null)
  if (!photos || photos.length === 0) return null
  const urls = photos.map((photo) => (typeof photo === 'string' ? photo : photo.url))

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
            onClick={() => setActive(url)}
            className="aspect-square overflow-hidden rounded-lg border border-panel-border bg-white"
          >
            <img src={url} alt={`${title} ${index + 1}`} className="h-full w-full object-cover" loading="lazy" decoding="async" />
          </button>
        ))}
      </div>

      {active ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setActive(null)}
          role="presentation"
        >
          <img src={active} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
        </div>
      ) : null}
    </div>
  )
}
