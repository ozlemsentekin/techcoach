import { TASK_TYPES, FOCUS_TASK_TYPES } from '../../../data/taskTypes'
import TaskTypeIcon from '../../shared/TaskTypeIcon'
import TaskStatusBadge from '../../shared/TaskStatusBadge'

const TERMINAL_STATUSES = new Set(['tamamlandi', 'kismen-tamamlandi', 'yeniden-planlandi'])

const ICON_BADGE_CLASSES = {
  blue: 'bg-panel-blue-soft text-panel-blue',
  sage: 'bg-panel-sage-soft text-panel-sage',
  lilac: 'bg-panel-lilac-soft text-panel-lilac',
  accent: 'bg-panel-accent-soft text-panel-warm',
}

export default function TaskCard({ task, onStart, onComplete, onPartialComplete, onReschedule, onHelp }) {
  const meta = TASK_TYPES[task.taskType] || {}
  const isFocusType = FOCUS_TASK_TYPES.has(task.taskType) || task.taskType === 'gunluk-degerlendirme'
  const isTerminal = TERMINAL_STATUSES.has(task.status)

  return (
    <div className="flex gap-4 rounded-2xl border border-panel-border bg-panel-surface p-4">
      <div
        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          ICON_BADGE_CLASSES[meta.color] || ICON_BADGE_CLASSES.blue
        }`}
      >
        <TaskTypeIcon name={meta.icon} size={18} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-panel-text-muted">
            {task.startTime} – {task.endTime}
          </p>
          <TaskStatusBadge status={task.status} />
        </div>
        <h3 className="mt-1 text-base font-semibold text-panel-text">{task.title}</h3>
        <p className="mt-1 text-sm text-panel-text-muted">{task.description}</p>
        {task.targetQuestionCount ? (
          <p className="mt-1 text-sm text-panel-text-muted">Hedef: {task.targetQuestionCount} soru</p>
        ) : null}

        {task.status === 'bekliyor' || task.status === 'devam-ediyor' ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onStart(task)}
              className="rounded-lg bg-panel-blue px-3 py-2 text-sm font-semibold text-white"
            >
              {task.status === 'devam-ediyor' && isFocusType ? 'Devam Et' : task.startLabel || 'Başlat'}
            </button>
            {!isFocusType ? (
              <button
                type="button"
                onClick={() => onComplete(task)}
                className="rounded-lg border border-panel-border px-3 py-2 text-sm font-medium text-panel-text"
              >
                Tamamladım
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onPartialComplete(task)}
              className="rounded-lg border border-panel-border px-3 py-2 text-sm font-medium text-panel-text"
            >
              Kısmen tamamladım
            </button>
            <button
              type="button"
              onClick={() => onReschedule(task)}
              className="rounded-lg border border-panel-border px-3 py-2 text-sm font-medium text-panel-text"
            >
              Yarına / başka saate taşı
            </button>
            <button
              type="button"
              onClick={() => onHelp(task)}
              className="rounded-lg border border-panel-border px-3 py-2 text-sm font-medium text-panel-text"
            >
              Yardıma ihtiyacım var
            </button>
          </div>
        ) : null}

        {isTerminal && task.completionMessage ? (
          <p className="mt-2 text-sm text-panel-sage">{task.completionMessage}</p>
        ) : null}
        {task.status === 'yeniden-planlandi' && task.rescheduledTo ? (
          <p className="mt-2 text-sm text-panel-lilac">{task.rescheduledTo.split(' ')[0]} tarihine taşındı.</p>
        ) : null}
      </div>
    </div>
  )
}
