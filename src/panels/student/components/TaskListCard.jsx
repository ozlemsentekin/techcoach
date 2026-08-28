import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  Circle,
  Timer,
  CheckCircle2,
  MinusCircle,
  Eye,
  HelpCircle,
  RotateCcw,
  AlertTriangle,
  Clock,
  Coffee,
  Utensils,
  XCircle,
  StickyNote,
  Loader2,
} from 'lucide-react'
import { calculateNet } from '../../../utils/netCalculator'
import { getAssignmentStatus } from '../../../utils/assignmentStatus'
import { parseAssignmentDetails } from '../../../utils/assignmentDetails'
import { daysLate, formatDateShort, formatSecondsAsTimer, taskTimeState, todayISODate } from '../../../utils/time'
import { BREAK_TASK_TYPES, HOMEWORK_TASK_TYPES } from '../../../data/taskTypes'
import { SUBJECT_STYLES, DEFAULT_SUBJECT_STYLE } from './subjectStyles'

const STATUS_ICONS = { Circle, Timer, CheckCircle2, Eye, HelpCircle, RotateCcw, AlertTriangle, BookOpen }

const STATUS_TONE_CLASSES = {
  theme: 'bg-student-theme-soft text-student-theme-text',
  sage: 'bg-panel-sage-soft text-panel-sage',
  yellow: 'bg-panel-yellow-soft text-panel-yellow',
  accent: 'bg-panel-accent-soft text-panel-warm',
  slate: 'bg-panel-slate-soft text-panel-slate',
  red: 'bg-panel-red-soft text-panel-red',
  now: 'bg-student-theme-primary text-student-theme-button-text animate-pulse',
  late: 'bg-panel-yellow text-white',
}

const ACTIVITY_TASK_TYPES = new Set(['serbest-zaman', 'sosyal-aktivite', 'spor'])
const BREAK_STYLE = { text: 'text-panel-warm', soft: 'bg-panel-accent-soft', border: 'border-l-panel-sage', dot: 'bg-panel-sage' }
const FREE_TIME_STYLE = { text: 'text-panel-warm', soft: 'bg-panel-accent-soft', border: 'border-l-panel-sage', dot: 'bg-panel-sage' }
const TEACHER_LESSON_STYLE = { text: 'text-panel-warm', soft: 'bg-panel-accent-soft', border: 'border-l-panel-warm', dot: 'bg-panel-warm' }
const SOFT_TIME_BADGE_CLASS = 'border border-panel-border bg-panel-surface text-panel-text-muted'

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
    return details.testGroups.map((item) => {
      if (item.topic && item.testName) return `${item.topic}: ${item.testName}`
      return item.topic || item.testName
    })
  }
  if (details.testTopic || details.testName) {
    return [`${details.testTopic || ''}${details.testTopic && details.testName ? ': ' : ''}${details.testName || ''}`]
  }
  return []
}

function isTimerRunning(task) {
  return Boolean(task.timerStartedAt) && !task.timerStoppedAt && !['tamamlandi', 'kismen-tamamlandi', 'yeniden-planlandi'].includes(task.status)
}

function getElapsedSeconds(task, nowMs) {
  if (task.timerElapsedSeconds !== undefined) return task.timerElapsedSeconds
  if (!isTimerRunning(task)) return 0

  const startedMs = new Date(task.timerStartedAt).getTime()
  if (!Number.isFinite(startedMs)) return 0

  return Math.max(0, Math.floor((nowMs - startedMs) / 1000))
}

function shouldOpenCompletionFlow(task) {
  return task.resourceType === 'soru_bankasi' || task.resourceType === 'okuma_kitabi'
}

function hasCountValue(value) {
  return value !== undefined && value !== null
}

function formatResultNumber(value) {
  return Number(value).toLocaleString('tr-TR', { maximumFractionDigits: 2 })
}

function getOpticalResult(task) {
  if (!HOMEWORK_TASK_TYPES.has(task.taskType) || task.resourceType !== 'soru_bankasi' || task.status !== 'tamamlandi') return null

  const testResults = Object.values(task.testResults || {}).filter(Boolean)
  const hasAggregateResult = [task.correctCount, task.wrongCount, task.blankCount].some(hasCountValue)

  if (!hasAggregateResult && testResults.length === 0) return null

  const totalsFromTests = testResults.reduce(
    (totals, result) => ({
      correct: totals.correct + (Number(result.correct) || 0),
      wrong: totals.wrong + (Number(result.wrong) || 0),
      blank: totals.blank + (Number(result.blank) || 0),
    }),
    { correct: 0, wrong: 0, blank: 0 },
  )

  const correct = hasAggregateResult ? Number(task.correctCount) || 0 : totalsFromTests.correct
  const wrong = hasAggregateResult ? Number(task.wrongCount) || 0 : totalsFromTests.wrong
  const blank = hasAggregateResult ? Number(task.blankCount) || 0 : totalsFromTests.blank
  const totalQuestions = Number(task.completedQuestionCount) || correct + wrong + blank || Number(task.targetQuestionCount) || 0

  return {
    correct,
    wrong,
    blank,
    totalQuestions,
    net: calculateNet(correct, wrong),
  }
}

function OpticalResultSummary({ task, className = '' }) {
  const result = getOpticalResult(task)
  if (!result) return null

  const items = [
    { label: 'Doğru', value: result.correct, icon: CheckCircle2, className: 'text-panel-sage' },
    { label: 'Yanlış', value: result.wrong, icon: XCircle, className: 'text-panel-red' },
    { label: 'Boş', value: result.blank, icon: MinusCircle, className: 'text-panel-text-muted' },
  ]

  return (
    <div className={`${className} rounded-[12px] border border-panel-border bg-white px-3 py-2.5 shadow-sm`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-panel-sage">Optik sonucu</span>
        {result.totalQuestions > 0 ? (
          <span className="rounded-full bg-panel-surface px-2 py-0.5 text-[11px] font-semibold text-panel-text-muted">
            {result.totalQuestions} soru
          </span>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <span
              key={item.label}
              className={`inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-panel-surface px-2.5 text-xs font-bold ${item.className}`}
            >
              <Icon size={14} className="shrink-0" aria-hidden="true" />
              {formatResultNumber(item.value)} {item.label}
            </span>
          )
        })}
        <span className="inline-flex h-8 items-center rounded-[10px] bg-student-theme-soft px-2.5 text-xs font-bold text-student-theme-text">
          {formatResultNumber(result.net)} net
        </span>
      </div>
    </div>
  )
}

export default function TaskListCard({
  task,
  lessonLabel,
  onOpenDetails,
  onStartTimer,
  onCompleteTask,
  onUndoComplete,
  showLessonLabel = true,
  emphasizeTime = false,
  timeline = false,
  isFirst = false,
  isLast = false,
  highlight = false,
  showDateBadge = false,
}) {
  const isTeacherLessonSlot = Boolean(task.isTeacherLessonSlot)
  const isBreakTask = BREAK_TASK_TYPES.has(task.taskType)
  const isFreeTimeTask = task.taskType === 'serbest-zaman'
  const isActivityTask = ACTIVITY_TASK_TYPES.has(task.taskType)
  const isOpenableRow = !isTeacherLessonSlot && (isFreeTimeTask || shouldOpenCompletionFlow(task))
  const subjectStyle = isBreakTask
    ? BREAK_STYLE
    : isTeacherLessonSlot
      ? TEACHER_LESSON_STYLE
    : isActivityTask
      ? FREE_TIME_STYLE
      : SUBJECT_STYLES[task.subject] || DEFAULT_SUBJECT_STYLE
  const details = parseAssignmentDetails(task)
  const overdueDays = daysLate(task.date)
  const isActive = task.status === 'bekliyor' || task.status === 'devam-ediyor' || task.status === 'yardim-bekliyor'
  // "Diğer" kategorisi görevleri (mola/yemek + serbest zaman/spor/sosyal aktivite) süresi
  // geçince sunucuda otomatik tamamlanır; "Gecikti" olarak işaretlenmezler.
  const isOverdueIncomplete =
    !isTeacherLessonSlot &&
    !isBreakTask &&
    !isActivityTask &&
    overdueDays > 0 &&
    !['tamamlandi', 'yeniden-planlandi'].includes(task.status)

  // Bugüne ait, henüz başlanmamış ve saat aralığı olan görevlerde anlık saatle görevin
  // start-end aralığı karşılaştırılır: aralık şu anı kapsıyorsa "Şimdi", aralık geçtiyse
  // "Saati geçti" gösterilir — geride kalınan görevlerin HEPSİNDE, tek bir tanesinde değil.
  const isTodayTask = task.date === todayISODate()
  const hasTimeWindow = Boolean(task.startTime && task.endTime)
  const timeState = task.status === 'bekliyor' && isTodayTask && hasTimeWindow ? taskTimeState(task) : null
  const isNowTask = timeState?.phase === 'active'
  const isBehindToday = timeState?.phase === 'past'

  let status = isTeacherLessonSlot
    ? { filterKey: 'pending', label: 'Planlı Ders', tone: 'accent', icon: 'BookOpen' }
    : getAssignmentStatus(task)
  if (isOverdueIncomplete) {
    status = { ...status, label: 'Gecikti', tone: 'red', icon: 'AlertTriangle' }
  } else if (isNowTask) {
    status = { ...status, label: `Şimdi · ${timeState.minutesUntilEnd} dk kaldı`, tone: 'now', icon: 'Timer' }
  } else if (!isTeacherLessonSlot && isBehindToday) {
    status = { ...status, label: `Saati geçti · ${timeState.minutesPast} dk`, tone: 'late', icon: 'AlertTriangle' }
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
  const showStatusBadge = !isBreakTask && !isActivityTask
  const showUndoButton = isCompletedStatus && Boolean(onUndoComplete)
  const showQuickFinishButton = (isBreakTask || isActivityTask) && isActive && !isCompletedStatus && Boolean(onCompleteTask)
  const showActionButton = !isTeacherLessonSlot && !isActivityTask && !isBreakTask
  const showActionColumn = showActionButton || showUndoButton
  const showTimerControl =
    showActionButton &&
    HOMEWORK_TASK_TYPES.has(task.taskType) &&
    task.resourceType === 'soru_bankasi' &&
    !['tamamlandi', 'yeniden-planlandi'].includes(task.status)
  const timerRunning = isTimerRunning(task)
  const [nowMs, setNowMs] = useState(0)
  const elapsedSeconds = getElapsedSeconds(task, nowMs)

  // Buton bazlı işlem durumu: 'complete' | 'undo' | 'timer'. onCompleteTask/onUndoComplete/
  // onStartTimer bir Promise döndürdüğü sürece, istek tamamlanana kadar ilgili buton
  // "yükleniyor" gösterir ve tüm aksiyon butonları devre dışı kalır (çift tıklama önlenir).
  const [pendingAction, setPendingAction] = useState(null)
  const isMountedRef = useRef(true)
  useEffect(() => () => {
    isMountedRef.current = false
  }, [])

  const runAction = async (kind, action) => {
    if (pendingAction) return
    setPendingAction(kind)
    try {
      await action()
    } finally {
      if (isMountedRef.current) setPendingAction(null)
    }
  }

  const isActionPending = pendingAction === 'complete' || pendingAction === 'undo'

  useEffect(() => {
    if (!timerRunning) return undefined

    const updateNow = () => setNowMs(Date.now())
    const timeout = window.setTimeout(updateNow, 0)
    const interval = window.setInterval(updateNow, 1000)
    return () => {
      window.clearTimeout(timeout)
      window.clearInterval(interval)
    }
  }, [timerRunning])

  const handleCardKeyDown = (event) => {
    if (!isOpenableRow) return
    if (event.key !== 'Enter' && event.key !== ' ') return

    event.preventDefault()
    onOpenDetails(task)
  }

  const handlePrimaryAction = () => {
    if (shouldOpenCompletionFlow(task) || !onCompleteTask) {
      onOpenDetails(task)
      return
    }

    runAction('complete', () => onCompleteTask(task))
  }

  const handleUndoComplete = (event) => {
    event.stopPropagation()
    runAction('undo', () => onUndoComplete(task))
  }

  const handleQuickFinish = (event) => {
    event.stopPropagation()
    runAction('complete', () => onCompleteTask(task))
  }

  const cardGridClass =
    showProgress && showActionColumn
      ? 'lg:grid-cols-[minmax(0,1fr)_minmax(180px,230px)_156px]'
      : showProgress
        ? 'lg:grid-cols-[minmax(0,1fr)_minmax(180px,230px)]'
        : showActionColumn || showQuickFinishButton
          ? 'lg:grid-cols-[minmax(0,1fr)_156px]'
          : 'lg:grid-cols-[minmax(0,1fr)]'

  const isCompactBreakRow = timeline && isBreakTask

  const cardSurfaceClass = isActivityTask
    ? 'bg-panel-sage-soft/15 hover:bg-panel-sage-soft/25'
    : isTeacherLessonSlot
      ? 'bg-panel-accent-soft/25 hover:bg-panel-accent-soft/35'
    : isBreakTask
      ? 'bg-panel-accent-soft/45 hover:bg-panel-accent-soft/60'
      : 'bg-panel-surface hover:bg-panel-surface-soft/55'

  const timeStateBorderClass = isNowTask
    ? 'border-l-4 border-l-student-theme-primary'
    : isBehindToday
      ? 'border-l-4 border-l-panel-yellow'
      : 'border-l-4 border-l-transparent'

  const rowStateClass = highlight
    ? 'bg-student-theme-soft/55'
    : isNowTask
      ? 'bg-student-theme-soft/40 ring-1 ring-inset ring-student-theme-primary/40'
      : isBehindToday
        ? 'bg-panel-yellow-soft/35'
        : cardSurfaceClass

  const progressNode = showProgress ? (
    <div className="min-w-0 rounded-[12px] bg-panel-surface-soft/70 p-2 sm:p-3 lg:bg-transparent lg:p-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-semibold text-panel-text-muted sm:text-[11px]">İlerleme (%{progressPct})</span>
        <span className="text-xs font-bold text-panel-text sm:text-sm">
          {completed} / {total} {unit}
        </span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-panel-surface-soft sm:mt-2 sm:h-2.5 lg:bg-student-theme-soft/45">
        <div
          className="h-full rounded-full bg-student-theme-primary transition-[width] duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  ) : null

  const actionNode = showActionColumn ? (
    <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:w-[156px] lg:grid-cols-1">
      {showTimerControl ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            if (!timerRunning && onStartTimer) runAction('timer', () => onStartTimer(task))
          }}
          aria-label={`${task.title} - Sayaç Başlat`}
          disabled={timerRunning || !onStartTimer || Boolean(pendingAction)}
          className={`inline-flex h-9 w-full items-center justify-center gap-2 rounded-[12px] border px-2.5 text-[11px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-student-theme-primary disabled:cursor-not-allowed disabled:opacity-70 sm:h-11 sm:px-3 sm:text-xs ${
            timerRunning
              ? 'border-student-theme-primary/30 bg-student-theme-soft text-student-theme-text'
              : 'border-student-theme-primary/30 bg-panel-surface text-student-theme-text hover:bg-student-theme-soft'
          }`}
        >
          {pendingAction === 'timer' ? (
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          ) : (
            <Timer size={14} aria-hidden="true" />
          )}
          {pendingAction === 'timer'
            ? 'Başlatılıyor...'
            : timerRunning
              ? formatSecondsAsTimer(elapsedSeconds)
              : 'Sayaç Başlat'}
        </button>
      ) : task.timerElapsedSeconds ? (
        <span className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-[12px] bg-panel-surface-soft px-2.5 text-[11px] font-semibold text-panel-text-muted sm:h-11 sm:px-3 sm:text-xs">
          <Timer size={14} aria-hidden="true" />
          {formatSecondsAsTimer(elapsedSeconds)}
        </span>
      ) : null}

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          if (showUndoButton) handleUndoComplete(event)
          else handlePrimaryAction()
        }}
        aria-label={`${task.title} - ${showUndoButton ? 'Geri Al' : 'Tamamla'}`}
        aria-busy={isActionPending}
        disabled={Boolean(pendingAction)}
        className={`inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-[12px] border px-3 text-sm font-semibold shadow-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 disabled:active:scale-100 sm:h-11 sm:px-4 ${
          showUndoButton
            ? 'border-panel-red/25 bg-panel-surface text-panel-red hover:bg-panel-red-soft focus-visible:outline-panel-red'
            : 'border-student-theme-primary bg-student-theme-primary text-student-theme-button-text hover:border-student-theme-hover hover:bg-student-theme-hover focus-visible:outline-student-theme-primary'
        }`}
      >
        {isActionPending ? (
          <>
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            {showUndoButton ? 'Geri alınıyor...' : 'Tamamlanıyor...'}
          </>
        ) : (
          <>
            {showUndoButton ? <RotateCcw size={16} aria-hidden="true" /> : null}
            {showUndoButton ? 'Geri Al' : 'Tamamla'}
            {!showUndoButton ? <ArrowRight size={16} aria-hidden="true" /> : null}
          </>
        )}
      </button>
    </div>
  ) : null

  const quickFinishNode = showQuickFinishButton ? (
    <button
      type="button"
      onClick={handleQuickFinish}
      aria-label={`${task.title} - Bitir`}
      aria-busy={isActionPending}
      disabled={Boolean(pendingAction)}
      className={`inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-[12px] border px-3 text-sm font-semibold shadow-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 disabled:active:scale-100 sm:h-11 sm:px-4 lg:w-[156px] ${
        isBreakTask || isActivityTask
          ? 'border-panel-accent/30 bg-panel-accent-soft text-panel-warm hover:border-panel-accent/45 hover:bg-panel-accent-soft/80 focus-visible:outline-panel-accent'
          : 'border-student-theme-primary bg-student-theme-primary text-student-theme-button-text hover:border-student-theme-hover hover:bg-student-theme-hover focus-visible:outline-student-theme-primary'
      }`}
    >
      {isActionPending ? (
        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
      ) : (
        <CheckCircle2 size={16} aria-hidden="true" />
      )}
      {isActionPending ? 'Bitiriliyor...' : 'Bitir'}
    </button>
  ) : null

  const bodyNode = (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        {emphasizeTime && task.startTime && !timeline ? (
          <span
            className={`inline-flex h-7 items-center gap-1.5 rounded-[10px] px-2.5 text-xs font-bold sm:h-9 sm:px-3 sm:text-sm ${
              isBreakTask ? 'bg-panel-sage text-white' : 'student-theme-time-badge'
            }`}
          >
            <Clock size={15} aria-hidden="true" />
            {task.startTime}
          </span>
        ) : null}

        {showLessonLabel ? (
          <span className={`inline-flex min-h-6 max-w-full items-center gap-1.5 rounded-[10px] px-2 py-0.5 text-xs font-bold leading-none sm:min-h-8 sm:px-3 sm:py-1 sm:text-sm ${subjectStyle.soft} ${subjectStyle.text}`}>
            {isBreakTask ? (
              <BreakTypeIcon taskType={task.taskType} size={15} />
            ) : !isActivityTask ? (
              <BookOpen size={15} aria-hidden="true" />
            ) : null}
            <span className="truncate">{displayLessonLabel}</span>
          </span>
        ) : null}

        {showLessonLabel && task.durationMinutes ? (
          <span className="inline-flex min-h-6 items-center gap-1 rounded-[10px] bg-panel-surface-soft px-2 py-0.5 text-xs font-semibold text-panel-text-muted sm:min-h-8 sm:px-2.5 sm:py-1 sm:text-sm">
            <Clock size={13} aria-hidden="true" />
            {task.durationMinutes} dk
          </span>
        ) : null}

        {isCompactBreakRow && task.startTime ? (
          <span className="inline-flex min-h-6 items-center gap-1 rounded-[10px] bg-panel-surface-soft px-2 py-0.5 text-xs font-semibold text-panel-text-muted sm:min-h-8 sm:px-2.5 sm:py-1 sm:text-sm">
            {task.startTime}{task.endTime ? ` - ${task.endTime}` : ''}
          </span>
        ) : null}

        {task.date && (!emphasizeTime || showDateBadge) ? (
          <span className="inline-flex min-h-6 items-center rounded-[10px] bg-panel-surface-soft px-2 py-0.5 text-[10px] font-medium text-panel-text-muted sm:min-h-8 sm:px-2.5 sm:py-1 sm:text-xs">
            {formatDateShort(task.date)}
            {task.startTime ? ` - ${task.startTime}` : ''}
          </span>
        ) : null}

        {showStatusBadge ? (
          <span
            className={`inline-flex min-h-6 items-center gap-1.5 rounded-[10px] px-2 py-0.5 text-[10px] font-semibold sm:min-h-8 sm:px-2.5 sm:py-1 sm:text-xs ${STATUS_TONE_CLASSES[status.tone]}`}
          >
            {StatusIcon ? <StatusIcon size={14} aria-hidden="true" /> : null}
            {status.label}
          </span>
        ) : null}
      </div>

      {isCompactBreakRow ? null : (
        <>
          <p className={`mt-2 line-clamp-2 text-sm font-semibold leading-snug sm:mt-3 sm:text-base ${isOverdueIncomplete ? 'text-panel-red' : 'text-panel-text'}`}>
            {getPrimaryText(task, details)}
          </p>

          {secondaryItems.length > 0 ? (
            <div className="mt-1.5 space-y-0.5 sm:mt-2 sm:space-y-1">
              {secondaryItems.map((item, index) => (
                <p key={`${task.id}-detail-${index}`} className="text-xs leading-snug text-panel-text-muted sm:text-sm sm:leading-relaxed">
                  {item}
                </p>
              ))}
            </div>
          ) : null}

          {task.parentNote ? (
            <div className="mt-1.5 flex items-start gap-1.5 rounded-[10px] bg-panel-yellow-soft/60 px-2 py-1 text-xs leading-snug text-panel-text sm:mt-2 sm:text-sm">
              <StickyNote size={14} className="mt-0.5 shrink-0 text-panel-yellow" aria-hidden="true" />
              <span className="min-w-0">
                <span className="font-semibold">Görev notu:</span> {task.parentNote}
              </span>
            </div>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-panel-text-muted sm:mt-3 sm:gap-2 sm:text-xs">
            {isReading && task.currentPageNumber ? (
              <span className="inline-flex min-h-6 items-center rounded-[10px] bg-panel-surface-soft px-2 py-0.5 font-medium sm:min-h-8 sm:px-2.5 sm:py-1">
                <span className="font-semibold text-panel-text">Kaldığı Sayfa:</span>&nbsp;{task.currentPageNumber}
              </span>
            ) : null}
            {isOverdueIncomplete ? (
              <span className="inline-flex min-h-6 items-center rounded-[10px] bg-panel-red-soft px-2 py-0.5 font-semibold text-panel-red sm:min-h-8 sm:px-2.5 sm:py-1">
                {overdueDays} gün gecikme
              </span>
            ) : null}
          </div>
        </>
      )}
    </div>
  )

  if (timeline) {
    return (
      <article
        role={isOpenableRow ? 'button' : undefined}
        tabIndex={isOpenableRow ? 0 : undefined}
        onClick={isOpenableRow ? () => onOpenDetails(task) : undefined}
        onKeyDown={handleCardKeyDown}
        aria-label={isOpenableRow ? `${task.title} detayını aç` : undefined}
        className={`grid grid-cols-[4.5rem_1.25rem_minmax(0,1fr)] gap-x-2 transition-colors sm:grid-cols-[4.9rem_1.5rem_minmax(0,1fr)] sm:gap-x-3 lg:grid-cols-[5.15rem_1.5rem_minmax(0,1fr)_minmax(170px,220px)_156px] lg:items-center ${
          isCompactBreakRow ? 'px-2.5 py-1.5 sm:px-4 sm:py-2' : 'px-2.5 py-2.5 sm:px-4 sm:py-4'
        } ${
          rowStateClass
        } ${
          timeStateBorderClass
        } ${
          isOpenableRow ? 'cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panel-accent' : ''
        }`}
      >
        {isCompactBreakRow ? null : (
          <div className="col-start-1 row-span-4 min-w-0 pt-0.5">
            <p className={`inline-flex h-7 min-w-14 items-center justify-center rounded-[10px] px-2 text-xs font-extrabold leading-none shadow-sm sm:h-9 sm:min-w-16 sm:px-2.5 sm:text-[15px] ${
              isActivityTask ? SOFT_TIME_BADGE_CLASS : 'student-theme-time-badge'
            } ${isNowTask ? 'ring-2 ring-student-theme-primary ring-offset-2 ring-offset-panel-surface' : ''}`}>
              {task.startTime || '--:--'}
            </p>
            {task.endTime ? <p className="mt-1 pl-1 text-[10px] font-medium text-panel-text-muted sm:mt-1.5 sm:text-xs">{task.endTime}</p> : null}
          </div>
        )}

        <div className="relative col-start-2 row-span-4 flex justify-center">
          {isCompactBreakRow ? (
            <span className="absolute inset-y-0 w-0 border-l-2 border-dashed border-panel-border-strong" aria-hidden="true" />
          ) : (
            <>
              {!isFirst ? <span className="absolute top-0 h-5 w-0 border-l-2 border-dashed border-panel-border-strong" aria-hidden="true" /> : null}
              {!isLast ? <span className="absolute bottom-0 top-5 w-0 border-l-2 border-dashed border-panel-border-strong" aria-hidden="true" /> : null}
            </>
          )}
          {isCompactBreakRow ? null : (
            <span
              className={`relative mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 bg-panel-surface sm:h-5 sm:w-5 ${
                isCompletedStatus
                  ? 'border-panel-sage text-panel-sage'
                  : isBreakTask
                    ? 'border-panel-sage text-panel-sage'
                    : isActivityTask
                      ? 'border-panel-sage text-panel-sage'
                      : 'border-student-theme-primary text-student-theme-text'
              }`}
            >
              {isNowTask ? (
                <span className="absolute -inset-1 animate-ping rounded-full bg-student-theme-primary/40" aria-hidden="true" />
              ) : null}
              {isCompletedStatus ? <CheckCircle2 size={12} aria-hidden="true" /> : <span className="h-1.5 w-1.5 rounded-full bg-current sm:h-2 sm:w-2" />}
            </span>
          )}
        </div>

        <div className="col-start-3 min-w-0 lg:col-start-3">
          {highlight ? (
            <span className="mb-1.5 inline-flex rounded-full bg-student-theme-primary px-2 py-0.5 text-[10px] font-bold text-student-theme-button-text sm:mb-2 sm:px-2.5 sm:py-1 sm:text-[11px]">
              Sıradaki görev
            </span>
          ) : null}
          {bodyNode}
        </div>

        {progressNode ? <div className="col-start-3 mt-2 min-w-0 sm:mt-3 lg:col-start-4 lg:mt-0">{progressNode}</div> : null}
        {actionNode ? <div className="col-start-3 mt-1.5 min-w-0 sm:mt-2 lg:col-start-5 lg:mt-0">{actionNode}</div> : null}
        {quickFinishNode ? <div className="col-start-3 mt-1.5 min-w-0 sm:mt-2 lg:col-start-5 lg:mt-0">{quickFinishNode}</div> : null}
        <OpticalResultSummary task={task} className="col-start-3 mt-3 lg:col-span-3 lg:col-start-3" />
      </article>
    )
  }

  return (
    <article
      role={isOpenableRow ? 'button' : undefined}
      tabIndex={isOpenableRow ? 0 : undefined}
      onClick={isOpenableRow ? () => onOpenDetails(task) : undefined}
      onKeyDown={handleCardKeyDown}
      aria-label={isOpenableRow ? `${task.title} detayını aç` : undefined}
      className={`grid gap-3 border-l-[3px] ${subjectStyle.border} px-2.5 py-2.5 transition-colors sm:gap-4 sm:px-4 sm:py-4 lg:items-center ${cardGridClass} ${rowStateClass} ${
        isOpenableRow ? 'cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panel-accent' : ''
      }`}
    >
      {bodyNode}

      {progressNode}

      {actionNode}

      {quickFinishNode}

      <OpticalResultSummary task={task} className="lg:col-span-full" />
    </article>
  )
}
