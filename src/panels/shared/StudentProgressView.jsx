import { createElement, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  BookOpenCheck,
  CalendarCheck,
  CheckCircle2,
  Layers3,
  Target,
  Trophy,
} from 'lucide-react'
import { getProgressOverview } from '../../services/progressService'
import { calculateNet } from '../../utils/netCalculator'
import {
  addDaysISO,
  dateToISO,
  formatDateShort,
  getMondayOfWeek,
  getMonthDates,
  todayISODate,
} from '../../utils/time'
import { cn } from '../ui/utils'
import PageHeader from '../layout/PageHeader'
import LoadingState from './LoadingState'
import {
  CompositionDonut,
  CompositionLegend,
  DailyActivityBars,
} from './ProgressAnalysisCharts'
import { RATE_TONES, successRateTone } from './rateTones'
import { ImagePreviewLightbox, ResourceBookAvatar } from './ResourceBookCard'

const RANGE_FILTERS = [
  { id: 'today', label: 'Bugün' },
  { id: 'week', label: 'Bu Hafta' },
  { id: 'month', label: 'Bu Ay' },
  { id: 'all', label: 'Tüm Zamanlar' },
]

const GENERAL_TAB_KEY = '__genel-analiz__'
const RANGE_METRIC_LABELS = {
  today: 'Bugün',
  week: 'Bu hafta',
  month: 'Bu ay',
  all: 'Tüm zamanlar',
}
const RANGE_ACTIVITY_LABELS = {
  today: 'Bugün',
  week: 'Bu hafta',
  month: 'Bu ay',
  all: 'Son 30 gün',
}

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
  // Salt tarih ("2026-08-19") olduğu gibi; zaman damgası ("...T22:14:36.846Z") ise
  // yerel güne çevrilir — aksi halde UTC'de gece geç işaretlenen kayıtlar bir gün
  // geriye kayıyordu (bkz. Aylin'in 5/8 Ağustos manuel test tamamlamaları).
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : dateToISO(date)
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

// Kapak fotoğrafları artık her task/session/homework/manualTestCompletion satırında değil,
// resourceBookId'ye göre tek bir haritada (overview.resourceBookImages) geliyor — bkz.
// api/src/progress.js'deki fetchResourceBookImagesByIds yorumu (aynı görselin onlarca satırda
// tekrarlanmasını önlemek için, WrongQuestionsView'daki bookImages deseniyle aynı fikir).
function resourceImageUrl(item, bookImages) {
  return (item?.resourceBookId && bookImages?.[item.resourceBookId]) || undefined
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

function splitTestResults(item, testsById, bookImages, { idPrefix, minutes, source }) {
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
        resourceImageUrl: resourceImageUrl(item, bookImages),
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
  const bookImages = overview.resourceBookImages || {}

  ;(overview.sessions || []).forEach((session) => {
    if (session.taskId) taskIdsWithSessions.add(session.taskId)

    const detailedRecords = splitTestResults(
      { ...session, sessionId: session.id },
      testsById,
      bookImages,
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
      resourceImageUrl: resourceImageUrl(session, bookImages),
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

    const detailedRecords = splitTestResults(task, testsById, bookImages, {
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
      resourceImageUrl: resourceImageUrl(task, bookImages),
      publisher: publisherLabel(task),
      questions,
      correct: asNumber(task.correctCount),
      wrong: asNumber(task.wrongCount),
      blank: asNumber(task.blankCount),
      minutes: asNumber(task.durationMinutes),
      source: 'task',
    })
  })

  ;(overview.manualTestCompletions || []).forEach((completion) => {
    const correct = asNumber(completion.correctCount)
    const wrong = asNumber(completion.wrongCount)
    const blank = asNumber(completion.blankCount)
    if (correct + wrong + blank <= 0) return

    const topic = completion.topicName || completion.testName || 'Genel çalışma'
    records.push({
      id: `manual-${completion.testId}`,
      date: toDateKey(completion.markedAt),
      subject: subjectLabel(completion),
      content: completion.testName ? `${topic} · ${completion.testName}` : topic,
      contentGroup: topic,
      resource: resourceLabel(completion),
      resourceImageUrl: resourceImageUrl(completion, bookImages),
      publisher: publisherLabel(completion),
      questions: correct + wrong,
      correct,
      wrong,
      blank,
      minutes: 0,
      source: 'manual',
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
      resourceImageUrl: resourceImageUrl(homework, bookImages),
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
  ;(overview.manualTestCompletions || []).forEach((item) => addSubject(item.subjectName))

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
        resourceImageUrl: undefined,
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
    if (!group.resourceImageUrl && record.resourceImageUrl) group.resourceImageUrl = record.resourceImageUrl
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

function rangeDayWindow(rangeId, today) {
  if (rangeId === 'today') return [today]
  if (rangeId === 'week') {
    const days = []
    for (let day = getMondayOfWeek(today); day <= today; day = addDaysISO(day, 1)) days.push(day)
    return days
  }
  if (rangeId === 'month') return getMonthDates(today).filter((day) => day <= today)
  return Array.from({ length: 30 }, (_, index) => addDaysISO(today, index - 29))
}

function buildDailyActivity(records, rangeId, today) {
  const byDate = new Map()
  records.forEach((record) => {
    if (!record.date) return
    const current = byDate.get(record.date) || { questions: 0, correct: 0, wrong: 0 }
    current.questions += record.questions
    current.correct += record.correct
    current.wrong += record.wrong
    byDate.set(record.date, current)
  })

  return rangeDayWindow(rangeId, today).map((date) => ({
    date,
    label: formatDateShort(date),
    ...(byDate.get(date) || { questions: 0, correct: 0, wrong: 0 }),
  }))
}

function buildInsights({ contentRows, wrongRows }) {
  const insights = []
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
      text: `${strongestContent.label} konusunda oldukça başarılısın, doğruluğun ${formatPercent(strongestContent.accuracy)}.`,
      tone: 'text-panel-sage bg-panel-sage-soft',
    })
  }

  if (weakestContent && weakestContent.wrong > 0) {
    insights.push({
      icon: Target,
      title: 'Tekrar Odağı',
      text: `${weakestContent.label} konusunu tekrar etmelisin, bu konuda ${formatNumber(weakestContent.wrong)} yanlışın var.`,
      tone: 'text-panel-warm bg-panel-accent-soft',
    })
  } else if (repeatTopic) {
    insights.push({
      icon: AlertTriangle,
      title: 'Tekrar Odağı',
      text: `${repeatTopic.topic || repeatTopic.subject} konusu hata defterinde tekrarını bekliyor.`,
      tone: 'text-panel-warm bg-panel-accent-soft',
    })
  }

  return insights.slice(0, 2)
}

function metricDescription(stats, plannedTasks, completedTasks) {
  const answeredQuestions = stats.correct + stats.wrong
  if (answeredQuestions > 0) return `${formatNumber(stats.correct)} doğru, ${formatNumber(stats.wrong)} yanlış`
  if (plannedTasks > 0) return `${completedTasks} / ${plannedTasks} plan görevi tamamlandı`
  return 'Seçili filtrede kayıt yok'
}

// Kart tasarımı öğrencinin "Bugün" sayfasındaki StatCard ile aynı: solda ikon + başlık +
// alt metin, sağda ayrı zeminli büyük değer.
function SummaryMetric({
  icon,
  title,
  value,
  description,
  iconClassName = 'bg-panel-sage-soft text-panel-sage',
  valueClassName,
}) {
  return (
    <div className="flex h-full items-stretch overflow-hidden rounded-xl border border-panel-border bg-panel-surface shadow-sm">
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 p-4">
        <div className="flex items-center gap-2">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconClassName}`}>
            {createElement(icon, { size: 16, 'aria-hidden': true })}
          </div>
          <p className="min-w-0 truncate text-base font-bold text-panel-text">{title}</p>
        </div>
        <p className="text-xs text-panel-text-muted">{description}</p>
      </div>

      <div className="flex shrink-0 items-center justify-center border-l border-panel-border bg-panel-surface-soft px-5 py-4">
        <p className={cn('whitespace-nowrap text-2xl font-bold leading-tight text-panel-text', valueClassName)}>
          {value}
        </p>
      </div>
    </div>
  )
}

function SubjectSelect({ subjects, value, offerGeneral, onChange }) {
  // Tek ders varsa seçilecek bir şey yok — dersin adını etiket olarak göster.
  if (!offerGeneral && subjects.length <= 1) {
    const only = subjects[0]
    if (!only) return null
    return (
      <span className="inline-flex h-11 items-center gap-2 rounded-xl border border-panel-border bg-panel-surface px-4 text-sm font-semibold text-panel-text">
        <BookOpenCheck size={16} aria-hidden="true" className="text-student-theme-text" />
        {only.label}
      </span>
    )
  }

  return (
    <label className="flex items-center gap-2">
      <span className="text-sm font-semibold text-panel-text-muted">Ders</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Ders seçimi"
        className="h-11 rounded-xl border border-panel-border bg-panel-surface px-3 text-sm font-semibold text-panel-text focus:border-student-theme-primary focus:outline-none"
      >
        {offerGeneral && <option value={GENERAL_TAB_KEY}>Tüm Dersler</option>}
        {subjects.map((subject) => (
          <option key={subject.key} value={subject.key}>
            {subject.label}
          </option>
        ))}
      </select>
    </label>
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

function InsightPanel({ insights }) {
  return (
    <section className="panel-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-panel-text">Odak Sinyalleri</h2>
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

function BreakdownRows({ rows, emptyLabel, showResourceAvatar, onPreviewImage }) {
  if (!rows.length) {
    return <p className="px-4 py-6 text-sm text-panel-text-muted">{emptyLabel}</p>
  }

  const maxQuestions = Math.max(...rows.map((row) => row.questions), 1)

  return (
    <div className="divide-y divide-panel-border">
      {rows.slice(0, 8).map((row) => (
        <div key={row.key} className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_220px] md:items-center">
          <div className="flex min-w-0 items-start gap-3">
            {showResourceAvatar && (
              <ResourceBookAvatar
                book={{ imageUrl: row.resourceImageUrl, name: row.label }}
                size="row"
                onClick={row.resourceImageUrl ? () => onPreviewImage({ url: row.resourceImageUrl, name: row.label }) : undefined}
              />
            )}
            <div className="min-w-0 flex-1">
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
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <span className="rounded-lg bg-panel-sage-soft px-2 py-1 font-semibold text-panel-sage">
              {formatNumber(row.correct)} D
            </span>
            <span className="rounded-lg bg-panel-red-soft px-2 py-1 font-semibold text-panel-red">
              {formatNumber(row.wrong)} Y
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

function BreakdownPanel({ icon, title, subtitle, rows, emptyLabel, showResourceAvatar, onPreviewImage }) {
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
      <BreakdownRows rows={rows} emptyLabel={emptyLabel} showResourceAvatar={showResourceAvatar} onPreviewImage={onPreviewImage} />
    </section>
  )
}

function GeneralAnalysisView({
  hasData,
  stats,
  insights,
  subjectRows,
  weakTopicRows,
  dailyActivity,
  activeDays,
  metricLabel,
  activityLabel,
}) {
  if (!hasData) {
    return (
      <div className="panel-card px-5 py-6 text-sm text-panel-text-muted">
        Bu aralıkta genel analiz için yeterli veri yok. Görev ve testleri tamamladıkça buradaki grafikler oluşacak.
      </div>
    )
  }

  const answered = stats.correct + stats.wrong
  const accuracy = answered > 0 ? (stats.correct / answered) * 100 : NaN
  const accuracyTone = RATE_TONES[successRateTone(answered > 0 ? accuracy / 100 : null)]

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryMetric
          icon={BookOpenCheck}
          iconClassName="bg-panel-sage-soft text-panel-sage"
          title="Toplam Soru"
          value={formatNumber(stats.questions)}
          description={`${formatNumber(stats.correct)} doğru · ${formatNumber(stats.wrong)} yanlış`}
        />
        <SummaryMetric
          icon={CheckCircle2}
          iconClassName={cn('bg-panel-blue-soft', accuracyTone.text)}
          valueClassName={Number.isFinite(accuracy) ? accuracyTone.text : undefined}
          title="Doğruluk"
          value={formatPercent(accuracy)}
          description={`${formatNet(calculateNet(stats.correct, stats.wrong))} net · ${formatNumber(stats.blank)} boş`}
        />
        <SummaryMetric
          icon={CalendarCheck}
          iconClassName="bg-panel-accent-soft text-panel-accent"
          title="Aktif Gün"
          value={formatNumber(activeDays)}
          description={metricLabel}
        />
      </div>

      {insights.length > 0 && <InsightPanel insights={insights} />}

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="panel-card p-5">
          <h2 className="text-base font-bold text-panel-text">Doğru / Yanlış / Boş</h2>
          <p className="mt-0.5 text-sm text-panel-text-muted">{metricLabel} · tüm dersler</p>
          <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row">
            <CompositionDonut correct={stats.correct} wrong={stats.wrong} blank={stats.blank} />
            <CompositionLegend correct={stats.correct} wrong={stats.wrong} blank={stats.blank} />
          </div>
        </section>

        <section className="panel-card p-5">
          <h2 className="text-base font-bold text-panel-text">Günlük Soru Aktivitesi</h2>
          <p className="mt-0.5 text-sm text-panel-text-muted">{activityLabel} · çözülen soru</p>
          <div className="mt-4">
            <DailyActivityBars data={dailyActivity} />
          </div>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <BreakdownPanel
          icon={Layers3}
          title="Ders Bazında Performans"
          subtitle="Tüm derslerin karşılaştırması"
          rows={subjectRows}
          emptyLabel="Bu aralıkta ders kaydı yok."
        />
        <BreakdownPanel
          icon={Target}
          title="En Çok Zorlanılan Konular"
          subtitle="Doğruluğu düşük konular"
          rows={weakTopicRows}
          emptyLabel="Bu aralıkta zorlanılan konu tespit edilmedi."
        />
      </div>
    </div>
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
  // '' = otomatik: birden çok ders varsa "Tüm Dersler" (genel analiz), tek ders varsa o ders.
  const [selectedSubjectKey, setSelectedSubjectKey] = useState('')
  const [selectedRange, setSelectedRange] = useState('all')
  const [previewImage, setPreviewImage] = useState(null)
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

  // "Tüm Dersler" seçeneği yalnızca öğrencinin birden çok dersi varsa sunulur; tek dersi
  // olan (ör. öğretmen paneli, tek branş) için doğrudan o ders seçili gelir.
  const offerGeneralTab = subjects.length > 1
  const hasExplicitSelection =
    (selectedSubjectKey === GENERAL_TAB_KEY && offerGeneralTab) ||
    subjects.some((subject) => subject.key === selectedSubjectKey)
  const effectiveSubjectKey = hasExplicitSelection
    ? selectedSubjectKey
    : offerGeneralTab
      ? GENERAL_TAB_KEY
      : subjects[0]?.key ?? GENERAL_TAB_KEY

  const isGeneralTab = effectiveSubjectKey === GENERAL_TAB_KEY
  const selectedSubject = isGeneralTab
    ? null
    : subjects.find((subject) => subject.key === effectiveSubjectKey) || subjects[0]

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

  const plannedTasks = filteredTasks.length
  const completedTasks = filteredTasks.filter((task) => COMPLETED_STATUSES.has(task.status)).length
  const accuracy = stats.correct + stats.wrong > 0 ? (stats.correct / (stats.correct + stats.wrong)) * 100 : NaN
  const subjectAccuracyTone = RATE_TONES[successRateTone(Number.isFinite(accuracy) ? accuracy / 100 : null)]
  const completedHomeworkQuestions = filteredHomeworks.reduce((sum, homework) => sum + asNumber(homework.completedQuestionCount), 0)
  const totalHomeworkQuestions = filteredHomeworks.reduce((sum, homework) => sum + asNumber(homework.totalQuestionCount), 0)
  const insights = buildInsights({ contentRows, wrongRows: filteredWrongRows })

  // "Genel Analiz" sekmesi: ders filtresi olmadan, seçili tarih aralığındaki tüm dersler.
  const generalRecords = useMemo(
    () => activityRecords.filter((record) => dateInRange(record.date, selectedRange, today)),
    [activityRecords, selectedRange, today],
  )
  const generalWrongRows = useMemo(
    () =>
      (overview?.wrongQuestions || []).filter((item) =>
        dateInRange(toDateKey(item.createdAt), selectedRange, today),
      ),
    [overview, selectedRange, today],
  )
  const generalStats = useMemo(() => sumRecords(generalRecords), [generalRecords])
  const generalContentRows = useMemo(
    () => aggregateBy(generalRecords, (record) => record.contentGroup || record.content),
    [generalRecords],
  )
  const generalSubjectRows = useMemo(
    () => aggregateBy(generalRecords, (record) => record.subject),
    [generalRecords],
  )
  const generalWeakTopicRows = useMemo(
    () =>
      aggregateBy(generalRecords, (record) => record.contentGroup || record.content)
        .filter((row) => row.correct + row.wrong >= 3 && row.wrong > 0)
        .sort((a, b) => a.accuracy - b.accuracy)
        .slice(0, 6),
    [generalRecords],
  )
  const generalDailyActivity = useMemo(
    () => buildDailyActivity(activityRecords, selectedRange, today),
    [activityRecords, selectedRange, today],
  )
  const generalActiveDays = useMemo(
    () => new Set(generalRecords.map((record) => record.date).filter(Boolean)).size,
    [generalRecords],
  )
  const generalInsights = buildInsights({ contentRows: generalContentRows, wrongRows: generalWrongRows })

  if (error) {
    return <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{error}</div>
  }

  if (overview === null) {
    return <LoadingState label="Gelişim verileri yükleniyor..." />
  }

  if (!isGeneralTab && !selectedSubject) {
    return (
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
        <PageHeader title={title} subtitle={emptySubtitle} actions={headerActions} />
        <div className="panel-card px-5 py-6 text-sm text-panel-text-muted">Gösterilecek ders bulunamadı.</div>
      </div>
    )
  }

  const headerSubtitle = isGeneralTab
    ? 'Tüm derslerdeki genel performans, aktivite ve gelişim özeti.'
    : buildSubtitle(selectedSubject.label)

  return (
    <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
      <PageHeader title={title} subtitle={headerSubtitle} actions={headerActions} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SubjectSelect
          subjects={subjects}
          value={effectiveSubjectKey}
          offerGeneral={offerGeneralTab}
          onChange={setSelectedSubjectKey}
        />
        <RangeFilter selectedRange={selectedRange} onSelect={setSelectedRange} />
      </div>

      {isGeneralTab ? (
        <GeneralAnalysisView
          hasData={generalRecords.length > 0}
          stats={generalStats}
          insights={generalInsights}
          subjectRows={generalSubjectRows}
          weakTopicRows={generalWeakTopicRows}
          dailyActivity={generalDailyActivity}
          activeDays={generalActiveDays}
          metricLabel={RANGE_METRIC_LABELS[selectedRange]}
          activityLabel={RANGE_ACTIVITY_LABELS[selectedRange]}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <SummaryMetric
              icon={BookOpenCheck}
              iconClassName="bg-panel-sage-soft text-panel-sage"
              title="Çözülen Soru"
              value={formatNumber(stats.questions)}
              description={metricDescription(stats, plannedTasks, completedTasks)}
            />
            <SummaryMetric
              icon={CheckCircle2}
              iconClassName={cn('bg-panel-blue-soft', subjectAccuracyTone.text)}
              valueClassName={Number.isFinite(accuracy) ? subjectAccuracyTone.text : undefined}
              title="Doğruluk"
              value={formatPercent(accuracy)}
              description={`${formatNet(calculateNet(stats.correct, stats.wrong))} net · ${formatNumber(stats.blank)} boş`}
            />
          </div>

          <InsightPanel insights={insights} />

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
              showResourceAvatar
              onPreviewImage={setPreviewImage}
            />
          </div>
        </>
      )}

      <ImagePreviewLightbox preview={previewImage} onClose={() => setPreviewImage(null)} />
    </div>
  )
}
