import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { FileCheck2 } from 'lucide-react'
import LoadingState from '../../shared/LoadingState'
import EmptyState from '../../shared/EmptyState'
import { cn } from '../../ui/utils'
import { MOCK_EXAM_KINDS, mockExamKindLabel } from '../../shared/mockExamConfig'

const MONTH_FMT = new Intl.DateTimeFormat('tr-TR', { month: 'short', year: '2-digit' })

// Panelin yumuşak paletine yakın, birbirinden ayırt edilebilir çizgi renkleri.
const SERIES_COLORS = [
  '#5b8def',
  '#ef8b53',
  '#3fae82',
  '#b579d6',
  '#e0b24a',
  '#e07171',
  '#5aa9c4',
  '#8b93a7',
  '#d67aa8',
  '#7ac46f',
]

function monthKey(exam) {
  const raw = exam.examDate || exam.createdAt
  return raw ? String(raw).slice(0, 7) : null
}

function monthLabel(key) {
  const date = new Date(`${key}-01T00:00:00`)
  return Number.isNaN(date.getTime()) ? key : MONTH_FMT.format(date)
}

function round1(value) {
  return Math.round(value * 10) / 10
}

function ChartTooltip({ active, payload, label, unit = '' }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-panel-border bg-panel-surface px-3 py-2 text-xs shadow-lg">
      {label ? <p className="mb-1 font-bold text-panel-text">{label}</p> : null}
      {payload
        .filter((entry) => entry.value != null)
        .map((entry) => (
          <p key={entry.name ?? entry.dataKey} className="flex items-center gap-2 text-panel-text-muted">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
            <span className="font-semibold text-panel-text">{entry.name}</span>
            <span className="ml-auto pl-3 font-bold text-panel-text">
              {entry.value}
              {unit}
            </span>
          </p>
        ))}
    </div>
  )
}

function ChartCard({ title, subtitle, children }) {
  return (
    <div className="panel-card p-4">
      <p className="text-sm font-semibold text-panel-text">{title}</p>
      {subtitle ? <p className="mt-0.5 text-xs text-panel-text-muted">{subtitle}</p> : null}
      <div className="mt-3 h-56 w-full">{children}</div>
    </div>
  )
}

// Verilen öğrenci listesinden (sadece kindFilter türündeki denemeler) grafik modeli üretir.
function buildModel(students, kindFilter) {
  const withExams = students
    .map((student) => ({
      ...student,
      exams: (student.exams || []).filter((exam) => exam.kind === kindFilter),
    }))
    .filter((student) => student.exams.length > 0)

  const monthSet = new Set()
  withExams.forEach((student) => {
    student.exams.forEach((exam) => {
      const key = monthKey(exam)
      if (key) monthSet.add(key)
    })
  })
  const months = [...monthSet].sort()

  const classMonthly = months.map((key) => {
    const nets = []
    withExams.forEach((student) => {
      student.exams.forEach((exam) => {
        if (monthKey(exam) === key) nets.push(exam.net)
      })
    })
    return {
      key,
      label: monthLabel(key),
      net: nets.length ? round1(nets.reduce((a, b) => a + b, 0) / nets.length) : null,
      count: nets.length,
    }
  })

  const studentSeries = withExams.map((student, index) => ({
    name: student.studentFullName,
    studentTeacherId: student.studentTeacherId,
    color: SERIES_COLORS[index % SERIES_COLORS.length],
  }))
  const studentMonthly = months.map((key) => {
    const point = { label: monthLabel(key) }
    withExams.forEach((student) => {
      const nets = student.exams.filter((exam) => monthKey(exam) === key).map((exam) => exam.net)
      if (nets.length) point[student.studentFullName] = round1(nets.reduce((a, b) => a + b, 0) / nets.length)
    })
    return point
  })

  const bySubject = new Map()
  withExams.forEach((student) => {
    student.exams.forEach((exam) => {
      exam.subjects.forEach((subject) => {
        const entry = bySubject.get(subject.subjectName) || { sum: 0, count: 0 }
        entry.sum += subject.successRate
        entry.count += 1
        bySubject.set(subject.subjectName, entry)
      })
    })
  })
  const subjectAverages = [...bySubject.entries()]
    .map(([subject, entry]) => ({ subject, successRate: round1(entry.sum / entry.count) }))
    .sort((a, b) => b.successRate - a.successRate)

  const summary = withExams
    .map((student) => {
      let netSum = 0
      student.exams.forEach((exam) => {
        netSum += exam.net
      })
      return {
        studentTeacherId: student.studentTeacherId,
        name: student.studentFullName,
        total: student.exams.length,
        avgNet: round1(netSum / student.exams.length),
      }
    })
    .sort((a, b) => b.avgNet - a.avgNet)

  return { studentCount: withExams.length, months, classMonthly, studentSeries, studentMonthly, subjectAverages, summary }
}

// Sınıf Analizi > "Deneme Sonuçları": deneme tipine göre ayrışan, ay bazında sınıf grafikleri.
export default function ClassMockExamPanel({ grade, fetchAnalysis, onSelectStudent }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [kindFilter, setKindFilter] = useState(null)

  useEffect(() => {
    if (!grade) return undefined
    let ignore = false
    fetchAnalysis(grade)
      .then((result) => {
        if (!ignore) setData(result)
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })
    return () => {
      ignore = true
    }
  }, [grade, fetchAnalysis])

  const students = useMemo(
    () => (data?.students || []).filter((student) => (student.exams || []).length > 0),
    [data],
  )

  // Sınıfta veri olan deneme türleri (MOCK_EXAM_KINDS sırasıyla).
  const presentKinds = useMemo(() => {
    const set = new Set()
    students.forEach((student) => student.exams.forEach((exam) => set.add(exam.kind)))
    return MOCK_EXAM_KINDS.map((meta) => meta.value).filter((value) => set.has(value))
  }, [students])

  const activeKind = kindFilter && presentKinds.includes(kindFilter) ? kindFilter : presentKinds[0]
  const model = useMemo(
    () => (activeKind ? buildModel(students, activeKind) : null),
    [students, activeKind],
  )

  if (error) {
    return <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{error}</div>
  }
  if (data === null) {
    return <LoadingState label="Deneme analizi yükleniyor..." />
  }
  if (!presentKinds.length) {
    return (
      <EmptyState
        icon={FileCheck2}
        title="Bu sınıfta deneme sonucu yok"
        description="Öğrenciler veya veliler Deneme Sınavları menüsünden sonuç girdiğinde sınıf grafikleri burada oluşur. (Branş İzleme ve Etüt'te yalnızca takip ettiğiniz derslere ait sonuçlar görünür.)"
      />
    )
  }

  const axisTick = { fontSize: 10, fill: 'var(--color-panel-text-muted)' }
  const gridProps = { vertical: false, stroke: 'var(--color-panel-border)', strokeOpacity: 0.6, strokeDasharray: '2 4' }
  const subjectSubtitle =
    activeKind === 'genel' ? 'Genel Denemelerdeki tüm dersler' : 'Takip ettiğiniz derslerin ortalaması'

  return (
    <div className="flex flex-col gap-4">
      <div className="-mx-1 overflow-x-auto px-1">
        <div className="flex w-max gap-2">
          {presentKinds.map((value) => {
            const selected = value === activeKind
            return (
              <button
                key={value}
                type="button"
                aria-pressed={selected}
                onClick={() => setKindFilter(value)}
                className={cn(
                  'shrink-0 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-colors',
                  selected
                    ? 'border-panel-blue bg-panel-blue text-white shadow-sm'
                    : 'border-panel-border bg-panel-surface text-panel-text-muted hover:bg-panel-surface-soft',
                )}
              >
                {mockExamKindLabel(value)}
              </button>
            )
          })}
        </div>
      </div>

      {!model || !model.studentCount ? (
        <EmptyState icon={FileCheck2} title={`${mockExamKindLabel(activeKind)} sonucu yok`} />
      ) : (
      <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Sınıf aylık ortalama neti" subtitle="Tüm öğrencilerin o ayki denemelerinin ortalaması">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={model.classMonthly} margin={{ top: 4, right: 8, bottom: 0, left: 0 }} barCategoryGap="24%">
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis width={32} tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip cursor={{ fill: 'var(--color-panel-surface-soft)', radius: 6 }} content={<ChartTooltip unit=" net" />} />
              <Bar
                dataKey="net"
                name="Ortalama net"
                fill="color-mix(in oklab, var(--color-panel-blue) 72%, white)"
                radius={[6, 6, 0, 0]}
                maxBarSize={40}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Öğrenciye göre aylık net" subtitle="Her çizgi bir öğrenci">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={model.studentMonthly} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis width={32} tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip unit=" net" />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {model.studentSeries.map((series) => (
                <Line
                  key={series.name}
                  type="monotone"
                  dataKey={series.name}
                  stroke={series.color}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="Ders bazında sınıf ortalama başarısı" subtitle={subjectSubtitle}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={model.subjectAverages}
            layout="vertical"
            margin={{ top: 4, right: 12, bottom: 0, left: 8 }}
          >
            <CartesianGrid horizontal={false} stroke="var(--color-panel-border)" strokeOpacity={0.6} strokeDasharray="2 4" />
            <XAxis type="number" domain={[0, 100]} tick={axisTick} axisLine={false} tickLine={false} unit="%" />
            <YAxis
              type="category"
              dataKey="subject"
              width={140}
              tick={{ fontSize: 11, fill: 'var(--color-panel-text)' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip cursor={{ fill: 'var(--color-panel-surface-soft)' }} content={<ChartTooltip unit="%" />} />
            <Bar
              dataKey="successRate"
              name="Başarı"
              fill="color-mix(in oklab, var(--color-panel-sage) 82%, white)"
              radius={[0, 6, 6, 0]}
              maxBarSize={26}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="panel-card overflow-hidden">
        <p className="border-b border-panel-border px-4 py-3 text-sm font-semibold text-panel-text">
          {mockExamKindLabel(activeKind)} — öğrenci özeti
        </p>
        <ul className="divide-y divide-panel-border/60">
          {model.summary.map((student) => (
            <li key={student.studentTeacherId}>
              <button
                type="button"
                onClick={() => onSelectStudent?.(student.studentTeacherId)}
                className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-left hover:bg-panel-surface-soft"
              >
                <span className="min-w-32 flex-1 text-sm font-medium text-panel-text">{student.name}</span>
                <span className="rounded-lg bg-panel-surface-soft px-2 py-0.5 text-xs font-medium text-panel-text-muted tabular-nums">
                  {student.total} deneme
                </span>
                <span className="rounded-lg bg-panel-blue-soft px-2 py-0.5 text-xs font-semibold text-panel-blue tabular-nums">
                  Ort. net {student.avgNet}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      </>
      )}
    </div>
  )
}
