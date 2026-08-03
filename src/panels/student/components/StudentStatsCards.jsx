import { Clock, HelpCircle, BookOpen } from 'lucide-react'
import { TASK_TYPES } from '../../../data/taskTypes'

const DOT_CLASSES = [
  'bg-panel-blue',
  'bg-panel-sage',
  'bg-panel-warm',
  'bg-panel-lilac',
  'bg-panel-slate',
  'bg-panel-accent',
]

const WORKED_STATUSES = new Set(['tamamlandi', 'kismen-tamamlandi'])
const READING_RESOURCE_TYPE = 'okuma_kitabi'
const HOMEWORK_TASK_TYPE = 'odev'

function getSubjectLabel(task) {
  return task.subject || TASK_TYPES[task.taskType]?.label || 'Genel'
}

function formatDuration(totalMinutes) {
  if (!totalMinutes || totalMinutes <= 0) return '0 dk'
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes} dk`
  if (minutes === 0) return `${hours} sa`
  return `${hours} sa ${minutes} dk`
}

/** Görevlerden ders bazlı toplamlar çıkarır; sadece pozitif değeri olan dersler döner. */
function aggregateBySubject(tasks, valueSelector) {
  const totals = new Map()
  for (const task of tasks) {
    const value = valueSelector(task)
    if (!value || value <= 0) continue
    const subject = getSubjectLabel(task)
    totals.set(subject, (totals.get(subject) || 0) + value)
  }
  return Array.from(totals.entries())
    .map(([subject, value]) => ({ subject, value }))
    .sort((a, b) => b.value - a.value)
}

function StatCard({ iconClassName, icon, title, mainValue, subtitle, children }) {
  return (
    <div className="flex h-full flex-col gap-3 rounded-xl border border-panel-border bg-panel-surface p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconClassName}`}>
          {icon}
        </div>
        <p className="min-w-0 truncate text-sm font-semibold text-panel-text">{title}</p>
      </div>

      <div>
        <p className="text-2xl font-bold leading-tight text-panel-text">{mainValue}</p>
        <p className="mt-1 text-xs text-panel-text-muted">{subtitle}</p>
      </div>

      {children}
    </div>
  )
}

function SubjectDetailList({ items, formatValue, columns = 2 }) {
  if (items.length === 0) {
    return <p className="text-xs text-panel-text-muted">Henüz veri yok</p>
  }

  return (
    <div className={`grid gap-x-4 gap-y-1.5 ${columns === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
      {items.map((item, index) => (
        <div key={item.subject} className="flex min-w-0 items-start gap-1.5">
          <span
            className={`mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full ${DOT_CLASSES[index % DOT_CLASSES.length]}`}
            aria-hidden="true"
          />
          <span className="flex-1 text-xs leading-snug text-panel-text-muted">{item.subject}</span>
          <span className="shrink-0 text-xs font-semibold text-panel-text">{formatValue(item.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function StudentStatsCards({ tasks = [] }) {
  const workedTasks = tasks.filter((task) => WORKED_STATUSES.has(task.status))
  const workedHomeworkTasks = workedTasks.filter((task) => task.taskType === HOMEWORK_TASK_TYPE)

  const timeBySubject = aggregateBySubject(
    workedHomeworkTasks.filter((task) => task.resourceType !== READING_RESOURCE_TYPE),
    (task) => task.durationMinutes,
  )
  const totalMinutes = timeBySubject.reduce((sum, item) => sum + item.value, 0)

  const questionsBySubject = aggregateBySubject(tasks, (task) => task.completedQuestionCount)
  const totalQuestions = questionsBySubject.reduce((sum, item) => sum + item.value, 0)

  const readingBySubject = aggregateBySubject(
    workedTasks.filter((task) => task.resourceType === READING_RESOURCE_TYPE),
    (task) => task.durationMinutes,
  )
  const totalReadingMinutes = readingBySubject.reduce((sum, item) => sum + item.value, 0)

  return (
    <div className="grid grid-cols-1 gap-3.5 min-[760px]:grid-cols-3">
      <StatCard
        iconClassName="bg-panel-slate-soft text-panel-slate"
        icon={<Clock size={18} aria-hidden="true" />}
        title="Çalışılan Toplam Süre"
        mainValue={formatDuration(totalMinutes)}
        subtitle="Toplam süre"
      >
        <SubjectDetailList items={timeBySubject} formatValue={formatDuration} />
      </StatCard>

      <StatCard
        iconClassName="bg-panel-sage-soft text-panel-sage"
        icon={<HelpCircle size={18} aria-hidden="true" />}
        title="Çözülen Soru"
        mainValue={`${totalQuestions} soru`}
        subtitle="Toplam çözülen soru"
      >
        <SubjectDetailList items={questionsBySubject} formatValue={(value) => `${value}`} />
      </StatCard>

      <StatCard
        iconClassName="bg-panel-warm-soft text-panel-warm"
        icon={<BookOpen size={18} aria-hidden="true" />}
        title="Okuma Süresi"
        mainValue={formatDuration(totalReadingMinutes)}
        subtitle="Toplam okuma süresi"
      >
        <SubjectDetailList items={readingBySubject} formatValue={formatDuration} columns={1} />
      </StatCard>
    </div>
  )
}
