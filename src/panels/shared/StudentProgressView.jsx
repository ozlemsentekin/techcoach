import { createElement, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  BarChart3,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Layers3,
  LineChart,
  Target,
  Trophy,
  XCircle,
} from 'lucide-react'
import { getProgressOverview } from '../../services/progressService'
import { calculateNet } from '../../utils/netCalculator'
import { addDaysISO, dateToISO, getMondayOfWeek, todayISODate } from '../../utils/time'
import PageHeader from '../layout/PageHeader'
import LoadingState from './LoadingState'

const RANGE_FILTERS = [
  { id: 'today', label: 'Bugün' },
  { id: 'week', label: 'Bu Hafta' },
  { id: 'month', label: 'Bu Ay' },
  { id: 'all', label: 'Tüm Zamanlar' },
]

const COMPLETED_STATUSES = new Set(['tamamlandi', 'kismen-tamamlandi'])
const HIDDEN_SUBJECT_TAB_KEYS = new Set(['genel', 'online fen bilimleri'])
const collator = new Intl.Collator('tr-TR')
const numberFormatter = new Intl.NumberFormat('tr-TR')

function asNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function formatNumber(value) {
  return numberFormatter.format(Math.round(asNumber(value)))
}

function formatNet(value) {
  const rounded = Math.round(asNumber(value) * 10) / 10
  return numberFormatter.format(rounded)
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return 'Veri yok'
  return `${Math.round(value)}%`
}

function toDateKey(value) {
  if (!value) return ''
  if (typeof value === 'string') return value.slice(0, 10)
  return dateToISO(new Date(value))
}

function toMonthKey(value) {
  const dateKey = toDateKey(value)
  return dateKey ? dateKey.slice(0, 7) : ''
}

function subjectLabel(item) {
  return item?.subjectName || item?.subject || 'Genel'
}

function subjectKey(label) {
  return (label || 'Genel').trim().toLocaleLowerCase('tr-TR')
}

function resourceLabel(item) {
  if (item?.resourceBookName) return item.resourceBookName
  if (item?.publisherName) return `${item.publisherName} kaynağı`
  return 'Kaynaksız çalışma'
}

function publisherLabel(item) {
  return item?.publisherName || ''
}

function contentLabel(item) {
  return item?.topic || item?.taskTitle || item?.title || item?.description || 'Genel çalışma'
}

function testTopicLabel(test, item) {
  return test?.topicName || item?.topic || contentLabel(item)
}

function dateInRange(dateKey, rangeId, today) {
  if (!dateKey) return false
  if (rangeId === 'all') return true
  if (dateKey > today) return false
  if (rangeId === 'today') return dateKey === today
  if (rangeId === 'week') {
    const weekStart = getMondayOfWeek(today)
    return dateKey >= weekStart && dateKey <= today
  }
  if (rangeId === 'month') return dateKey.slice(0, 7) === today.slice(0, 7)
  return true
}

function dateRangeKeys(rangeId, today, records) {
  if (rangeId === 'today') return [today]

  if (rangeId === 'week') {
    const start = getMondayOfWeek(today)
    const days = []
    let day = start
    while (day <= today) {
      days.push(day)
      day = addDaysISO(day, 1)
    }
    return days
  }

  if (rangeId === 'month') {
    const start = `${today.slice(0, 7)}-01`
    const days = []
    let day = start
    while (day <= today) {
      days.push(day)
      day = addDaysISO(day, 1)
    }
    return days
  }

  const monthKeys = Array.from(new Set(records.map((record) => toMonthKey(record.date)).filter(Boolean))).sort()
  return monthKeys.length ? monthKeys.slice(-10) : [today.slice(0, 7)]
}

function formatDateLabel(dateKey, rangeId) {
  if (rangeId === 'all') {
    return new Date(`${dateKey}-01T00:00:00`).toLocaleDateString('tr-TR', { month: 'short', year: '2-digit' })
  }
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
}

function splitTestResults(item, testsById, { idPrefix, minutes, source }) {
  const entries = Object.entries(item.testResults || {})
    .map(([testId, result]) => {
      const test = testsById.get(testId)
      const correct = asNumber(result?.correct)
      const wrong = asNumber(result?.wrong)
      const blank = asNumber(result?.blank)
      const questions = correct + wrong
      const topic = testTopicLabel(test, item)
      const testName = test?.name
      return {
        id: `${idPrefix}-${testId}`,
        taskId: item.taskId || item.id,
        sessionId: item.sessionId,
        homeworkId: item.homeworkId,
        date: toDateKey(item.startedAt || item.completedAt || item.date),
        subject: subjectLabel(item),
        content: testName ? `${topic} · ${testName}` : topic,
        contentGroup: topic,
        resource: resourceLabel(item),
        publisher: publisherLabel(item),
        questions,
        correct,
        wrong,
        blank,
        weight: questions + blank || asNumber(test?.questionCount) || 1,
        source,
      }
    })
    .filter((record) => record.questions > 0 || record.blank > 0)

  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0)
  return entries.map(({ weight, ...entry }) => ({
    ...entry,
    minutes: totalWeight > 0 ? (asNumber(minutes) * weight) / totalWeight : 0,
  }))
}

function buildActivityRecords(overview, testsById) {
  const records = []
  const taskIdsWithSessions = new Set()

  ;(overview.sessions || []).forEach((session) => {
    if (session.taskId) taskIdsWithSessions.add(session.taskId)

    const detailedRecords = splitTestResults(
      { ...session, sessionId: session.id },
      testsById,
      {
        idPrefix: `session-test-${session.id}`,
        minutes: asNumber(session.durationMinutes) || asNumber(session.taskDurationMinutes),
        source: 'session',
      },
    )
    if (detailedRecords.length) {
      records.push(...detailedRecords)
      return
    }

    records.push({
      id: `session-${session.id}`,
      sessionId: session.id,
      taskId: session.taskId,
      homeworkId: session.homeworkId,
      date: toDateKey(session.startedAt),
      subject: subjectLabel(session),
      content: contentLabel(session),
      contentGroup: contentLabel(session),
      resource: resourceLabel(session),
      publisher: publisherLabel(session),
      questions: asNumber(session.completedQuestionCount),
      correct: asNumber(session.correctCount),
      wrong: asNumber(session.wrongCount),
      blank: asNumber(session.blankCount),
      minutes: asNumber(session.durationMinutes) || asNumber(session.taskDurationMinutes),
      source: 'session',
    })
  })

  ;(overview.tasks || []).forEach((task) => {
    if (taskIdsWithSessions.has(task.id)) return

    const detailedRecords = splitTestResults(task, testsById, {
      idPrefix: `task-test-${task.id}`,
      minutes: task.durationMinutes,
      source: 'task',
    })
    if (detailedRecords.length) {
      records.push(...detailedRecords)
      return
    }

    const questions = asNumber(task.completedQuestionCount)
    const pages = asNumber(task.completedPageCount)
    const hasRecordedWork =
      questions > 0 ||
      pages > 0 ||
      asNumber(task.correctCount) > 0 ||
      asNumber(task.wrongCount) > 0

    if (!hasRecordedWork) return

    records.push({
      id: `task-${task.id}`,
      taskId: task.id,
      homeworkId: task.homeworkId,
      date: toDateKey(task.completedAt || task.date),
      subject: subjectLabel(task),
      content: contentLabel(task),
      contentGroup: contentLabel(task),
      resource: resourceLabel(task),
      publisher: publisherLabel(task),
      questions,
      correct: asNumber(task.correctCount),
      wrong: asNumber(task.wrongCount),
      blank: asNumber(task.blankCount),
      minutes: asNumber(task.durationMinutes),
      source: 'task',
    })
  })

  const homeworkIdsWithActivity = new Set(records.map((record) => record.homeworkId).filter(Boolean))
  ;(overview.homeworks || []).forEach((homework) => {
    if (homeworkIdsWithActivity.has(homework.id)) return

    const questions = asNumber(homework.completedQuestionCount)
    if (questions <= 0) return

    records.push({
      id: `homework-${homework.id}`,
      homeworkId: homework.id,
      date: toDateKey(homework.updatedAt || homework.dueDate || homework.assignedDate),
      subject: subjectLabel(homework),
      content: homework.title || contentLabel(homework),
      contentGroup: homework.title || contentLabel(homework),
      resource: resourceLabel(homework),
      publisher: publisherLabel(homework),
      questions,
      correct: 0,
      wrong: 0,
      blank: 0,
      minutes: 0,
      source: 'homework',
    })
  })

  return records
}

function buildSubjectTabs(overview) {
  const subjects = new Map()
  const addSubject = (label) => {
    const cleanLabel = (label || '').trim()
    if (!cleanLabel) return
    const key = subjectKey(cleanLabel)
    if (HIDDEN_SUBJECT_TAB_KEYS.has(key)) return
    if (!subjects.has(key)) subjects.set(key, { key, label: cleanLabel })
  }

  ;(overview.resourceBooks || []).forEach((book) => addSubject(book.subjectName))
  ;(overview.tasks || []).forEach((task) => addSubject(subjectLabel(task)))
  ;(overview.sessions || []).forEach((session) => addSubject(subjectLabel(session)))
  ;(overview.homeworks || []).forEach((homework) => addSubject(homework.subject))
  ;(overview.wrongQuestions || []).forEach((item) => addSubject(item.subject))

  return Array.from(subjects.values()).sort((a, b) => collator.compare(a.label, b.label))
}

function aggregateBy(records, keyReader) {
  const groups = new Map()

  records.forEach((record) => {
    const key = keyReader(record)
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: key,
        questions: 0,
        correct: 0,
        wrong: 0,
        blank: 0,
        minutes: 0,
        sessions: 0,
        publishers: new Set(),
      })
    }

    const group = groups.get(key)
    group.questions += record.questions
    group.correct += record.correct
    group.wrong += record.wrong
    group.blank += record.blank
    group.minutes += record.minutes
    if (record.source === 'session') group.sessions += 1
    if (record.publisher) group.publishers.add(record.publisher)
  })

  return Array.from(groups.values())
    .map(({ publishers, ...group }) => ({
      ...group,
      publishers: Array.from(publishers),
      accuracy: group.correct + group.wrong > 0 ? (group.correct / (group.correct + group.wrong)) * 100 : NaN,
      net: calculateNet(group.correct, group.wrong),
    }))
    .sort((a, b) => b.questions - a.questions || b.minutes - a.minutes || collator.compare(a.label, b.label))
}

function sumRecords(records) {
  return records.reduce(
    (total, record) => ({
      questions: total.questions + record.questions,
      correct: total.correct + record.correct,
      wrong: total.wrong + record.wrong,
      blank: total.blank + record.blank,
      minutes: total.minutes + record.minutes,
    }),
    { questions: 0, correct: 0, wrong: 0, blank: 0, minutes: 0 },
  )
}

function buildTimeline(records, rangeId, today) {
  const keys = dateRangeKeys(rangeId, today, records)
  const rows = keys.map((key) => ({
    key,
    label: formatDateLabel(key, rangeId),
    questions: 0,
    minutes: 0,
  }))
  const rowMap = new Map(rows.map((row) => [row.key, row]))

  records.forEach((record) => {
    const key = rangeId === 'all' ? toMonthKey(record.date) : record.date
    const row = rowMap.get(key)
    if (!row) return
    row.questions += record.questions
    row.minutes += record.minutes
  })

  const maxValue = Math.max(...rows.map((row) => row.questions + row.minutes), 1)
  return rows.map((row) => ({ ...row, ratio: (row.questions + row.minutes) / maxValue }))
}

function buildInsights({ stats, contentRows, wrongRows }) {
  const insights = []
  const answeredQuestions = stats.correct + stats.wrong
  const weakestContent = contentRows
    .filter((row) => row.correct + row.wrong >= 3)
    .sort((a, b) => a.accuracy - b.accuracy)[0]
  const strongestContent = contentRows
    .filter((row) => row.correct + row.wrong >= 3)
    .sort((a, b) => b.accuracy - a.accuracy)[0]
  const repeatTopic = wrongRows
    .filter((item) => item.reviewStatus !== 'ogrenildi')
    .sort((a, b) => toDateKey(b.createdAt).localeCompare(toDateKey(a.createdAt)))[0]

  if (strongestContent) {
    insights.push({
      icon: Trophy,
      title: 'Güçlü Alan',
      text: `${strongestContent.label} için doğruluk ${formatPercent(strongestContent.accuracy)}.`,
      tone: 'text-panel-sage bg-panel-sage-soft',
    })
  }

  if (weakestContent && weakestContent.wrong > 0) {
    insights.push({
      icon: Target,
      title: 'Tekrar Odağı',
      text: `${weakestContent.label} içinde ${formatNumber(weakestContent.wrong)} yanlış görünüyor.`,
      tone: 'text-panel-warm bg-panel-accent-soft',
    })
  } else if (repeatTopic) {
    insights.push({
      icon: AlertTriangle,
      title: 'Tekrar Odağı',
      text: `${repeatTopic.topic || repeatTopic.subject} hata defterinde bekliyor.`,
      tone: 'text-panel-warm bg-panel-accent-soft',
    })
  }

  insights.push({
    icon: Clock3,
    title: 'Çalışma Ritmi',
    text:
      stats.minutes > 0
        ? `${formatNumber(stats.minutes)} dk odaklı çalışma kaydedildi.`
        : answeredQuestions > 0
          ? 'Soru kaydı var, süre kaydı henüz az.'
          : 'Bu filtrede çalışma kaydı bekleniyor.',
    tone: 'text-student-theme-text bg-student-theme-soft',
  })

  return insights.slice(0, 3)
}

function metricDescription(stats, plannedTasks, completedTasks) {
  const answeredQuestions = stats.correct + stats.wrong
  if (answeredQuestions > 0) return `${formatNumber(stats.correct)} doğru, ${formatNumber(stats.wrong)} yanlış`
  if (plannedTasks > 0) return `${completedTasks} / ${plannedTasks} plan görevi tamamlandı`
  return 'Seçili filtrede kayıt yok'
}

function SummaryMetric({ icon, title, value, description }) {
  return (
    <article className="panel-card min-h-[132px] p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-panel-text-muted">
        {createElement(icon, { size: 18, 'aria-hidden': true })}
        <span>{title}</span>
      </div>
      <p className="mt-3 text-2xl font-bold text-panel-text">{value}</p>
      <p className="mt-1 text-sm text-panel-text-muted">{description}</p>
    </article>
  )
}

function SubjectTabs({ subjects, selectedKey, onSelect }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Dersler">
      {subjects.map((subject) => (
        <button
          key={subject.key}
          type="button"
          role="tab"
          aria-selected={selectedKey === subject.key}
          onClick={() => onSelect(subject.key)}
          className={`h-10 shrink-0 rounded-xl border px-4 text-sm font-semibold transition-colors ${
            selectedKey === subject.key
              ? 'border-student-theme-primary bg-student-theme-primary text-student-theme-button-text'
              : 'border-panel-border bg-panel-surface text-panel-text-muted hover:bg-student-theme-soft hover:text-student-theme-text'
          }`}
        >
          {subject.label}
        </button>
      ))}
    </div>
  )
}

function RangeFilter({ selectedRange, onSelect }) {
  return (
    <div className="flex w-full gap-1 rounded-xl border border-panel-border bg-panel-surface-soft p-1 sm:w-auto">
      {RANGE_FILTERS.map((filter) => (
        <button
          key={filter.id}
          type="button"
          aria-pressed={selectedRange === filter.id}
          onClick={() => onSelect(filter.id)}
          className={`h-9 flex-1 rounded-lg px-1.5 text-[11px] font-bold transition-colors sm:flex-none sm:px-3 sm:text-xs ${
            selectedRange === filter.id
              ? 'bg-panel-surface text-panel-text shadow-sm'
              : 'text-panel-text-muted hover:text-panel-text'
          }`}
        >
          {filter.label}
        </button>
      ))}
    </div>
  )
}

function TimelineChart({ rows }) {
  return (
    <section className="panel-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-panel-text">Çalışma Ritmi</h2>
          <p className="mt-1 text-sm text-panel-text-muted">Soru ve süre yoğunluğu</p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-student-theme-soft text-student-theme-text">
          <LineChart size={18} aria-hidden="true" />
        </span>
      </div>

      <div className="mt-5 flex min-h-[188px] items-end gap-2 overflow-x-auto pb-1">
        {rows.map((row) => {
          const hasActivity = row.questions + row.minutes > 0
          return (
            <div key={row.key} className="flex min-w-[44px] flex-1 flex-col items-center justify-end gap-2">
              <div className="flex h-32 w-full items-end rounded-lg bg-panel-surface-soft px-1">
                <div
                  className={`w-full rounded-md ${hasActivity ? 'bg-student-theme-primary' : 'bg-panel-border-strong'}`}
                  style={{ height: hasActivity ? `${Math.max(8, row.ratio * 100)}%` : '4px' }}
                  aria-label={`${row.label}: ${row.questions} soru, ${row.minutes} dakika`}
                />
              </div>
              <span className="w-full truncate text-center text-[11px] font-semibold text-panel-text-muted">{row.label}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function InsightPanel({ insights }) {
  return (
    <section className="panel-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-panel-text">Odak Sinyalleri</h2>
          <p className="mt-1 text-sm text-panel-text-muted">Derse ait kısa okuma</p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-panel-accent-soft text-panel-warm">
          <Target size={18} aria-hidden="true" />
        </span>
      </div>

      <div className="mt-4 divide-y divide-panel-border">
        {insights.map((insight) => {
          const Icon = insight.icon
          return (
            <div key={`${insight.title}-${insight.text}`} className="flex items-start gap-3 py-3">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${insight.tone}`}>
                <Icon size={17} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-panel-text">{insight.title}</p>
                <p className="mt-0.5 text-sm leading-snug text-panel-text-muted">{insight.text}</p>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function BreakdownRows({ rows, emptyLabel }) {
  if (!rows.length) {
    return <p className="px-4 py-6 text-sm text-panel-text-muted">{emptyLabel}</p>
  }

  const maxQuestions = Math.max(...rows.map((row) => row.questions), 1)

  return (
    <div className="divide-y divide-panel-border">
      {rows.slice(0, 8).map((row) => (
        <div key={row.key} className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_220px] md:items-center">
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-sm font-bold text-panel-text" title={row.label}>
                {row.label}
              </p>
              <span className="shrink-0 text-sm font-bold text-panel-text">{formatNumber(row.questions)} soru</span>
            </div>
            {row.publishers?.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {row.publishers.map((publisher) => (
                  <span
                    key={publisher}
                    className="inline-flex items-center rounded-full bg-panel-surface-soft px-2 py-0.5 text-[11px] font-semibold text-panel-text-muted"
                  >
                    {publisher}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-2 h-2 rounded-full bg-panel-surface-soft">
              <div
                className="h-2 rounded-full bg-student-theme-primary"
                style={{ width: `${Math.max(6, (row.questions / maxQuestions) * 100)}%` }}
              />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <span className="rounded-lg bg-panel-sage-soft px-2 py-1 font-semibold text-panel-sage">
              {formatNumber(row.correct)} D
            </span>
            <span className="rounded-lg bg-panel-red-soft px-2 py-1 font-semibold text-panel-red">
              {formatNumber(row.wrong)} Y
            </span>
            <span className="rounded-lg bg-panel-surface-soft px-2 py-1 font-semibold text-panel-text-muted">
              {formatNumber(row.minutes)} dk
            </span>
            <span className="rounded-lg bg-student-theme-soft px-2 py-1 font-semibold text-student-theme-text">
              {Number.isFinite(row.accuracy) ? formatPercent(row.accuracy) : `${formatNet(row.net)} net`}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

function BreakdownPanel({ icon, title, subtitle, rows, emptyLabel }) {
  return (
    <section className="panel-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-panel-border px-4 py-4">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-panel-text">{title}</h2>
          <p className="mt-0.5 text-sm text-panel-text-muted">{subtitle}</p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-student-theme-soft text-student-theme-text">
          {createElement(icon, { size: 18, 'aria-hidden': true })}
        </span>
      </div>
      <BreakdownRows rows={rows} emptyLabel={emptyLabel} />
    </section>
  )
}

function RecentActivity({ records }) {
  const recent = [...records].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)

  return (
    <section className="panel-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-panel-border px-4 py-4">
        <div>
          <h2 className="text-base font-bold text-panel-text">Son Çalışmalar</h2>
          <p className="mt-0.5 text-sm text-panel-text-muted">Seçili derse göre</p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-panel-sage-soft text-panel-sage">
          <CalendarDays size={18} aria-hidden="true" />
        </span>
      </div>

      {recent.length ? (
        <div className="divide-y divide-panel-border">
          {recent.map((record) => (
            <div key={record.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[110px_minmax(0,1fr)_auto] sm:items-center">
              <span className="text-sm font-semibold text-panel-text-muted">{formatDateLabel(record.date, 'month')}</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-panel-text">{record.content}</p>
                <p className="truncate text-xs text-panel-text-muted">{record.resource}</p>
              </div>
              <span className="text-sm font-bold text-panel-text">
                {formatNumber(record.questions)} soru · {formatNumber(record.minutes)} dk
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="px-4 py-6 text-sm text-panel-text-muted">Bu filtrede son çalışma kaydı yok.</p>
      )}
    </section>
  )
}

export default function StudentProgressView({
  studentId,
  title = 'Gelişimim',
  emptySubtitle = 'Ders ilerlemen burada görünecek.',
  buildSubtitle = (subjectLabelText) => `${subjectLabelText} için emek, doğruluk ve kaynak ilerlemen.`,
  headerActions,
  fetchOverview = getProgressOverview,
}) {
  const [overview, setOverview] = useState(null)
  const [error, setError] = useState('')
  const [selectedSubjectKey, setSelectedSubjectKey] = useState('')
  const [selectedRange, setSelectedRange] = useState('month')
  const today = useMemo(() => todayISODate(), [])

  useEffect(() => {
    let ignore = false
    setOverview(null)
    setError('')

    fetchOverview(studentId)
      .then((data) => {
        if (!ignore) setOverview(data)
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })

    return () => {
      ignore = true
    }
  }, [studentId, fetchOverview])

  const testsById = useMemo(
    () => new Map((overview?.tests || []).map((test) => [test.id, test])),
    [overview],
  )
  const activityRecords = useMemo(() => buildActivityRecords(overview || {}, testsById), [overview, testsById])
  const subjects = useMemo(() => buildSubjectTabs(overview || {}), [overview])

  const selectedSubject = subjects.find((subject) => subject.key === selectedSubjectKey) || subjects[0]

  const filteredRecords = useMemo(
    () =>
      activityRecords.filter(
        (record) =>
          subjectKey(record.subject) === selectedSubject?.key &&
          dateInRange(record.date, selectedRange, today),
      ),
    [activityRecords, selectedRange, selectedSubject?.key, today],
  )

  const filteredTasks = useMemo(
    () =>
      (overview?.tasks || []).filter(
        (task) =>
          subjectKey(subjectLabel(task)) === selectedSubject?.key &&
          dateInRange(toDateKey(task.date), selectedRange, today),
      ),
    [overview, selectedRange, selectedSubject?.key, today],
  )

  const filteredHomeworks = useMemo(
    () =>
      (overview?.homeworks || []).filter(
        (homework) =>
          subjectKey(subjectLabel(homework)) === selectedSubject?.key &&
          dateInRange(toDateKey(homework.dueDate || homework.assignedDate), selectedRange, today),
      ),
    [overview, selectedRange, selectedSubject?.key, today],
  )

  const filteredWrongRows = useMemo(
    () =>
      (overview?.wrongQuestions || []).filter(
        (item) =>
          subjectKey(item.subject) === selectedSubject?.key &&
          dateInRange(toDateKey(item.createdAt), selectedRange, today),
      ),
    [overview, selectedRange, selectedSubject?.key, today],
  )

  const stats = useMemo(() => sumRecords(filteredRecords), [filteredRecords])
  const contentRows = useMemo(() => aggregateBy(filteredRecords, (record) => record.contentGroup || record.content), [filteredRecords])
  const bookRows = useMemo(() => aggregateBy(filteredRecords, (record) => record.resource), [filteredRecords])
  const timelineRows = useMemo(() => buildTimeline(filteredRecords, selectedRange, today), [filteredRecords, selectedRange, today])

  const plannedTasks = filteredTasks.length
  const completedTasks = filteredTasks.filter((task) => COMPLETED_STATUSES.has(task.status)).length
  const completionRate = plannedTasks > 0 ? (completedTasks / plannedTasks) * 100 : NaN
  const accuracy = stats.correct + stats.wrong > 0 ? (stats.correct / (stats.correct + stats.wrong)) * 100 : NaN
  const pendingWrongCount = filteredWrongRows.filter((item) => item.reviewStatus !== 'ogrenildi').length
  const completedHomeworkQuestions = filteredHomeworks.reduce((sum, homework) => sum + asNumber(homework.completedQuestionCount), 0)
  const totalHomeworkQuestions = filteredHomeworks.reduce((sum, homework) => sum + asNumber(homework.totalQuestionCount), 0)
  const sessionCount = new Set(filteredRecords.map((record) => record.sessionId).filter(Boolean)).size
  const hasTaskDurationFallback = filteredRecords.some((record) => !record.sessionId && record.minutes > 0)
  const insights = buildInsights({ stats, contentRows, wrongRows: filteredWrongRows })

  if (error) {
    return <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{error}</div>
  }

  if (overview === null) {
    return <LoadingState label="Gelişim verileri yükleniyor..." />
  }

  if (!selectedSubject) {
    return (
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
        <PageHeader title={title} subtitle={emptySubtitle} actions={headerActions} />
        <div className="panel-card px-5 py-6 text-sm text-panel-text-muted">Gösterilecek ders bulunamadı.</div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
      <PageHeader title={title} subtitle={buildSubtitle(selectedSubject.label)} actions={headerActions} />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SubjectTabs subjects={subjects} selectedKey={selectedSubject.key} onSelect={setSelectedSubjectKey} />
        <RangeFilter selectedRange={selectedRange} onSelect={setSelectedRange} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryMetric
          icon={BookOpenCheck}
          title="Çözülen Soru"
          value={formatNumber(stats.questions)}
          description={metricDescription(stats, plannedTasks, completedTasks)}
        />
        <SummaryMetric
          icon={CheckCircle2}
          title="Doğruluk"
          value={formatPercent(accuracy)}
          description={`${formatNet(calculateNet(stats.correct, stats.wrong))} net · ${formatNumber(stats.blank)} boş`}
        />
        <SummaryMetric
          icon={Clock3}
          title="Çalışma Süresi"
          value={`${formatNumber(stats.minutes)} dk`}
          description={
            sessionCount > 0
              ? `${formatNumber(sessionCount)} oturum · görev süreleri dahil`
              : hasTaskDurationFallback
                ? 'Test çözme görev süreleri dahil'
                : 'Süre kaydı bekleniyor'
          }
        />
        <SummaryMetric
          icon={BarChart3}
          title="Plan Tamamlama"
          value={formatPercent(completionRate)}
          description={`${completedTasks} / ${plannedTasks} görev · ${pendingWrongCount} tekrar bekliyor`}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <TimelineChart rows={timelineRows} />
        <InsightPanel insights={insights} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <BreakdownPanel
          icon={Layers3}
          title="İçerik Kırılımı"
          subtitle="Test konusu bazında"
          rows={contentRows}
          emptyLabel="Bu filtrede içerik kırılımı oluşmadı."
        />
        <BreakdownPanel
          icon={BookOpenCheck}
          title="Kaynak Kitap Kırılımı"
          subtitle={`${formatNumber(completedHomeworkQuestions)} / ${formatNumber(totalHomeworkQuestions)} ödev sorusu`}
          rows={bookRows}
          emptyLabel="Bu filtrede kaynak kitap kaydı yok."
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <BreakdownPanel
          icon={XCircle}
          title="Yanlış ve Tekrar"
          subtitle={`${formatNumber(pendingWrongCount)} kayıt tekrar bekliyor`}
          rows={aggregateBy(
            filteredWrongRows.map((item) => ({
              id: item.id,
              date: toDateKey(item.createdAt),
              subject: item.subject,
              content: item.topic || item.errorType || 'Hata defteri',
              contentGroup: item.topic || item.errorType || 'Hata defteri',
              resource: 'Hata defteri',
              questions: 1,
              correct: item.reviewStatus === 'ogrenildi' ? 1 : 0,
              wrong: item.reviewStatus === 'ogrenildi' ? 0 : 1,
              blank: 0,
              minutes: 0,
              source: 'wrong',
            })),
            (record) => record.content,
          )}
          emptyLabel="Bu filtrede yanlış kaydı yok."
        />
        <RecentActivity records={filteredRecords} />
      </div>
    </div>
  )
}
