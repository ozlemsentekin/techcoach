import { createElement, useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  CalendarCheck,
  CalendarRange,
  Clock,
  GraduationCap,
  Layers3,
  Target,
  Users,
} from 'lucide-react'
import PageHeader from '../../layout/PageHeader'
import EmptyState from '../../shared/EmptyState'
import LoadingState from '../../shared/LoadingState'
import {
  aggregateBy,
  buildActivityRecords,
  formatNet,
  formatNumber,
  sumRecords,
  toDateKey,
} from '../../shared/progressAnalytics'
import { RATE_TONES, successRateTone } from '../../shared/rateTones'
import { ResourceBookAvatar } from '../../shared/ResourceBookCard'
import { cn } from '../../ui/utils'
import { calculateNet } from '../../../utils/netCalculator'
import { todayISODate } from '../../../utils/time'
import { isBacklogTask } from '../../../utils/backlogTasks'
import { getTeacherClassAnalysis } from '../../../services/teacherService'
import { useTeacherClasses } from '../useTeacherClasses'

const UNSPECIFIED_KEY = '__none__'
const COMPLETED_STATUSES = new Set(['tamamlandi', 'kismen-tamamlandi'])
const MIN_ANSWERED_FOR_RANK = 3
const MAX_RESOURCE_COLUMNS = 8
const MONTH_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']

// Eğitim yılı: içinde bulunduğumuz Ağustos'tan sonraki Haziran'a kadar (Ağu–Haz, 11 ay).
function buildAcademicMonths(today) {
  const [year, month] = today.split('-').map(Number)
  const startYear = month >= 8 ? year : year - 1
  const months = []
  for (let m = 8; m <= 12; m += 1) months.push({ y: startYear, m })
  for (let m = 1; m <= 6; m += 1) months.push({ y: startYear + 1, m })
  return months.map(({ y, m }) => ({
    key: `${y}-${String(m).padStart(2, '0')}`,
    short: MONTH_SHORT[m - 1],
    label: `${MONTH_SHORT[m - 1]} ${y}`,
  }))
}

// "Yağmur Aydoğdu" → "Yağmur A." — grafik ekseninde her zaman sığsın diye.
function shortName(full) {
  const parts = String(full || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '—'
  if (parts.length === 1) return parts[0]
  const initial = parts[parts.length - 1][0]?.toLocaleUpperCase('tr-TR') || ''
  return `${parts[0]} ${initial}.`
}

function pct(value) {
  return Number.isFinite(value) ? `${Math.round(value)}%` : '—'
}

function accuracyOf(correct, wrong) {
  const answered = correct + wrong
  return answered > 0 ? (correct / answered) * 100 : NaN
}

function toneFor(accuracy) {
  return successRateTone(Number.isFinite(accuracy) ? accuracy / 100 : null)
}

function safeAcc(accuracy) {
  return Number.isFinite(accuracy) ? accuracy : -1
}

// Öğrencinin seçili tarih aralığındaki ham gelişim verisini tek-öğrenci analiz
// sayfasıyla aynı yardımcılarla özetler.
function analyzeStudent(entry) {
  const overview = entry.overview || {}
  const testsById = new Map((overview.tests || []).map((test) => [test.id, test]))
  const records = buildActivityRecords(overview, testsById)
  const totals = sumRecords(records)
  const answered = totals.correct + totals.wrong

  // Aylık dağılım — tüm kayıtlar ay bazında toplanır.
  const monthly = new Map()
  for (const record of records) {
    const monthKey = (record.date || '').slice(0, 7)
    if (monthKey.length !== 7) continue
    const bucket = monthly.get(monthKey) || { questions: 0, correct: 0, wrong: 0, blank: 0 }
    bucket.questions += record.questions
    bucket.correct += record.correct
    bucket.wrong += record.wrong
    bucket.blank += record.blank
    monthly.set(monthKey, bucket)
  }

  const tasks = overview.tasks || []
  const taskCounts = { total: tasks.length, onTime: 0, late: 0, backlog: 0, pending: 0 }
  for (const task of tasks) {
    if (COMPLETED_STATUSES.has(task.status)) {
      const doneDay = toDateKey(task.completedAt || task.date)
      if (doneDay && doneDay > toDateKey(task.date)) taskCounts.late += 1
      else taskCounts.onTime += 1
    } else if (isBacklogTask(task)) {
      taskCounts.backlog += 1
    } else {
      taskCounts.pending += 1
    }
  }

  const topicRows = aggregateBy(records, (record) => record.contentGroup || record.content)
  const resourceRows = aggregateBy(records, (record) => record.resource)
  const rankable = (rows) =>
    rows.filter((row) => row.correct + row.wrong >= MIN_ANSWERED_FOR_RANK).sort((a, b) => a.accuracy - b.accuracy)[0] || null

  // Kitap tamamlanma oranı: kitaptaki toplam test sayısına karşı öğrencinin sonuç
  // girdiği (manuel optik + görev/oturum test sonuçları) benzersiz test sayısı.
  const bookTestTotals = new Map()
  for (const test of overview.tests || []) {
    if (test.resourceBookId) bookTestTotals.set(test.resourceBookId, (bookTestTotals.get(test.resourceBookId) || 0) + 1)
  }
  const completedTestIds = new Set()
  for (const completion of overview.manualTestCompletions || []) {
    if (completion.testId) completedTestIds.add(completion.testId)
  }
  for (const source of [...(overview.tasks || []), ...(overview.sessions || [])]) {
    for (const testId of Object.keys(source.testResults || {})) completedTestIds.add(testId)
  }
  const bookCompleted = new Map()
  for (const test of overview.tests || []) {
    if (test.resourceBookId && completedTestIds.has(test.id)) {
      bookCompleted.set(test.resourceBookId, (bookCompleted.get(test.resourceBookId) || 0) + 1)
    }
  }
  const bookImages = overview.resourceBookImages || {}

  // Kaynak adı → { doğruluk, çözülen soru, tamamlanma, kapak, yayın evi }
  const resources = new Map()
  for (const row of resourceRows) {
    resources.set(row.key, {
      accuracy: row.accuracy,
      answered: row.correct + row.wrong,
      cover: row.resourceImageUrl || null,
      publisher: row.publishers?.[0] || '',
    })
  }
  for (const book of overview.resourceBooks || []) {
    const total = bookTestTotals.get(book.id) || 0
    const done = bookCompleted.get(book.id) || 0
    const existing = resources.get(book.name) || { answered: 0 }
    resources.set(book.name, {
      accuracy: existing.accuracy,
      answered: existing.answered || 0,
      completionRate: total > 0 ? done / total : NaN,
      completedTests: done,
      totalTests: total,
      cover: bookImages[book.id] || existing.cover || null,
      publisher: book.publisherName || existing.publisher || '',
    })
  }

  // Son işlem zamanı: ham zaman damgaları (görev/oturum/manuel optik/ödev) içindeki en yeni an.
  let lastActivityAt = null
  const considerTs = (value) => {
    if (!value) return
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return
    const iso = date.toISOString()
    if (!lastActivityAt || iso > lastActivityAt) lastActivityAt = iso
  }
  for (const task of overview.tasks || []) {
    considerTs(task.completedAt)
    considerTs(task.updatedAt)
  }
  for (const session of overview.sessions || []) {
    considerTs(session.endedAt)
    considerTs(session.startedAt)
  }
  for (const completion of overview.manualTestCompletions || []) considerTs(completion.markedAt)
  for (const homework of overview.homeworks || []) considerTs(homework.updatedAt)

  return {
    key: entry.studentTeacherId,
    studentTeacherId: entry.studentTeacherId,
    name: entry.studentFullName,
    shortLabel: shortName(entry.studentFullName),
    subjectName: entry.subjectName || null,
    totals,
    answered,
    accuracy: accuracyOf(totals.correct, totals.wrong),
    net: calculateNet(totals.correct, totals.wrong),
    taskCounts,
    resources,
    resourceRows,
    monthly,
    hardestTopic: rankable(topicRows),
    hardestBook: rankable(resourceRows),
    lastActivityAt,
  }
}

const DATE_FMT = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })
const TIME_FMT = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' })

function LastActivity({ iso }) {
  if (!iso) return <span className="text-panel-text-muted">—</span>
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return <span className="text-panel-text-muted">—</span>
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-panel-surface-soft px-2 py-1 text-xs font-semibold text-panel-text">
      <Clock size={12} className="shrink-0 text-panel-text-muted" aria-hidden="true" />
      {DATE_FMT.format(date)}
      <span className="text-panel-text-muted">·</span>
      <span className="tabular-nums text-panel-text-muted">{TIME_FMT.format(date)}</span>
    </span>
  )
}

// Öğrenci Gelişim Analizi'ndeki özet kartlarıyla aynı stil: solda ikon + başlık +
// alt metin, sağda ayrı zeminli büyük değer.
function SummaryMetric({ icon, title, value, description, iconClassName = 'bg-panel-blue-soft text-panel-blue', valueClassName }) {
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
        <p className={cn('whitespace-nowrap text-2xl font-bold leading-tight text-panel-text', valueClassName)}>{value}</p>
      </div>
    </div>
  )
}

function Card({ title, subtitle, icon, children }) {
  return (
    <section className="panel-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-panel-text">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-sm text-panel-text-muted">{subtitle}</p> : null}
        </div>
        {icon ? (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-panel-surface-soft text-panel-text-muted">
            {createElement(icon, { size: 18, 'aria-hidden': true })}
          </span>
        ) : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Legend({ items }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-panel-text-muted">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.className}`} />
          {item.label}
        </li>
      ))}
    </ul>
  )
}

// Öğrenci başına yığılı bar (görev disiplini). rows:
// [{ key, name, fullName, segments: [{ value, className, label }], total, valueLabel }]
function StudentStackedRows({ rows, legend, onSelect, unit = '' }) {
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col">
        {rows.map((row) => (
          <li key={row.key}>
            <button
              type="button"
              onClick={() => onSelect(row.key)}
              className="flex w-full items-center gap-3 rounded-lg py-2 text-left transition-colors hover:bg-panel-surface-soft"
            >
              <span
                className="w-20 shrink-0 truncate text-xs font-semibold text-panel-text sm:w-24 sm:text-sm"
                title={row.fullName}
              >
                {row.name}
              </span>
              <span className="flex h-5 min-w-0 flex-1 overflow-hidden rounded-full bg-panel-surface-soft">
                {row.total > 0
                  ? row.segments.map((seg, index) =>
                      seg.value > 0 ? (
                        <span
                          key={index}
                          className={`${seg.className} cursor-help`}
                          style={{ width: `${(seg.value / row.total) * 100}%` }}
                          title={`${seg.label}: ${seg.value}${unit}`}
                        />
                      ) : null,
                    )
                  : null}
              </span>
              <span className="w-[68px] shrink-0 whitespace-nowrap text-right text-xs font-bold text-panel-text sm:w-[76px] sm:text-sm">
                {row.valueLabel}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <Legend items={legend} />
    </div>
  )
}

// Sütun başlığının altında açılan kitap "profil" balonu (kapak + yayın evi + ad).
// Konum, başlığın ekran koordinatlarından bir kez hesaplanır (mousemove dinlenmez).
function BookHoverCard({ tip }) {
  if (!tip) return null
  const { rect, col } = tip
  const style = {
    position: 'fixed',
    left: Math.max(8, Math.min(rect.left, window.innerWidth - 224)),
    top: rect.bottom + 6,
    zIndex: 80,
  }
  return createPortal(
    <div
      style={style}
      className="pointer-events-none w-52 rounded-xl border border-panel-border bg-panel-surface p-3 shadow-xl"
    >
      <div className="flex gap-3">
        <div className="w-16 shrink-0">
          <ResourceBookAvatar book={{ imageUrl: col.cover, name: col.label }} size="lg" />
        </div>
        <div className="min-w-0 flex-1">
          {col.publisher ? (
            <span className="inline-block rounded bg-panel-surface-soft px-1.5 py-0.5 text-[10px] font-semibold text-panel-text-muted">
              {col.publisher}
            </span>
          ) : null}
          <p className="mt-1 text-sm font-bold leading-snug text-panel-text">{col.label}</p>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// Öğrenci × kaynak ısı haritası. Hücre: o kitaptaki doğruluk % + tamamlanma çubuğu.
function AccuracyHeatmap({ students, columns, onSelect }) {
  const [tip, setTip] = useState(null)

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-1 text-center">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-panel-surface" />
            {columns.map((col) => (
              <th
                key={col.key}
                className="w-[104px] min-w-[104px] px-1 pb-1 align-bottom"
                onMouseEnter={(event) => setTip({ rect: event.currentTarget.getBoundingClientRect(), col })}
                onMouseLeave={() => setTip((current) => (current?.col === col ? null : current))}
              >
                {col.publisher ? (
                  <span className="mb-0.5 block max-w-full truncate rounded bg-panel-surface-soft px-1 py-0.5 text-[9px] font-semibold text-panel-text-muted">
                    {col.publisher}
                  </span>
                ) : null}
                <span className="block max-w-full truncate rounded bg-panel-blue-soft px-1 py-0.5 text-[10px] font-semibold text-panel-blue">
                  {col.label}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {students.map((student) => (
            <tr key={student.key}>
              <td
                className="sticky left-0 z-10 max-w-[6rem] truncate bg-panel-surface pr-2 text-left text-xs font-semibold text-panel-text"
                title={student.name}
              >
                <button type="button" onClick={() => onSelect(student.key)} className="hover:underline">
                  {student.shortLabel}
                </button>
              </td>
              {columns.map((col) => {
                const cell = student.resources.get(col.key)
                const hasAccuracy = cell && Number.isFinite(cell.accuracy)
                const completion = cell && Number.isFinite(cell.completionRate) ? cell.completionRate : null
                if (!hasAccuracy && completion === null) {
                  return (
                    <td key={col.key} className="rounded-md bg-panel-surface-soft/50 py-2 text-[11px] text-panel-text-muted">
                      –
                    </td>
                  )
                }
                const tone = hasAccuracy ? RATE_TONES[toneFor(cell.accuracy)] : RATE_TONES.neutral
                return (
                  <td key={col.key} className={`rounded-md px-1 py-1 ${tone.chip}`}>
                    <span
                      className="block text-[12px] font-bold leading-none"
                      title={
                        hasAccuracy
                          ? `${student.shortLabel} · ${col.label}\nBaşarı oranı: ${Math.round(cell.accuracy)}% (${formatNumber(cell.answered)} soru çözüldü)`
                          : `${student.shortLabel} · ${col.label}\nHenüz çözüm yok`
                      }
                    >
                      {hasAccuracy ? `${Math.round(cell.accuracy)}%` : '–'}
                    </span>
                    {completion !== null ? (
                      <span
                        className="mt-1 flex items-center gap-1"
                        title={`${student.shortLabel} · ${col.label}\nKitap tamamlanma oranı: ${Math.round(
                          completion * 100,
                        )}% (${cell.completedTests}/${cell.totalTests} test)`}
                      >
                        <span className="h-1 flex-1 overflow-hidden rounded-full bg-black/10">
                          <span
                            className="block h-1 rounded-full bg-panel-blue"
                            style={{ width: `${Math.round(completion * 100)}%` }}
                          />
                        </span>
                        <span className="text-[8px] font-bold tabular-nums opacity-70">{Math.round(completion * 100)}%</span>
                      </span>
                    ) : null}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <BookHoverCard tip={tip} />
    </div>
  )
}

function mergeBuckets(buckets) {
  return buckets.reduce(
    (acc, bucket) => {
      if (!bucket) return acc
      acc.questions += bucket.questions
      acc.correct += bucket.correct
      acc.wrong += bucket.wrong
      acc.blank += bucket.blank
      return acc
    },
    { questions: 0, correct: 0, wrong: 0, blank: 0 },
  )
}

// Öğrenci × ay tablosu (Ağu–Haz eğitim yılı). Hücre içeriğini renderCell belirler;
// showTotal true ise sağa çizgiyle ayrılmış "Toplam" sütunu eklenir.
function MonthlyTable({ students, months, onSelect, renderCell, showTotal }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-center text-xs">
        <thead>
          <tr className="border-b-2 border-panel-border">
            <th className="sticky left-0 z-10 bg-panel-surface py-2 pr-3" />
            {months.map((month) => (
              <th
                key={month.key}
                className="min-w-[54px] px-1 py-2 text-[11px] font-bold uppercase tracking-wide text-panel-text-muted"
                title={month.label}
              >
                {month.short}
              </th>
            ))}
            {showTotal ? (
              <th className="border-l border-panel-border px-2 py-2 text-[11px] font-bold uppercase tracking-wide text-panel-text">
                Toplam
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-panel-border">
          {students.map((student) => {
            const buckets = months.map((month) => student.monthly.get(month.key) || null)
            return (
              <tr key={student.key} className="transition-colors hover:bg-panel-surface-soft/50">
                <td className="sticky left-0 z-10 bg-panel-surface py-2 pr-3 text-left">
                  <button
                    type="button"
                    onClick={() => onSelect(student.key)}
                    title={student.name}
                    className="block max-w-[7rem] truncate text-sm font-semibold text-panel-text hover:text-panel-blue hover:underline"
                  >
                    {student.shortLabel}
                  </button>
                </td>
                {months.map((month, index) => (
                  <td key={month.key} className="px-1 py-2 align-middle">
                    {renderCell(buckets[index])}
                  </td>
                ))}
                {showTotal ? (
                  <td className="border-l border-panel-border px-1.5 py-2 align-middle">
                    {renderCell(mergeBuckets(buckets))}
                  </td>
                ) : null}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

const SORTS = {
  accuracyAsc: { label: 'Düşük başarı önce', fn: (a, b) => safeAcc(a.accuracy) - safeAcc(b.accuracy) },
  accuracyDesc: { label: 'Yüksek başarı önce', fn: (a, b) => safeAcc(b.accuracy) - safeAcc(a.accuracy) },
  answeredDesc: { label: 'En çok soru', fn: (a, b) => b.answered - a.answered },
  answeredAsc: { label: 'En az soru', fn: (a, b) => a.answered - b.answered },
  backlogDesc: { label: 'En çok biriken görev', fn: (a, b) => b.taskCounts.backlog - a.taskCounts.backlog },
}

export default function ClassAnalysisPage() {
  const navigate = useNavigate()
  const { grades, hasUnspecified, classesLoading } = useTeacherClasses()
  const [searchParams, setSearchParams] = useSearchParams()
  const [loaded, setLoaded] = useState(null)
  const [failed, setFailed] = useState(null)
  const [sortKey, setSortKey] = useState('accuracyAsc')
  const today = useMemo(() => todayISODate(), [])

  const tabs = useMemo(() => {
    const list = grades.map((grade) => ({ key: String(grade), label: `${grade}. Sınıf` }))
    if (hasUnspecified) list.push({ key: UNSPECIFIED_KEY, label: 'Sınıf belirtilmemiş' })
    return list
  }, [grades, hasUnspecified])

  const gradeParam = searchParams.get('grade')
  const activeKey = tabs.some((tab) => tab.key === gradeParam) ? gradeParam : tabs[0]?.key || null

  const openStudent = useCallback(
    (id) => navigate(`/teacher/students/${id}?tab=analysis`),
    [navigate],
  )

  useEffect(() => {
    if (!activeKey) return undefined
    let ignore = false
    getTeacherClassAnalysis(activeKey)
      .then((result) => {
        if (!ignore) setLoaded({ key: activeKey, result })
      })
      .catch((err) => {
        if (!ignore) setFailed({ key: activeKey, message: err.message })
      })
    return () => {
      ignore = true
    }
  }, [activeKey])

  // Sekme değişince eski sınıfın verisi ekranda kalmasın.
  const data = loaded?.key === activeKey ? loaded.result : null
  const error = failed?.key === activeKey ? failed.message : ''

  const analysis = useMemo(() => {
    if (!data) return null
    const students = (data.students || []).map((entry) => analyzeStudent(entry))

    // Isı haritası sütunları: sınıfın en çok çalıştığı / atanmış kaynaklar.
    const resourceMeta = new Map()
    for (const student of students) {
      for (const [name, info] of student.resources) {
        const meta = resourceMeta.get(name) || { weight: 0, publisher: '', cover: null }
        meta.weight += (info.answered || 0) + (info.totalTests || 0)
        if (!meta.publisher && info.publisher) meta.publisher = info.publisher
        if (!meta.cover && info.cover) meta.cover = info.cover
        resourceMeta.set(name, meta)
      }
    }
    const resourceColumns = [...resourceMeta.entries()]
      .filter(([, meta]) => meta.weight > 0)
      .sort((a, b) => b[1].weight - a[1].weight)
      .slice(0, MAX_RESOURCE_COLUMNS)
      .map(([key, meta]) => ({ key, label: key, publisher: meta.publisher, cover: meta.cover }))

    const months = buildAcademicMonths(today)

    // Özet kartları: aktif çözüm yapmış öğrenci sayısı + öğrenci başarı ortalaması.
    const activeStudents = students.filter((student) => Number.isFinite(student.accuracy))
    const avgAccuracy = activeStudents.length
      ? activeStudents.reduce((sum, student) => sum + student.accuracy, 0) / activeStudents.length
      : NaN
    const accuracyValues = activeStudents.map((student) => student.accuracy)
    const summary = {
      studentCount: students.length,
      activeCount: activeStudents.length,
      avgAccuracy,
      minAccuracy: accuracyValues.length ? Math.min(...accuracyValues) : NaN,
      maxAccuracy: accuracyValues.length ? Math.max(...accuracyValues) : NaN,
    }

    return { students, resourceColumns, months, summary }
  }, [data, today])

  const sortedStudents = useMemo(() => {
    if (!analysis) return []
    return [...analysis.students].sort(SORTS[sortKey].fn)
  }, [analysis, sortKey])

  if (classesLoading && !tabs.length) {
    return <LoadingState label="Sınıflar yükleniyor..." />
  }

  if (!tabs.length) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Sınıf Analizi" subtitle="Sınıf düzeyinde toplu öğrenci analizi." />
        <EmptyState
          icon={GraduationCap}
          title="Henüz sınıf oluşmadı"
          description="Aktif öğrencilerinizin profilinde sınıf bilgisi girildiğinde sınıflar burada sekme olarak görünür."
        />
      </div>
    )
  }

  const activeTab = tabs.find((tab) => tab.key === activeKey)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Sınıf Analizi" subtitle="Sınıftaki her öğrencinin durumunu tek ekranda karşılaştırın." />

      <div className="-mx-1 overflow-x-auto px-1">
        <div className="flex w-max gap-2">
          {tabs.map((tab) => {
            const selected = tab.key === activeKey
            return (
              <button
                key={tab.key}
                type="button"
                aria-pressed={selected}
                onClick={() => setSearchParams({ grade: tab.key }, { replace: true })}
                className={`shrink-0 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
                  selected
                    ? 'border-panel-blue bg-panel-blue text-white shadow-sm'
                    : 'border-panel-border bg-panel-surface text-panel-text-muted hover:bg-panel-surface-soft'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {analysis ? (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <SummaryMetric
            icon={Users}
            iconClassName="bg-panel-blue-soft text-panel-blue"
            title="Sınıf Mevcudu"
            value={formatNumber(analysis.summary.studentCount)}
            description={`${formatNumber(analysis.summary.activeCount)} öğrenci aktif çözüm yaptı`}
          />
          <SummaryMetric
            icon={Target}
            iconClassName={cn('bg-panel-blue-soft', RATE_TONES[toneFor(analysis.summary.avgAccuracy)].text)}
            valueClassName={
              Number.isFinite(analysis.summary.avgAccuracy)
                ? RATE_TONES[toneFor(analysis.summary.avgAccuracy)].text
                : undefined
            }
            title="Sınıf Başarı Ortalaması"
            value={pct(analysis.summary.avgAccuracy)}
            description={
              analysis.summary.activeCount
                ? `${analysis.summary.activeCount} öğrenci · %${Math.round(analysis.summary.minAccuracy)}–%${Math.round(
                    analysis.summary.maxAccuracy,
                  )} arası`
                : 'Henüz çözüm yok'
            }
          />
        </div>
      ) : null}

      {data?.failedStudents?.length ? (
        <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-sm text-panel-warm">
          {data.failedStudents.length} öğrencinin verisi yüklenemedi ({data.failedStudents.join(', ')}); kalan öğrenciler
          aşağıda gösteriliyor.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{error}</div>
      ) : !analysis ? (
        <LoadingState label={`${activeTab?.label || 'Sınıf'} analizi yükleniyor...`} />
      ) : analysis.students.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Bu sınıfta öğrenci yok"
          description="Seçili sınıfa atanmış aktif öğrenciniz bulunmuyor."
        />
      ) : (
        <ClassAnalysisBody
          analysis={analysis}
          sortedStudents={sortedStudents}
          sortKey={sortKey}
          onSortChange={setSortKey}
          onOpenStudent={openStudent}
        />
      )}
    </div>
  )
}

const TASK_LEGEND = [
  { key: 'onTime', label: 'Zamanında', className: 'bg-panel-green' },
  { key: 'late', label: 'Geç', className: 'bg-panel-yellow' },
  { key: 'backlog', label: 'Biriken', className: 'bg-panel-red' },
  { key: 'pending', label: 'Bekleyen', className: 'bg-panel-text-muted/40' },
]
const COMPOSITION_LEGEND = [
  { label: 'Doğru', className: 'bg-panel-green' },
  { label: 'Yanlış', className: 'bg-panel-red' },
  { label: 'Boş', className: 'bg-panel-text-muted/40' },
]

// Aylık çözülen soru + o ayın başarı %'si — yumuşak tonlu stat balonu.
function PerfCell({ bucket }) {
  if (!bucket || bucket.questions === 0) return <span className="text-panel-text-muted">–</span>
  const acc = accuracyOf(bucket.correct, bucket.wrong)
  const tone = RATE_TONES[toneFor(acc)]
  return (
    <span className={`inline-flex min-w-[46px] flex-col items-center rounded-lg px-2 py-1 leading-tight ${tone.chip}`}>
      <span className="text-sm font-bold text-panel-text">{formatNumber(bucket.questions)}</span>
      {Number.isFinite(acc) ? <span className="text-[10px] font-bold">{Math.round(acc)}%</span> : null}
    </span>
  )
}

// Aylık sonuç: o ayın başarı %'si (etiket stili — Performans tablosuyla aynı) +
// altında doğru/yanlış/boş sayıları. Ayrıntı ipucu hücrenin üzerinde.
function ResultCell({ bucket }) {
  const total = bucket ? bucket.correct + bucket.wrong + bucket.blank : 0
  if (total === 0) return <span className="text-panel-text-muted">–</span>
  const acc = accuracyOf(bucket.correct, bucket.wrong)
  const tone = RATE_TONES[toneFor(acc)]
  return (
    <span
      className={`inline-flex min-w-[46px] flex-col items-center rounded-lg px-2 py-1 leading-tight ${tone.chip}`}
      title={`Doğru: ${formatNumber(bucket.correct)}\nYanlış: ${formatNumber(bucket.wrong)}\nBoş: ${formatNumber(
        bucket.blank,
      )}\nBaşarı oranı: ${Number.isFinite(acc) ? `${Math.round(acc)}%` : '—'}`}
    >
      <span className="text-sm font-bold text-panel-text">{Number.isFinite(acc) ? `${Math.round(acc)}%` : '—'}</span>
      <span className="flex items-center gap-1.5 text-[10px] font-bold tabular-nums">
        <span className="text-panel-green">{formatNumber(bucket.correct)}</span>
        <span className="text-panel-red">{formatNumber(bucket.wrong)}</span>
        <span className="text-panel-text-muted">{formatNumber(bucket.blank)}</span>
      </span>
    </span>
  )
}

function ClassAnalysisBody({ analysis, sortedStudents, sortKey, onSortChange, onOpenStudent }) {
  const { students, resourceColumns, months } = analysis

  // sortKey / ısı haritası hover'ı gibi tekrar render'larda yeniden hesaplanmasın.
  const byAccuracy = useMemo(
    () => [...students].sort((a, b) => safeAcc(b.accuracy) - safeAcc(a.accuracy)),
    [students],
  )
  const byQuestions = useMemo(
    () => [...students].sort((a, b) => b.totals.questions - a.totals.questions),
    [students],
  )
  const taskRows = useMemo(
    () =>
      [...students]
        .sort((a, b) => b.taskCounts.backlog - a.taskCounts.backlog || b.taskCounts.total - a.taskCounts.total)
        .map((student) => ({
          key: student.key,
          name: student.shortLabel,
          fullName: student.name,
          total: student.taskCounts.total,
          segments: TASK_LEGEND.map((seg) => ({
            value: student.taskCounts[seg.key],
            className: seg.className,
            label: seg.label,
          })),
          valueLabel: `${student.taskCounts.total} görev`,
        })),
    [students],
  )

  return (
    <div className="flex flex-col gap-5">
      <Card
        title="Aylara Göre Çalışma Performansı"
        subtitle="Öğrenci başına aylık çözülen soru ve o ayın başarı yüzdesi (Ağustos–Haziran)"
        icon={CalendarRange}
      >
        <MonthlyTable
          students={byQuestions}
          months={months}
          onSelect={onOpenStudent}
          showTotal
          renderCell={(bucket) => <PerfCell bucket={bucket} />}
        />
      </Card>

      <Card
        title="Aylık Sonuç Analizi"
        subtitle="Öğrenci başına aylık doğru / yanlış / boş dağılımı ve o ayın başarı yüzdesi"
        icon={Target}
      >
        <MonthlyTable
          students={byAccuracy}
          months={months}
          onSelect={onOpenStudent}
          showTotal
          renderCell={(bucket) => <ResultCell bucket={bucket} />}
        />
        <div className="mt-3">
          <Legend items={COMPOSITION_LEGEND} />
        </div>
      </Card>

      <Card
        title="Kaynaklara göre başarı"
        subtitle="Öğrenci × kaynak — her hücrede o kitaptaki doğruluk yüzdesi ve tamamlanma oranı"
        icon={Layers3}
      >
        {resourceColumns.length ? (
          <AccuracyHeatmap students={byAccuracy} columns={resourceColumns} onSelect={onOpenStudent} />
        ) : (
          <p className="py-4 text-sm text-panel-text-muted">Bu aralıkta kaynak bazlı çözüm kaydı yok.</p>
        )}
      </Card>

      <Card
        title="Görevleri zamanında çözme"
        subtitle="Her öğrencinin görev tamamlama disiplini"
        icon={CalendarCheck}
      >
        <StudentStackedRows rows={taskRows} legend={TASK_LEGEND} onSelect={onOpenStudent} unit=" görev" />
      </Card>

      <Card
        title="Öğrencilerin en zorlandığı konu ve kitap"
        subtitle="Her öğrenci için doğruluğu en düşük konu/kaynak"
        icon={Target}
      >
        <HardestPerStudent students={byAccuracy} onOpenStudent={onOpenStudent} />
      </Card>

      <StudentComparison
        students={sortedStudents}
        sortKey={sortKey}
        onSortChange={onSortChange}
        onOpenStudent={onOpenStudent}
      />
    </div>
  )
}

function HardestCell({ row, withPublisher }) {
  if (!row) return <span className="text-panel-text-muted">—</span>
  const tone = RATE_TONES[toneFor(row.accuracy)]
  const publisher = withPublisher ? row.publishers?.[0] : null
  return (
    <span className="flex min-w-0 items-center gap-2">
      {publisher ? (
        <span className="shrink-0 rounded bg-panel-surface-soft px-1.5 py-0.5 text-[10px] font-semibold text-panel-text-muted">
          {publisher}
        </span>
      ) : null}
      <span className="min-w-0 truncate text-panel-text" title={publisher ? `${publisher} · ${row.label}` : row.label}>
        {row.label}
      </span>
      <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-xs font-bold ${tone.chip}`}>{pct(row.accuracy)}</span>
    </span>
  )
}

function HardestPerStudent({ students, onOpenStudent }) {
  return (
    <ul className="divide-y divide-panel-border">
      {students.map((student) => (
        <li key={student.key}>
          <button
            type="button"
            onClick={() => onOpenStudent(student.key)}
            className="grid w-full gap-1 py-3 text-left transition-colors hover:bg-panel-surface-soft sm:grid-cols-[8rem_minmax(0,1fr)_minmax(0,1fr)] sm:items-center sm:gap-3"
          >
            <span className="truncate text-sm font-semibold text-panel-text" title={student.name}>
              {student.name}
            </span>
            <span className="flex min-w-0 items-center gap-1.5 text-sm">
              <span className="shrink-0 text-xs text-panel-text-muted sm:hidden">Konu:</span>
              <HardestCell row={student.hardestTopic} />
            </span>
            <span className="flex min-w-0 items-center gap-1.5 text-sm">
              <span className="shrink-0 text-xs text-panel-text-muted sm:hidden">Kitap:</span>
              <HardestCell row={student.hardestBook} withPublisher />
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function StudentComparison({ students, sortKey, onSortChange, onOpenStudent }) {
  return (
    <section className="panel-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-panel-border px-5 py-4">
        <div>
          <h2 className="text-base font-bold text-panel-text">Öğrenci karşılaştırması</h2>
          <p className="mt-0.5 text-sm text-panel-text-muted">Öğrenciye dokununca detay analizine gidersiniz</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-panel-text-muted">Sırala</span>
          <select
            value={sortKey}
            onChange={(event) => onSortChange(event.target.value)}
            className="h-10 rounded-lg border border-panel-border bg-panel-surface px-3 text-sm font-semibold text-panel-text focus:border-panel-blue focus:outline-none"
          >
            {Object.entries(SORTS).map(([key, { label }]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Masaüstü: tablo */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-panel-border text-left text-xs font-semibold uppercase tracking-wide text-panel-text-muted">
              <th className="px-5 py-3">Öğrenci</th>
              <th className="px-3 py-3 text-right">Çözülen</th>
              <th className="px-3 py-3 text-right">Doğru</th>
              <th className="px-3 py-3 text-right">Başarı</th>
              <th className="px-3 py-3 text-right">Net</th>
              <th className="px-3 py-3 text-right">Biriken</th>
              <th className="px-5 py-3 text-right">Son işlem zamanı</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-panel-border">
            {students.map((student) => {
              const tone = RATE_TONES[toneFor(student.accuracy)]
              return (
                <tr
                  key={student.key}
                  onClick={() => onOpenStudent(student.key)}
                  className="cursor-pointer transition-colors hover:bg-panel-surface-soft"
                >
                  <td className="px-5 py-3">
                    <span className="font-semibold text-panel-text">{student.name}</span>
                    {student.subjectName ? (
                      <span className="ml-2 text-xs text-panel-text-muted">{student.subjectName}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-panel-text">{formatNumber(student.totals.questions)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-panel-text">{formatNumber(student.totals.correct)}</td>
                  <td className={`px-3 py-3 text-right font-bold tabular-nums ${tone.text}`}>{pct(student.accuracy)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-panel-text">{formatNet(student.net)}</td>
                  <td
                    className={`px-3 py-3 text-right font-semibold tabular-nums ${
                      student.taskCounts.backlog > 0 ? 'text-panel-red' : 'text-panel-text-muted'
                    }`}
                  >
                    {student.taskCounts.backlog}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <LastActivity iso={student.lastActivityAt} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobil: kart listesi */}
      <ul className="divide-y divide-panel-border md:hidden">
        {students.map((student) => {
          const tone = RATE_TONES[toneFor(student.accuracy)]
          return (
            <li key={student.key}>
              <button
                type="button"
                onClick={() => onOpenStudent(student.key)}
                className="flex w-full flex-col gap-2 px-4 py-3 text-left"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate font-semibold text-panel-text">{student.name}</span>
                  <span className={`shrink-0 text-sm font-bold ${tone.text}`}>{pct(student.accuracy)}</span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-panel-text-muted">
                  <span>{formatNumber(student.totals.questions)} çözülen</span>
                  <span>{formatNumber(student.totals.correct)} doğru</span>
                  <span>{formatNet(student.net)} net</span>
                  <span className={student.taskCounts.backlog > 0 ? 'font-semibold text-panel-red' : undefined}>
                    {student.taskCounts.backlog} biriken
                  </span>
                </div>
                {student.lastActivityAt ? (
                  <div className="text-[11px] text-panel-text-muted">
                    Son işlem: {new Date(student.lastActivityAt).toLocaleString('tr-TR', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
