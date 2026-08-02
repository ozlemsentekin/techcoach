import { ArrowRight, Circle, Timer, CheckCircle2, Eye, HelpCircle, RotateCcw, AlertTriangle } from 'lucide-react'
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

export default function TaskListCard({ task, lessonLabel, onOpenDetails, showLessonLabel = true }) {
  const subjectStyle = SUBJECT_STYLES[task.subject] || DEFAULT_SUBJECT_STYLE
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

  return (
    <div className={`flex flex-col gap-4 rounded-2xl border border-panel-border border-l-4 ${subjectStyle.border} bg-panel-surface p-4 shadow-panel-1 transition-shadow hover:shadow-panel-2 sm:p-5 lg:flex-row lg:items-center lg:gap-6`}>
      <div className="min-w-0 flex-1">
        {showLessonLabel ? (
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-bold tracking-wide ${subjectStyle.soft} ${subjectStyle.text}`}>
            {lessonLabel}
          </span>
        ) : null}

        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${showLessonLabel ? 'ml-2' : ''} ${STATUS_TONE_CLASSES[status.tone]}`}
        >
          {StatusIcon ? <StatusIcon size={13} aria-hidden="true" /> : null}
          {status.label}
        </span>

        {task.date ? (
          <span className="ml-2 inline-flex items-center text-xs font-medium text-panel-text-muted">
            {formatDateShort(task.date)}
            {task.startTime ? ` · ${task.startTime}` : ''}
          </span>
        ) : null}

        {details.kaynak ? (
          <p className="mt-2 flex items-start gap-1.5 text-sm text-panel-text-muted">
            <span className="font-semibold text-panel-text">Kaynak:</span>{' '}
            {task.publisherName ? `${task.publisherName} - ` : ''}
            {details.kaynak}
          </p>
        ) : null}
        {details.rawText ? <p className="mt-2 text-sm text-panel-text-muted">{details.rawText}</p> : null}

        <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-panel-text-muted">
          {details.testTopic ? (
            <span className="break-words">
              <span className="font-semibold text-panel-text">Test Konusu:</span> {details.testTopic}
            </span>
          ) : null}
          {details.testName ? (
            <span className="break-words">
              <span className="font-semibold text-panel-text">Test Adı:</span> {details.testName}
            </span>
          ) : null}
          {total > 0 ? (
            <span>
              <span className="font-semibold text-panel-text">{isReading ? 'Toplam Sayfa Sayısı' : 'Toplam Soru Sayısı'}:</span> {total} {unit}
            </span>
          ) : null}
          {isReading && task.currentPageNumber ? (
            <span>
              <span className="font-semibold text-panel-text">Kaldığı Sayfa:</span> {task.currentPageNumber}
            </span>
          ) : null}
        </div>

        {isActive && overdueDays > 0 ? (
          <p className="mt-2 text-sm font-semibold text-panel-red">{overdueDays} gün gecikme var</p>
        ) : null}
      </div>

      {showProgress ? (
        <div className="flex w-full flex-col gap-1.5 lg:w-48 lg:shrink-0">
          <span className="text-sm font-medium text-panel-text">
            {completed} / {total} {unit} {isReading ? 'okundu' : 'tamamlandı'}
          </span>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-panel-surface-soft">
            <div
              className="h-full rounded-full bg-student-theme-primary transition-[width] duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="self-end text-xs font-semibold text-student-theme-text">%{progressPct}</span>
        </div>
      ) : null}

      <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
        <button
          type="button"
          onClick={() => onOpenDetails(task)}
          aria-label={`${task.title} — İşlem Yap`}
          className="inline-flex min-h-[50px] min-w-[160px] items-center justify-center gap-1.5 rounded-xl border border-student-theme-primary bg-student-theme-primary px-5 text-sm font-semibold text-student-theme-button-text shadow-panel-1 transition-all duration-150 hover:bg-student-theme-hover hover:border-student-theme-hover hover:shadow-panel-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-student-theme-primary active:scale-[0.98]"
        >
          İşlem Yap
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
