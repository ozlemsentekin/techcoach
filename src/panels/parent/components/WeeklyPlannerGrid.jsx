import { useEffect, useRef, useState } from 'react'
import {
  BookOpen,
  Calculator,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  Coffee,
  FlaskConical,
  Library,
  ListChecks,
  MinusCircle,
  NotebookPen,
  Plus,
  ScanLine,
  School,
  Star,
  Target,
  UploadCloud,
  XCircle,
} from 'lucide-react'
import { todayISODate, WEEKDAY_KEYS as DAY_KEYS } from '../../../utils/time'

const BREAK_DURATION_OPTIONS = [15, 30, 45, 60]

const DAY_LABELS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']

// student.schedule (bkz. StudentTeacherModal) dayOfWeek'i bu Türkçe slug'larla saklar;
// weekDates her zaman Pazartesi'den başladığı için index eşlemesi doğrudan yapılabilir.

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
// satırlarını ayıklıyor, ":" yerine "-" koyarak "konu - test adı" biçimine çeviriyoruz.
function getTaskTestLines(task) {
  if (!task.description) return []
  return task.description
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).replace(/:\s*/, ' - '))
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
  return task.resourceBookName || null
}

function getQuestionProgress(task) {
  if (!task.targetQuestionCount) return null
  return `${task.targetQuestionCount} soru`
}

function getPageProgress(task) {
  if (!task.targetPageCount) return null
  return `${task.targetPageCount} sayfa`
}

// Ödev (soru bankası/kitap) görevleri için kart başındaki ders ikonu yerine tamamlanma
// durumunu gösteririz: tamamlandıysa tik, aksi halde bekliyor ikonu. Diğer görev tiplerinde
// (ders, mola, serbest zaman) durum kavramı anlamlı olmadığından konu ikonu korunur.
function getHomeworkStatusIcon(task) {
  if (task.taskType !== 'odev') return null
  const isDone = task.status === 'tamamlandi'
  return {
    Icon: isDone ? CheckCircle2 : Clock,
    iconClassName: isDone ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600',
  }
}

function isTaskGraded(task) {
  return task.taskType === 'odev' && task.status === 'tamamlandi' && task.correctCount != null
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
function ScheduleSlotCard({ task }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-[#f07b31]/45 bg-white px-2.5 py-2 text-panel-blue shadow-[0_8px_20px_-6px_rgba(240,123,49,0.4)]">
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
        <CalendarDays size={12} aria-hidden="true" />
        {task.startTime}-{task.endTime}
      </span>
      <span className="truncate text-sm font-bold">Planlı Ders</span>
    </div>
  )
}

// Öğrencinin okul ders programındaki (bkz. StudentProfiles.school_schedule_json /
// SchoolClassSchedules) bir zaman dilimini temsil eden salt okunur, sahte "görev" kartı.
// Gerçek bir Tasks satırı değildir; o saatin okulda geçtiğini göstermek ve o saate ödev
// eklenmesini engellemek (bkz. AddTaskDrawer/AssignHomeworkModal) için kullanılır.
function SchoolSlotCard({ task }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-slate-300 bg-slate-100 px-2.5 py-2 text-slate-600">
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
        <School size={12} aria-hidden="true" />
        {task.startTime}-{task.endTime}
      </span>
      <span className="truncate text-sm font-bold">{task.lessonName || 'Okulda'}</span>
    </div>
  )
}

function TaskCard({ task, onEditTask, onQuickAddBreak, onViewAnswerSheet }) {
  const [showBreakMenu, setShowBreakMenu] = useState(false)

  if (task.isScheduleSlot) return <ScheduleSlotCard task={task} />
  if (task.isSchoolSlot) return <SchoolSlotCard task={task} />

  const style = getTaskStyle(task)
  const isHomework = task.taskType === 'odev'
  const homeworkStatus = getHomeworkStatusIcon(task)
  const Icon = homeworkStatus?.Icon || style.icon
  const iconClassName = homeworkStatus?.iconClassName || style.iconClassName
  const canAddBreak = typeof onQuickAddBreak === 'function' && !['mola', 'dinlenme'].includes(task.taskType) && Boolean(task.endTime)
  const tag = isHomework ? getTaskTag(task) : null
  const testLines = isHomework ? getTaskTestLines(task) : []
  const fallbackDetail = !isHomework || testLines.length === 0 ? getFallbackDetail(task) : null
  const source = isHomework ? getTaskSource(task) : null
  const questionProgress = getQuestionProgress(task)
  const pageProgress = getPageProgress(task)
  const graded = isTaskGraded(task)

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
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconClassName}`}>
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

      {source ? (
        <span
          title={source}
          className="flex items-center gap-1 pl-11 text-[11px] font-semibold leading-snug text-panel-text-muted"
        >
          <Library size={11} className="shrink-0" aria-hidden="true" />
          <span className="truncate">{source}</span>
        </span>
      ) : null}

      {testLines.length ? (
        <div className="flex items-start gap-1 pl-11">
          <Target size={11} className="mt-0.5 shrink-0 text-panel-text-muted" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            {testLines.map((line, index) => (
              <p key={index} className="break-words text-[11px] font-medium leading-snug text-panel-text-muted">
                {line}
              </p>
            ))}
          </div>
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
  schoolSchedule,
  onAddHomework,
  onAddTask,
  onEditTask,
  onPublishDay,
  onQuickAddBreak,
  onViewAnswerSheet,
}) {
  const [expandedActionDate, setExpandedActionDate] = useState(null)
  const currentDate = todayISODate()

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
    setExpandedActionDate(null)
    onPublishDay(date)
  }

  const renderDayColumn = (date, index) => {
    const scheduleSlots = (lessonSchedule || [])
      .filter((slot) => slot.dayOfWeek === DAY_KEYS[index] && slot.startTime)
      .map((slot, slotIndex) => ({
        id: `schedule-${date}-${slotIndex}`,
        isScheduleSlot: true,
        startTime: slot.startTime,
        endTime: slot.endTime,
      }))
    const schoolSlots = (schoolSchedule || [])
      .filter((slot) => slot.dayOfWeek === DAY_KEYS[index] && slot.startTime)
      .map((slot, slotIndex) => ({
        id: `school-${date}-${slotIndex}`,
        isSchoolSlot: true,
        startTime: slot.startTime,
        endTime: slot.endTime,
        lessonName: slot.lessonName,
      }))
    const tasks = [...(tasksByDate[date] || []), ...scheduleSlots, ...schoolSlots].sort((a, b) =>
      (a.startTime || '').localeCompare(b.startTime || ''),
    )
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

        <div className="flex flex-1 flex-col gap-3 px-3 py-4">
          {isPastDay || typeof onAddHomework !== 'function' ? null : (
            <button
              type="button"
              onClick={() => handleAddHomework(date)}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#f07b31] bg-[#f07b31] px-3 text-sm font-bold text-white shadow-sm transition-colors duration-150 hover:bg-[#d9691f]"
            >
              <Plus size={18} aria-hidden="true" />
              Ödev Ekle
            </button>
          )}

          <div className="flex flex-1 flex-col gap-2">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onEditTask={onEditTask}
                onViewAnswerSheet={onViewAnswerSheet}
                onQuickAddBreak={
                  isPastDay || typeof onQuickAddBreak !== 'function' || task.isScheduleSlot
                    ? undefined
                    : (pickedTask, minutes) => onQuickAddBreak(date, pickedTask, minutes)
                }
              />
            ))}
          </div>

          <div className="mt-auto grid gap-2">
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
                  className="flex h-10 min-w-0 items-center justify-start gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 text-xs font-bold text-panel-blue transition-colors duration-150 hover:bg-slate-100/70"
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
  }

  const weekdayDates = weekDates.slice(0, 5)
  const weekendDates = weekDates.slice(5, 7)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {weekdayDates.map((date, index) => renderDayColumn(date, index))}
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {weekendDates.map((date, index) => renderDayColumn(date, index + 5))}
      </div>
    </div>
  )
}
