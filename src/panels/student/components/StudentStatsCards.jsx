import { CheckCircle2, Clock, HelpCircle, BookOpen } from 'lucide-react'
import { TASK_TYPES } from '../../../data/taskTypes'

const DOT_COLORS = ['#7B5FF5', '#3B82F6', '#22A55E', '#E8A23D', '#EF4444', '#06B6D4', '#EC4899', '#84CC16']

const WORKED_STATUSES = new Set(['tamamlandi', 'kismen-tamamlandi'])
const READING_RESOURCE_TYPE = 'okuma_kitabi'

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

function StatCard({ iconBg, iconColor, icon, title, mainValue, subtitle, children }) {
  return (
    <div className="flex h-full flex-col gap-3 rounded-[19px] border border-[#E7E8EE] bg-white p-4 shadow-[0_8px_24px_rgba(31,38,75,0.06)]">
      <div className="flex items-center gap-2.5">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: iconBg }}
        >
          {icon(iconColor)}
        </div>
        <p className="text-[13.5px] font-semibold text-[#3A3F5C]">{title}</p>
      </div>

      <div>
        <p className="text-[24px] font-bold leading-tight text-[#1F2454]">{mainValue}</p>
        <p className="mt-1 text-[12px] text-[#8A90A6]">{subtitle}</p>
      </div>

      {children}
    </div>
  )
}

function SubjectDetailList({ items, formatValue, columns = 2 }) {
  if (items.length === 0) {
    return <p className="text-[12px] text-[#B4B8C8]">Henüz veri yok</p>
  }

  return (
    <div className={`grid gap-x-4 gap-y-1.5 ${columns === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
      {items.map((item, index) => (
        <div key={item.subject} className="flex min-w-0 items-start gap-1.5">
          <span
            className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: DOT_COLORS[index % DOT_COLORS.length] }}
            aria-hidden="true"
          />
          <span className="flex-1 text-[12px] leading-snug text-[#5B607A]">{item.subject}</span>
          <span className="shrink-0 text-[12px] font-medium text-[#3A3F5C]">{formatValue(item.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function StudentStatsCards({ tasks = [], completed, total, progress }) {
  const workedTasks = tasks.filter((task) => WORKED_STATUSES.has(task.status))

  const timeBySubject = aggregateBySubject(
    workedTasks.filter((task) => task.resourceType !== READING_RESOURCE_TYPE),
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
    <div className="grid grid-cols-1 gap-3.5 min-[700px]:grid-cols-2 min-[1100px]:grid-cols-4">
      <StatCard
        iconBg="#EEEAF8"
        iconColor="#7B5FF5"
        icon={(color) => <CheckCircle2 size={17} style={{ color }} aria-hidden="true" />}
        title="Tamamlanan / Toplam Görev"
        mainValue={`${completed} / ${total}`}
        subtitle={`%${progress} tamamlandı`}
      >
        <div>
          <div
            className="h-[6px] w-full overflow-hidden rounded-full bg-[#EEEAF8]"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-label="Tamamlanan görev oranı"
          >
            <div
              className="h-full rounded-full bg-[#7B5FF5] motion-safe:transition-all motion-safe:duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-[12px] text-[#8A90A6]">Bugünkü görev ilerlemesi</p>
        </div>
      </StatCard>

      <StatCard
        iconBg="#E8F1FC"
        iconColor="#3B82F6"
        icon={(color) => <Clock size={17} style={{ color }} aria-hidden="true" />}
        title="Çalışılan Toplam Süre"
        mainValue={formatDuration(totalMinutes)}
        subtitle="Toplam süre"
      >
        <SubjectDetailList items={timeBySubject} formatValue={formatDuration} />
      </StatCard>

      <StatCard
        iconBg="#E7F8EE"
        iconColor="#22A55E"
        icon={(color) => <HelpCircle size={17} style={{ color }} aria-hidden="true" />}
        title="Çözülen Soru"
        mainValue={`${totalQuestions} soru`}
        subtitle="Toplam çözülen soru"
      >
        <SubjectDetailList items={questionsBySubject} formatValue={(value) => `${value}`} />
      </StatCard>

      <StatCard
        iconBg="#FBF0DD"
        iconColor="#E8A23D"
        icon={(color) => <BookOpen size={17} style={{ color }} aria-hidden="true" />}
        title="Okuma Süresi"
        mainValue={formatDuration(totalReadingMinutes)}
        subtitle="Toplam okuma süresi"
      >
        <SubjectDetailList items={readingBySubject} formatValue={formatDuration} columns={1} />
      </StatCard>
    </div>
  )
}
