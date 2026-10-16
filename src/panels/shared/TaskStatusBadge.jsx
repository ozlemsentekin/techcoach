import { CheckCircle2, Clock, HelpCircle, MinusCircle, PlayCircle, RotateCw } from 'lucide-react'
import { STATUS_LABELS } from '../../data/taskTypes'

const STATUS_STYLES = {
  bekliyor: { className: 'bg-panel-blue-soft text-panel-blue', icon: Clock },
  'devam-ediyor': { className: 'bg-panel-accent-soft text-panel-warm', icon: PlayCircle },
  tamamlandi: { className: 'bg-panel-sage-soft text-panel-sage', icon: CheckCircle2 },
  'kismen-tamamlandi': { className: 'bg-panel-sage-soft text-panel-sage', icon: MinusCircle },
  'yeniden-planlandi': { className: 'bg-panel-lilac-soft text-panel-lilac', icon: RotateCw },
  'yardim-bekliyor': { className: 'bg-panel-accent-soft text-panel-warm', icon: HelpCircle },
}

// size="sm": yoğun tablolarda bir punto küçük rozet. toneOverrides: { [status]: className } ile
// renk yalnızca o ekranda değiştirilebilir.
export default function TaskStatusBadge({ status, size = 'md', toneOverrides }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.bekliyor
  const { icon: Icon } = style
  const className = toneOverrides?.[status] || style.className
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${
        size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm'
      } ${className}`}
    >
      <Icon size={size === 'sm' ? 12 : 13} className="shrink-0" aria-hidden="true" />
      {STATUS_LABELS[status] || status}
    </span>
  )
}
