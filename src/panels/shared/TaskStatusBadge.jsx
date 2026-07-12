import { STATUS_LABELS } from '../../data/taskTypes'

const STATUS_STYLES = {
  bekliyor: 'bg-panel-blue-soft text-panel-blue',
  'devam-ediyor': 'bg-panel-accent-soft text-panel-warm',
  tamamlandi: 'bg-panel-sage-soft text-panel-sage',
  'kismen-tamamlandi': 'bg-panel-sage-soft text-panel-sage',
  'yeniden-planlandi': 'bg-panel-lilac-soft text-panel-lilac',
  'yardim-bekliyor': 'bg-panel-accent-soft text-panel-warm',
}

export default function TaskStatusBadge({ status }) {
  const style = STATUS_STYLES[status] || 'bg-panel-blue-soft text-panel-blue'
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${style}`}>
      {STATUS_LABELS[status] || status}
    </span>
  )
}
