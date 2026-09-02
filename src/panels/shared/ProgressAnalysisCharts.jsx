import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { RATE_TONES, successRateTone } from './rateTones'

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

const ACCURACY_FILL = {
  green: 'color-mix(in oklab, var(--color-panel-green) 82%, white)',
  yellow: 'color-mix(in oklab, var(--color-panel-yellow) 82%, white)',
  red: 'color-mix(in oklab, var(--color-panel-red) 72%, white)',
  neutral: 'color-mix(in oklab, var(--color-panel-border-strong) 78%, white)',
}

function accuracyFill(accuracy) {
  const tone = successRateTone(Number.isFinite(accuracy) ? accuracy / 100 : null)
  return ACCURACY_FILL[tone] || ACCURACY_FILL.neutral
}

function AccuracyTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <div className="rounded-xl border border-panel-border bg-panel-surface px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-bold text-panel-text">{row.label}</p>
      <p className="text-panel-text-muted">
        Doğruluk <span className="font-bold text-panel-text">{formatPercent(row.accuracy)}</span>
      </p>
      <p className="text-panel-text-muted">
        {formatCount(row.answered)} çözülen · {formatCount(row.correct)} doğru
      </p>
    </div>
  )
}

// Yatay başarı barları (öğrenci / kaynak başına doğruluk %). data: [{ key, label, accuracy,
// answered, correct }]. onSelect verilirse bara tıklanınca key ile çağrılır.
export function HorizontalAccuracyBars({ data, onSelect }) {
  const rows = data.map((row) => ({ ...row, accuracy: Number.isFinite(row.accuracy) ? row.accuracy : 0 }))
  const height = Math.max(140, rows.length * 44)

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 44, bottom: 4, left: 0 }} barCategoryGap="28%">
          <CartesianGrid horizontal={false} stroke="var(--color-panel-border)" strokeOpacity={0.6} strokeDasharray="2 4" />
          <XAxis
            type="number"
            domain={[0, 100]}
            tickCount={5}
            unit="%"
            tick={{ fontSize: 10, fill: 'var(--color-panel-text-muted)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={104}
            tick={{ fontSize: 11, fill: 'var(--color-panel-text)' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value) => (value.length > 14 ? `${value.slice(0, 13)}…` : value)}
          />
          <Tooltip cursor={{ fill: 'var(--color-panel-surface-soft)' }} content={<AccuracyTooltip />} />
          <Bar
            dataKey="accuracy"
            radius={[0, 6, 6, 0]}
            maxBarSize={26}
            isAnimationActive={false}
            onClick={onSelect ? (entry) => onSelect(entry?.key ?? entry?.payload?.key) : undefined}
            className={onSelect ? 'cursor-pointer' : undefined}
          >
            {rows.map((row) => (
              <Cell key={row.key} fill={accuracyFill(row.accuracy)} />
            ))}
            <LabelList
              dataKey="accuracy"
              position="right"
              formatter={(value) => `${Math.round(value)}%`}
              style={{ fontSize: 11, fontWeight: 700, fill: 'var(--color-panel-text-muted)' }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// Saf div "bar list" — sıralı zorluk/oran gösterimi (en zorlanılan konu/kitap). items:
// [{ key, label, ratio (0..1), valueLabel, metaLabel, tone }].
export function RankedBarList({ items, emptyLabel = 'Veri yok.' }) {
  if (!items.length) {
    return <p className="px-1 py-4 text-sm text-panel-text-muted">{emptyLabel}</p>
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => {
        const tone = RATE_TONES[item.tone] || RATE_TONES.neutral
        return (
          <li key={item.key} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-sm font-semibold text-panel-text" title={item.label}>
                {item.label}
              </span>
              <span className={`shrink-0 text-sm font-bold ${tone.text}`}>{item.valueLabel}</span>
            </div>
            <div className="h-2 rounded-full bg-panel-surface-soft">
              <div
                className={`h-2 rounded-full ${tone.bar}`}
                style={{ width: `${Math.max(4, Math.min(100, item.ratio * 100))}%` }}
              />
            </div>
            {item.metaLabel ? (
              <span className="text-[11px] font-medium text-panel-text-muted">{item.metaLabel}</span>
            ) : null}
          </li>
        )
      })}
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
