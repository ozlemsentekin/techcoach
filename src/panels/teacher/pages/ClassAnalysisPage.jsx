import { createElement, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  BookOpenCheck,
  CalendarCheck,
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
  dateInRange,
  formatNet,
  formatNumber,
  sumRecords,
  toDateKey,
} from '../../shared/progressAnalytics'
import { RATE_TONES, successRateTone } from '../../shared/rateTones'
import { calculateNet } from '../../../utils/netCalculator'
import { todayISODate } from '../../../utils/time'
import { isBacklogTask } from '../../../utils/backlogTasks'
import { getTeacherClassAnalysis } from '../../../services/teacherService'
import { useTeacherClasses } from '../useTeacherClasses'

const UNSPECIFIED_KEY = '__none__'
const RANGE_FILTERS = [
  { id: 'all', label: 'Tüm Zamanlar' },
  { id: 'month', label: 'Bu Ay' },
  { id: 'week', label: 'Bu Hafta' },
]
const COMPLETED_STATUSES = new Set(['tamamlandi', 'kismen-tamamlandi'])
const MIN_ANSWERED_FOR_RANK = 3
const MAX_RESOURCE_COLUMNS = 8

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
function analyzeStudent(entry, range, today) {
  const overview = entry.overview || {}
  const testsById = new Map((overview.tests || []).map((test) => [test.id, test]))
  const records = buildActivityRecords(overview, testsById).filter((record) =>
    dateInRange(record.date, range, today),
  )
  const totals = sumRecords(records)
  const answered = totals.correct + totals.wrong

  const tasks = (overview.tasks || []).filter((task) => dateInRange(toDateKey(task.date), range, today))
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

  const lastActive = records.reduce((max, record) => (record.date > max ? record.date : max), '')

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
    resourceAccuracy: new Map(
      resourceRows.map((row) => [row.key, { accuracy: row.accuracy, answered: row.correct + row.wrong }]),
    ),
    resourceRows,
    hardestTopic: rankable(topicRows),
    hardestBook: rankable(resourceRows),
    lastActive,
  }
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

// Öğrenci başına tek değerli yatay bar (başarı % veya çözülen soru). rows:
// [{ key, name, fullName, fillClass, ratio (0..1), valueLabel, sub }]
function StudentBarRows({ rows, onSelect }) {
  return (
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
            <span className="relative h-5 min-w-0 flex-1 rounded-full bg-panel-surface-soft">
              <span
                className={`absolute inset-y-0 left-0 rounded-full ${row.fillClass}`}
                style={{ width: `${Math.max(2, Math.min(100, row.ratio * 100))}%` }}
              />
            </span>
            <span className="w-9 shrink-0 text-right text-xs font-bold text-panel-text sm:text-sm">{row.valueLabel}</span>
          </button>
          {row.sub ? <p className="ml-[5.75rem] -mt-1 pb-1 text-[11px] text-panel-text-muted sm:ml-[6.75rem]">{row.sub}</p> : null}
        </li>
      ))}
    </ul>
  )
}

// Öğrenci başına yığılı bar (doğru/yanlış/boş veya görev disiplini). rows:
// [{ key, name, fullName, segments: [{ value, className }], total, valueLabel }]
function StudentStackedRows({ rows, legend, onSelect }) {
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
                          className={seg.className}
                          style={{ width: `${(seg.value / row.total) * 100}%` }}
                        />
                      ) : null,
                    )
                  : null}
              </span>
              <span className="w-14 shrink-0 text-right text-xs font-bold text-panel-text sm:text-sm">
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

// Öğrenci × kaynak başarı ısı haritası. columns: [{ key, label }].
function AccuracyHeatmap({ students, columns, onSelect }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-1 text-center">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-panel-surface" />
            {columns.map((col) => (
              <th
                key={col.key}
                className="max-w-[84px] truncate px-1 pb-1 text-[11px] font-semibold text-panel-text-muted"
                title={col.label}
              >
                {col.label}
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
                const cell = student.resourceAccuracy.get(col.key)
                if (!cell || !Number.isFinite(cell.accuracy)) {
                  return (
                    <td key={col.key} className="rounded-md bg-panel-surface-soft/60 py-2 text-[11px] text-panel-text-muted">
                      –
                    </td>
                  )
                }
                const tone = RATE_TONES[toneFor(cell.accuracy)]
                return (
                  <td
                    key={col.key}
                    className={`rounded-md py-2 text-[11px] font-bold ${tone.chip}`}
                    title={`${student.name} · ${col.label}: ${pct(cell.accuracy)} (${formatNumber(cell.answered)} soru)`}
                  >
                    {Math.round(cell.accuracy)}
                  </td>
                )
              })}
            </tr>
          ))}
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
  const [range, setRange] = useState('all')
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
    const students = (data.students || []).map((entry) => analyzeStudent(entry, range, today))

    // Isı haritası sütunları: sınıfın en çok çalıştığı kaynaklar.
    const resourceTotals = new Map()
    for (const student of students) {
      for (const row of student.resourceRows) {
        const current = resourceTotals.get(row.key) || 0
        resourceTotals.set(row.key, current + row.correct + row.wrong)
      }
    }
    const resourceColumns = [...resourceTotals.entries()]
      .filter(([, answered]) => answered > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_RESOURCE_COLUMNS)
      .map(([key]) => ({ key, label: key }))

    const maxQuestions = Math.max(1, ...students.map((student) => student.totals.questions))

    return { students, resourceColumns, maxQuestions }
  }, [data, range, today])

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
          title="Sınıf oluşturacak öğrenci yok"
          description="En az iki aktif öğrenciniz olduğunda sınıflarınız burada sekme olarak görünür."
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

      <div className="flex w-full gap-1 rounded-xl border border-panel-border bg-panel-surface-soft p-1 sm:w-auto sm:self-start">
        {RANGE_FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            aria-pressed={range === filter.id}
            onClick={() => setRange(filter.id)}
            className={`h-9 flex-1 rounded-lg px-3 text-xs font-bold transition-colors sm:flex-none ${
              range === filter.id
                ? 'bg-panel-surface text-panel-text shadow-sm'
                : 'text-panel-text-muted hover:text-panel-text'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

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
          onOpenStudent={(id) => navigate(`/teacher/students/${id}?tab=analysis`)}
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

function ClassAnalysisBody({ analysis, sortedStudents, sortKey, onSortChange, onOpenStudent }) {
  const { students, resourceColumns, maxQuestions } = analysis

  const byAccuracy = [...students].sort((a, b) => safeAcc(b.accuracy) - safeAcc(a.accuracy))
  const byQuestions = [...students].sort((a, b) => b.totals.questions - a.totals.questions)

  const accuracyRows = byAccuracy.map((student) => ({
    key: student.key,
    name: student.shortLabel,
    fullName: student.name,
    fillClass: RATE_TONES[toneFor(student.accuracy)].bar,
    ratio: Number.isFinite(student.accuracy) ? student.accuracy / 100 : 0,
    valueLabel: pct(student.accuracy),
    sub: student.answered
      ? `${formatNumber(student.answered)} soru · ${formatNumber(student.totals.correct)} doğru`
      : 'bu aralıkta çözüm yok',
  }))

  const questionRows = byQuestions.map((student) => ({
    key: student.key,
    name: student.shortLabel,
    fullName: student.name,
    fillClass: 'bg-panel-blue',
    ratio: student.totals.questions / maxQuestions,
    valueLabel: formatNumber(student.totals.questions),
    sub: `${formatNumber(student.totals.correct)} D · ${formatNumber(student.totals.wrong)} Y · ${formatNumber(student.totals.blank)} B`,
  }))

  const compositionRows = byAccuracy.map((student) => ({
    key: student.key,
    name: student.shortLabel,
    fullName: student.name,
    total: student.totals.correct + student.totals.wrong + student.totals.blank,
    segments: [
      { value: student.totals.correct, className: 'bg-panel-green' },
      { value: student.totals.wrong, className: 'bg-panel-red' },
      { value: student.totals.blank, className: 'bg-panel-text-muted/40' },
    ],
    valueLabel: pct(student.accuracy),
  }))

  const taskRows = [...students]
    .sort((a, b) => b.taskCounts.backlog - a.taskCounts.backlog || b.taskCounts.total - a.taskCounts.total)
    .map((student) => ({
      key: student.key,
      name: student.shortLabel,
      fullName: student.name,
      total: student.taskCounts.total,
      segments: TASK_LEGEND.map((seg) => ({ value: student.taskCounts[seg.key], className: seg.className })),
      valueLabel: `${student.taskCounts.total} görev`,
    }))

  return (
    <div className="flex flex-col gap-5">
      <Card
        title="Öğrenci başarı oranları"
        subtitle="Her öğrencinin doğruluk yüzdesi — satıra dokununca öğrencinin analizine gidersiniz"
        icon={GraduationCap}
      >
        <StudentBarRows rows={accuracyRows} onSelect={onOpenStudent} />
      </Card>

      <Card title="Çözülen soru sayısı" subtitle="Hangi öğrenci ne kadar soru çözmüş" icon={BookOpenCheck}>
        <StudentBarRows rows={questionRows} onSelect={onOpenStudent} />
      </Card>

      <Card title="Doğru / Yanlış / Boş dağılımı" subtitle="Her öğrencinin soru dağılımı" icon={Target}>
        <StudentStackedRows rows={compositionRows} legend={COMPOSITION_LEGEND} onSelect={onOpenStudent} />
      </Card>

      <Card
        title="Kaynaklara göre başarı"
        subtitle="Öğrenci × kaynak — hücredeki sayı o öğrencinin o kitaptaki doğruluk yüzdesi"
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
        <StudentStackedRows rows={taskRows} legend={TASK_LEGEND} onSelect={onOpenStudent} />
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

function HardestCell({ row }) {
  if (!row) return <span className="text-panel-text-muted">—</span>
  const tone = RATE_TONES[toneFor(row.accuracy)]
  return (
    <span className="flex items-center gap-2">
      <span className="min-w-0 truncate text-panel-text" title={row.label}>
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
              <HardestCell row={student.hardestBook} />
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
              <th className="px-5 py-3 text-right">Son aktivite</th>
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
                  <td className="px-5 py-3 text-right text-panel-text-muted">{student.lastActive || '—'}</td>
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
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
