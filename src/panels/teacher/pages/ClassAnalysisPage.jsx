import { createElement, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  BookOpenCheck,
  CalendarCheck,
  ChevronRight,
  GraduationCap,
  Layers3,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react'
import PageHeader from '../../layout/PageHeader'
import EmptyState from '../../shared/EmptyState'
import LoadingState from '../../shared/LoadingState'
import {
  CompositionDonut,
  CompositionLegend,
  DailyActivityBars,
  HorizontalAccuracyBars,
  RankedBarList,
} from '../../shared/ProgressAnalysisCharts'
import {
  aggregateBy,
  buildActivityRecords,
  buildDailyActivity,
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
const MIN_TOPIC_QUESTIONS = 5

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

  const tasks = (overview.tasks || []).filter((task) =>
    dateInRange(toDateKey(task.date), range, today),
  )
  let onTime = 0
  let late = 0
  let backlog = 0
  let pending = 0
  for (const task of tasks) {
    if (COMPLETED_STATUSES.has(task.status)) {
      const doneDay = toDateKey(task.completedAt || task.date)
      if (doneDay && doneDay > toDateKey(task.date)) late += 1
      else onTime += 1
    } else if (isBacklogTask(task)) {
      backlog += 1
    } else {
      pending += 1
    }
  }

  const lastActive = records.reduce((max, record) => (record.date > max ? record.date : max), '')

  return {
    studentTeacherId: entry.studentTeacherId,
    name: entry.studentFullName,
    photoUrl: entry.studentPhotoUrl || null,
    subjectName: entry.subjectName || null,
    records,
    totals,
    answered,
    accuracy: accuracyOf(totals.correct, totals.wrong),
    net: calculateNet(totals.correct, totals.wrong),
    taskCounts: { total: tasks.length, onTime, late, backlog, pending },
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

const TIMELINESS_SEGMENTS = [
  { key: 'onTime', label: 'Zamanında', className: 'bg-panel-green' },
  { key: 'late', label: 'Geç tamamlanan', className: 'bg-panel-yellow' },
  { key: 'backlog', label: 'Biriken', className: 'bg-panel-red' },
  { key: 'pending', label: 'Bekleyen', className: 'bg-panel-text-muted/40' },
]

function SegmentedBar({ counts }) {
  const total = TIMELINESS_SEGMENTS.reduce((sum, seg) => sum + (counts[seg.key] || 0), 0)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-panel-surface-soft">
        {total > 0
          ? TIMELINESS_SEGMENTS.map((seg) =>
              counts[seg.key] > 0 ? (
                <div
                  key={seg.key}
                  className={seg.className}
                  style={{ width: `${(counts[seg.key] / total) * 100}%` }}
                  title={`${seg.label}: ${counts[seg.key]}`}
                />
              ) : null,
            )
          : null}
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
        {TIMELINESS_SEGMENTS.map((seg) => (
          <li key={seg.key} className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${seg.className}`} />
            <span className="flex-1 text-panel-text-muted">{seg.label}</span>
            <span className="font-bold text-panel-text">{counts[seg.key] || 0}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

const SORTS = {
  accuracyAsc: { label: 'Düşük başarı önce', fn: (a, b) => safeAcc(a) - safeAcc(b) },
  answeredDesc: { label: 'En çok soru', fn: (a, b) => b.answered - a.answered },
  backlogDesc: { label: 'En çok biriken görev', fn: (a, b) => b.taskCounts.backlog - a.taskCounts.backlog },
}

function safeAcc(row) {
  return Number.isFinite(row.accuracy) ? row.accuracy : 999
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

  // Sekme değişince eski sınıfın verisi ekranda kalmasın: yükleme yalnızca aktif
  // sınıfın sonucu geldiğinde tamamlanmış sayılır.
  const data = loaded?.key === activeKey ? loaded.result : null
  const error = failed?.key === activeKey ? failed.message : ''

  const analysis = useMemo(() => {
    if (!data) return null
    const students = (data.students || []).map((entry) => analyzeStudent(entry, range, today))
    const classRecords = students.flatMap((student) => student.records)
    const classTotals = sumRecords(classRecords)
    const classTasks = students.reduce(
      (acc, student) => {
        acc.onTime += student.taskCounts.onTime
        acc.late += student.taskCounts.late
        acc.backlog += student.taskCounts.backlog
        acc.pending += student.taskCounts.pending
        acc.total += student.taskCounts.total
        return acc
      },
      { onTime: 0, late: 0, backlog: 0, pending: 0, total: 0 },
    )
    const resolvedTasks = classTasks.onTime + classTasks.late + classTasks.backlog
    const onTimeRate = resolvedTasks > 0 ? (classTasks.onTime / resolvedTasks) * 100 : NaN

    const resourceRows = aggregateBy(classRecords, (record) => record.resource)
      .filter((row) => row.correct + row.wrong > 0)
      .slice(0, 8)
      .map((row) => ({
        key: row.key,
        label: row.label,
        accuracy: row.accuracy,
        answered: row.correct + row.wrong,
        correct: row.correct,
      }))

    const topicRows = aggregateBy(classRecords, (record) => record.contentGroup || record.content)
    const hardestTopics = topicRows
      .filter((row) => row.correct + row.wrong >= MIN_TOPIC_QUESTIONS)
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 6)
    const hardestBooks = topicRows.length
      ? aggregateBy(classRecords, (record) => record.resource)
          .filter((row) => row.correct + row.wrong >= MIN_TOPIC_QUESTIONS)
          .sort((a, b) => a.accuracy - b.accuracy)
          .slice(0, 6)
      : []

    const classAccuracy = accuracyOf(classTotals.correct, classTotals.wrong)
    const studentAccuracies = students.map((s) => s.accuracy).filter(Number.isFinite)
    const avgStudentAccuracy = studentAccuracies.length
      ? studentAccuracies.reduce((sum, v) => sum + v, 0) / studentAccuracies.length
      : NaN

    return {
      students,
      classRecords,
      classTotals,
      classTasks,
      onTimeRate,
      classAccuracy,
      avgStudentAccuracy,
      resourceRows,
      hardestTopics,
      hardestBooks,
      dailyActivity: buildDailyActivity(classRecords, range, today),
      activeDays: new Set(classRecords.map((r) => r.date).filter(Boolean)).size,
    }
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
      <PageHeader
        title="Sınıf Analizi"
        subtitle="Sınıftaki öğrencilerin bütününü tek ekranda değerlendirin."
      />

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

function ClassAnalysisBody({ analysis, sortedStudents, sortKey, onSortChange, onOpenStudent }) {
  const { students, classTotals, classTasks, resourceRows, hardestTopics, hardestBooks, dailyActivity } = analysis

  const studentBars = students
    .map((student) => ({
      key: student.studentTeacherId,
      label: student.name,
      accuracy: student.accuracy,
      answered: student.answered,
      correct: student.totals.correct,
    }))
    .sort((a, b) => safeAccValue(b.accuracy) - safeAccValue(a.accuracy))

  const topBacklog = students
    .filter((student) => student.taskCounts.backlog > 0)
    .sort((a, b) => b.taskCounts.backlog - a.taskCounts.backlog)
    .slice(0, 5)

  return (
    <div className="flex flex-col gap-5">
      <Card
        title="Öğrenci başarı oranları"
        subtitle="Her öğrencinin doğruluk yüzdesi — bara dokununca öğrencinin analizine gidersiniz"
        icon={GraduationCap}
      >
        <HorizontalAccuracyBars data={studentBars} onSelect={onOpenStudent} />
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Doğru / Yanlış / Boş" subtitle="Sınıf geneli soru dağılımı" icon={Target}>
          <div className="flex flex-col items-center gap-5 sm:flex-row">
            <CompositionDonut correct={classTotals.correct} wrong={classTotals.wrong} blank={classTotals.blank} />
            <CompositionLegend correct={classTotals.correct} wrong={classTotals.wrong} blank={classTotals.blank} />
          </div>
        </Card>
        <Card title="Günlük soru aktivitesi" subtitle="Sınıfın toplam çözdüğü soru" icon={TrendingUp}>
          <DailyActivityBars data={dailyActivity} />
        </Card>
      </div>

      <Card
        title="Kaynaklara göre başarı"
        subtitle="Sınıfın kaynak kitap bazında doğruluğu"
        icon={BookOpenCheck}
      >
        {resourceRows.length ? (
          <HorizontalAccuracyBars data={resourceRows} />
        ) : (
          <p className="py-4 text-sm text-panel-text-muted">Bu aralıkta kaynak bazlı çözüm kaydı yok.</p>
        )}
      </Card>

      <Card title="Görevleri zamanında çözme" subtitle="Sınıfın görev tamamlama disiplini" icon={CalendarCheck}>
        <SegmentedBar counts={classTasks} />
        {topBacklog.length ? (
          <div className="mt-5 border-t border-panel-border pt-4">
            <p className="mb-2 text-sm font-semibold text-panel-text">En çok görev biriktirenler</p>
            <ul className="flex flex-col divide-y divide-panel-border">
              {topBacklog.map((student) => (
                <li key={student.studentTeacherId}>
                  <button
                    type="button"
                    onClick={() => onOpenStudent(student.studentTeacherId)}
                    className="flex w-full items-center justify-between gap-3 py-2 text-left"
                  >
                    <span className="min-w-0 truncate text-sm font-medium text-panel-text">{student.name}</span>
                    <span className="flex shrink-0 items-center gap-2 text-sm font-bold text-panel-red">
                      {student.taskCounts.backlog} biriken
                      <ChevronRight size={15} className="text-panel-text-muted" aria-hidden="true" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="En zorlanılan konular" subtitle={`En az ${MIN_TOPIC_QUESTIONS} soru çözülen konular`} icon={Target}>
          <RankedBarList
            emptyLabel="Bu aralıkta zorlanılan konu tespit edilmedi."
            items={hardestTopics.map((row) => ({
              key: row.key,
              label: row.label,
              ratio: (row.wrong) / Math.max(1, row.correct + row.wrong),
              tone: toneFor(row.accuracy),
              valueLabel: `${pct(row.accuracy)} başarı`,
              metaLabel: `${formatNumber(row.correct + row.wrong)} soru · ${formatNumber(row.wrong)} yanlış`,
            }))}
          />
        </Card>
        <Card title="En zorlanılan kitaplar" subtitle="Doğruluğu en düşük kaynaklar" icon={Layers3}>
          <RankedBarList
            emptyLabel="Bu aralıkta zorlanılan kitap tespit edilmedi."
            items={hardestBooks.map((row) => ({
              key: row.key,
              label: row.label,
              ratio: (row.wrong) / Math.max(1, row.correct + row.wrong),
              tone: toneFor(row.accuracy),
              valueLabel: `${pct(row.accuracy)} başarı`,
              metaLabel: `${formatNumber(row.correct + row.wrong)} soru · ${formatNumber(row.wrong)} yanlış`,
            }))}
          />
        </Card>
      </div>

      <StudentComparison
        students={sortedStudents}
        sortKey={sortKey}
        onSortChange={onSortChange}
        onOpenStudent={onOpenStudent}
      />
    </div>
  )
}

function safeAccValue(accuracy) {
  return Number.isFinite(accuracy) ? accuracy : -1
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
                  key={student.studentTeacherId}
                  onClick={() => onOpenStudent(student.studentTeacherId)}
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
            <li key={student.studentTeacherId}>
              <button
                type="button"
                onClick={() => onOpenStudent(student.studentTeacherId)}
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
