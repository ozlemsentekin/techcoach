import { TASK_TYPES } from '../../../data/taskTypes'
import { formatDateShort } from '../../../utils/time'
import { totalAcademicMinutes } from '../../../services/weeklyPlanService'

const DAY_LABELS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']

const CHIP_CLASSES = {
  blue: 'bg-panel-blue-soft text-panel-blue',
  sage: 'bg-panel-sage-soft text-panel-sage',
  lilac: 'bg-panel-lilac-soft text-panel-lilac',
  accent: 'bg-panel-accent-soft text-panel-warm',
}

function dayMetrics(tasks) {
  const academicMinutes = totalAcademicMinutes(tasks)
  const testCount = tasks.filter((task) => ['test-cozme', 'deneme-sinavi'].includes(task.taskType)).length
  const restMinutes = tasks
    .filter((task) => ['mola', 'dinlenme'].includes(task.taskType))
    .reduce((sum, task) => sum + (task.durationMinutes || 0), 0)
  const freeMinutes = tasks
    .filter((task) => task.taskType === 'serbest-zaman')
    .reduce((sum, task) => sum + (task.durationMinutes || 0), 0)
  return { academicMinutes, testCount, restMinutes, freeMinutes }
}

export default function WeeklyPlannerGrid({ weekDates, tasksByDate, onAddTask, onEditTask }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
      {weekDates.map((date, index) => {
        const tasks = [...(tasksByDate[date] || [])].sort((a, b) => a.startTime.localeCompare(b.startTime))
        const metrics = dayMetrics(tasks)

        return (
          <div key={date} className="flex flex-col gap-2 rounded-2xl border border-panel-border bg-panel-surface p-3">
            <div>
              <p className="text-sm font-semibold text-panel-text">{DAY_LABELS[index]}</p>
              <p className="text-xs text-panel-text-muted">{formatDateShort(date)}</p>
            </div>

            <div className="flex flex-wrap gap-1 text-[11px] text-panel-text-muted">
              <span>{metrics.academicMinutes} dk çalışma</span>
              <span>· {metrics.testCount} test</span>
              <span>· {metrics.restMinutes} dk mola</span>
              <span>· {metrics.freeMinutes} dk serbest</span>
            </div>

            <div className="flex min-h-[80px] flex-col gap-1.5">
              {tasks.map((task) => {
                const meta = TASK_TYPES[task.taskType] || {}
                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => onEditTask(task)}
                    className={`rounded-lg px-2 py-1.5 text-left text-xs font-medium ${CHIP_CLASSES[meta.color] || CHIP_CLASSES.blue}`}
                  >
                    {task.startTime} {task.title}
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              onClick={() => onAddTask(date)}
              className="rounded-lg border border-dashed border-panel-border px-2 py-1.5 text-xs font-medium text-panel-text-muted hover:bg-panel-bg"
            >
              + Görev Ekle
            </button>
          </div>
        )
      })}
    </div>
  )
}
