import {
  ArrowRight,
  Circle,
  Timer,
  CheckCircle2,
  Eye,
  HelpCircle,
  RotateCcw,
  AlertTriangle,
  Clock,
  Coffee,
  Utensils,
} from 'lucide-react'
import { getAssignmentStatus } from '../../../utils/assignmentStatus'
import { parseAssignmentDetails } from '../../../utils/assignmentDetails'
import { daysLate, formatDateShort } from '../../../utils/time'
import { SUBJECT_STYLES, DEFAULT_SUBJECT_STYLE } from './subjectStyles'

const STATUS_ICONS = { Circle, Timer, CheckCircle2, Eye, HelpCircle, RotateCcw, AlertTriangle }

const STATUS_TONE_CLASSES = {
  theme: 'bg-student-theme-soft text-student-theme-text',
  sage: 'bg-panel-sage-soft text-panel-sage',
  yellow: 'bg-panel-yellow-soft text-panel-yellow',
  accent: 'bg-panel-accent-soft text-panel-warm',
  slate: 'bg-panel-slate-soft text-panel-slate',
  red: 'bg-panel-red-soft text-panel-red',
}

const BREAK_TASK_TYPES = new Set(['mola', 'dinlenme', 'yemek', 'yemek-dinlenme'])
const BREAK_STYLE = { text: 'text-panel-sage', soft: 'bg-panel-sage-soft', border: 'border-l-panel-sage' }
const FREE_TIME_STYLE = { text: 'text-panel-accent', soft: 'bg-panel-accent-soft', border: 'border-l-panel-accent' }

function BreakTypeIcon({ taskType, size = 16 }) {
  if (taskType === 'yemek' || taskType === 'yemek-dinlenme') {
    return <Utensils size={size} aria-hidden="true" />
  }

  return <Coffee size={size} aria-hidden="true" />
}

function getPrimaryText(task, details) {
  if (details.kaynak) {
    return `${task.publisherName ? `${task.publisherName} - ` : ''}${details.kaynak}`
  }
  return details.rawText || task.title || 'Görev'
}

function getSecondaryItems(details) {
  if (details.testGroups.length) {
    return details.testGroups.slice(0, 3).map((item) => {
      if (item.topic && item.testName) return `${item.topic}: ${item.testName}`
      return item.topic || item.testName
    })
  }
  if (details.testTopic || details.testName) {
    return [`${details.testTopic || ''}${details.testTopic && details.testName ? ': ' : ''}${details.testName || ''}`]
  }
  return []
}

export default function TaskListCard({ task, lessonLabel, onOpenDetails, showLessonLabel = true, emphasizeTime = false }) {
  const isBreakTask = BREAK_TASK_TYPES.has(task.taskType)
  const isFreeTimeTask = task.taskType === 'serbest-zaman'
  const subjectStyle = isBreakTask
    ? BREAK_STYLE
    : isFreeTimeTask
      ? FREE_TIME_STYLE
      : SUBJECT_STYLES[task.subject] || DEFAULT_SUBJECT_STYLE
  const details = parseAssignmentDetails(task)
  const overdueDays = daysLate(task.date)
  const isActive = task.status === 'bekliyor' || task.status === 'devam-ediyor' || task.status === 'yardim-bekliyor'

  let status = getAssignmentStatus(task)
  if (isActive && overdueDays > 0) {
    status = { ...status, label: 'Gecikti', tone: 'red', icon: 'AlertTriangle' }
  }
  const StatusIcon = STATUS_ICONS[status.icon]

  const isReading = task.resourceType === 'okuma_kitabi'
  const completed = isReading ? task.completedPageCount || 0 : task.completedQuestionCount || 0
  const total = isReading ? task.targetPageCount || 0 : task.targetQuestionCount || 0
  const unit = isReading ? 'sayfa' : 'soru'
  const showProgress = total > 0
  const progressPct = task.status === 'tamamlandi' ? 100 : total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0
  const secondaryItems = getSecondaryItems(details)
  const displayLessonLabel = String(lessonLabel || '').toLocaleUpperCase('tr-TR')
  const isCompletedStatus = status.filterKey === 'done'
  const actionLabel = isBreakTask ? 'Mola Detayı' : 'İşlem Yap'

  const handleCardKeyDown = (event) => {
    if (!isFreeTimeTask) return
    if (event.key !== 'Enter' && event.key !== ' ') return

    event.preventDefault()
    onOpenDetails(task)
  }

  return (
    <article
      role={isFreeTimeTask ? 'button' : undefined}
      tabIndex={isFreeTimeTask ? 0 : undefined}
      onClick={isFreeTimeTask ? () => onOpenDetails(task) : undefined}
      onKeyDown={handleCardKeyDown}
      aria-label={isFreeTimeTask ? `${task.title} detayını aç` : undefined}
      className={`grid gap-4 border-l-4 ${subjectStyle.border} px-4 py-4 transition-colors sm:px-5 lg:items-center ${
        isFreeTimeTask ? 'lg:grid-cols-[minmax(0,1fr)] cursor-pointer bg-panel-accent-soft/35 hover:bg-panel-accent-soft/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panel-accent' : 'lg:grid-cols-[minmax(0,1fr)_180px_auto]'
      } ${
        isBreakTask ? 'bg-panel-sage-soft/35 hover:bg-panel-sage-soft/60' : !isFreeTimeTask ? 'bg-panel-surface hover:bg-panel-surface-soft/70' : ''
      }`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {emphasizeTime && task.startTime ? (
            <span
              className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-bold ${
                isBreakTask ? 'bg-panel-sage text-white' : 'bg-student-theme-primary text-student-theme-button-text'
              }`}
            >
              <Clock size={15} aria-hidden="true" />
              {task.startTime}
            </span>
          ) : null}

          {showLessonLabel ? (
            <span className={`inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-full px-3.5 py-1 text-[15px] font-extrabold leading-none ${subjectStyle.soft} ${subjectStyle.text}`}>
              {isBreakTask ? <BreakTypeIcon taskType={task.taskType} size={15} /> : null}
              <span className="truncate">{displayLessonLabel}</span>
            </span>
          ) : null}

          <span
            aria-label={isCompletedStatus ? status.label : undefined}
            title={isCompletedStatus ? status.label : undefined}
            className={
              isCompletedStatus
                ? `inline-flex h-8 w-8 items-center justify-center rounded-full ${STATUS_TONE_CLASSES[status.tone]}`
                : `inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold ${STATUS_TONE_CLASSES[status.tone]}`
            }
          >
            {StatusIcon ? <StatusIcon size={isCompletedStatus ? 16 : 13} aria-hidden="true" /> : null}
            {isCompletedStatus ? null : status.label}
          </span>

          {task.date && !emphasizeTime ? (
            <span className="inline-flex items-center text-xs font-medium text-panel-text-muted">
              {formatDateShort(task.date)}
              {task.startTime ? ` - ${task.startTime}` : ''}
            </span>
          ) : null}
        </div>

        <p className="mt-3 line-clamp-2 text-base font-bold text-panel-text">{getPrimaryText(task, details)}</p>

        {secondaryItems.length > 0 ? (
          <div className="mt-1.5 space-y-0.5">
            {secondaryItems.map((item, index) => (
              <p key={`${task.id}-detail-${index}`} className="line-clamp-1 text-sm text-panel-text-muted">
                {item}
                {details.testGroups.length > 3 && index === secondaryItems.length - 1 ? '...' : ''}
              </p>
            ))}
          </div>
        ) : null}

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-panel-text-muted">
          {isBreakTask && task.durationMinutes ? (
            <span>
              <span className="font-semibold text-panel-text">Dinlenme:</span> {task.durationMinutes} dk
            </span>
          ) : null}
          {total > 0 ? (
            <span>
              <span className="font-semibold text-panel-text">{isReading ? 'Sayfa' : 'Soru'}:</span> {total} {unit}
            </span>
          ) : null}
          {isReading && task.currentPageNumber ? (
            <span>
              <span className="font-semibold text-panel-text">Kaldığı Sayfa:</span> {task.currentPageNumber}
            </span>
          ) : null}
          {isActive && overdueDays > 0 ? <span className="font-semibold text-panel-red">{overdueDays} gün gecikme</span> : null}
        </div>
      </div>

      {showProgress ? (
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-sm font-semibold text-panel-text">
            {completed} / {total} {unit}
          </span>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-panel-surface-soft">
            <div
              className="h-full rounded-full bg-student-theme-primary transition-[width] duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="self-end text-xs font-bold text-student-theme-text">%{progressPct}</span>
        </div>
      ) : !isFreeTimeTask ? (
        <div className="hidden lg:block" />
      ) : null}

      {!isFreeTimeTask ? (
        <button
          type="button"
          onClick={() => onOpenDetails(task)}
          aria-label={`${task.title} - ${actionLabel}`}
          className={`inline-flex h-10 min-w-32 shrink-0 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold shadow-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.98] ${
            isBreakTask
              ? 'border-panel-sage bg-panel-sage text-white hover:border-panel-sage hover:bg-panel-sage/90 focus-visible:outline-panel-sage'
              : 'border-student-theme-primary bg-student-theme-primary text-student-theme-button-text hover:border-student-theme-hover hover:bg-student-theme-hover focus-visible:outline-student-theme-primary'
          }`}
        >
          {isBreakTask ? <BreakTypeIcon taskType={task.taskType} size={16} /> : null}
          {actionLabel}
          {!isBreakTask ? <ArrowRight size={16} aria-hidden="true" /> : null}
        </button>
      ) : null}
    </article>
  )
}
