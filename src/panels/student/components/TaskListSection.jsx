import { useMemo, useState } from 'react'
import { ListChecks } from 'lucide-react'
import { getSortedTasks } from '../../../utils/taskSelectors'
import { getAssignmentStatus } from '../../../utils/assignmentStatus'
import { TASK_TYPES } from '../../../data/taskTypes'
import { addDaysISO, formatDateLong, todayISODate } from '../../../utils/time'
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
  { key: 'all', label: 'Tümü' },
  { key: 'pending', label: 'Bekleyen' },
  { key: 'done', label: 'Tamamlanan' },
]

const VIEW_MODES = [
  { key: 'time', label: 'Zamana Göre' },
  { key: 'subject', label: 'Derse Göre' },
]

const SUBJECT_ORDER = ['Türkçe', 'Matematik', 'Fen Bilimleri', 'T.C. İnkılap Tarihi', 'İngilizce', 'Din Kültürü']

function lessonLabelFor(task) {
  return task.subject || TASK_TYPES[task.taskType]?.label || 'Genel'
}

function dateGroupLabel(dateISO) {
  if (!dateISO) return 'Tarihsiz'
  const today = todayISODate()
  if (dateISO === today) return 'Bugün'
  if (dateISO === addDaysISO(today, 1)) return 'Yarın'
  if (dateISO === addDaysISO(today, -1)) return 'Dün'
  return formatDateLong(new Date(dateISO))
}

export default function TaskListSection({
  tasks,
  onComplete,
  onPartialComplete,
  onReschedule,
  onHelp,
  onAnswerSheetSaved,
  onSaveReadingProgress,
  onSaveQuestionCount,
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

  const filtered = sorted.filter((task) => {
    if (filter === 'all') return true
    return getAssignmentStatus(task).filterKey === filter
  })

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
    const byDate = new Map()
    filtered.forEach((task) => {
      const key = task.date || ''
      if (!byDate.has(key)) byDate.set(key, [])
      byDate.get(key).push(task)
    })
    let entries = [...byDate.entries()]
    if (filter === 'done') {
      entries = entries.reverse().map(([date, dateTasks]) => [date, [...dateTasks].reverse()])
    }
    return entries.map(([date, dateTasks]) => ({ label: dateGroupLabel(date), tasks: dateTasks }))
  }, [filtered, filter])

  const visibleGroups = viewMode === 'subject' ? grouped : groupedByDate

  return (
    <section className="panel-card overflow-hidden bg-panel-surface">
      <div className="student-theme-section-header flex flex-col gap-4 border-b border-student-theme-primary/20 bg-student-theme-primary/15 p-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="student-theme-section-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-panel-surface/80 text-student-theme-text shadow-sm">
            <ListChecks size={19} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="student-theme-section-title text-xl font-bold text-panel-text">Görev Akışı</h2>
            <p className="student-theme-section-muted mt-0.5 text-sm text-panel-text-muted">{filtered.length} görev görüntüleniyor</p>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-2 md:flex-row md:flex-wrap md:items-center xl:justify-end">
          <div className="student-theme-control-group flex w-full gap-1 overflow-x-auto rounded-xl border border-student-theme-primary/20 bg-panel-surface/85 p-1 shadow-sm md:w-auto md:overflow-visible" aria-label="Görev görünümü">
            {VIEW_MODES.map((item) => (
              <button
                key={item.key}
                type="button"
                aria-pressed={viewMode === item.key}
                onClick={() => setViewMode(item.key)}
                className={`student-theme-control-button h-9 shrink-0 rounded-lg px-3 text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-student-theme-primary ${
                  viewMode === item.key
                    ? 'bg-student-theme-primary text-student-theme-button-text shadow-sm'
                    : 'text-panel-text-muted hover:bg-student-theme-soft hover:text-student-theme-text'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="student-theme-control-group flex w-full gap-1 overflow-x-auto rounded-xl border border-student-theme-primary/20 bg-panel-surface/85 p-1 shadow-sm md:w-auto md:overflow-visible" aria-label="Görev durumu">
            {FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                aria-pressed={filter === item.key}
                onClick={() => setFilter(item.key)}
                className={`student-theme-control-button h-9 shrink-0 rounded-lg px-3 text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-student-theme-primary ${
                  filter === item.key
                    ? 'bg-student-theme-primary text-student-theme-button-text shadow-sm'
                    : 'text-panel-text-muted hover:bg-student-theme-soft hover:text-student-theme-text'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-5 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-student-theme-soft text-student-theme-text">
            <ListChecks size={22} aria-hidden="true" />
          </span>
          <h3 className="mt-4 text-lg font-semibold text-panel-text">Bu filtrede görev yok</h3>
          <p className="mt-1 max-w-sm text-sm text-panel-text-muted">Farklı bir filtre veya ders seçmeyi deneyebilirsin.</p>
        </div>
      ) : (
        <div className="border-t border-panel-border">
          {visibleGroups.map((group, index) => (
            <TaskGroupSection
              key={`${viewMode}-${filter}-${group.label}`}
              subject={group.label}
              tasks={group.tasks}
              onOpenDetails={openTask}
              showLessonLabel={viewMode === 'time'}
              getLessonLabel={viewMode === 'time' ? lessonLabelFor : undefined}
              emphasizeTime={viewMode === 'time'}
              defaultExpanded={viewMode === 'time' && filter === 'done' ? index === 0 : true}
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
