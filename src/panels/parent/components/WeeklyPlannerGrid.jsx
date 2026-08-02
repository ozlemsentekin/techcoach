import { BookOpen, Calculator, Coffee, FlaskConical, NotebookPen, Plus, Star } from 'lucide-react'

const DAY_LABELS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']

const TASK_STYLES = {
  turkish: {
    icon: BookOpen,
    card: 'border-sky-100 bg-sky-50/70',
    iconClassName: 'bg-sky-100 text-sky-500',
    timeClassName: 'text-panel-blue',
    titleClassName: 'text-panel-text',
  },
  math: {
    icon: Calculator,
    card: 'border-orange-100 bg-orange-50/75',
    iconClassName: 'bg-orange-100 text-orange-500',
    timeClassName: 'text-panel-blue',
    titleClassName: 'text-panel-text',
  },
  science: {
    icon: FlaskConical,
    card: 'border-teal-100 bg-teal-50/75',
    iconClassName: 'bg-teal-100 text-teal-600',
    timeClassName: 'text-panel-blue',
    titleClassName: 'text-panel-text',
  },
  break: {
    icon: Coffee,
    card: 'border-amber-100 bg-amber-50/80',
    iconClassName: 'bg-amber-100 text-orange-500',
    timeClassName: 'text-panel-blue',
    titleClassName: 'text-panel-text',
  },
  free: {
    icon: Star,
    card: 'border-emerald-100 bg-emerald-50/80',
    iconClassName: 'bg-emerald-100 text-emerald-600',
    timeClassName: 'text-panel-blue',
    titleClassName: 'text-emerald-700',
  },
  default: {
    icon: NotebookPen,
    card: 'border-panel-border bg-panel-surface',
    iconClassName: 'bg-panel-blue-soft text-panel-blue',
    timeClassName: 'text-panel-blue',
    titleClassName: 'text-panel-text',
  },
}

function formatDayDate(dateISO) {
  return new Date(dateISO).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })
}

function normalizeText(value) {
  return value.toLocaleLowerCase('tr-TR')
}

function getTaskStyle(task) {
  if (['mola', 'dinlenme'].includes(task.taskType)) return TASK_STYLES.break
  if (task.taskType === 'serbest-zaman') return TASK_STYLES.free

  const searchText = normalizeText(`${task.subject || ''} ${task.title || ''}`)
  if (searchText.includes('matematik')) return TASK_STYLES.math
  if (searchText.includes('fen')) return TASK_STYLES.science
  if (searchText.includes('türkçe') || searchText.includes('turkce')) return TASK_STYLES.turkish

  return TASK_STYLES.default
}

function formatTaskTime(task) {
  if (task.startTime && task.endTime) return `${task.startTime} – ${task.endTime}`
  return task.startTime || task.endTime || 'Saat eklenmedi'
}

function TaskCard({ task, onEditTask }) {
  const style = getTaskStyle(task)
  const Icon = style.icon

  return (
    <button
      type="button"
      onClick={() => onEditTask(task)}
      className={`flex min-h-[60px] w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left shadow-[0_1px_4px_rgba(49,42,92,0.06)] transition duration-150 hover:-translate-y-0.5 hover:shadow-sm ${style.card}`}
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${style.iconClassName}`}>
        <Icon size={21} strokeWidth={2.2} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[11px] font-bold leading-tight ${style.timeClassName}`}>
          {formatTaskTime(task)}
        </span>
        <span className={`mt-1 block break-words text-xs font-bold leading-snug ${style.titleClassName}`}>
          {task.title}
        </span>
      </span>
    </button>
  )
}

export default function WeeklyPlannerGrid({ weekDates, tasksByDate, onAddTask, onEditTask }) {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
      {weekDates.map((date, index) => {
        const tasks = [...(tasksByDate[date] || [])].sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))

        return (
          <div
            key={date}
            className="flex min-h-[30rem] min-w-0 flex-col overflow-hidden rounded-2xl border border-panel-border bg-panel-surface shadow-[0_2px_10px_rgba(49,42,92,0.06)] lg:min-h-[36rem]"
          >
            <div className="border-b border-panel-blue-soft bg-panel-blue-soft px-3 py-4 text-center">
              <p className="break-words text-base font-extrabold leading-tight text-panel-text">{DAY_LABELS[index]}</p>
              <p className="mt-1 break-words text-sm font-bold leading-tight text-panel-blue">{formatDayDate(date)}</p>
            </div>

            <div className="flex flex-1 flex-col px-3 py-4">
              <div className="flex flex-1 flex-col gap-2">
                {tasks.map((task) => (
                  <TaskCard key={task.id} task={task} onEditTask={onEditTask} />
                ))}
              </div>

              <button
                type="button"
                onClick={() => onAddTask(date)}
                className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-panel-blue-soft bg-panel-surface px-3 text-sm font-bold text-panel-blue shadow-sm transition-colors duration-150 hover:bg-panel-blue-soft/60"
              >
                <Plus size={18} aria-hidden="true" />
                Görev Ekle
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
