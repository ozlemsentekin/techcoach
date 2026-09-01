import { HelpCircle, Target } from 'lucide-react'
import { HOMEWORK_TASK_TYPES, TASK_TYPES } from '../../../data/taskTypes'
import { cn } from '../../ui/utils'
import { RATE_TONES, successRateTone } from '../../shared/rateTones'

const DOT_CLASSES = [
  'bg-panel-blue',
  'bg-panel-sage',
  'bg-panel-warm',
  'bg-panel-lilac',
  'bg-panel-slate',
  'bg-panel-accent',
]

function getSubjectLabel(task) {
  return task.subject || TASK_TYPES[task.taskType]?.label || 'Genel'
}

/** Bir görevin optik/manuel sonucundan doğru ve cevaplanan (doğru+yanlış+boş) soru sayısını çıkarır. */
function getTaskResultTotals(task) {
  const testResults = Object.values(task.testResults || {}).filter(Boolean)
  const hasAggregate = [task.correctCount, task.wrongCount, task.blankCount].some(
    (value) => value !== undefined && value !== null,
  )

  const fromTests = testResults.reduce(
    (totals, result) => ({
      correct: totals.correct + (Number(result.correct) || 0),
      wrong: totals.wrong + (Number(result.wrong) || 0),
      blank: totals.blank + (Number(result.blank) || 0),
    }),
    { correct: 0, wrong: 0, blank: 0 },
  )

  const correct = hasAggregate ? Number(task.correctCount) || 0 : fromTests.correct
  const wrong = hasAggregate ? Number(task.wrongCount) || 0 : fromTests.wrong
  const blank = hasAggregate ? Number(task.blankCount) || 0 : fromTests.blank

  return { correct, answered: correct + wrong + blank }
}

/** Görevlerin sonuçlarını ders bazında toplar; başarı oranına göre azalan sıralı döner. */
function aggregateResultsBySubject(tasks) {
  const totals = new Map()
  for (const task of tasks) {
    const { correct, answered } = getTaskResultTotals(task)
    if (answered <= 0) continue
    const subject = getSubjectLabel(task)
    const entry = totals.get(subject) || { correct: 0, answered: 0 }
    entry.correct += correct
    entry.answered += answered
    totals.set(subject, entry)
  }
  return Array.from(totals.entries())
    .map(([subject, entry]) => ({
      subject,
      correct: entry.correct,
      answered: entry.answered,
      successRate: entry.correct / entry.answered,
    }))
    .sort((a, b) => b.successRate - a.successRate)
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

function StatCard({ iconClassName, icon, title, mainValue, mainValueClassName, children }) {
  return (
    <div className="flex h-full items-stretch overflow-hidden rounded-xl border border-panel-border bg-panel-surface shadow-sm">
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 p-4">
        <div className="flex items-center gap-2">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconClassName}`}>
            {icon}
          </div>
          <p className="min-w-0 truncate text-base font-bold text-panel-text">{title}</p>
        </div>
        {children}
      </div>

      <div className="flex shrink-0 items-center justify-center border-l border-panel-border bg-panel-surface-soft px-5 py-4">
        <p className={cn('whitespace-nowrap text-2xl font-bold leading-tight text-panel-text', mainValueClassName)}>
          {mainValue}
        </p>
      </div>
    </div>
  )
}

function SubjectInlineBreakdown({ items, formatValue }) {
  if (items.length === 0) {
    return <p className="text-xs text-panel-text-muted">Henüz veri yok</p>
  }

  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-panel-text-muted">
      {items.map((item, index) => (
        <span key={item.subject} className="inline-flex items-center gap-1.5">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_CLASSES[index % DOT_CLASSES.length]}`}
            aria-hidden="true"
          />
          <span>{item.subject}</span>
          <span className="font-semibold text-panel-text">{formatValue(item.value)}</span>
        </span>
      ))}
    </p>
  )
}

export default function StudentStatsCards({ tasks = [] }) {
  const questionsBySubject = aggregateBySubject(tasks, (task) => task.completedQuestionCount)
  const totalQuestions = questionsBySubject.reduce((sum, item) => sum + item.value, 0)

  const successBySubject = aggregateResultsBySubject(tasks)
  const totalAnswered = successBySubject.reduce((sum, item) => sum + item.answered, 0)
  const successRate = totalAnswered > 0 ? successBySubject.reduce((sum, item) => sum + item.correct, 0) / totalAnswered : null
  const successPercent = successRate != null ? Math.round(successRate * 100) : null
  const successColors = RATE_TONES[successRateTone(successRate)]

  return (
    <div className="grid grid-cols-1 gap-3.5 min-[760px]:grid-cols-2">
      <StatCard
        iconClassName="bg-panel-sage-soft text-panel-sage"
        icon={<HelpCircle size={16} aria-hidden="true" />}
        title="Çözülen Soru"
        mainValue={`${totalQuestions} soru`}
      >
        <SubjectInlineBreakdown items={questionsBySubject} formatValue={(value) => `${value}`} />
      </StatCard>

      <StatCard
        iconClassName={cn('bg-panel-blue-soft', successColors.text)}
        icon={<Target size={16} aria-hidden="true" />}
        title="Günün Başarı Oranı"
        mainValue={successPercent != null ? `%${successPercent}` : '—'}
        mainValueClassName={successPercent != null ? successColors.text : undefined}
      >
        <SubjectInlineBreakdown
          items={successBySubject.map((item) => ({ subject: item.subject, value: item.successRate }))}
          formatValue={(value) => `(%${Math.round(value * 100)})`}
        />
      </StatCard>
    </div>
  )
}
