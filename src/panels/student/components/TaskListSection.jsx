import { useMemo, useState } from 'react'
import { BookOpen, CheckCircle2, Circle, Clock, ListChecks, SlidersHorizontal } from 'lucide-react'
import { getSortedTasks } from '../../../utils/taskSelectors'
import { getAssignmentStatus } from '../../../utils/assignmentStatus'
import { TASK_TYPES, BREAK_TASK_TYPES, AUTO_COMPLETE_TASK_TYPES } from '../../../data/taskTypes'
import { addDaysISO, daysLate, formatDateLong, todayISODate } from '../../../utils/time'
import TaskGroupSection from './TaskGroupSection'
import TaskDetailsDrawer from './TaskDetailsDrawer'
import TaskAnswerSheetModal from './TaskAnswerSheetModal'
import ReadingProgressModal from './ReadingProgressModal'
import QuestionCountModal from './QuestionCountModal'

function isQuestionBankTask(task) {
  return task.resourceType === 'soru_bankasi' && Boolean(task.selectedTestIds?.length)
}

function isReadingTask(task) {
  return task.resourceType === 'okuma_kitabi'
}

const FILTERS = [
  { key: 'pending', label: 'Bekleyen', icon: Circle },
  { key: 'done', label: 'Tamamlanan', icon: CheckCircle2 },
]

const VIEW_MODES = [
  { key: 'time', label: 'Zamana Göre', icon: Clock },
  { key: 'subject', label: 'Derse Göre', icon: BookOpen },
]

const SUBJECT_ORDER = ['Türkçe', 'Matematik', 'Fen Bilimleri', 'T.C. İnkılap Tarihi', 'İngilizce', 'Din Kültürü']

function lessonLabelFor(task) {
  return task.subject || TASK_TYPES[task.taskType]?.label || 'Genel'
}

function isOverdueIncomplete(task) {
  // "Diğer" kategorisi görevleri (mola/yemek/serbest zaman/spor) süresi geçince sunucuda
  // otomatik tamamlanır; biriken görev olarak gösterilmezler.
  if (AUTO_COMPLETE_TASK_TYPES.has(task.taskType)) return false
  return daysLate(task.date) > 0 && !['tamamlandi', 'yeniden-planlandi'].includes(task.status)
}

function dateGroupLabel(dateISO) {
  if (!dateISO) return 'Tarihsiz'
  const today = todayISODate()
  if (dateISO === today) return 'Bugün'
  if (dateISO === addDaysISO(today, 1)) return 'Yarın'
  if (dateISO === addDaysISO(today, -1)) return 'Dün'
  return formatDateLong(new Date(dateISO))
}

function shouldExpandGroup({ filter, viewMode, index }) {
  if (viewMode === 'time' && filter === 'done') return index === 0
  return true
}

function SegmentedControl({ items, value, onChange, ariaLabel }) {
  return (
    <div className="student-theme-control-group flex min-w-0 gap-1 rounded-[12px] border border-white/15 bg-white/10 p-1" aria-label={ariaLabel}>
      {items.map((item) => {
        const Icon = item.icon
        const selected = value === item.key

        return (
          <button
            key={item.key}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(item.key)}
            className={`student-theme-control-button inline-flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-[9px] px-2.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-student-theme-primary sm:px-3 ${
              selected
                ? 'bg-panel-surface text-student-theme-text shadow-sm'
                : 'text-white/80 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Icon size={14} aria-hidden="true" />
            <span className="truncate">{item.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function ViewModeMenu({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const selected = VIEW_MODES.find((item) => item.key === value) || VIEW_MODES[0]

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
        title={`Gösterim şekli: ${selected.label}`}
        className="inline-flex h-10 w-10 items-center justify-center rounded-[12px] border border-white/15 bg-white/10 text-white/85 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <SlidersHorizontal size={17} aria-hidden="true" />
        <span className="sr-only">Gösterim şekli: {selected.label}</span>
      </button>

      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-44 rounded-[12px] border border-panel-border bg-panel-surface p-1 shadow-panel-2" role="menu">
          {VIEW_MODES.map((item) => {
            const Icon = item.icon
            const selectedItem = value === item.key

            return (
              <button
                key={item.key}
                type="button"
                role="menuitemradio"
                aria-checked={selectedItem}
                onClick={() => {
                  onChange(item.key)
                  setOpen(false)
                }}
                className={`flex h-9 w-full items-center gap-2 rounded-[9px] px-3 text-left text-sm font-semibold transition-colors ${
                  selectedItem
                    ? 'bg-student-theme-soft text-student-theme-text'
                    : 'text-panel-text-muted hover:bg-panel-surface-soft hover:text-panel-text'
                }`}
              >
                <Icon size={15} aria-hidden="true" />
                {item.label}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

export default function TaskListSection({
  tasks,
  onStartTimer,
  onComplete,
  onUndoComplete,
  onPartialComplete,
  onReschedule,
  onHelp,
  onAnswerSheetSaved,
  onSaveReadingProgress,
  onSaveQuestionCount,
  onSaveNotes,
}) {
  const [filter, setFilter] = useState('pending')
  const [viewMode, setViewMode] = useState('time')
  const [detailsTask, setDetailsTask] = useState(null)
  const [answerSheetTask, setAnswerSheetTask] = useState(null)
  const [readingTask, setReadingTask] = useState(null)
  const [questionCountTask, setQuestionCountTask] = useState(null)

  const openTask = (task) => {
    if (isQuestionBankTask(task)) {
      if (task.hasAnswerKey === false) setQuestionCountTask(task)
      else setAnswerSheetTask(task)
    } else if (isReadingTask(task)) setReadingTask(task)
    else setDetailsTask(task)
  }

  const sorted = useMemo(() => getSortedTasks(tasks), [tasks])

  const filtered = useMemo(
    () =>
      sorted.filter((task) => {
        if (filter === 'done' && BREAK_TASK_TYPES.has(task.taskType)) return false
        return getAssignmentStatus(task).filterKey === filter
      }),
    [filter, sorted],
  )

  const grouped = useMemo(() => {
    const byLabel = new Map()
    filtered.forEach((task) => {
      const label = lessonLabelFor(task)
      if (!byLabel.has(label)) byLabel.set(label, [])
      byLabel.get(label).push(task)
    })
    const knownOrder = SUBJECT_ORDER.filter((item) => byLabel.has(item))
    const extraOrder = [...byLabel.keys()].filter((label) => !knownOrder.includes(label))
    return [...knownOrder, ...extraOrder].map((label) => ({ label, tasks: byLabel.get(label) }))
  }, [filtered])

  const groupedByDate = useMemo(() => {
    const overdueTasks = filter === 'pending' ? filtered.filter(isOverdueIncomplete) : []
    const remaining = overdueTasks.length ? filtered.filter((task) => !isOverdueIncomplete(task)) : filtered

    const byDate = new Map()
    remaining.forEach((task) => {
      const key = task.date || ''
      if (!byDate.has(key)) byDate.set(key, [])
      byDate.get(key).push(task)
    })
    let entries = [...byDate.entries()]
    if (filter === 'done') {
      entries = entries.reverse().map(([date, dateTasks]) => [date, [...dateTasks].reverse()])
    }
    const dateGroups = entries.map(([date, dateTasks]) => ({ label: dateGroupLabel(date), date, tasks: dateTasks }))

    if (!overdueTasks.length) return dateGroups
    return [{ label: 'Geciken Görevler', date: null, tasks: overdueTasks, isOverdueGroup: true }, ...dateGroups]
  }, [filtered, filter])

  const visibleGroups = viewMode === 'subject' ? grouped : groupedByDate
  const highlightTaskId = viewMode === 'time' && filter === 'pending' ? filtered[0]?.id : null

  return (
    <section className="panel-card overflow-hidden bg-panel-surface">
      <div className="student-theme-flow-header px-3 py-3 sm:px-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="student-theme-section-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-white/10 text-white">
            <ListChecks size={18} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="student-theme-section-title text-lg font-bold leading-tight text-white sm:text-xl">Görev Akışı</h2>
            <p className="student-theme-section-muted text-xs font-medium sm:text-sm">
              {filtered.length} görev
            </p>
          </div>

          <div className="ml-auto flex min-w-0 items-center gap-2">
            <ViewModeMenu value={viewMode} onChange={setViewMode} />
            <SegmentedControl items={FILTERS} value={filter} onChange={setFilter} ariaLabel="Görev durumu" />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-5 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-[12px] bg-student-theme-soft text-student-theme-text">
            <ListChecks size={19} aria-hidden="true" />
          </span>
          <h3 className="mt-4 text-lg font-semibold text-panel-text">Bu filtrede görev yok</h3>
          <p className="mt-1 max-w-sm text-sm text-panel-text-muted">Farklı bir filtre veya ders seçmeyi deneyebilirsin.</p>
        </div>
      ) : (
        <div>
          {visibleGroups.map((group, index) => (
            <TaskGroupSection
              key={`${viewMode}-${filter}-${group.label}`}
              subject={group.label}
              tasks={group.tasks}
              onOpenDetails={openTask}
              onStartTimer={onStartTimer}
              onCompleteTask={onComplete}
              onUndoComplete={onUndoComplete}
              showLessonLabel={viewMode === 'time'}
              getLessonLabel={viewMode === 'time' ? lessonLabelFor : undefined}
              emphasizeTime={viewMode === 'time'}
              timeline={viewMode === 'time'}
              highlightTaskId={highlightTaskId}
              showDateOnCards={Boolean(group.isOverdueGroup)}
              defaultExpanded={shouldExpandGroup({ filter, viewMode, index })}
            />
          ))}
        </div>
      )}

      {detailsTask ? (
        <TaskDetailsDrawer
          task={detailsTask}
          lessonLabel={lessonLabelFor(detailsTask)}
          onClose={() => setDetailsTask(null)}
          onComplete={(task) => {
            onComplete(task)
            setDetailsTask(null)
          }}
          onPartialComplete={(task) => {
            onPartialComplete(task)
            setDetailsTask(null)
          }}
          onReschedule={(task) => {
            setDetailsTask(null)
            onReschedule(task)
          }}
          onHelp={(task) => {
            setDetailsTask(null)
            onHelp(task)
          }}
          onSaveNotes={async (task, notes) => {
            const updatedTask = await onSaveNotes(task, notes)
            if (updatedTask) setDetailsTask(updatedTask)
          }}
        />
      ) : null}

      {readingTask ? (
        <ReadingProgressModal
          task={readingTask}
          onClose={() => setReadingTask(null)}
          onSave={(payload) => {
            onSaveReadingProgress(readingTask, payload)
          }}
        />
      ) : null}

      {answerSheetTask ? (
        <TaskAnswerSheetModal
          task={answerSheetTask}
          lessonLabel={lessonLabelFor(answerSheetTask)}
          onClose={() => setAnswerSheetTask(null)}
          onSaved={(updatedTask) => {
            onAnswerSheetSaved(updatedTask)
            setAnswerSheetTask(updatedTask)
          }}
        />
      ) : null}

      {questionCountTask ? (
        <QuestionCountModal
          task={questionCountTask}
          onClose={() => setQuestionCountTask(null)}
          onSave={(payload) => {
            onSaveQuestionCount(questionCountTask, payload)
          }}
        />
      ) : null}
    </section>
  )
}
