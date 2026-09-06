import { createElement, Fragment, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarCheck, CalendarRange, Clock, Layers3, Target } from 'lucide-react'
import { formatNet, formatNumber } from './progressAnalytics'
import { RATE_TONES } from './rateTones'
import { ResourceBookAvatar } from './ResourceBookCard'
import { cn } from '../ui/utils'
import {
  COMPOSITION_LEGEND,
  DEFAULT_LABELS,
  SORTS,
  TASK_LEGEND,
  accuracyOf,
  mergeBuckets,
  pct,
  safeAcc,
  toneFor,
} from './analysisData'

// Sınıf/Gelişim Analizi'nin ortak görsel gövdesi. Saf toplama mantığı analysisData.js'te;
// burada yalnızca React bileşenleri var.

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
export function SummaryMetric({
  icon,
  title,
  value,
  description,
  iconClassName = 'bg-panel-blue-soft text-panel-blue',
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

// entity başına yığılı bar (görev disiplini).
function EntityStackedRows({ rows, legend, onSelect, unit = '' }) {
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col">
        {rows.map((row) => (
          <li key={row.key}>
            <button
              type="button"
              onClick={onSelect ? () => onSelect(row.key) : undefined}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg py-2 text-left transition-colors',
                onSelect ? 'hover:bg-panel-surface-soft' : 'cursor-default',
              )}
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

// Isı haritası hücresi: o kitap/ders kesişimindeki doğruluk % + tamamlanma çubuğu.
// labelA/labelB yalnızca ipucu metni içindir (satır ve sütun ekseninin adı).
function HeatCell({ cell, labelA, labelB }) {
  const hasAccuracy = cell && Number.isFinite(cell.accuracy)
  const completion = cell && Number.isFinite(cell.completionRate) ? cell.completionRate : null
  if (!hasAccuracy && completion === null) {
    return <td className="min-w-[72px] rounded-md bg-panel-surface-soft/50 py-2 text-[11px] text-panel-text-muted">–</td>
  }
  const tone = hasAccuracy ? RATE_TONES[toneFor(cell.accuracy)] : RATE_TONES.neutral
  return (
    <td className={`min-w-[72px] rounded-md px-1 py-1 ${tone.chip}`}>
      <span
        className="block text-[12px] font-bold leading-none"
        title={
          hasAccuracy
            ? `${labelA} · ${labelB}\nBaşarı oranı: ${Math.round(cell.accuracy)}% (${formatNumber(cell.answered)} soru çözüldü)`
            : `${labelA} · ${labelB}\nHenüz çözüm yok`
        }
      >
        {hasAccuracy ? `${Math.round(cell.accuracy)}%` : '–'}
      </span>
      {completion !== null ? (
        <span
          className="mt-1 flex items-center gap-1"
          title={`${labelA} · ${labelB}\nKitap tamamlanma oranı: ${Math.round(
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
}

// kaynak (satır) × entity (sütun) ısı haritası. Hem veli Gelişim Analizi (sütun = ders)
// hem öğretmen Sınıf Analizi (sütun = öğrenci) bunu kullanır — kaynaklar satır olduğu için
// çocuğun/sınıfın tüm kaynakları sığar. Kitaplar yayın evine göre gruplu. İlk sütun sabit
// genişlikte (aksi halde tüm boşluğu yutuyordu); veri sütunları min genişlikle yatay kaydırır.
const HEAT_FIRST_COL = 'w-[200px] min-w-[200px] max-w-[200px]'

function ResourceRowHeatmap({ entities, resources, onSelect }) {
  const [tip, setTip] = useState(null)

  const groups = useMemo(() => {
    const byPublisher = new Map()
    const ordered = []
    for (const res of resources) {
      const publisher = res.publisher || 'Yayın evi belirtilmemiş'
      let group = byPublisher.get(publisher)
      if (!group) {
        group = { publisher, items: [] }
        byPublisher.set(publisher, group)
        ordered.push(group)
      }
      group.items.push(res)
    }
    return ordered
  }, [resources])

  return (
    <div className="overflow-x-auto">
      <table className="w-max min-w-full border-separate border-spacing-1 text-center">
        <thead>
          <tr>
            <th className={`sticky left-0 z-10 bg-panel-surface ${HEAT_FIRST_COL}`} />
            {entities.map((entity) => (
              <th key={entity.key} className="min-w-[78px] px-1 pb-1 align-bottom">
                <button
                  type="button"
                  onClick={onSelect ? () => onSelect(entity.key) : undefined}
                  title={entity.name}
                  className={cn(
                    'block w-full whitespace-normal break-words rounded bg-panel-surface-soft px-1 py-1 text-[10px] font-semibold leading-tight text-panel-text',
                    onSelect ? 'hover:bg-panel-blue-soft hover:text-panel-blue' : 'cursor-default',
                  )}
                >
                  {entity.shortLabel}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <Fragment key={group.publisher}>
              <tr>
                <td className={`sticky left-0 z-10 bg-panel-surface pb-1 pt-3 text-left ${HEAT_FIRST_COL}`}>
                  <span className="block text-[11px] font-bold uppercase tracking-wide text-panel-text-muted">
                    {group.publisher}
                  </span>
                </td>
                <td className="bg-panel-surface" colSpan={entities.length} />
              </tr>
              {group.items.map((res) => (
                <tr key={res.key}>
                  <td
                    className={`sticky left-0 z-10 bg-panel-surface py-0.5 pl-2 pr-2 text-left align-middle ${HEAT_FIRST_COL}`}
                    onMouseEnter={(event) => setTip({ rect: event.currentTarget.getBoundingClientRect(), col: res })}
                    onMouseLeave={() => setTip((current) => (current?.col === res ? null : current))}
                  >
                    <span className="block whitespace-normal break-words rounded bg-panel-blue-soft px-1.5 py-1 text-[11px] font-semibold leading-snug text-panel-blue">
                      {res.label}
                    </span>
                  </td>
                  {entities.map((entity) => (
                    <HeatCell
                      key={entity.key}
                      cell={entity.resources.get(res.key)}
                      labelA={res.label}
                      labelB={entity.shortLabel}
                    />
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
      <BookHoverCard tip={tip} />
    </div>
  )
}

// entity × ay tablosu (Ağu–Haz eğitim yılı). Hücre içeriğini renderCell belirler.
function MonthlyTable({ entities, months, onSelect, renderCell, showTotal }) {
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
          {entities.map((entity) => {
            const buckets = months.map((month) => entity.monthly.get(month.key) || null)
            return (
              <tr key={entity.key} className="transition-colors hover:bg-panel-surface-soft/50">
                <td className="sticky left-0 z-10 bg-panel-surface py-2 pr-3 text-left">
                  <button
                    type="button"
                    onClick={onSelect ? () => onSelect(entity.key) : undefined}
                    title={entity.name}
                    className={cn(
                      'block max-w-[7rem] truncate text-sm font-semibold text-panel-text',
                      onSelect ? 'hover:text-panel-blue hover:underline' : 'cursor-default',
                    )}
                  >
                    {entity.shortLabel}
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

// Aylık sonuç: o ayın başarı %'si + altında doğru/yanlış/boş sayıları.
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

function HardestPerEntity({ entities, onSelect }) {
  return (
    <ul className="divide-y divide-panel-border">
      {entities.map((entity) => (
        <li key={entity.key}>
          <button
            type="button"
            onClick={onSelect ? () => onSelect(entity.key) : undefined}
            className={cn(
              'grid w-full gap-1 py-3 text-left transition-colors sm:grid-cols-[minmax(9rem,13rem)_minmax(0,1fr)_minmax(0,1fr)] sm:items-center sm:gap-3',
              onSelect ? 'hover:bg-panel-surface-soft' : 'cursor-default',
            )}
          >
            <span className="text-sm font-semibold leading-snug text-panel-text" title={entity.name}>
              {entity.name}
            </span>
            <span className="flex min-w-0 items-center gap-1.5 text-sm">
              <span className="shrink-0 text-xs text-panel-text-muted sm:hidden">Konu:</span>
              <HardestCell row={entity.hardestTopic} />
            </span>
            <span className="flex min-w-0 items-center gap-1.5 text-sm">
              <span className="shrink-0 text-xs text-panel-text-muted sm:hidden">Kitap:</span>
              <HardestCell row={entity.hardestBook} withPublisher />
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function EntityComparison({ entities, sortKey, onSortChange, onSelect, labels, showLastActivity }) {
  return (
    <section className="panel-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-panel-border px-5 py-4">
        <div>
          <h2 className="text-base font-bold text-panel-text">{labels.comparisonTitle}</h2>
          {labels.comparisonSubtitle ? (
            <p className="mt-0.5 text-sm text-panel-text-muted">{labels.comparisonSubtitle}</p>
          ) : null}
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
              <th className="px-5 py-3">{labels.entityHeader}</th>
              <th className="px-3 py-3 text-right">Çözülen</th>
              <th className="px-3 py-3 text-right">Doğru</th>
              <th className="px-3 py-3 text-right">Başarı</th>
              <th className="px-3 py-3 text-right">Net</th>
              <th className="px-3 py-3 text-right">Biriken</th>
              {showLastActivity ? <th className="px-5 py-3 text-right">Son işlem zamanı</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-panel-border">
            {entities.map((entity) => {
              const tone = RATE_TONES[toneFor(entity.accuracy)]
              return (
                <tr
                  key={entity.key}
                  onClick={onSelect ? () => onSelect(entity.key) : undefined}
                  className={cn('transition-colors', onSelect ? 'cursor-pointer hover:bg-panel-surface-soft' : null)}
                >
                  <td className="px-5 py-3">
                    <span className="font-semibold text-panel-text">{entity.name}</span>
                    {entity.subjectName ? (
                      <span className="ml-2 text-xs text-panel-text-muted">{entity.subjectName}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-panel-text">{formatNumber(entity.totals.questions)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-panel-text">{formatNumber(entity.totals.correct)}</td>
                  <td className={`px-3 py-3 text-right font-bold tabular-nums ${tone.text}`}>{pct(entity.accuracy)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-panel-text">{formatNet(entity.net)}</td>
                  <td
                    className={`px-3 py-3 text-right font-semibold tabular-nums ${
                      entity.taskCounts.backlog > 0 ? 'text-panel-red' : 'text-panel-text-muted'
                    }`}
                  >
                    {entity.taskCounts.backlog}
                  </td>
                  {showLastActivity ? (
                    <td className="px-5 py-3 text-right">
                      <LastActivity iso={entity.lastActivityAt} />
                    </td>
                  ) : null}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobil: kart listesi */}
      <ul className="divide-y divide-panel-border md:hidden">
        {entities.map((entity) => {
          const tone = RATE_TONES[toneFor(entity.accuracy)]
          return (
            <li key={entity.key}>
              <button
                type="button"
                onClick={onSelect ? () => onSelect(entity.key) : undefined}
                className={cn('flex w-full flex-col gap-2 px-4 py-3 text-left', onSelect ? null : 'cursor-default')}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate font-semibold text-panel-text">{entity.name}</span>
                  <span className={`shrink-0 text-sm font-bold ${tone.text}`}>{pct(entity.accuracy)}</span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-panel-text-muted">
                  <span>{formatNumber(entity.totals.questions)} çözülen</span>
                  <span>{formatNumber(entity.totals.correct)} doğru</span>
                  <span>{formatNet(entity.net)} net</span>
                  <span className={entity.taskCounts.backlog > 0 ? 'font-semibold text-panel-red' : undefined}>
                    {entity.taskCounts.backlog} biriken
                  </span>
                </div>
                {showLastActivity && entity.lastActivityAt ? (
                  <div className="text-[11px] text-panel-text-muted">
                    Son işlem: {new Date(entity.lastActivityAt).toLocaleString('tr-TR', {
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

// Sınıf/Gelişim Analizi'nin ortak gövdesi: aylık performans + aylık sonuç + kaynak ısı
// haritası + görev disiplini + en zorlanılan konu/kitap + karşılaştırma tablosu.
export function AnalysisBody({
  analysis,
  sortedEntities,
  sortKey,
  onSortChange,
  onSelect,
  labels: labelOverrides,
  showLastActivity = true,
}) {
  const labels = { ...DEFAULT_LABELS, ...labelOverrides }
  const { entities, resourceColumns, months } = analysis

  const byAccuracy = useMemo(
    () => [...entities].sort((a, b) => safeAcc(b.accuracy) - safeAcc(a.accuracy)),
    [entities],
  )
  const byQuestions = useMemo(
    () => [...entities].sort((a, b) => b.totals.questions - a.totals.questions),
    [entities],
  )
  const taskRows = useMemo(
    () =>
      [...entities]
        .sort((a, b) => b.taskCounts.backlog - a.taskCounts.backlog || b.taskCounts.total - a.taskCounts.total)
        .map((entity) => ({
          key: entity.key,
          name: entity.shortLabel,
          fullName: entity.name,
          total: entity.taskCounts.total,
          segments: TASK_LEGEND.map((seg) => ({
            value: entity.taskCounts[seg.key],
            className: seg.className,
            label: seg.label,
          })),
          valueLabel: `${entity.taskCounts.total} görev`,
        })),
    [entities],
  )

  return (
    <div className="flex flex-col gap-5">
      <Card title={labels.monthlyPerfTitle} subtitle={labels.monthlyPerfSubtitle} icon={CalendarRange}>
        <MonthlyTable
          entities={byQuestions}
          months={months}
          onSelect={onSelect}
          showTotal
          renderCell={(bucket) => <PerfCell bucket={bucket} />}
        />
      </Card>

      <Card title={labels.monthlyResultTitle} subtitle={labels.monthlyResultSubtitle} icon={Target}>
        <MonthlyTable
          entities={byAccuracy}
          months={months}
          onSelect={onSelect}
          showTotal
          renderCell={(bucket) => <ResultCell bucket={bucket} />}
        />
        <div className="mt-3">
          <Legend items={COMPOSITION_LEGEND} />
        </div>
      </Card>

      <Card title={labels.resourceTitle} subtitle={labels.resourceSubtitle} icon={Layers3}>
        {resourceColumns.length ? (
          <ResourceRowHeatmap entities={byAccuracy} resources={resourceColumns} onSelect={onSelect} />
        ) : (
          <p className="py-4 text-sm text-panel-text-muted">{labels.resourceEmpty}</p>
        )}
      </Card>

      <Card title={labels.taskTitle} subtitle={labels.taskSubtitle} icon={CalendarCheck}>
        <EntityStackedRows rows={taskRows} legend={TASK_LEGEND} onSelect={onSelect} unit=" görev" />
      </Card>

      <Card title={labels.hardestTitle} subtitle={labels.hardestSubtitle} icon={Target}>
        <HardestPerEntity entities={byAccuracy} onSelect={onSelect} />
      </Card>

      <EntityComparison
        entities={sortedEntities}
        sortKey={sortKey}
        onSortChange={onSortChange}
        onSelect={onSelect}
        labels={labels}
        showLastActivity={showLastActivity}
      />
    </div>
  )
}
