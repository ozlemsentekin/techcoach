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

export default function TaskStatusBadge({ status }) {
  const { className, icon: Icon } = STATUS_STYLES[status] || STATUS_STYLES.bekliyor
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${className}`}>
      <Icon size={13} className="shrink-0" aria-hidden="true" />
      {STATUS_LABELS[status] || status}
    </span>
  )
}
