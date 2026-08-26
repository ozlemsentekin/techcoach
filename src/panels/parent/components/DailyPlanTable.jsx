import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertTriangle,
  ArrowRightLeft,
  BookOpen,
  Calculator,
  CalendarDays,
  CheckCircle2,
  Clock,
  Coffee,
  Dumbbell,
  FlaskConical,
  GraduationCap,
  MinusCircle,
  Moon,
  MoreHorizontal,
  Music,
  NotebookPen,
  Pencil,
  Plus,
  Sun,
  Trash2,
  Users,
  Utensils,
  XCircle,
} from 'lucide-react'
import { calculateNet } from '../../../utils/netCalculator'
import { getSortedTasks } from '../../../utils/taskSelectors'
import { formatDateShort, parseTimeToMinutes } from '../../../utils/time'
import { HOMEWORK_TASK_TYPES, STATUS_LABELS, TASK_TYPES } from '../../../data/taskTypes'
import Badge from '../../ui/Badge'

const SUBJECT_BADGES = {
  Türkçe: { icon: BookOpen, text: 'text-panel-slate', soft: 'bg-panel-slate-soft', border: 'border-panel-slate/25' },
  Matematik: { icon: Calculator, text: 'text-panel-warm', soft: 'bg-panel-warm-soft', border: 'border-panel-warm/25' },
  'Fen Bilimleri': { icon: FlaskConical, text: 'text-panel-sage', soft: 'bg-panel-sage-soft', border: 'border-panel-sage/25' },
}
const DEFAULT_SUBJECT_BADGE = {
  icon: BookOpen,
  text: 'text-panel-blue',
  soft: 'bg-panel-blue-soft',
  border: 'border-panel-blue/25',
}

const BREAK_TASK_TYPES = new Set(['mola', 'dinlenme', 'yemek', 'yemek-dinlenme'])
const DAILY_HOMEWORK_TASK_TYPES = new Set([...HOMEWORK_TASK_TYPES, 'odev-kontrolu'])
const ACTIVITY_TASK_TYPES = new Set(['serbest-zaman', 'sosyal-aktivite', 'spor', 'sanat-hobi', 'uyku-hazirligi', 'gunluk-rutin'])

const TASK_KIND_STYLES = {
  homework: {
    label: 'Ödev',
    icon: NotebookPen,
    rowBorder: 'border-l-panel-warm',
    rowBackground: 'bg-white hover:bg-panel-surface-soft/50',
    typeBadge: 'border-panel-warm/35 bg-panel-warm-soft text-panel-warm',
    typeIcon: 'bg-white text-panel-warm',
    timeBlock: 'bg-panel-warm-soft/45',
    durationChip: 'bg-white text-panel-warm',
    questionChip: 'bg-panel-blue-soft text-panel-blue',
    dot: 'border-panel-warm text-panel-warm',
  },
  break: {
    label: 'Mola',
    icon: Coffee,
    rowBorder: 'border-l-panel-lilac',
    rowBackground: 'bg-white hover:bg-panel-surface-soft/50',
    typeBadge: 'border-panel-lilac/35 bg-panel-lilac-soft text-panel-lilac',
    typeIcon: 'bg-white text-panel-lilac',
    timeBlock: 'bg-panel-lilac-soft/60',
    durationChip: 'bg-white text-panel-lilac',
    questionChip: 'bg-panel-lilac-soft text-panel-lilac',
    dot: 'border-panel-lilac text-panel-lilac',
  },
  activity: {
    label: 'Aktivite',
    icon: Sun,
    rowBorder: 'border-l-panel-accent',
    rowBackground: 'bg-white hover:bg-panel-surface-soft/50',
    typeBadge: 'border-panel-accent/35 bg-panel-accent-soft text-panel-warm',
    typeIcon: 'bg-white text-panel-accent',
    timeBlock: 'bg-panel-accent-soft/55',
    durationChip: 'bg-white text-panel-warm',
    questionChip: 'bg-panel-accent-soft text-panel-warm',
    dot: 'border-panel-accent text-panel-accent',
  },
  study: {
    label: 'Ders',
    icon: BookOpen,
    rowBorder: 'border-l-panel-blue',
    rowBackground: 'bg-white hover:bg-panel-surface-soft/50',
    typeBadge: 'border-panel-blue/25 bg-panel-blue-soft text-panel-blue',
    typeIcon: 'bg-white text-panel-blue',
    timeBlock: 'bg-panel-surface-soft',
    durationChip: 'bg-white text-panel-text-muted',
    questionChip: 'bg-panel-blue-soft text-panel-blue',
    dot: 'border-panel-blue-soft text-panel-blue',
  },
  lesson: {
    label: 'Planlı Ders',
    icon: GraduationCap,
    rowBorder: 'border-l-panel-accent',
    rowBackground: 'bg-panel-accent-soft/35 hover:bg-panel-accent-soft/50',
    typeBadge: 'border-panel-accent/35 bg-panel-accent-soft text-panel-warm',
    typeIcon: 'bg-white text-panel-accent',
    timeBlock: 'bg-panel-accent-soft/45',
    durationChip: 'bg-white text-panel-warm',
    questionChip: 'bg-panel-accent-soft text-panel-warm',
    dot: 'border-panel-accent text-panel-accent',
  },
}

const TASK_TYPE_ICONS = {
  mola: Coffee,
  dinlenme: Coffee,
  yemek: Utensils,
  'yemek-dinlenme': Utensils,
  'serbest-zaman': Sun,
  'sosyal-aktivite': Users,
  spor: Dumbbell,
  'sanat-hobi': Music,
  'uyku-hazirligi': Moon,
}

const STATUS_STYLES = {
  bekliyor: { icon: Clock, className: 'bg-panel-blue-soft text-panel-blue' },
  'devam-ediyor': { icon: Clock, className: 'bg-panel-warm-soft text-panel-warm' },
  tamamlandi: { icon: CheckCircle2, className: 'bg-panel-sage-soft text-panel-sage' },
  'kismen-tamamlandi': { icon: CheckCircle2, className: 'bg-panel-sage-soft text-panel-sage' },
  'yeniden-planlandi': { icon: ArrowRightLeft, className: 'bg-panel-lilac-soft text-panel-lilac' },
  'yardim-bekliyor': { icon: NotebookPen, className: 'bg-panel-warm-soft text-panel-warm' },
}

const DAILY_FLOW_FILTERS = [
  { key: 'all', label: 'Tümü' },
  { key: 'pending', label: 'Bekleyen' },
  { key: 'done', label: 'Tamamlanan' },
]

const FILTER_EMPTY_COPY = {
  pending: {
    title: 'Bekleyen görev yok',
    description: 'Bugünün kalan akışı temiz görünüyor.',
  },
  done: {
    title: 'Tamamlanan görev yok',
    description: 'Görevler tamamlandıkça burada görünecek.',
  },
  all: {
    title: 'Bu filtrede görev yok',
    description: 'Bugün için görüntülenecek görev bulunmuyor.',
  },
}

function normalizeText(value) {
  return String(value || '').toLocaleLowerCase('tr-TR')
}

function getTaskKind(task) {
  if (task.isTeacherLessonSlot) return 'lesson'
  if (BREAK_TASK_TYPES.has(task.taskType)) return 'break'
  if (DAILY_HOMEWORK_TASK_TYPES.has(task.taskType)) return 'homework'
  if (ACTIVITY_TASK_TYPES.has(task.taskType)) return 'activity'
  return 'study'
}

function getTaskKindStyle(task) {
  return TASK_KIND_STYLES[getTaskKind(task)]
}

function getSubjectLabel(task) {
  if (BREAK_TASK_TYPES.has(task.taskType)) return ''
  if (task.subject) return task.subject

  const searchText = normalizeText(`${task.title || ''} ${task.description || ''}`)
  return Object.keys(SUBJECT_BADGES).find((subject) => searchText.includes(normalizeText(subject))) || ''
}

function getSubjectBadge(task) {
  const label = getSubjectLabel(task)
  if (!label) return null
  return { label, ...(SUBJECT_BADGES[label] || DEFAULT_SUBJECT_BADGE) }
}

function getDescriptionLines(task) {
  return (task.description || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function formatDuration(task) {
  const minutes =
    task.durationMinutes || Math.max(0, parseTimeToMinutes(task.endTime) - parseTimeToMinutes(task.startTime))
  if (!minutes) return '0dk'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins}dk`
  if (mins === 0) return `${hours}sa`
  return `${hours}sa ${mins}dk`
}

function getQuestionBankHomeworkCount(task) {
  if (!HOMEWORK_TASK_TYPES.has(task.taskType) || task.resourceType !== 'soru_bankasi') return 0
  return Number(task.targetQuestionCount) || 0
}

function hasCountValue(value) {
  return value !== undefined && value !== null
}

function formatResultNumber(value) {
  return Number(value).toLocaleString('tr-TR', { maximumFractionDigits: 2 })
}

function getOpticalResult(task) {
  if (getTaskKind(task) !== 'homework' || task.status !== 'tamamlandi') return null

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

function getDailyFlowFilterKey(task) {
  if (task.status === 'tamamlandi') return 'done'
  if (task.status === 'yeniden-planlandi') return null
  return 'pending'
}

function getDailyFlowSummary(filter, counts) {
  if (counts.all === 0) return '0 görev planlandı'
  if (filter === 'all') return `${counts.all} görev planlandı`
  if (filter === 'done') return `${counts.done} tamamlanan · ${counts.all} planlandı`
  return `${counts.pending} bekleyen · ${counts.all} planlandı`
}

function TimeBlock({ task, visual }) {
  const questionCount = getQuestionBankHomeworkCount(task)

  return (
    <div className={`flex min-w-0 items-center gap-3 rounded-xl px-3 py-2 sm:block sm:bg-transparent sm:p-0 ${visual.timeBlock}`}>
      <div className="min-w-0">
        {task.isBacklog ? (
          <BacklogTag task={task} />
        ) : task.startTime ? (
          <>
            <p className="whitespace-nowrap text-sm font-bold text-panel-text">{task.startTime}</p>
            <p className="whitespace-nowrap text-xs font-medium text-panel-text-muted">{task.endTime}</p>
          </>
        ) : (
          <p className="whitespace-nowrap text-xs font-semibold text-panel-text-muted">Saat eklenmedi</p>
        )}
      </div>
      {questionCount > 0 ? (
        <div className="flex flex-nowrap items-center gap-1.5 sm:mt-2">
          <span className={`inline-flex h-7 shrink-0 items-center rounded-full px-2.5 text-xs font-semibold shadow-sm ${visual.questionChip}`}>
            {questionCount} soru
          </span>
        </div>
      ) : null}
    </div>
  )
}

function StatusPill({ status }) {
  const { icon: Icon, className } = STATUS_STYLES[status] || STATUS_STYLES.bekliyor

  return (
    <span className={`inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold ${className}`}>
      <Icon size={13} className="shrink-0" aria-hidden="true" />
      {STATUS_LABELS[status] || status}
    </span>
  )
}

function DailyFlowFilter({ activeFilter, counts, onChange }) {
  return (
    <div
      className="flex w-full gap-1 overflow-x-auto rounded-xl border border-white/15 bg-white/10 p-1 sm:w-auto sm:overflow-visible"
      aria-label="Günün akışı filtresi"
    >
      {DAILY_FLOW_FILTERS.map((filter) => {
        const selected = activeFilter === filter.key

        return (
          <button
            key={filter.key}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(filter.key)}
            className={`inline-flex h-9 min-w-max flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:flex-none sm:px-3 ${
              selected
                ? 'bg-white text-panel-blue shadow-sm'
                : 'text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            <span>{filter.label}</span>
            <span
              className={`rounded-full px-1.5 py-0.5 text-[11px] leading-none ${
                selected ? 'bg-panel-blue-soft text-panel-blue' : 'bg-white/15 text-white/80'
              }`}
            >
              {counts[filter.key]}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function TimelineDot({ status, isFirst, isLast, visual }) {
  const completed = status === 'tamamlandi'

  return (
    <div className="relative hidden justify-center sm:flex">
      {!isFirst ? <span className="absolute top-0 h-5 w-px bg-panel-border" aria-hidden="true" /> : null}
      {!isLast ? <span className="absolute bottom-0 top-5 w-px bg-panel-border" aria-hidden="true" /> : null}
      <span
        className={`relative mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 bg-panel-surface ${
          completed ? 'border-panel-sage text-panel-sage' : visual.dot
        }`}
      >
        {completed ? <CheckCircle2 size={13} aria-hidden="true" /> : <span className="h-2 w-2 rounded-full bg-current" />}
      </span>
    </div>
  )
}

function TaskKindBadge({ task, visual }) {
  const kind = getTaskKind(task)
  const Icon = TASK_TYPE_ICONS[task.taskType] || visual.icon
  const label = kind === 'study' ? TASK_TYPES[task.taskType]?.label || visual.label : visual.label

  return (
    <span className={`inline-flex max-w-full items-center overflow-hidden rounded-lg border text-xs font-extrabold ${visual.typeBadge}`}>
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center ${visual.typeIcon}`}>
        <Icon size={14} className="shrink-0" aria-hidden="true" />
      </span>
      <span className="truncate px-2.5 tracking-wide">{label}</span>
    </span>
  )
}

function DurationBadge({ task, visual }) {
  return (
    <span className={`inline-flex h-7 shrink-0 items-center rounded-lg border px-2.5 text-xs font-bold ${visual.typeBadge}`}>
      {formatDuration(task)}
    </span>
  )
}

function SubjectChip({ task }) {
  const badge = getSubjectBadge(task)
  if (!badge) return null

  const { icon: Icon, label, text, soft, border } = badge

  return (
    <span className={`inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold ${text} ${soft} ${border}`}>
      <Icon size={13} className="shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </span>
  )
}

function TaskDetail({ task }) {
  const lines = getDescriptionLines(task)
  const primary = lines[0] || task.title || 'Görev detayı eklenmemiş.'
  const secondary = task.isTeacherLessonSlot && task.topic ? [task.topic] : lines.slice(1, 3)
  const hasHiddenLines = !task.isTeacherLessonSlot && lines.length > 3

  return (
    <div className="min-w-0">
      <p className="line-clamp-2 text-base font-bold text-panel-text">{primary}</p>
      {secondary.length > 0 ? (
        <div className="mt-1 space-y-0.5">
          {secondary.map((line, index) => (
            <p key={`${task.id}-detail-${index}`} className="line-clamp-1 text-sm text-panel-text-muted">
              {line}
              {hasHiddenLines && index === secondary.length - 1 ? '...' : ''}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function OpticalResultSummary({ task, className = '', onOpenAnswerSheet }) {
  const result = getOpticalResult(task)
  if (!result) return null

  const items = [
    { label: 'Doğru', value: result.correct, icon: CheckCircle2, className: 'text-panel-sage' },
    { label: 'Yanlış', value: result.wrong, icon: XCircle, className: 'text-panel-red' },
    { label: 'Boş', value: result.blank, icon: MinusCircle, className: 'text-panel-text-muted' },
  ]
  const isClickable = Boolean(onOpenAnswerSheet) && task.resourceType === 'soru_bankasi' && Boolean(task.selectedTestIds?.length)
  const Wrapper = isClickable ? 'button' : 'div'

  return (
    <Wrapper
      type={isClickable ? 'button' : undefined}
      onClick={isClickable ? (event) => { event.stopPropagation(); onOpenAnswerSheet(task) } : undefined}
      title={isClickable ? 'Cevap kağıdını görüntüle' : undefined}
      className={`${className} rounded-xl border border-panel-border bg-white px-3 py-2.5 text-left shadow-sm ${
        isClickable ? 'cursor-pointer transition-colors hover:bg-panel-surface-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panel-blue' : ''
      }`}
    >
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
              className={`inline-flex h-8 items-center gap-1.5 rounded-lg bg-panel-surface px-2.5 text-xs font-bold ${item.className}`}
            >
              <Icon size={14} className="shrink-0" aria-hidden="true" />
              {formatResultNumber(item.value)} {item.label}
            </span>
          )
        })}
        <span className="inline-flex h-8 items-center rounded-lg bg-panel-blue-soft px-2.5 text-xs font-bold text-panel-blue">
          {formatResultNumber(result.net)} net
        </span>
      </div>
    </Wrapper>
  )
}

const ACTION_MENU_WIDTH = 180
const ACTION_MENU_ESTIMATED_HEIGHT = 92
const ACTION_MENU_VIEWPORT_PADDING = 8
const ACTION_MENU_GAP = 6

function getActionMenuPosition(buttonRect, menuHeight = ACTION_MENU_ESTIMATED_HEIGHT) {
  const left = Math.min(
    Math.max(ACTION_MENU_VIEWPORT_PADDING, buttonRect.right - ACTION_MENU_WIDTH),
    window.innerWidth - ACTION_MENU_WIDTH - ACTION_MENU_VIEWPORT_PADDING,
  )
  const hasRoomBelow = window.innerHeight - buttonRect.bottom >= menuHeight + ACTION_MENU_GAP
  const top = hasRoomBelow
    ? buttonRect.bottom + ACTION_MENU_GAP
    : Math.max(ACTION_MENU_VIEWPORT_PADDING, buttonRect.top - menuHeight - ACTION_MENU_GAP)

  return { left, top }
}

function TaskActionsMenu({ isOpen, onToggle, onClose, onEdit, onDelete }) {
  const buttonRef = useRef(null)
  const menuRef = useRef(null)
  const [menuPosition, setMenuPosition] = useState(null)

  useLayoutEffect(() => {
    if (!isOpen) return undefined

    const updateMenuPosition = () => {
      const buttonRect = buttonRef.current?.getBoundingClientRect()
      if (!buttonRect) return

      const menuHeight = menuRef.current?.offsetHeight || ACTION_MENU_ESTIMATED_HEIGHT
      setMenuPosition(getActionMenuPosition(buttonRect, menuHeight))
    }
    let frameId = null
    const scheduleMenuPositionUpdate = () => {
      if (frameId !== null) return
      frameId = window.requestAnimationFrame(() => {
        frameId = null
        updateMenuPosition()
      })
    }

    scheduleMenuPositionUpdate()
    window.addEventListener('resize', scheduleMenuPositionUpdate)
    window.addEventListener('scroll', scheduleMenuPositionUpdate, true)
    return () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId)
      window.removeEventListener('resize', scheduleMenuPositionUpdate)
      window.removeEventListener('scroll', scheduleMenuPositionUpdate, true)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return undefined

    function handlePointerDown(event) {
      if (buttonRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return
      onClose()
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  const items = [
    { label: 'Düzenle', icon: Pencil, onClick: onEdit },
    { label: 'Sil', icon: Trash2, onClick: onDelete, danger: true },
  ]

  return (
    <div className="relative inline-block text-left">
      <button
        ref={buttonRef}
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          if (isOpen) {
            setMenuPosition(null)
          } else if (buttonRef.current) {
            setMenuPosition(getActionMenuPosition(buttonRef.current.getBoundingClientRect()))
          }
          onToggle()
        }}
        aria-label="Görev işlemleri"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title="Görev işlemleri"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-panel-border bg-panel-surface text-panel-text-muted transition-colors hover:bg-panel-surface-soft hover:text-panel-text"
      >
        <MoreHorizontal size={18} aria-hidden="true" />
      </button>

      {isOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={{
                left: menuPosition?.left ?? 0,
                top: menuPosition?.top ?? 0,
                width: ACTION_MENU_WIDTH,
              }}
              className={`fixed z-[70] overflow-hidden rounded-xl border border-panel-border bg-white py-1 shadow-[0_10px_28px_rgba(37,30,60,0.14)] ${
                menuPosition ? 'opacity-100' : 'pointer-events-none opacity-0'
              }`}
            >
              {items.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  onClick={(event) => {
                    event.stopPropagation()
                    onClose()
                    item.onClick()
                  }}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:bg-panel-surface-soft ${
                    item.danger ? 'text-panel-red hover:bg-panel-red-soft' : 'text-panel-text hover:bg-panel-surface-soft'
                  }`}
                >
                  <item.icon size={14} className="shrink-0" aria-hidden="true" />
                  {item.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}

function formatBacklogTooltip(task) {
  const dateLabel = formatDateShort(task.date)
  const timeLabel = task.startTime && task.endTime ? `${task.startTime} - ${task.endTime}` : task.startTime || ''
  const whenLabel = timeLabel ? `${dateLabel}, ${timeLabel}` : dateLabel
  return `${whenLabel} için planlanmıştı, zamanında yapılmadı.`
}

function BacklogTag({ task }) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    function handlePointerDown(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  return (
    <span ref={wrapperRef} className="relative inline-flex">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          setOpen((current) => !current)
        }}
        aria-expanded={open}
        aria-label="Biriken görev detayı"
      >
        <Badge tone="red" className="cursor-pointer gap-1 text-[10px] font-extrabold">
          <AlertTriangle size={11} aria-hidden="true" />
          Biriken Görev
        </Badge>
      </button>
      {open ? (
        <span
          role="tooltip"
          className="absolute left-0 top-full z-20 mt-1.5 w-56 rounded-lg border border-panel-red/25 bg-white px-3 py-2 text-xs font-semibold leading-snug text-panel-text shadow-lg"
        >
          {formatBacklogTooltip(task)}
        </span>
      ) : null}
    </span>
  )
}

function TaskAgendaItem({
  task,
  isFirst,
  isLast,
  isMenuOpen,
  onToggleMenu,
  onCloseMenu,
  onEdit,
  onDelete,
  onOpenAnswerSheet,
}) {
  const visual = getTaskKindStyle(task)
  const taskKind = getTaskKind(task)
  const isLessonSlot = taskKind === 'lesson'
  const showStatus = taskKind !== 'break' && taskKind !== 'activity' && !isLessonSlot
  const hasActions = Boolean(onEdit || onDelete)

  return (
    <article
      className={`grid grid-cols-[minmax(0,1fr)_2.5rem] gap-3 border-l-4 px-4 py-4 transition-colors sm:grid-cols-[10rem_2rem_minmax(0,1fr)_2.5rem] sm:gap-4 sm:px-5 ${visual.rowBorder} ${visual.rowBackground}`}
    >
      <div className="col-start-1 row-start-1 min-w-0 sm:col-start-1 sm:row-start-1">
        <TimeBlock task={task} visual={visual} />
      </div>

      <TimelineDot status={task.status} isFirst={isFirst} isLast={isLast} visual={visual} />

      <div className="col-span-2 col-start-1 row-start-2 min-w-0 sm:col-span-1 sm:col-start-3 sm:row-start-1">
        <div className="flex flex-wrap items-center gap-2">
          <TaskKindBadge task={task} visual={visual} />
          {task.isBacklog ? null : <DurationBadge task={task} visual={visual} />}
          <SubjectChip task={task} />
          {showStatus ? <StatusPill status={task.status} /> : null}
        </div>
        <div className="mt-3">
          <TaskDetail task={task} />
        </div>
      </div>

      <div className="col-start-2 row-start-1 justify-self-end sm:col-start-4 sm:row-start-1">
        {isLessonSlot || !hasActions ? null : (
          <TaskActionsMenu
            isOpen={isMenuOpen}
            onToggle={onToggleMenu}
            onClose={onCloseMenu}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        )}
      </div>

      <OpticalResultSummary
        task={task}
        className="col-span-2 col-start-1 row-start-3 sm:col-span-4 sm:col-start-1 sm:row-start-2"
        onOpenAnswerSheet={onOpenAnswerSheet}
      />
    </article>
  )
}

export default function DailyPlanTable({ tasks, backlogTasks = [], onEdit, onDelete, onAddTask, onOpenAnswerSheet }) {
  const [openMenuId, setOpenMenuId] = useState(null)
  const [agendaFilter, setAgendaFilter] = useState('all')

  const combinedTasks = useMemo(
    () => [...backlogTasks.map((task) => ({ ...task, isBacklog: true })), ...tasks],
    [backlogTasks, tasks],
  )
  const sorted = useMemo(() => getSortedTasks(combinedTasks), [combinedTasks])
  const filterCounts = useMemo(
    () =>
      sorted.reduce(
        (counts, task) => {
          const filterKey = getDailyFlowFilterKey(task)
          counts.all += 1
          if (filterKey) counts[filterKey] += 1
          return counts
        },
        { all: 0, pending: 0, done: 0 },
      ),
    [sorted],
  )
  const visibleTasks = useMemo(
    () =>
      sorted.filter((task) => {
        if (agendaFilter === 'all') return true
        return getDailyFlowFilterKey(task) === agendaFilter
      }),
    [agendaFilter, sorted],
  )
  const emptyCopy = FILTER_EMPTY_COPY[agendaFilter] || FILTER_EMPTY_COPY.all

  const selectAgendaFilter = (filter) => {
    setAgendaFilter(filter)
    setOpenMenuId(null)
  }

  return (
    <section className="panel-card overflow-hidden">
      <div className="flex flex-col gap-3 bg-panel-blue p-4 text-white sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white">
            <CalendarDays size={17} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-white sm:text-xl">Günün Akışı</h2>
            <p className="mt-0.5 text-sm text-white/70">{getDailyFlowSummary(agendaFilter, filterCounts)}</p>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
          {sorted.length > 0 ? (
            <DailyFlowFilter activeFilter={agendaFilter} counts={filterCounts} onChange={selectAgendaFilter} />
          ) : null}
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-5 py-7 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-panel-accent-soft text-panel-blue">
            <CalendarDays size={20} aria-hidden="true" />
          </span>
          <h3 className="mt-3 text-base font-semibold text-panel-text">Bugün plan boş</h3>
          <p className="mt-1 max-w-sm text-sm text-panel-text-muted">
            {onAddTask ? 'Aylin için ilk görevi ekleyebilirsin.' : 'Öğretmenin planladığı görevler burada görünecek.'}
          </p>
          {onAddTask ? (
            <button
              type="button"
              onClick={onAddTask}
              className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-panel-blue px-4 text-sm font-semibold text-white hover:opacity-90"
            >
              <Plus size={17} aria-hidden="true" />
              Görev Ekle
            </button>
          ) : null}
        </div>
      ) : visibleTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-5 py-7 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-panel-surface-soft text-panel-text-muted">
            <CalendarDays size={20} aria-hidden="true" />
          </span>
          <h3 className="mt-3 text-base font-semibold text-panel-text">{emptyCopy.title}</h3>
          <p className="mt-1 max-w-sm text-sm text-panel-text-muted">{emptyCopy.description}</p>
        </div>
      ) : (
        <div className="divide-y divide-panel-border">
          {visibleTasks.map((task, index) => (
            <TaskAgendaItem
              key={task.id}
              task={task}
              isFirst={index === 0}
              isLast={index === visibleTasks.length - 1}
              isMenuOpen={openMenuId === task.id}
              onToggleMenu={() => setOpenMenuId(openMenuId === task.id ? null : task.id)}
              onCloseMenu={() => setOpenMenuId(null)}
              onEdit={onEdit ? () => onEdit(task) : undefined}
              onDelete={onDelete ? () => onDelete(task) : undefined}
              onOpenAnswerSheet={onOpenAnswerSheet}
            />
          ))}
        </div>
      )}
    </section>
  )
}
