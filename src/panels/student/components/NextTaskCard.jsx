import { taskTimeState } from '../../../utils/time'
import { TASK_TYPES } from '../../../data/taskTypes'
import TaskTypeIcon from '../../shared/TaskTypeIcon'

function timeHint(task) {
  const { phase, minutesUntilStart, minutesPast } = taskTimeState(task)
  if (phase === 'upcoming') {
    return `Başlamasına ${minutesUntilStart} dakika kaldı.`
  }
  if (phase === 'past') {
    return minutesPast > 0
      ? 'Hazırsan şimdi başlayabilir veya yeni bir saat seçebilirsin.'
      : 'Şimdi başlama zamanı.'
  }
  return 'Şimdi başlama zamanı.'
}

export default function NextTaskCard({ currentTask, nextTask, onStart, onLater, onEdit, onHelp }) {
  if (!nextTask) {
    return (
      <div className="rounded-2xl border border-panel-border bg-panel-sage-soft p-6 text-center">
        <p className="text-base font-medium text-panel-text">
          Bugünün tüm görevlerini gözden geçirdin. Emeğini görüyoruz.
        </p>
      </div>
    )
  }

  const meta = TASK_TYPES[nextTask.taskType]

  return (
    <div className="flex flex-col gap-4">
      {currentTask ? (
        <div className="rounded-2xl border border-panel-border bg-panel-accent-soft p-4">
          <p className="text-sm font-medium text-panel-warm">Şu Anda</p>
          <p className="mt-1 text-base font-semibold text-panel-text">{currentTask.title}</p>
        </div>
      ) : null}

      <div className="rounded-2xl border border-panel-blue bg-panel-blue-soft p-6">
        <p className="text-sm font-medium text-panel-blue">Sıradaki Görev</p>
        <div className="mt-2 flex items-center gap-2">
          <TaskTypeIcon name={meta?.icon} className="text-panel-blue" />
          <h2 className="text-xl font-semibold text-panel-text">{nextTask.title}</h2>
        </div>
        <p className="mt-1 text-base text-panel-text-muted">
          {nextTask.startTime} – {nextTask.endTime}
          {nextTask.targetQuestionCount ? ` · Hedef: ${nextTask.targetQuestionCount} soru` : ''}
        </p>
        <p className="mt-2 text-sm text-panel-text-muted">{timeHint(nextTask)}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onStart(nextTask)}
            className="rounded-xl bg-panel-blue px-5 py-3 text-base font-semibold text-white"
          >
            {nextTask.startLabel || 'Derse Başla'}
          </button>
          <button
            type="button"
            onClick={() => onLater(nextTask)}
            className="rounded-xl border border-panel-border bg-white px-4 py-3 text-base font-medium text-panel-text"
          >
            Daha sonra başlat
          </button>
          <button
            type="button"
            onClick={() => onEdit(nextTask)}
            className="rounded-xl border border-panel-border bg-white px-4 py-3 text-base font-medium text-panel-text"
          >
            Planı düzenle
          </button>
          <button
            type="button"
            onClick={() => onHelp(nextTask)}
            className="rounded-xl border border-panel-border bg-white px-4 py-3 text-base font-medium text-panel-text"
          >
            Yardıma ihtiyacım var
          </button>
        </div>
      </div>
    </div>
  )
}
