import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  BookOpen,
  Calculator,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  Coffee,
  Dumbbell,
  FlaskConical,
  GraduationCap,
  Library,
  ListChecks,
  MinusCircle,
  NotebookPen,
  Plus,
  ScanLine,
  School,
  Star,
  Timer,
  UploadCloud,
  XCircle,
} from 'lucide-react'
import { HOMEWORK_TASK_TYPES, TASK_TYPES } from '../../../data/taskTypes'
import { parseTimeToMinutes, todayISODate, WEEKDAY_KEYS as DAY_KEYS } from '../../../utils/time'
import { isBacklogTask } from '../../../utils/backlogTasks'
import Badge from '../../ui/Badge'
import { isSchoolHoliday } from '../../../services/weeklyPlanService'

const BREAK_DURATION_OPTIONS = [15, 30, 45, 60]

const DAY_LABELS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']
const DAY_SHORT_LABELS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']

// student.schedule (bkz. StudentTeacherModal) dayOfWeek'i bu Türkçe slug'larla saklar;
// weekDates her zaman Pazartesi'den başladığı için index eşlemesi doğrudan yapılabilir.

const QUICK_ADD_TEMPLATES = {
  lesson: {
    label: 'Soru Bankası Ödevi',
    task: {
      title: 'Soru Bankası Ödevi',
      taskType: 'soru-bankasi-odevi',
      startTime: '15:00',
      endTime: '16:00',
      durationMinutes: 60,
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
    card: 'border border-[#1e2c60]/35 bg-white shadow-[0_8px_20px_-6px_rgba(30,44,96,0.35)]',
    iconClassName: 'bg-sky-100 text-sky-500',
    tagClassName: 'bg-sky-100 text-sky-700',
    timeClassName: 'text-panel-blue',
    titleClassName: 'text-panel-text',
  },
  math: {
    icon: Calculator,
    card: 'border border-[#1e2c60]/35 bg-white shadow-[0_8px_20px_-6px_rgba(30,44,96,0.35)]',
    iconClassName: 'bg-orange-100 text-orange-500',
    tagClassName: 'bg-orange-100 text-orange-700',
    timeClassName: 'text-panel-blue',
    titleClassName: 'text-panel-text',
  },
  science: {
    icon: FlaskConical,
    card: 'border border-[#1e2c60]/35 bg-white shadow-[0_8px_20px_-6px_rgba(30,44,96,0.35)]',
    iconClassName: 'bg-teal-100 text-teal-600',
    tagClassName: 'bg-teal-100 text-teal-700',
    timeClassName: 'text-panel-blue',
    titleClassName: 'text-panel-text',
  },
  lesson: {
    icon: BookOpen,
    card: 'border border-[#f07b31]/45 bg-white shadow-[0_8px_20px_-6px_rgba(240,123,49,0.4)]',
    iconClassName: 'bg-[#f07b31]/15 text-[#f07b31]',
    tagClassName: 'bg-[#f07b31]/15 text-[#f07b31]',
    timeClassName: 'text-panel-blue',
    titleClassName: 'text-panel-text',
  },
  break: {
    icon: Coffee,
    card: 'border border-[#1e2c60]/35 bg-white shadow-[0_8px_20px_-6px_rgba(30,44,96,0.35)]',
    iconClassName: 'bg-amber-100 text-orange-500',
    tagClassName: 'bg-amber-100 text-orange-700',
    timeClassName: 'text-panel-blue',
    titleClassName: 'text-panel-text',
  },
  // Özel ders: veli tarafından eklenen "ozel-ders" görevleri ile öğretmenin sabit ders
  // programı slotları (bkz. ScheduleSlotCard) girenden bağımsız aynı tonu kullanır. barClassName
  // ve chipClassName varlığı TaskCard'da sol renkli çizgi + üstte tip etiketi çizmeyi tetikler.
  privateLesson: {
    icon: GraduationCap,
    card: 'border border-panel-accent/30 bg-panel-accent-soft/45 shadow-[0_8px_20px_-6px_rgba(232,162,61,0.3)]',
    iconClassName: 'bg-white text-panel-warm',
    tagClassName: 'bg-white text-panel-warm',
    timeClassName: 'text-panel-blue',
    titleClassName: 'text-panel-text',
    barClassName: 'bg-panel-accent',
    chipClassName: 'bg-panel-accent-soft text-panel-warm',
  },
  sport: {
    icon: Dumbbell,
    card: 'border border-panel-sage/35 bg-panel-sage-soft/45 shadow-[0_8px_20px_-6px_rgba(135,163,165,0.3)]',
    iconClassName: 'bg-white text-panel-sage',
    tagClassName: 'bg-white text-panel-sage',
    timeClassName: 'text-panel-blue',
    titleClassName: 'text-panel-text',
    barClassName: 'bg-panel-sage',
    chipClassName: 'bg-panel-sage-soft text-panel-sage',
  },
  free: {
    icon: Star,
    card: 'border border-[#1e2c60]/35 bg-white shadow-[0_8px_20px_-6px_rgba(30,44,96,0.35)]',
    iconClassName: 'bg-emerald-100 text-emerald-600',
    tagClassName: 'bg-emerald-100 text-emerald-700',
    timeClassName: 'text-panel-blue',
    titleClassName: 'text-emerald-700',
  },
  default: {
    icon: NotebookPen,
    card: 'border border-[#1e2c60]/35 bg-white shadow-[0_8px_20px_-6px_rgba(30,44,96,0.35)]',
    iconClassName: 'bg-panel-blue-soft text-panel-blue',
    tagClassName: 'bg-panel-blue-soft text-panel-blue',
    timeClassName: 'text-panel-blue',
    titleClassName: 'text-panel-text',
  },
}

function formatDayDate(dateISO) {
  return new Date(dateISO).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })
}

function formatShortDayDate(dateISO) {
  return new Date(dateISO).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
}

function normalizeText(value) {
  return value.toLocaleLowerCase('tr-TR')
}

function getTaskStyle(task) {
  if (['mola', 'dinlenme'].includes(task.taskType)) return TASK_STYLES.break
  if (task.taskType === 'serbest-zaman') return TASK_STYLES.free
  if (task.taskType === 'ozel-ders') return TASK_STYLES.privateLesson
  if (task.taskType === 'spor') return TASK_STYLES.sport

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

// Ödev kartının en üstünde artık genel "Matematik Ödevi" yerine daha ayırt edici bir
// etiket gösteriyoruz: ders adı + yayın evi adı bir arada (kart başına farklı olur),
// ikisinden biri eksikse sadece var olan gösterilir.
function getTaskTag(task) {
  if (task.subject && task.publisherName) return `${task.subject} · ${task.publisherName}`
  return task.publisherName || task.subject || null
}

// createTaskForHomework/AssignHomeworkModal, ödevin notunu hep "{kaynak adı}\n- {konu}: {test adları}"
// biçiminde üretir (bkz. teacher/components/AssignHomeworkModal.jsx buildNote). İlk satır zaten
// resourceBookName ile aynı olduğundan kartta tekrar etmeyip sadece "- " ile başlayan konu/test
// satırlarını ayıklıyoruz. Bir satırda birden fazla test varsa her testi ayrı "konu - test"
// satırına böleriz.
function getTaskTestRows(task) {
  if (!task.description) return []
  return task.description
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .flatMap((line) => {
      const detail = line.slice(2).trim()
      const separatorIndex = detail.indexOf(':')

      if (separatorIndex === -1) return [detail]

      const topic = detail.slice(0, separatorIndex).trim()
      const testNames = detail
        .slice(separatorIndex + 1)
        .split(',')
        .map((testName) => testName.trim())
        .filter(Boolean)

      if (!testNames.length) return [topic]
      return testNames.map((testName) => `${topic} - ${testName}`)
    })
}

// Ödev notu yukarıdaki kalıba uymuyorsa (ör. elle eklenmiş bir ders görevi) eski davranışa
// geri düşüp konuyu ya da ham açıklamayı tek satır olarak gösteririz.
function getFallbackDetail(task) {
  if (task.topic) return task.subject ? `${task.subject} · ${task.topic}` : task.topic
  if (task.description) return task.description
  return null
}

// Yayın evi zaten üstteki etikette (bkz. getTaskTag) gösterildiğinden burada tekrar
// edilmiyor, sadece kaynağın kendi adı gösterilir.
function getTaskSource(task) {
  return task.resourceBookName || task.schoolResourceName || null
}

function getQuestionProgress(task) {
  if (!task.targetQuestionCount) return null
  return `${task.targetQuestionCount} soru`
}

function getPageProgress(task) {
  if (!task.targetPageCount) return null
  return `${task.targetPageCount} sayfa`
}

function formatCompletionDuration(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return null
  if (totalSeconds < 60) return '<1 dk'

  const totalMinutes = Math.round(totalSeconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours && minutes) return `${hours} sa ${minutes} dk`
  if (hours) return `${hours} sa`
  return `${totalMinutes} dk`
}

function formatCompletionTimestamp(isoString) {
  if (!isoString) return null
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return null

  const datePart = date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })
  const timePart = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  return `${datePart} · ${timePart}`
}

function getCompletionTimestampLabel(task) {
  if (task.status !== 'tamamlandi') return null
  return formatCompletionTimestamp(task.completedAt)
}

function getCompletionTimerInfo(task) {
  if (task.status !== 'tamamlandi') return null
  if (!task.timerStartedAt) return { tone: 'muted', label: 'Sayaç tutulmadı' }

  const savedSeconds = Number(task.timerElapsedSeconds)
  if (Number.isFinite(savedSeconds) && savedSeconds >= 0) {
    return { tone: 'tracked', label: `Sayaç süresi: ${formatCompletionDuration(savedSeconds)}` }
  }

  const startedMs = new Date(task.timerStartedAt).getTime()
  const endedMs = new Date(task.completedAt || task.timerStoppedAt).getTime()
  if (Number.isFinite(startedMs) && Number.isFinite(endedMs)) {
    const elapsedSeconds = Math.max(0, Math.round((endedMs - startedMs) / 1000))
    return { tone: 'tracked', label: `Sayaç süresi: ${formatCompletionDuration(elapsedSeconds)}` }
  }

  return { tone: 'muted', label: 'Sayaç süresi hesaplanamadı' }
}

// Ödev (soru bankası/kitap) görevleri için kart başındaki ders ikonu yerine tamamlanma
// durumunu gösteririz: tamamlandıysa tik, aksi halde bekliyor ikonu. Diğer görev tiplerinde
// (ders, mola, serbest zaman) durum kavramı anlamlı olmadığından konu ikonu korunur.
function getHomeworkStatusIcon(task) {
  if (!HOMEWORK_TASK_TYPES.has(task.taskType)) return null
  const isDone = task.status === 'tamamlandi'
  return {
    Icon: isDone ? CheckCircle2 : Clock,
    iconClassName: isDone ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600',
  }
}

function isTaskGraded(task) {
  return HOMEWORK_TASK_TYPES.has(task.taskType) && task.status === 'tamamlandi' && task.correctCount != null
}

function CompletionTimerNote({ info, completedAtLabel }) {
  if (!info && !completedAtLabel) return null

  return (
    <span className="mt-0.5 flex flex-col gap-0.5 px-1">
      {info ? (
        <span
          className={`flex items-center gap-1 text-[10px] font-semibold leading-snug ${
            info.tone === 'tracked' ? 'text-panel-blue' : 'text-panel-text-muted'
          }`}
        >
          <Timer size={11} className="shrink-0" aria-hidden="true" />
          <span>{info.label}</span>
        </span>
      ) : null}
      {completedAtLabel ? (
        <span className="flex items-center gap-1 text-[10px] font-semibold leading-snug text-panel-text-muted">
          <CalendarDays size={11} className="shrink-0" aria-hidden="true" />
          <span>Tamamlandı: {completedAtLabel}</span>
        </span>
      ) : null}
    </span>
  )
}

// Net = doğru - yanlış/4 (klasik 4 yanlış 1 doğruyu götürür kuralı); başarı yüzdesi doğru
// sayısının cevaplanan (doğru+yanlış+boş) soru sayısına oranıdır.
function getGradeSummary(task) {
  const correct = task.correctCount ?? 0
  const wrong = task.wrongCount ?? 0
  const blank = task.blankCount ?? 0
  const total = correct + wrong + blank || task.targetQuestionCount || 0
  const net = Math.round((correct - wrong / 4) * 100) / 100
  const percent = total ? Math.round((correct / total) * 100) : 0
  return { correct, wrong, blank, net, percent }
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

// Öğretmenin bu öğrenciyle sabit ders programındaki (bkz. StudentTeachers.schedule_json) bir
// zaman dilimini temsil eden salt okunur, sahte "görev" kartı. Gerçek bir Tasks satırı değildir;
// sadece o saatin dolu olduğunu haftalık takvimde ayrı bir renkle göstermek için render edilir.
function ScheduleSlotCard({ task, muted = false, onManage }) {
  const title = task.subjectName ? `${task.subjectName} Dersi` : 'Planlı Ders'
  const style = TASK_STYLES.privateLesson
  const durationMinutes =
    task.startTime && task.endTime
      ? Math.max(0, parseTimeToMinutes(task.endTime) - parseTimeToMinutes(task.startTime))
      : null
  const toneClassName = muted ? 'border-slate-200 bg-white/80 text-slate-500 shadow-none' : style.card
  const iconClassName = style.iconClassName
  const timeClassName = style.timeClassName
  const titleClassName = style.titleClassName

  // Öğretmenin sabit ders programı slotu, veli tarafından eklenen "ozel-ders" görevinin
  // (bkz. TASK_STYLES.privateLesson / TaskCard summaryContent) birebir aynı düzenini kullanır:
  // aynı ikon kutusu, sol renkli çizgi ve üstte tip etiketi — girenden bağımsız aynı stil.
  const content = (
    <>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconClassName}`}>
        <GraduationCap size={21} strokeWidth={2.2} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-nowrap items-center justify-between gap-1">
          <span className={`block whitespace-nowrap text-[11px] font-bold leading-tight ${timeClassName}`}>
            {task.startTime}-{task.endTime}
          </span>
          {durationMinutes ? (
            <span className="shrink-0 whitespace-nowrap text-[10px] font-semibold text-panel-text-muted">
              {durationMinutes} dk
            </span>
          ) : null}
        </span>
        <span title={title} className={`mt-1 block truncate text-xs font-bold leading-snug ${titleClassName}`}>
          {title}
        </span>
        {task.teacherFullName ? (
          <span className="mt-0.5 block truncate text-[11px] font-semibold text-panel-text-muted">
            {task.teacherFullName}
          </span>
        ) : null}
      </span>
    </>
  )

  const cardBody = (
    <>
      {!muted ? (
        <span className={`absolute inset-y-2 left-1.5 w-1 rounded-full ${style.barClassName}`} aria-hidden="true" />
      ) : null}
      {!muted ? (
        <span
          className={`inline-flex w-fit items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${style.chipClassName}`}
        >
          {TASK_TYPES['ozel-ders']?.label}
        </span>
      ) : null}
      <div className="flex min-w-0 flex-1 items-center gap-2">{content}</div>
    </>
  )

  const containerClassName = `group relative flex min-h-[68px] w-full flex-col gap-1.5 rounded-xl border py-2.5 pr-3 transition duration-150 ${muted ? 'pl-3' : 'pl-4'} ${toneClassName}`

  if (typeof onManage === 'function') {
    return (
      <button
        type="button"
        onClick={() =>
          onManage({ dayOfWeek: task.dayOfWeek, startTime: task.startTime, endTime: task.endTime, date: task.date })
        }
        className={`${containerClassName} text-left hover:-translate-y-0.5 hover:shadow-sm`}
      >
        {cardBody}
      </button>
    )
  }

  return <div className={containerClassName}>{cardBody}</div>
}

// Öğrencinin okul ders programındaki (bkz. StudentProfiles.school_schedule_json /
// SchoolClassSchedules) bir zaman dilimini temsil eden salt okunur, sahte "görev" kartı.
// Gerçek bir Tasks satırı değildir; o saatin okulda geçtiğini göstermek ve o saate ödev
// eklenmesini engellemek (bkz. AddTaskDrawer/AssignHomeworkModal) için kullanılır.
function SchoolSlotCard({ task, muted = false }) {
  if (task.isHoliday) {
    return (
      <div
        className={`flex items-center gap-1.5 rounded-xl border border-dashed px-3 py-2.5 text-xs font-semibold ${
          muted ? 'border-slate-200 bg-white/75 text-slate-400' : 'border-slate-300 bg-slate-50 text-slate-500'
        }`}
      >
        <School size={12} aria-hidden="true" />
        <span className="truncate">{task.lessonName || 'Resmi Tatil'} · okul yok</span>
      </div>
    )
  }

  return (
    <div
      className={`flex flex-col gap-1 rounded-xl border px-3 py-2.5 ${
        muted ? 'border-slate-200 bg-white/75 text-slate-500' : 'border-slate-300 bg-slate-100 text-slate-600'
      }`}
    >
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
        <School size={12} aria-hidden="true" />
        {task.startTime}-{task.endTime}
      </span>
      <span className="truncate text-sm font-bold">{task.lessonName || 'Okulda'}</span>
    </div>
  )
}

function TaskCard({ task, onEditTask, onQuickAddBreak, onViewAnswerSheet, onManageLessonSlot, muted = false }) {
  const [showBreakMenu, setShowBreakMenu] = useState(false)

  if (task.isScheduleSlot) return <ScheduleSlotCard task={task} muted={muted} onManage={muted ? undefined : onManageLessonSlot} />
  if (task.isSchoolSlot) return <SchoolSlotCard task={task} muted={muted} />

  const style = getTaskStyle(task)
  const isHomework = HOMEWORK_TASK_TYPES.has(task.taskType)
  const backlog = isBacklogTask(task)
  const homeworkStatus = getHomeworkStatusIcon(task)
  const Icon = backlog ? AlertTriangle : homeworkStatus?.Icon || style.icon
  const iconClassName = backlog ? 'bg-panel-red-soft text-panel-red' : homeworkStatus?.iconClassName || style.iconClassName
  const canAddBreak = typeof onQuickAddBreak === 'function' && !['mola', 'dinlenme'].includes(task.taskType) && Boolean(task.endTime)
  const tag = isHomework ? getTaskTag(task) : null
  const testRows = isHomework ? getTaskTestRows(task) : []
  const fallbackDetail = !isHomework || testRows.length === 0 ? getFallbackDetail(task) : null
  const source = isHomework ? getTaskSource(task) : null
  const questionProgress = getQuestionProgress(task)
  const pageProgress = getPageProgress(task)
  const graded = isTaskGraded(task)
  const completionTimerInfo = isHomework ? getCompletionTimerInfo(task) : null
  const completionTimestampLabel = isHomework ? getCompletionTimestampLabel(task) : null
  const canOpenTask = typeof onEditTask === 'function'
  // Görev tipini konudan bağımsız her zaman ayırt edilebilir kılmak için (bkz. özel ders/spor
  // gibi konu etiketiyle renklenmeyen türler) stil tanımına sol renkli çizgi + üstte tip
  // etiketi ekliyoruz; barClassName tanımlı olmayan türlerde bu görsel hiç render edilmez.
  const hasTypeAccent = Boolean(style.barClassName) && !backlog && !muted
  const typeLabel = hasTypeAccent ? TASK_TYPES[task.taskType]?.label : null

  const handlePick = (minutes) => {
    setShowBreakMenu(false)
    onQuickAddBreak(task, minutes)
  }

  const cardToneClassName = backlog
    ? 'border-panel-red/50 bg-panel-red-soft/30 text-panel-text shadow-[0_1px_4px_rgba(220,38,38,0.15)]'
    : muted
      ? 'border-slate-200 bg-white/80 text-slate-500'
      : `shadow-[0_1px_4px_rgba(49,42,92,0.06)] hover:-translate-y-0.5 hover:shadow-sm ${style.card}`
  const summaryContent = (
    <>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconClassName}`}>
        <Icon size={21} strokeWidth={2.2} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-nowrap items-center justify-between gap-1">
          <span className={`block whitespace-nowrap text-[11px] font-bold leading-tight ${style.timeClassName}`}>
            {formatTaskTime(task)}
          </span>
          {task.durationMinutes ? (
            <span className="shrink-0 whitespace-nowrap text-[10px] font-semibold text-panel-text-muted">
              {task.durationMinutes} dk
            </span>
          ) : null}
        </span>
        {tag ? (
          <span
            title={tag}
            className={`mt-1 inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 text-[10px] font-extrabold ${style.tagClassName}`}
          >
            {tag}
          </span>
        ) : (
          <span
            title={task.title}
            className={`mt-1 block truncate text-xs font-bold leading-snug ${style.titleClassName}`}
          >
            {task.title}
          </span>
        )}
        {task.taskType === 'ozel-ders' && task.teacherFullName ? (
          <span className="mt-0.5 block truncate text-[11px] font-semibold text-panel-text-muted">
            {task.teacherFullName}
          </span>
        ) : null}
      </span>
    </>
  )

  return (
    <div
      className={`group relative flex min-h-[68px] w-full flex-col gap-1.5 rounded-xl border py-2.5 pr-3 transition duration-150 ${hasTypeAccent ? 'pl-4' : 'pl-3'} ${cardToneClassName} ${showBreakMenu ? 'z-30' : ''}`}
    >
      {hasTypeAccent ? (
        <span className={`absolute inset-y-2 left-1.5 w-1 rounded-full ${style.barClassName}`} aria-hidden="true" />
      ) : null}

      {typeLabel ? (
        <span
          className={`inline-flex w-fit items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${style.chipClassName}`}
        >
          {typeLabel}
        </span>
      ) : null}

      {backlog ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full border border-panel-red/30 bg-panel-red-soft px-2 py-0.5 text-[10px] font-extrabold text-panel-red">
            <AlertTriangle size={11} aria-hidden="true" />
            Zamanında yapılmadı
          </span>
          <Badge tone="red" className="px-2 py-0.5 text-[10px] font-extrabold">
            Biriken Görev
          </Badge>
        </div>
      ) : null}

      <div className="flex items-stretch gap-1">
        {canOpenTask ? (
          <button
            type="button"
            onClick={() => onEditTask(task)}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            {summaryContent}
          </button>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-2 text-left">{summaryContent}</div>
        )}

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

      {source || testRows.length ? (
        <div className="pl-11">
          {source ? (
            <span
              title={source}
              className="flex min-w-0 items-center gap-1 text-[11px] font-semibold leading-snug text-panel-text-muted"
            >
              {task.schoolResourceImageUrl ? (
                <img
                  src={task.schoolResourceImageUrl}
                  alt=""
                  className="h-4 w-4 shrink-0 rounded-full border border-panel-border object-cover"
                />
              ) : (
                <Library size={11} className="shrink-0" aria-hidden="true" />
              )}
              <span className="truncate">{source}</span>
            </span>
          ) : null}

          {testRows.length ? (
            <div className="mt-1 grid gap-0.5 border-l border-panel-blue-soft/80 pl-2">
              {testRows.map((line, index) => (
                <p key={index} className="break-words text-[11px] font-medium leading-snug text-panel-text-muted">
                  {line}
                </p>
              ))}
            </div>
          ) : fallbackDetail ? (
            <p className="mt-1 whitespace-pre-line break-words border-l border-panel-blue-soft/80 pl-2 text-[11px] font-medium leading-snug text-panel-text-muted">
              {fallbackDetail}
            </p>
          ) : null}
        </div>
      ) : fallbackDetail ? (
        <p className="whitespace-pre-line break-words pl-11 text-[11px] font-medium leading-snug text-panel-text-muted">
          {fallbackDetail}
        </p>
      ) : null}

      {questionProgress || pageProgress ? (
        <div className="flex flex-wrap items-center gap-1.5 pl-11">
          {questionProgress ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-panel-blue-soft px-2 py-0.5 text-[10px] font-bold text-panel-blue">
              <ListChecks size={11} aria-hidden="true" />
              {questionProgress}
            </span>
          ) : null}
          {pageProgress ? (
            <span className="text-[10px] font-semibold text-panel-text-muted">{pageProgress}</span>
          ) : null}
        </div>
      ) : null}

      {graded ? <GradeSummaryBar task={task} onViewAnswerSheet={onViewAnswerSheet} /> : null}
      <CompletionTimerNote info={completionTimerInfo} completedAtLabel={completionTimestampLabel} />
    </div>
  )
}

// Başarı yüzdesine göre rozet rengi: %70 altı soft kırmızı, %70-85 arası sarı, %85 üzeri yeşil.
function getGradeTierClassName(percent) {
  if (percent < 70) return 'bg-panel-red-soft text-panel-red'
  if (percent <= 85) return 'bg-amber-100 text-amber-700'
  return 'bg-emerald-100 text-emerald-700'
}

function GradeSummaryBar({ task, onViewAnswerSheet }) {
  const { correct, wrong, blank, net, percent } = getGradeSummary(task)
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        if (typeof onViewAnswerSheet === 'function') onViewAnswerSheet(task)
      }}
      disabled={typeof onViewAnswerSheet !== 'function'}
      className="mt-0.5 flex w-full flex-col gap-1 rounded-xl border-2 border-panel-blue-soft bg-white px-2.5 py-1.5 text-[11px] font-bold text-panel-text transition-colors duration-150 enabled:hover:border-panel-blue enabled:hover:bg-panel-blue-soft/20 disabled:cursor-default"
    >
      <span className="flex items-center gap-1 border-b border-panel-border/60 pb-1 text-panel-blue">
        <ScanLine size={13} aria-hidden="true" />
        Optik Sonuç
      </span>
      <span className="flex flex-nowrap items-center gap-2.5">
        <span className="flex shrink-0 items-center gap-1 text-emerald-600">
          <CheckCircle2 size={12} aria-hidden="true" /> {correct} D
        </span>
        <span className="flex shrink-0 items-center gap-1 text-panel-red">
          <XCircle size={12} aria-hidden="true" /> {wrong} Y
        </span>
        <span className="flex shrink-0 items-center gap-1 text-panel-text-muted">
          <MinusCircle size={12} aria-hidden="true" /> {blank} B
        </span>
      </span>
      <span className="flex items-center justify-between gap-2">
        <span className="text-panel-text-muted">Net {net}</span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-extrabold ${getGradeTierClassName(percent)}`}>
          %{percent}
        </span>
      </span>
    </button>
  )
}

export default function WeeklyPlannerGrid({
  weekDates,
  tasksByDate,
  dayStatusByDate,
  lessonSchedule,
  lessonScheduleExceptions,
  schoolSchedule,
  schoolHolidays,
  onAddHomework,
  onAddTask,
  onEditTask,
  onPublishDay,
  onQuickAddBreak,
  onViewAnswerSheet,
  onManageLessonSlot,
}) {
  const [expandedActionDate, setExpandedActionDate] = useState(null)
  const currentDate = todayISODate()
  const isCurrentWeekView = weekDates.includes(currentDate)
  const weekKey = weekDates.join('|')
  const [pastDayExpansion, setPastDayExpansion] = useState({ weekKey: '', expandedDates: new Set() })
  const expandedPastDates = pastDayExpansion.weekKey === weekKey ? pastDayExpansion.expandedDates : new Set()
  const hasCollapsedPastDay =
    isCurrentWeekView && weekDates.some((date) => date < currentDate && !expandedPastDates.has(date))
  const compactPastGridStyle = hasCollapsedPastDay
    ? {
        '--weekly-plan-columns': weekDates
          .map((date) =>
            isCurrentWeekView && date < currentDate && !expandedPastDates.has(date)
              ? '2.5rem'
              : 'minmax(18rem, 22rem)',
          )
          .join(' '),
      }
    : undefined

  const handleAddHomework = (date) => {
    if (date < currentDate || typeof onAddHomework !== 'function') return
    setExpandedActionDate(null)
    onAddHomework(date)
  }

  const handleAddTask = (date, initialTemplate) => {
    if (date < currentDate || typeof onAddTask !== 'function') return
    setExpandedActionDate(null)
    onAddTask(date, initialTemplate)
  }

  const handlePublishDay = (date) => {
    if (typeof onPublishDay !== 'function') return
    setExpandedActionDate(null)
    onPublishDay(date)
  }

  const togglePastDay = (date) => {
    setPastDayExpansion((current) => {
      const next = current.weekKey === weekKey ? new Set(current.expandedDates) : new Set()
      if (next.has(date)) {
        next.delete(date)
      } else {
        next.add(date)
      }
      return { weekKey, expandedDates: next }
    })
  }

  const renderDayColumn = (date, index) => {
    const scheduleSlots = (lessonSchedule || [])
      .filter((slot) => slot.dayOfWeek === DAY_KEYS[index] && slot.startTime)
      .filter(
        (slot) =>
          !(lessonScheduleExceptions || []).some(
            (exception) =>
              exception.dayOfWeek === slot.dayOfWeek && exception.startTime === slot.startTime && exception.date === date,
          ),
      )
      .map((slot, slotIndex) => ({
        ...slot,
        id: `schedule-${date}-${slotIndex}`,
        isScheduleSlot: true,
        startTime: slot.startTime,
        endTime: slot.endTime,
        date,
      }))
    const isHoliday = isSchoolHoliday(date, schoolHolidays)
    const schoolSlots = (isHoliday ? [] : schoolSchedule || [])
      .filter((slot) => slot.dayOfWeek === DAY_KEYS[index] && slot.startTime)
      .filter((slot) => (!slot.startDate || date >= slot.startDate) && (!slot.endDate || date <= slot.endDate))
      .map((slot, slotIndex) => ({
        id: `school-${date}-${slotIndex}`,
        isSchoolSlot: true,
        startTime: slot.startTime,
        endTime: slot.endTime,
        lessonName: slot.lessonName,
      }))
    const holidaySlots =
      isHoliday && (schoolSchedule || []).some((slot) => slot.dayOfWeek === DAY_KEYS[index])
        ? [
            {
              id: `holiday-${date}`,
              isSchoolSlot: true,
              isHoliday: true,
              lessonName:
                (schoolHolidays || []).find((entry) => date >= entry.startDate && date <= entry.endDate)?.name ||
                'Resmi Tatil',
            },
          ]
        : []
    const tasks = [...(tasksByDate?.[date] || []), ...scheduleSlots, ...schoolSlots, ...holidaySlots].sort((a, b) =>
      (a.startTime || '').localeCompare(b.startTime || ''),
    )
    const isPastDay = date < currentDate
    const isToday = date === currentDate
    const isPastDayExpanded = expandedPastDates.has(date)
    const isCollapsed = isPastDay && isCurrentWeekView && !isPastDayExpanded
    const isActionsExpanded = expandedActionDate === date && !isPastDay
    const dayStatus = dayStatusByDate?.[date]
    const hasPendingDraft = dayStatus === 'taslak'
    const shellTone = isPastDay
      ? 'border-slate-200 bg-slate-50/80 shadow-none'
      : 'border-panel-border bg-panel-surface shadow-[0_2px_10px_rgba(49,42,92,0.06)]'
    const headerTone = isPastDay
      ? 'border-slate-200 bg-slate-100/90'
      : isToday
        ? 'border-panel-blue bg-panel-blue'
        : 'border-panel-blue-soft bg-panel-blue-soft/80'
    const titleTone = isPastDay ? 'text-slate-600' : isToday ? 'text-white' : 'text-panel-text'
    const dateTone = isPastDay ? 'text-slate-500' : isToday ? 'text-white/85' : 'text-panel-blue'

    if (isCollapsed) {
      return (
        <button
          key={date}
          type="button"
          onClick={() => togglePastDay(date)}
          title={`${DAY_LABELS[index]} gününü göster`}
          aria-label={`${DAY_LABELS[index]} gününü göster`}
          aria-expanded="false"
          className="weekly-plan-collapsed-day group flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/90 px-2.5 py-2.5 text-left text-slate-600 transition-colors duration-150 hover:border-slate-300 hover:bg-white md:min-h-[18rem] md:flex-col md:items-center md:gap-2 md:px-1.5 md:py-2.5 md:text-center"
        >
          <span className="h-9 w-1 shrink-0 rounded-full bg-slate-300 md:hidden" aria-hidden="true" />
          <span className="min-w-0 flex-1 md:hidden">
            <span className="block truncate text-sm font-extrabold text-slate-700">{DAY_LABELS[index]}</span>
            <span className="mt-0.5 block truncate text-xs font-bold text-slate-500">{formatDayDate(date)}</span>
          </span>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors duration-150 group-hover:text-slate-700 md:h-6 md:w-6">
            <ChevronDown size={17} className="-rotate-90" aria-hidden="true" />
          </span>
          <span className="hidden min-h-0 flex-1 items-center justify-center overflow-hidden md:flex">
            <span className="weekly-plan-collapsed-day__vertical text-[11px] font-extrabold leading-none tracking-normal text-slate-700">
              {DAY_SHORT_LABELS[index]} · {formatShortDayDate(date)}
            </span>
          </span>
        </button>
      )
    }

    return (
      <div
        key={date}
        className={`flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border transition-colors duration-150 ${shellTone} ${
          isToday ? 'ring-2 ring-panel-blue-soft' : ''
        }`}
      >
        <div className={`border-b px-3 py-3 ${headerTone}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className={`break-words text-base font-extrabold leading-tight ${titleTone}`}>{DAY_LABELS[index]}</p>
              <p className={`mt-1 break-words text-sm font-bold leading-tight ${dateTone}`}>{formatDayDate(date)}</p>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {isToday ? (
                <span className="rounded-full bg-white/15 px-2 py-1 text-[10px] font-extrabold text-white">Bugün</span>
              ) : null}
              {hasPendingDraft ? (
                <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-extrabold text-amber-700">
                  Taslak
                </span>
              ) : null}
              {isPastDay ? (
                <button
                  type="button"
                  onClick={() => togglePastDay(date)}
                  title={isCollapsed ? 'Geçmiş günü göster' : 'Geçmiş günü kapat'}
                  aria-label={isCollapsed ? `${DAY_LABELS[index]} gününü göster` : `${DAY_LABELS[index]} gününü kapat`}
                  aria-expanded={!isCollapsed}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white/80 text-slate-500 transition-colors duration-150 hover:bg-white hover:text-slate-700"
                >
                  <ChevronDown
                    size={17}
                    className={`transition-transform duration-150 ${isCollapsed ? '' : 'rotate-180'}`}
                    aria-hidden="true"
                  />
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {isCollapsed ? null : (
        <div className={`flex flex-1 flex-col gap-3 px-3 py-3.5 ${isPastDay ? 'bg-slate-50/70' : ''}`}>
          {isPastDay || typeof onAddHomework !== 'function' ? null : (
            <button
              type="button"
              onClick={() => handleAddHomework(date)}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#f07b31] bg-[#f07b31] px-3 text-sm font-bold text-white shadow-sm transition-colors duration-150 hover:bg-[#d9691f]"
            >
              <Plus size={18} aria-hidden="true" />
              Ödev Ekle
            </button>
          )}

          <div className="flex flex-1 flex-col gap-2">
            {tasks.length ? tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onEditTask={onEditTask}
                onViewAnswerSheet={onViewAnswerSheet}
                onManageLessonSlot={onManageLessonSlot}
                muted={isPastDay}
                onQuickAddBreak={
                  isPastDay || typeof onQuickAddBreak !== 'function' || task.isScheduleSlot || task.isSchoolSlot
                    ? undefined
                    : (pickedTask, minutes) => onQuickAddBreak(date, pickedTask, minutes)
                }
              />
            )) : (
              <div
                className={`flex min-h-20 flex-1 items-center justify-center rounded-xl border border-dashed px-3 py-6 text-center text-sm font-semibold ${
                  isPastDay
                    ? 'border-slate-200 bg-white/70 text-slate-500'
                    : 'border-panel-blue-soft bg-panel-surface-soft/70 text-panel-text-muted'
                }`}
              >
                {isPastDay ? 'Bu güne kayıt eklenmemiş.' : 'Bu gün için plan boş.'}
              </div>
            )}
          </div>

          {!isPastDay && typeof onAddTask === 'function' ? (
          <div className="mt-auto grid gap-2">
            <button
              type="button"
              aria-expanded={isActionsExpanded}
              onClick={() => setExpandedActionDate(isActionsExpanded ? null : date)}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-panel-border bg-panel-surface px-3 text-xs font-bold text-panel-text shadow-sm transition-colors duration-150 hover:bg-panel-surface-soft"
            >
              Diğer
              <ChevronDown
                size={16}
                className={`transition-transform duration-150 ${isActionsExpanded ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>

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
                className="flex h-10 min-w-0 items-center justify-start gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 text-xs font-bold text-panel-blue transition-colors duration-150 hover:bg-slate-100/70"
              >
                <NotebookPen size={16} aria-hidden="true" />
                <span className="min-w-0 truncate">Soru Bankası Ödevi</span>
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
          ) : null}
        </div>
        )}
      </div>
    )
  }

  return (
    <div
      className={
        hasCollapsedPastDay
          ? 'weekly-plan-grid weekly-plan-grid--compact-past min-w-0 items-stretch gap-2'
          : 'grid min-w-0 grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 min-[1900px]:grid-cols-7'
      }
      style={compactPastGridStyle}
    >
      {weekDates.map((date, index) => renderDayColumn(date, index))}
    </div>
  )
}
