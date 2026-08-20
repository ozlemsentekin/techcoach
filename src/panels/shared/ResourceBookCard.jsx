import { BookOpen, CheckCircle2, Target } from 'lucide-react'
import { cn } from '../ui/utils'

const AVATAR_DIMENSIONS = { md: 'h-10 w-10', row: 'h-14 w-14', lg: 'h-20 w-20' }
const AVATAR_ICON_SIZES = { md: 17, row: 22, lg: 30 }

export function ResourceBookAvatar({ book, size = 'md', onClick }) {
  const dimension = AVATAR_DIMENSIONS[size] || AVATAR_DIMENSIONS.md
  if (book?.imageUrl) {
    const image = (
      <img
        src={book.imageUrl}
        alt={`${book.name} görseli`}
        className={`${dimension} shrink-0 rounded-xl border border-panel-border object-cover shadow-sm`}
      />
    )
    if (!onClick) return image
    return (
      <button
        type="button"
        onClick={onClick}
        className="shrink-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-student-theme-primary"
        aria-label={`${book.name} görselini büyüt`}
      >
        {image}
      </button>
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

export function ResourceBookCover({ book }) {
  if (book?.imageUrl) {
    return (
      <img
        src={book.imageUrl}
        alt={`${book.name} görseli`}
        className="aspect-[3/4] w-full rounded-lg border border-panel-border object-cover"
      />
    )
  }

  return (
    <span className="flex aspect-[3/4] w-full items-center justify-center rounded-lg bg-panel-blue-soft text-panel-blue">
      <BookOpen size={28} aria-hidden="true" />
    </span>
  )
}

const RATE_TONES = {
  blue: { chip: 'bg-panel-blue-soft text-panel-blue', bar: 'bg-panel-blue', text: 'text-panel-blue' },
  sage: { chip: 'bg-panel-sage-soft text-panel-sage', bar: 'bg-panel-sage', text: 'text-panel-sage' },
  accent: { chip: 'bg-panel-accent-soft text-panel-accent', bar: 'bg-panel-accent', text: 'text-panel-accent' },
  warm: { chip: 'bg-panel-warm-soft text-panel-warm', bar: 'bg-panel-warm', text: 'text-panel-warm' },
  yellow: { chip: 'bg-panel-yellow-soft text-panel-yellow', bar: 'bg-panel-yellow', text: 'text-panel-yellow' },
  red: { chip: 'bg-panel-red-soft text-panel-red', bar: 'bg-panel-red', text: 'text-panel-red' },
  neutral: { chip: 'bg-panel-surface-soft text-panel-text-muted', bar: 'bg-panel-text-muted/40', text: 'text-panel-text-muted' },
}

function successRateTone(value) {
  if (value === null || value === undefined) return 'neutral'
  if (value >= 0.9) return 'sage'
  if (value >= 0.8) return 'yellow'
  return 'red'
}

function completionRateTone(value) {
  if (!value) return 'neutral'
  return 'blue'
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
      <RateRow icon={CheckCircle2} label="Tamamlanma" value={completionRate} tone={completionRateTone(completionRate)} />
      <RateRow icon={Target} label="Başarı" value={successRate} tone={successRateTone(successRate)} />
    </div>
  )
}
