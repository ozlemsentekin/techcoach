import { useEffect, useMemo, useState } from 'react'
import { School, Search, X } from 'lucide-react'
import { getSchoolHomeworks } from '../../services/schoolHomeworkService'
import LoadingState from './LoadingState'
import EmptyState from './EmptyState'
import TaskStatusBadge from './TaskStatusBadge'

const COMPLETED_STATUSES = new Set(['tamamlandi', 'kismen-tamamlandi'])
const STATUS_FILTERS = [
  { id: '', label: 'Tüm durumlar' },
  { id: 'done', label: 'Tamamlananlar' },
  { id: 'open', label: 'Tamamlanmayanlar' },
]

const DATE_FMT = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })
const TIME_FMT = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' })

// 'YYYY-MM-DD' yerel gün olarak; ISO zaman damgası olduğu gibi.
function parseDate(value) {
  if (!value) return null
  const dayOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  const date = dayOnly ? new Date(Number(dayOnly[1]), Number(dayOnly[2]) - 1, Number(dayOnly[3])) : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDay(value) {
  const date = parseDate(value)
  return date ? DATE_FMT.format(date) : '—'
}

const lower = (value) => String(value ?? '').toLocaleLowerCase('tr')

// Ders sekmelerinin sırası; ad başlangıcına göre eşleşir ("Fen" → "Fen Bilimleri"). Listede
// olmayan dersler sona, alfabetik.
const SUBJECT_ORDER = ['matematik', 'geometri', 'türkçe', 'fen', 't.c. inkılap', 'din', 'ingilizce']

function subjectRank(name) {
  const key = lower(name).replace(/^inkılap/, 't.c. inkılap')
  const index = SUBJECT_ORDER.findIndex((prefix) => key.startsWith(prefix))
  return index === -1 ? SUBJECT_ORDER.length : index
}
const isCompleted = (item) => COMPLETED_STATUSES.has(item.status)
// Okul Ödevleri'nde durum rozeti: tamamlanan açık yeşil, bekleyen sarı.
const STATUS_TONES = {
  tamamlandi: 'bg-emerald-100 text-emerald-700',
  'kismen-tamamlandi': 'bg-emerald-100 text-emerald-700',
  bekliyor: 'bg-amber-100 text-amber-700',
}
// Başlık ("Matematik Ara Ödevi" vb.) gösterilmez; yalnızca görev metni. Metin yoksa başlığa düşer.
const homeworkText = (item) => item.description || item.title

function CompletedAt({ value, className = '' }) {
  const date = parseDate(value)
  if (!date) return <span className={`text-xs text-panel-text-muted ${className}`}>—</span>
  return (
    <span className={className}>
      <span className="text-xs font-medium text-panel-text">{DATE_FMT.format(date)}</span>{' '}
      <span className="text-[11px] text-panel-text-muted">{TIME_FMT.format(date)}</span>
    </span>
  )
}

// Kaynak etiket (chip) olarak; yayınevi varsa etiketin başında.
function ResourceTag({ item }) {
  if (!item.resourceName) return <span className="text-xs text-panel-text-muted">—</span>
  return (
    <span className="inline-flex max-w-full items-center rounded-full bg-panel-blue-soft px-2.5 py-0.5 text-[11px] font-medium text-panel-blue">
      {[item.publisherName, item.resourceName].filter(Boolean).join(' · ')}
    </span>
  )
}

function HomeworkRow({ item }) {
  return (
    <tr className="border-b border-panel-border/50 align-top last:border-0 even:bg-panel-surface-soft/60 hover:bg-panel-blue-soft/30">
      <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-panel-text">{formatDay(item.assignedDate)}</td>
      <td className="px-4 py-3">
        <div className="whitespace-pre-line text-xs leading-relaxed text-panel-text">{homeworkText(item)}</div>
      </td>
      <td className="px-4 py-3">
        <ResourceTag item={item} />
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        <CompletedAt value={item.completedAt} />
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        <TaskStatusBadge status={item.status} size="sm" toneOverrides={STATUS_TONES} />
      </td>
    </tr>
  )
}

function HomeworkCard({ item }) {
  return (
    <article className="rounded-xl border border-panel-border bg-panel-surface p-3.5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-xs font-medium text-panel-text-muted">Görev tarihi: {formatDay(item.assignedDate)}</p>
        <div className="shrink-0">
          <TaskStatusBadge status={item.status} toneOverrides={STATUS_TONES} />
        </div>
      </div>
      <p className="mt-2 whitespace-pre-line text-sm leading-snug text-panel-text">{homeworkText(item)}</p>
      {item.resourceName ? (
        <div className="mt-1.5">
          <ResourceTag item={item} />
        </div>
      ) : null}
      {item.completedAt ? (
        <p className="mt-1.5 text-xs text-panel-text-muted">
          Tamamlandı: <CompletedAt value={item.completedAt} />
        </p>
      ) : null}
    </article>
  )
}

/**
 * Okul Ödevleri: ders sekmeleri (ilk ders varsayılan) + arama + durum/kaynak filtresi. Veli ve öğrenci panelinde ortak.
 * @param {string} [studentId] Veli oturumunda seçili çocuk; öğrenci oturumunda verilmez.
 */
export default function SchoolHomeworksView({ studentId }) {
  const studentKey = studentId || ''
  const [loaded, setLoaded] = useState(null)
  const [failed, setFailed] = useState(null)
  const [tab, setTab] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [resource, setResource] = useState('')

  useEffect(() => {
    let ignore = false
    getSchoolHomeworks(studentId)
      .then((data) => {
        if (ignore) return
        setLoaded({ id: studentKey, data })
        setFailed(null)
      })
      .catch((err) => {
        if (!ignore) setFailed({ id: studentKey, message: err.message })
      })
    return () => {
      ignore = true
    }
  }, [studentId, studentKey])

  const items = loaded?.id === studentKey ? loaded.data : null
  const error = failed?.id === studentKey ? failed.message : ''

  // Sekmeler: ödev verilen dersler (SUBJECT_ORDER sırasıyla), her birinde ödev sayısı.
  const subjects = useMemo(() => {
    if (!items) return []
    const counts = new Map()
    for (const it of items) counts.set(it.subjectName, (counts.get(it.subjectName) || 0) + 1)
    return Array.from(counts, ([name, count]) => ({ name, count })).sort(
      (a, b) => subjectRank(a.name) - subjectRank(b.name) || a.name.localeCompare(b.name, 'tr'),
    )
  }, [items])

  // Seçili sekme yoksa (ilk açılış / çocuk değişimi) ilk ders seçilir.
  const activeTab = subjects.some((s) => s.name === tab) ? tab : subjects[0]?.name
  const tabItems = useMemo(
    () => (items ? items.filter((it) => it.subjectName === activeTab) : []),
    [items, activeTab],
  )

  const resources = useMemo(
    () =>
      Array.from(new Set(tabItems.map((it) => it.resourceName).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'tr')),
    [tabItems],
  )
  const activeResource = resources.includes(resource) ? resource : ''

  const filtered = useMemo(() => {
    const q = lower(search).trim()
    return tabItems.filter((it) => {
      if (statusFilter === 'done' && !isCompleted(it)) return false
      if (statusFilter === 'open' && isCompleted(it)) return false
      if (activeResource && it.resourceName !== activeResource) return false
      if (!q) return true
      return [it.title, it.description, it.resourceName, it.publisherName].some((field) =>
        lower(field).includes(q),
      )
    })
  }, [tabItems, search, statusFilter, activeResource])

  const completedCount = filtered.filter(isCompleted).length

  if (error && !items) {
    return <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{error}</div>
  }

  if (items === null) {
    return <LoadingState label="Okul ödevleri yükleniyor..." />
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={School}
        title="Henüz okul ödevi yok"
        description="Okul ödevi tipinde bir görev eklendiğinde burada ders ders listelenecek."
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Ders sekmeleri */}
      <div className="-mx-1 overflow-x-auto px-1">
        <div role="tablist" aria-label="Dersler" className="flex w-max gap-1.5 border-b border-panel-border">
          {subjects.map((t) => {
            const selected = t.name === activeTab
            return (
              <button
                key={t.name}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setTab(t.name)}
                className={`-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${
                  selected
                    ? 'border-panel-blue text-panel-blue'
                    : 'border-transparent text-panel-text-muted hover:text-panel-text'
                }`}
              >
                {t.name}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[11px] tabular-nums ${
                    selected ? 'bg-panel-blue-soft text-panel-blue' : 'bg-panel-surface-soft text-panel-text-muted'
                  }`}
                >
                  {t.count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Araç çubuğu: arama + durum + kaynak filtresi */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-panel-text-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Ödev açıklaması veya kaynak ara..."
            className="h-10 w-full rounded-xl border border-panel-border bg-panel-surface pl-9 pr-9 text-sm text-panel-text outline-none focus:border-panel-blue focus:ring-2 focus:ring-panel-blue/10"
          />
          {search ? (
            <button
              type="button"
              aria-label="Aramayı temizle"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-panel-text-muted hover:bg-panel-surface-soft hover:text-panel-text"
            >
              <X size={14} aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          aria-label="Duruma göre filtrele"
          className="h-10 shrink-0 rounded-xl border border-panel-border bg-panel-surface px-3 text-sm font-medium text-panel-text sm:w-48"
        >
          {STATUS_FILTERS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        {resources.length ? (
          <select
            value={activeResource}
            onChange={(event) => setResource(event.target.value)}
            aria-label="Kaynağa göre filtrele"
            className="h-10 shrink-0 rounded-xl border border-panel-border bg-panel-surface px-3 text-sm font-medium text-panel-text sm:w-56"
          >
            <option value="">Tüm kaynaklar</option>
            {resources.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <p className="text-sm text-panel-text-muted">
        {filtered.length} ödev · <span className="font-semibold text-panel-sage">{completedCount} tamamlandı</span> ·{' '}
        <span className="font-semibold text-panel-blue">{filtered.length - completedCount} tamamlanmadı</span>
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-panel-border bg-panel-surface px-4 py-10 text-center text-sm text-panel-text-muted">
          Bu filtreyle eşleşen ödev bulunamadı.
        </div>
      ) : (
        <>
          {/* Mobil: kart listesi */}
          <div className="grid gap-3 md:hidden">
            {filtered.map((item) => (
              <HomeworkCard key={item.id} item={item} />
            ))}
          </div>

          {/* Masaüstü: tablo */}
          <div className="hidden min-w-0 overflow-hidden rounded-2xl border border-panel-border bg-panel-surface shadow-sm md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] border-collapse text-left">
                <thead>
                  <tr className="whitespace-nowrap bg-panel-blue text-[11px] font-semibold uppercase tracking-wide text-white">
                    <th className="px-4 py-3 font-semibold">Görev Tarihi</th>
                    <th className="px-4 py-3 font-semibold">Görev Açıklaması</th>
                    <th className="px-4 py-3 font-semibold">Kaynak</th>
                    <th className="px-4 py-3 font-semibold">Tamamlanma</th>
                    <th className="px-4 py-3 font-semibold">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <HomeworkRow key={item.id} item={item} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
