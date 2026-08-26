import { BookOpen, CheckCircle2, Target, X } from 'lucide-react'
import { cn } from '../ui/utils'
import { RATE_TONES, completionRateTone, successRateTone } from './rateTones'

const AVATAR_DIMENSIONS = { md: 'h-10 w-10', row: 'h-14 w-14', lg: 'h-20 w-20' }
const AVATAR_ICON_SIZES = { md: 17, row: 22, lg: 30 }
const AVATAR_PIXEL_SIZES = { md: 40, row: 56, lg: 80 }

export function ResourceBookAvatar({ book, size = 'md', onClick }) {
  const dimension = AVATAR_DIMENSIONS[size] || AVATAR_DIMENSIONS.md
  const pixelSize = AVATAR_PIXEL_SIZES[size] || AVATAR_PIXEL_SIZES.md
  if (book?.imageUrl) {
    const image = (
      <img
        src={book.imageUrl}
        alt={`${book.name} görseli`}
        loading="lazy"
        decoding="async"
        width={pixelSize}
        height={pixelSize}
        className={`${dimension} shrink-0 rounded-xl border border-panel-border object-cover shadow-sm`}
      />
    )
    if (!onClick) return image
    return (
      <span
        role="button"
        tabIndex={0}
        onClick={(event) => {
          event.stopPropagation()
          onClick(event)
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          event.stopPropagation()
          onClick(event)
        }}
        className="shrink-0 cursor-pointer rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-student-theme-primary"
        aria-label={`${book.name} görselini büyüt`}
      >
        {image}
      </span>
    )
  }

  return (
    <span
      className={`flex ${dimension} shrink-0 items-center justify-center rounded-xl border border-panel-border bg-panel-blue-soft text-panel-blue shadow-sm`}
    >
      <BookOpen size={AVATAR_ICON_SIZES[size] || AVATAR_ICON_SIZES.md} aria-hidden="true" />
    </span>
  )
}

export function ResourceBookCover({ book, onClick }) {
  if (book?.imageUrl) {
    const image = (
      <img
        src={book.imageUrl}
        alt={`${book.name} görseli`}
        loading="lazy"
        decoding="async"
        className="aspect-[3/4] w-full rounded-lg border border-panel-border object-cover"
      />
    )

    if (!onClick) return image
    return (
      <span
        role="button"
        tabIndex={0}
        onClick={(event) => {
          event.stopPropagation()
          onClick(event)
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          event.stopPropagation()
          onClick(event)
        }}
        className="block cursor-pointer rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-student-theme-primary"
        aria-label={`${book.name} görselini büyüt`}
      >
        {image}
      </span>
    )
  }

  return (
    <span className="flex aspect-[3/4] w-full items-center justify-center rounded-lg bg-panel-blue-soft text-panel-blue">
      <BookOpen size={28} aria-hidden="true" />
    </span>
  )
}

export function ImagePreviewLightbox({ preview, onClose }) {
  if (!preview) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <button
        type="button"
        aria-label="Kapat"
        onClick={onClose}
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
      >
        <X size={20} aria-hidden="true" />
      </button>
      <img
        loading="lazy"
        decoding="async"
        src={preview.url}
        alt={`${preview.name} görseli`}
        className="max-h-[85vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  )
}

function RateRow({ icon: Icon, label, value, tone }) {
  const hasValue = value !== null && value !== undefined
  const percentage = hasValue ? Math.round(value * 100) : 0
  const colors = RATE_TONES[tone]

  return (
    <div className={cn('min-w-0 rounded-lg px-2 py-1.5', colors.chip)}>
      <div className="flex items-center justify-between gap-1">
        <span className="flex min-w-0 items-center gap-1 text-[11px] font-semibold">
          {Icon ? <Icon size={12} className="shrink-0" aria-hidden="true" /> : null}
          <span className="truncate">{label}</span>
        </span>
        <span className="shrink-0 text-sm font-bold tabular-nums">{hasValue ? `%${percentage}` : '—'}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/70">
        <div className={cn('h-full rounded-full transition-all', colors.bar)} style={{ width: `${hasValue ? percentage : 0}%` }} />
      </div>
    </div>
  )
}

export function SuccessRateBadge({ value, label = 'Başarı' }) {
  const hasValue = value !== null && value !== undefined
  const percentage = hasValue ? Math.round(value * 100) : 0
  const colors = RATE_TONES[successRateTone(value)]

  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold', colors.chip)}>
      <Target size={12} className="shrink-0" aria-hidden="true" />
      {label} {hasValue ? `%${percentage}` : '—'}
    </span>
  )
}

export function ResourceBookRates({ completionRate, successRate, className }) {
  return (
    <div className={cn('mt-2.5 grid grid-cols-1 gap-1.5', className)}>
      <RateRow icon={CheckCircle2} label="İlerleme" value={completionRate} tone={completionRateTone(completionRate)} />
      <RateRow icon={Target} label="Başarı" value={successRate} tone={successRateTone(successRate)} />
    </div>
  )
}
