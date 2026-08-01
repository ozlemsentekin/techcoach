import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { getSortedTasks } from '../../../utils/taskSelectors'
import { getAssignmentStatus } from '../../../utils/assignmentStatus'
import { TASK_TYPES } from '../../../data/taskTypes'
import TaskGroupSection from './TaskGroupSection'
import TaskDetailsDrawer from './TaskDetailsDrawer'
import TaskAnswerSheetModal from './TaskAnswerSheetModal'
import ReadingProgressModal from './ReadingProgressModal'
import QuestionCountModal from './QuestionCountModal'
import EmptyState from '../../shared/EmptyState'

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

const DATE_FILTERS = [
  { key: 'today', label: 'Bugün' },
  { key: 'week', label: 'Bu Hafta' },
  { key: 'month', label: 'Bu Ay' },
]

const SUBJECTS = ['Tüm Dersler', 'Türkçe', 'Matematik', 'Fen Bilimleri', 'T.C. İnkılap Tarihi', 'İngilizce', 'Din Kültürü']

function lessonLabelFor(task) {
  return task.subject || TASK_TYPES[task.taskType]?.label || 'Genel'
}

export default function TaskListSection({
  tasks,
  dateFilter,
  onDateFilterChange,
  loadingRange = false,
  onComplete,
  onPartialComplete,
  onReschedule,
  onHelp,
  onAnswerSheetSaved,
  onSaveReadingProgress,
  onSaveQuestionCount,
}) {
  const [filter, setFilter] = useState('pending')
  const [subject, setSubject] = useState('Tüm Dersler')
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
    if (subject !== 'Tüm Dersler' && task.subject !== subject) return false
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
    const knownOrder = SUBJECTS.filter((item) => item !== 'Tüm Dersler' && byLabel.has(item))
    const extraOrder = [...byLabel.keys()].filter((label) => !knownOrder.includes(label))
    return [...knownOrder, ...extraOrder].map((label) => ({ label, tasks: byLabel.get(label) }))
  }, [filtered])

  return (
    <div className="panel-card flex flex-col gap-5 bg-panel-surface p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-bold text-panel-text sm:text-2xl">Görevlerim</h2>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex gap-2 overflow-x-auto pb-1 sm:overflow-visible sm:pb-0">
            {FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                aria-pressed={filter === item.key}
                onClick={() => setFilter(item.key)}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-student-theme-primary ${
                  filter === item.key
                    ? 'border-student-theme-primary bg-student-theme-primary text-student-theme-button-text'
                    : 'border-panel-border bg-panel-surface text-panel-text-muted hover:border-student-theme-primary hover:bg-student-theme-soft hover:text-student-theme-text'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <select
              value={dateFilter}
              onChange={(event) => onDateFilterChange(event.target.value)}
              aria-label="Zamana göre filtrele"
              className="w-full appearance-none rounded-full border border-panel-border bg-panel-surface py-2 pl-4 pr-9 text-sm font-medium text-panel-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-student-theme-primary sm:w-auto"
            >
              {DATE_FILTERS.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
            <ChevronDown
              size={16}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-panel-text-muted"
              aria-hidden="true"
            />
          </div>

          <div className="relative">
            <select
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              aria-label="Derse göre filtrele"
              className="w-full appearance-none rounded-full border border-panel-border bg-panel-surface py-2 pl-4 pr-9 text-sm font-medium text-panel-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-student-theme-primary sm:w-auto"
            >
              {SUBJECTS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <ChevronDown
              size={16}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-panel-text-muted"
              aria-hidden="true"
            />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        loadingRange ? (
          <EmptyState title="Görevler yükleniyor..." description="Seçtiğin zaman aralığındaki görevler getiriliyor." />
        ) : (
          <EmptyState title="Bu filtrede görev yok" description="Farklı bir filtre veya ders seçmeyi deneyebilirsin." />
        )
      ) : (
        <div className="flex flex-col gap-4">
          {grouped.map((group) => (
            <TaskGroupSection
              key={group.label}
              subject={group.label}
              tasks={group.tasks}
              onOpenDetails={openTask}
              showDate={dateFilter !== 'today'}
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
    </div>
  )
}
