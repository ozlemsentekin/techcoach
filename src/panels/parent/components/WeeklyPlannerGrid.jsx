import { useEffect, useRef, useState } from 'react'
import { BookOpen, Calculator, ChevronDown, Coffee, FlaskConical, Library, ListChecks, NotebookPen, Plus, Star, UploadCloud } from 'lucide-react'
import { todayISODate } from '../../../utils/time'

const BREAK_DURATION_OPTIONS = [15, 30, 45, 60]

const DAY_LABELS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']

const QUICK_ADD_TEMPLATES = {
  lesson: {
    label: 'Ders',
    task: {
      title: 'Ders',
      taskType: 'ders-calisma',
      startTime: '15:00',
      endTime: '16:00',
      durationMinutes: 60,
      description: 'Online veya yüz yüze ders.',
    },
  },
  break: {
    label: 'Mola',
    task: {
      title: 'Mola',
      taskType: 'mola',
      startTime: '11:00',
      endTime: '11:30',
      durationMinutes: 30,
    },
  },
  activity: {
    label: 'Serbest Zaman',
    task: {
      title: 'Serbest Zaman',
      taskType: 'serbest-zaman',
      startTime: '18:00',
      endTime: '19:00',
      durationMinutes: 60,
    },
  },
}

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
  lesson: {
    icon: BookOpen,
    card: 'border-violet-100 bg-violet-50/70',
    iconClassName: 'bg-violet-100 text-panel-blue',
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
  if (task.taskType === 'ders-calisma' && searchText.includes('ders')) return TASK_STYLES.lesson

  return TASK_STYLES.default
}

function formatTaskTime(task) {
  if (task.startTime && task.endTime) return `${task.startTime} – ${task.endTime}`
  return task.startTime || task.endTime || 'Saat eklenmedi'
}

// Ders/ödev kartlarında görev adı çoğu zaman genel bir kalıptır (örn. "Matematik Ödevi");
// asıl neyin çalışılacağını konu (topic) ya da ödev notu (description) taşır, bu yüzden
// kartta ikinci bir satır olarak bunu gösteriyoruz.
function getTaskDetail(task) {
  if (task.topic) return task.subject ? `${task.subject} · ${task.topic}` : task.topic
  if (task.description) return task.description
  return null
}

function getTaskSource(task) {
  const parts = [task.publisherName, task.resourceBookName].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}

function getTaskProgress(task) {
  if (task.targetQuestionCount) return `${task.completedQuestionCount || 0}/${task.targetQuestionCount} soru`
  if (task.targetPageCount) return `${task.completedPageCount || 0}/${task.targetPageCount} sayfa`
  return null
}

function QuickBreakMenu({ task, onPick, onClose }) {
  const menuRef = useRef(null)
  const [customValue, setCustomValue] = useState('')

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) onClose()
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [onClose])

  const handleCustomSubmit = (event) => {
    event.preventDefault()
    const minutes = Number(customValue)
    if (minutes > 0) onPick(minutes)
  }

  return (
    <div
      ref={menuRef}
      onClick={(event) => event.stopPropagation()}
      className="absolute right-0 top-full z-20 mt-1 w-40 rounded-xl border border-panel-border bg-panel-surface p-2 shadow-lg"
    >
      <p className="px-1 pb-1.5 text-[11px] font-bold text-panel-text-muted">
        {formatTaskTime(task).split(' – ')[1] || ''} sonrasına mola
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {BREAK_DURATION_OPTIONS.map((minutes) => (
          <button
            key={minutes}
            type="button"
            onClick={() => onPick(minutes)}
            className="rounded-lg border border-amber-100 bg-amber-50/70 px-2 py-1.5 text-xs font-bold text-panel-warm transition-colors duration-150 hover:bg-amber-100/70"
          >
            {minutes} dk
          </button>
        ))}
      </div>
      <form onSubmit={handleCustomSubmit} className="mt-1.5 flex items-center gap-1">
        <input
          type="number"
          min="1"
          value={customValue}
          onChange={(event) => setCustomValue(event.target.value)}
          placeholder="Özel"
          className="h-8 w-full min-w-0 rounded-lg border border-panel-border px-2 text-xs font-semibold text-panel-text focus:border-panel-blue focus:outline-none"
        />
        <button
          type="submit"
          disabled={!(Number(customValue) > 0)}
          className="h-8 shrink-0 rounded-lg border border-panel-blue-soft bg-panel-blue-soft/60 px-2 text-xs font-bold text-panel-blue transition-colors duration-150 hover:bg-panel-blue-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          Ekle
        </button>
      </form>
    </div>
  )
}

function TaskCard({ task, onEditTask, onQuickAddBreak }) {
  const style = getTaskStyle(task)
  const Icon = style.icon
  const [showBreakMenu, setShowBreakMenu] = useState(false)
  const canAddBreak = typeof onQuickAddBreak === 'function' && !['mola', 'dinlenme'].includes(task.taskType) && Boolean(task.endTime)
  const detail = getTaskDetail(task)
  const source = getTaskSource(task)
  const progress = getTaskProgress(task)

  const handlePick = (minutes) => {
    setShowBreakMenu(false)
    onQuickAddBreak(task, minutes)
  }

  return (
    <div
      className={`group relative flex min-h-[60px] w-full flex-col gap-1.5 rounded-xl border px-2.5 py-2 shadow-[0_1px_4px_rgba(49,42,92,0.06)] transition duration-150 hover:-translate-y-0.5 hover:shadow-sm ${showBreakMenu ? 'z-30' : ''} ${style.card}`}
    >
      <div className="flex items-stretch gap-1">
        <button
          type="button"
          onClick={() => onEditTask(task)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${style.iconClassName}`}>
            <Icon size={21} strokeWidth={2.2} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center justify-between gap-1">
              <span className={`block text-[11px] font-bold leading-tight ${style.timeClassName}`}>
                {formatTaskTime(task)}
              </span>
              {task.durationMinutes ? (
                <span className="shrink-0 text-[10px] font-semibold text-panel-text-muted">{task.durationMinutes} dk</span>
              ) : null}
            </span>
            <span className={`mt-1 block break-words text-xs font-bold leading-snug ${style.titleClassName}`}>
              {task.title}
            </span>
          </span>
        </button>

        {canAddBreak ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              setShowBreakMenu((current) => !current)
            }}
            title="Bu dersin ardına mola ekle"
            aria-expanded={showBreakMenu}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-panel-text-muted opacity-0 transition-colors duration-150 hover:bg-amber-100/70 hover:text-panel-warm focus-visible:opacity-100 group-hover:opacity-100"
          >
            <Coffee size={15} aria-hidden="true" />
          </button>
        ) : null}

        {canAddBreak && showBreakMenu ? (
          <QuickBreakMenu task={task} onPick={handlePick} onClose={() => setShowBreakMenu(false)} />
        ) : null}
      </div>

      {detail ? (
        <p className="line-clamp-2 break-words pl-11 text-[11px] font-medium leading-snug text-panel-text-muted">{detail}</p>
      ) : null}

      {source || progress ? (
        <div className="flex flex-wrap items-center gap-1 pl-11">
          {source ? (
            <span
              title={source}
              className="inline-flex max-w-full items-center gap-1 rounded-md bg-white/60 px-1.5 py-0.5 text-[10px] font-semibold text-panel-text-muted"
            >
              <Library size={11} className="shrink-0" aria-hidden="true" />
              <span className="truncate">{source}</span>
            </span>
          ) : null}
          {progress ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-white/60 px-1.5 py-0.5 text-[10px] font-semibold text-panel-text-muted">
              <ListChecks size={11} aria-hidden="true" />
              {progress}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export default function WeeklyPlannerGrid({ weekDates, tasksByDate, dayStatusByDate, onAddHomework, onAddTask, onEditTask, onPublishDay, onQuickAddBreak }) {
  const [expandedActionDate, setExpandedActionDate] = useState(null)
  const currentDate = todayISODate()

  const handleAddHomework = (date) => {
    if (date < currentDate) return
    setExpandedActionDate(null)
    onAddHomework(date)
  }

  const handleAddTask = (date, initialTemplate) => {
    if (date < currentDate || typeof onAddTask !== 'function') return
    setExpandedActionDate(null)
    onAddTask(date, initialTemplate)
  }

  const handlePublishDay = (date) => {
    setExpandedActionDate(null)
    onPublishDay(date)
  }

  return (
    <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {weekDates.map((date, index) => {
        const tasks = [...(tasksByDate[date] || [])].sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))
        const isPastDay = date < currentDate
        const isActionsExpanded = expandedActionDate === date && !isPastDay
        const dayStatus = dayStatusByDate?.[date]
        const hasPendingDraft = dayStatus === 'taslak'

        return (
          <div
            key={date}
            className="flex min-h-[32rem] min-w-0 flex-col rounded-2xl border border-panel-border bg-panel-surface shadow-[0_2px_10px_rgba(49,42,92,0.06)] lg:min-h-[38rem]"
          >
            <div className="rounded-t-2xl border-b border-panel-blue-soft bg-panel-blue-soft px-3 py-4 text-center">
              <p className="break-words text-base font-extrabold leading-tight text-panel-text">{DAY_LABELS[index]}</p>
              <p className="mt-1 break-words text-sm font-bold leading-tight text-panel-blue">{formatDayDate(date)}</p>
              {hasPendingDraft ? (
                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                  Taslak · Yayınlanmadı
                </span>
              ) : null}
            </div>

            <div className="flex flex-1 flex-col px-3 py-4">
              <div className="flex flex-1 flex-col gap-2">
                {tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onEditTask={onEditTask}
                    onQuickAddBreak={
                      isPastDay || typeof onQuickAddBreak !== 'function'
                        ? undefined
                        : (pickedTask, minutes) => onQuickAddBreak(date, pickedTask, minutes)
                    }
                  />
                ))}
              </div>

              <div className="mt-4 grid gap-2">
                <button
                  type="button"
                  onClick={() => handleAddHomework(date)}
                  disabled={isPastDay}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-panel-blue-soft bg-panel-surface px-3 text-sm font-bold text-panel-blue shadow-sm transition-colors duration-150 hover:bg-panel-blue-soft/60 disabled:cursor-not-allowed disabled:border-panel-border disabled:bg-panel-surface-soft disabled:text-panel-text-muted disabled:shadow-none disabled:hover:bg-panel-surface-soft"
                >
                  <Plus size={18} aria-hidden="true" />
                  Ödev Ekle
                </button>

                {typeof onAddTask === 'function' ? (
                  <button
                    type="button"
                    aria-expanded={isActionsExpanded}
                    onClick={() => setExpandedActionDate(isActionsExpanded ? null : date)}
                    disabled={isPastDay}
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-panel-border bg-panel-surface px-3 text-xs font-bold text-panel-text shadow-sm transition-colors duration-150 hover:bg-panel-surface-soft disabled:cursor-not-allowed disabled:bg-panel-surface-soft disabled:text-panel-text-muted disabled:shadow-none"
                  >
                    Diğer
                    <ChevronDown
                      size={16}
                      className={`transition-transform duration-150 ${isActionsExpanded ? 'rotate-180' : ''}`}
                      aria-hidden="true"
                    />
                  </button>
                ) : null}

                {isActionsExpanded ? (
                  <div className="grid gap-2 rounded-xl border border-panel-border bg-panel-surface-soft p-2">
                    {hasPendingDraft ? (
                      <button
                        type="button"
                        onClick={() => handlePublishDay(date)}
                        className="flex h-10 min-w-0 items-center justify-start gap-2 rounded-lg border border-panel-blue-soft bg-panel-blue-soft/60 px-3 text-xs font-bold text-panel-blue transition-colors duration-150 hover:bg-panel-blue-soft"
                      >
                        <UploadCloud size={16} aria-hidden="true" />
                        <span className="min-w-0 truncate">Bu Günü Yayımla</span>
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => handleAddTask(date, QUICK_ADD_TEMPLATES.lesson)}
                      className="flex h-10 min-w-0 items-center justify-start gap-2 rounded-lg border border-violet-100 bg-violet-50/80 px-3 text-xs font-bold text-panel-blue transition-colors duration-150 hover:bg-violet-100/70"
                    >
                      <BookOpen size={16} aria-hidden="true" />
                      <span className="min-w-0 truncate">Ders Ekle</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleAddTask(date, QUICK_ADD_TEMPLATES.break)}
                      className="flex h-10 min-w-0 items-center justify-start gap-2 rounded-lg border border-amber-100 bg-amber-50/70 px-3 text-xs font-bold text-panel-warm transition-colors duration-150 hover:bg-amber-100/70"
                    >
                      <Coffee size={16} aria-hidden="true" />
                      <span className="min-w-0 truncate">Mola Ekle</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleAddTask(date, QUICK_ADD_TEMPLATES.activity)}
                      className="flex h-10 min-w-0 items-center justify-start gap-2 rounded-lg border border-emerald-100 bg-emerald-50/80 px-3 text-xs font-bold text-emerald-700 transition-colors duration-150 hover:bg-emerald-100/70"
                    >
                      <Star size={16} aria-hidden="true" />
                      <span className="min-w-0 truncate">Aktivite Ekle</span>
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
