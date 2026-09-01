import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

// "Genel Analiz" sekmesinin grafik bileşenleri (recharts). Renkler tema CSS
// değişkenlerinden türetilir; panelin yumuşak paletine uyması için beyazla
// karıştırılıp pastel tonlara indirilir — bkz. src/index.css.

const SOFT = {
  correct: 'color-mix(in oklab, var(--color-panel-sage) 88%, white)',
  wrong: 'color-mix(in oklab, var(--color-panel-red) 70%, white)',
  blank: 'color-mix(in oklab, var(--color-panel-border-strong) 82%, white)',
  bar: 'color-mix(in oklab, var(--color-student-theme-primary) 78%, white)',
}

const numberFormatter = new Intl.NumberFormat('tr-TR')

function formatCount(value) {
  return numberFormatter.format(Math.round(Number(value) || 0))
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return '—'
  return `${Math.round(value)}%`
}

function buildSegments({ correct, wrong, blank }) {
  return [
    { key: 'correct', label: 'Doğru', value: Number(correct) || 0, color: SOFT.correct },
    { key: 'wrong', label: 'Yanlış', value: Number(wrong) || 0, color: SOFT.wrong },
    { key: 'blank', label: 'Boş', value: Number(blank) || 0, color: SOFT.blank },
  ]
}

function ChartTooltip({ active, payload, label, unit = '' }) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-xl border border-panel-border bg-panel-surface px-3 py-2 text-xs shadow-lg">
      {label != null && label !== '' && <p className="mb-1 font-bold text-panel-text">{label}</p>}
      {payload.map((entry) => (
        <p key={entry.name ?? entry.dataKey} className="flex items-center gap-2 text-panel-text-muted">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: entry.payload?.color || entry.color || entry.fill }}
          />
          <span className="font-semibold text-panel-text">{entry.name}</span>
          <span className="ml-auto pl-3 font-bold text-panel-text">
            {formatCount(entry.value)}
            {unit}
          </span>
        </p>
      ))}
    </div>
  )
}

export function CompositionDonut({ correct, wrong, blank }) {
  const segments = buildSegments({ correct, wrong, blank })
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)
  const data = segments.filter((segment) => segment.value > 0)
  const slices = data.length ? data : [{ key: 'empty', label: 'Veri yok', value: 1, color: 'var(--color-panel-surface-soft)' }]

  return (
    <div className="relative h-44 w-44 shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={slices}
            dataKey="value"
            nameKey="label"
            innerRadius="68%"
            outerRadius="100%"
            startAngle={90}
            endAngle={-270}
            paddingAngle={data.length > 1 ? 2.5 : 0}
            cornerRadius={5}
            stroke="var(--color-panel-surface)"
            strokeWidth={3}
            isAnimationActive={false}
          >
            {slices.map((slice) => (
              <Cell key={slice.key} fill={slice.color} />
            ))}
          </Pie>
          {data.length > 0 && <Tooltip content={<ChartTooltip unit=" soru" />} />}
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-panel-text">{formatCount(total)}</span>
        <span className="text-[11px] font-semibold text-panel-text-muted">soru</span>
      </div>
    </div>
  )
}

export function CompositionLegend({ correct, wrong, blank }) {
  const segments = buildSegments({ correct, wrong, blank })
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)

  return (
    <ul className="flex flex-1 flex-col gap-2.5 text-sm">
      {segments.map((segment) => (
        <li key={segment.key} className="flex items-center gap-2.5">
          <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} />
          <span className="flex-1 font-semibold text-panel-text">{segment.label}</span>
          <span className="font-bold text-panel-text">{formatCount(segment.value)}</span>
          <span className="w-12 text-right text-panel-text-muted">
            {total > 0 ? formatPercent((segment.value / total) * 100) : '—'}
          </span>
        </li>
      ))}
    </ul>
  )
}

export function DailyActivityBars({ data }) {
  // 10 günden fazlaysa x eksenindeki etiketleri seyrelt.
  const tickInterval = data.length <= 10 ? 0 : Math.ceil(data.length / 8) - 1

  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }} barCategoryGap="22%">
          <CartesianGrid
            vertical={false}
            stroke="var(--color-panel-border)"
            strokeOpacity={0.6}
            strokeDasharray="2 4"
          />
          <XAxis
            dataKey="label"
            interval={tickInterval}
            tick={{ fontSize: 10, fill: 'var(--color-panel-text-muted)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            width={32}
            tickCount={4}
            tick={{ fontSize: 10, fill: 'var(--color-panel-text-muted)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: 'var(--color-panel-surface-soft)', radius: 6 }}
            content={<ChartTooltip unit=" soru" />}
          />
          <Bar
            dataKey="questions"
            name="Çözülen soru"
            fill={SOFT.bar}
            radius={[6, 6, 0, 0]}
            maxBarSize={30}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
