import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, History, ScanLine, Search, X } from 'lucide-react'
import { getStudyHistory } from '../../services/studyHistoryService'
import { authRequest } from '../../services/authClient'
import { verifyMistakePhotoQuestionNumber } from '../../services/mistakePhotoService'
import LoadingState from './LoadingState'
import EmptyState from './EmptyState'
import ManualOpticalAnswerModal from './ManualOpticalAnswerModal'
import { TASK_TYPES } from '../../data/taskTypes'

const TaskAnswerSheetModal = lazy(() => import('../student/components/TaskAnswerSheetModal'))

const PAGE_SIZE = 100

const DATE_FMT = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })
const TIME_FMT = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' })

function parseDate(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function pageRange(item) {
  if (item.pageStart == null) return ''
  if (item.pageEnd != null && item.pageEnd !== item.pageStart) return `s. ${item.pageStart}-${item.pageEnd}`
  return `s. ${item.pageStart}`
}

// Satırın "görev tipi" etiketi: görev kaynaklıysa görev türü, Kitaplık'tan elle girilmişse "Kitaplık".
function typeLabel(item) {
  if (item.source === 'manual') return 'Kitaplık'
  return TASK_TYPES[item.taskType]?.label || 'Soru Bankası Ödevi'
}

function successTone(percent) {
  if (percent < 70) return 'bg-panel-red-soft text-panel-red'
  if (percent <= 85) return 'bg-amber-100 text-amber-700'
  return 'bg-emerald-100 text-emerald-700'
}

const lower = (value) => String(value ?? '').toLocaleLowerCase('tr')

function withStudent(path, studentId) {
  if (!studentId) return path
  return `${path}${path.includes('?') ? '&' : '?'}studentId=${encodeURIComponent(studentId)}`
}

// Bir manuel tamamlama satırı için ManualOpticalAnswerModal'ı besleyen sarmalayıcı:
// hata defteri fotoğraflarını çeker ve optik/foto kaydetme uçlarını bağlar.
function ManualAnswersModal({ item, studentId, onClose, onSaved }) {
  const [initialPhotos, setInitialPhotos] = useState({})

  useEffect(() => {
    let ignore = false
    if (!item.resourceBookId) return undefined
    authRequest(withStudent(`/api/panel/wrong-questions?resourceBookId=${item.resourceBookId}`, studentId))
      .then((data) => {
        if (ignore) return
        const map = {}
        for (const wq of data.wrongQuestions || []) {
          if (wq.testId === item.testId && wq.hasPhoto) map[wq.questionNumber] = true
        }
        setInitialPhotos(map)
      })
      .catch(() => {})
    return () => {
      ignore = true
    }
  }, [item.resourceBookId, item.testId, studentId])

  const test = {
    id: item.testId,
    name: item.testName,
    topicName: item.topicName,
    questionCount: item.questionCount,
    hasAnswerKey: true,
    completionSource: 'manual',
    correctCount: item.correct,
    wrongCount: item.wrong,
    blankCount: item.blank,
    manualAnswers: item.manualAnswers || {},
  }

  return (
    <ManualOpticalAnswerModal
      test={test}
      onClose={onClose}
      onSaved={(testId, updates) => onSaved(updates)}
      submitAnswers={(answers) =>
        authRequest(withStudent(`/api/panel/resource-book-topic-tests/${item.testId}/optical-completion`, studentId), {
          method: 'PUT',
          body: JSON.stringify({ answers }),
        })
      }
      submitPhoto={(orderNo, dataUrl) =>
        authRequest(withStudent(`/api/panel/resource-book-topic-tests/${item.testId}/mistakes/${orderNo}`, studentId), {
          method: 'PUT',
          body: JSON.stringify({ photo: dataUrl }),
        })
      }
      verifyQuestionNumber={(orderNo, dataUrl) => verifyMistakePhotoQuestionNumber(dataUrl, Number(orderNo))}
      initialPhotos={initialPhotos}
    />
  )
}

function ViewAnswersButton({ item, onClick }) {
  if (!item.canViewAnswers) return <span className="text-xs text-panel-text-muted">—</span>
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1 text-xs font-semibold text-panel-blue transition-colors hover:bg-panel-blue-soft/50"
    >
      <ScanLine size={14} aria-hidden="true" />
      Cevapları Gör
    </button>
  )
}

function NumCell({ value, className = '' }) {
  return <td className={`px-2 py-3 text-center text-sm tabular-nums ${className}`}>{value}</td>
}

function DateTimeCell({ value }) {
  const date = parseDate(value)
  return (
    <td className="whitespace-nowrap px-4 py-3">
      <div className="text-sm font-medium text-panel-text">{date ? DATE_FMT.format(date) : '—'}</div>
      <div className="text-xs text-panel-text-muted">{date ? TIME_FMT.format(date) : ''}</div>
    </td>
  )
}

function StudyHistoryRow({ item, onOpen }) {
  const pages = pageRange(item)
  return (
    <tr className="border-b border-panel-border/50 last:border-0 hover:bg-panel-blue-soft/20">
      <DateTimeCell value={item.occurredAt} />
      <td className="px-4 py-3">
        <div className="text-sm text-panel-text">{item.subjectName || '—'}</div>
        <div className="text-xs text-panel-text-muted">{typeLabel(item)}</div>
      </td>
      <td className="px-4 py-3">
        {item.publisherName ? (
          <div className="text-[11px] font-medium uppercase tracking-wide text-panel-text-muted">{item.publisherName}</div>
        ) : null}
        <div className="text-sm font-medium text-panel-text">{item.resourceBookName || '—'}</div>
      </td>
      <td className="px-4 py-3">
        <div className="text-sm font-semibold text-panel-text">
          {item.testName}
          {pages ? <span className="font-normal text-panel-text-muted"> ({pages})</span> : null}
        </div>
        {item.topicName ? <div className="text-xs text-panel-text-muted">{item.topicName}</div> : null}
      </td>
      <NumCell value={item.questionCount} className="text-panel-text-muted" />
      <NumCell value={item.correct} className="font-semibold text-emerald-600" />
      <NumCell value={item.wrong} className="font-semibold text-panel-red" />
      <NumCell value={item.blank} className="text-panel-text-muted" />
      <td className="px-3 py-3 text-center">
        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${successTone(item.successRate)}`}>
          %{item.successRate}
        </span>
      </td>
      <td className="px-3 py-3 text-right">
        <ViewAnswersButton item={item} onClick={onOpen} />
      </td>
    </tr>
  )
}

function StudyHistoryCard({ item, onOpen }) {
  const date = parseDate(item.occurredAt)
  const pages = pageRange(item)
  return (
    <article className="rounded-xl border border-panel-border bg-panel-surface p-3.5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-panel-text-muted">
            {date ? `${DATE_FMT.format(date)} · ${TIME_FMT.format(date)}` : '—'}
          </p>
          <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-panel-blue">
            {[item.subjectName, typeLabel(item)].filter(Boolean).join(' · ')}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${successTone(item.successRate)}`}>
          %{item.successRate}
        </span>
      </div>
      <p className="mt-2 text-sm font-bold leading-snug text-panel-text">
        {item.testName}
        {pages ? <span className="font-normal text-panel-text-muted"> ({pages})</span> : null}
      </p>
      <p className="mt-0.5 text-xs text-panel-text-muted">
        {[item.publisherName, item.resourceBookName].filter(Boolean).join(' · ') || '—'}
      </p>
      {item.topicName ? <p className="text-xs text-panel-text-muted">{item.topicName}</p> : null}
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold tabular-nums">
          <span className="text-panel-text-muted">{item.questionCount} soru</span>
          <span className="text-emerald-600">{item.correct} D</span>
          <span className="text-panel-red">{item.wrong} Y</span>
          <span className="text-panel-text-muted">{item.blank} B</span>
        </div>
        <ViewAnswersButton item={item} onClick={onOpen} />
      </div>
    </article>
  )
}

/**
 * Çalışma Geçmişi listesi + arama/sayfalama + "Cevapları Gör" akışı. Veli ve öğrenci panelinde ortak.
 * @param {string} [studentId] Veli oturumunda seçili çocuk; öğrenci oturumunda verilmez.
 * @param {'view' | 'edit'} [photoMode] Görev cevap kağıdında fotoğraf modu.
 * @param {boolean} [canRegrade] Veli görev optiğini yeniden değerlendirebilir.
 */
export default function StudyHistoryView({ studentId, photoMode = 'edit', canRegrade = false }) {
  // { id, data } — hangi çocuğun listesi yüklü. reloadKey ile sessiz yenilemede (cevap kağıdı
  // kaydından sonra) eski satırlar ekranda kalır; aksi halde açık modal da unmount olurdu.
  const [loaded, setLoaded] = useState(null)
  const [failed, setFailed] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [activeItem, setActiveItem] = useState(null)
  const [search, setSearch] = useState('')
  const [subject, setSubject] = useState('')
  const [page, setPage] = useState(1)

  const studentKey = studentId || ''

  useEffect(() => {
    let ignore = false
    getStudyHistory(studentId)
      .then((data) => {
        if (ignore) return
        setLoaded({ id: studentKey, data })
        setFailed(null)
      })
      .catch((err) => {
        if (ignore) return
        setFailed({ id: studentKey, message: err.message })
      })
    return () => {
      ignore = true
    }
  }, [studentId, studentKey, reloadKey])

  const refresh = () => setReloadKey((k) => k + 1)

  const items = loaded?.id === studentKey ? loaded.data : null
  const error = failed?.id === studentKey ? failed.message : ''

  const subjects = useMemo(() => {
    if (!items) return []
    return Array.from(new Set(items.map((it) => it.subjectName).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, 'tr'),
    )
  }, [items])

  const filtered = useMemo(() => {
    if (!items) return []
    const q = lower(search).trim()
    return items.filter((it) => {
      if (subject && it.subjectName !== subject) return false
      if (!q) return true
      return [
        it.testName,
        it.topicName,
        it.resourceBookName,
        it.publisherName,
        it.subjectName,
        typeLabel(it),
        it.pageStart != null ? String(it.pageStart) : '',
        it.pageEnd != null ? String(it.pageEnd) : '',
      ].some((field) => lower(field).includes(q))
    })
  }, [items, search, subject])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const totals = useMemo(
    () =>
      filtered.reduce(
        (acc, item) => {
          acc.correct += item.correct
          acc.wrong += item.wrong
          acc.blank += item.blank
          acc.questions += item.questionCount
          return acc
        },
        { correct: 0, wrong: 0, blank: 0, questions: 0 },
      ),
    [filtered],
  )

  const resetPage = () => setPage(1)

  if (error && !items) {
    return <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{error}</div>
  }

  if (items === null) {
    return <LoadingState label="Çalışma geçmişi yükleniyor..." />
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="Henüz çözülmüş test yok"
        description="Bir testin optik sonucu kaydedildiğinde burada tarih sırasıyla görünecek."
      />
    )
  }

  const taskItem = activeItem?.source === 'task' ? activeItem : null
  const manualItem = activeItem?.source === 'manual' ? activeItem : null
  const rangeStart = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(safePage * PAGE_SIZE, filtered.length)

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* Araç çubuğu: arama + ders filtresi */}
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
              onChange={(event) => {
                setSearch(event.target.value)
                resetPage()
              }}
              placeholder="Test, konu, kaynak veya yayınevi ara..."
              className="h-10 w-full rounded-xl border border-panel-border bg-panel-surface pl-9 pr-9 text-sm text-panel-text outline-none focus:border-panel-blue focus:ring-2 focus:ring-panel-blue/10"
            />
            {search ? (
              <button
                type="button"
                aria-label="Aramayı temizle"
                onClick={() => {
                  setSearch('')
                  resetPage()
                }}
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-panel-text-muted hover:bg-panel-surface-soft hover:text-panel-text"
              >
                <X size={14} aria-hidden="true" />
              </button>
            ) : null}
          </div>
          <select
            value={subject}
            onChange={(event) => {
              setSubject(event.target.value)
              resetPage()
            }}
            aria-label="Derse göre filtrele"
            className="h-10 shrink-0 rounded-xl border border-panel-border bg-panel-surface px-3 text-sm font-medium text-panel-text sm:w-52"
          >
            <option value="">Tüm dersler</option>
            {subjects.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <p className="text-sm text-panel-text-muted">
          {filtered.length} test · {totals.questions} soru ·{' '}
          <span className="font-semibold text-emerald-600">{totals.correct} doğru</span> ·{' '}
          <span className="font-semibold text-panel-red">{totals.wrong} yanlış</span> ·{' '}
          <span className="font-semibold text-panel-text-muted">{totals.blank} boş</span>
        </p>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-panel-border bg-panel-surface px-4 py-10 text-center text-sm text-panel-text-muted">
            Aramayla eşleşen test bulunamadı.
          </div>
        ) : (
          <>
            {/* Mobil: kart listesi */}
            <div className="grid gap-3 md:hidden">
              {pageItems.map((item) => (
                <StudyHistoryCard key={item.key} item={item} onOpen={() => setActiveItem(item)} />
              ))}
            </div>

            {/* Masaüstü: tablo */}
            <div className="hidden min-w-0 overflow-hidden rounded-2xl border border-panel-border bg-panel-surface shadow-sm md:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-panel-border bg-panel-surface-soft text-[11px] font-semibold uppercase tracking-wide text-panel-text-muted">
                      <th className="px-4 py-3 font-semibold">Tarih · Saat</th>
                      <th className="px-4 py-3 font-semibold">Ders</th>
                      <th className="px-4 py-3 font-semibold">Yayınevi · Kaynak</th>
                      <th className="px-4 py-3 font-semibold">Test</th>
                      <th className="px-2 py-3 text-center font-semibold">Soru</th>
                      <th className="px-2 py-3 text-center font-semibold">D</th>
                      <th className="px-2 py-3 text-center font-semibold">Y</th>
                      <th className="px-2 py-3 text-center font-semibold">B</th>
                      <th className="px-3 py-3 text-center font-semibold">Başarı</th>
                      <th className="px-3 py-3 text-right font-semibold">Cevaplar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((item) => (
                      <StudyHistoryRow key={item.key} item={item} onOpen={() => setActiveItem(item)} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sayfalama */}
            {totalPages > 1 ? (
              <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
                <p className="text-xs text-panel-text-muted">
                  {filtered.length} kayıttan {rangeStart}–{rangeEnd} arası
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                    className="flex h-9 items-center gap-1 rounded-lg border border-panel-border px-3 text-sm font-medium text-panel-text hover:bg-panel-surface-soft disabled:opacity-40"
                  >
                    <ChevronLeft size={15} aria-hidden="true" />
                    Önceki
                  </button>
                  <span className="px-2 text-sm font-medium text-panel-text-muted">
                    {safePage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage >= totalPages}
                    className="flex h-9 items-center gap-1 rounded-lg border border-panel-border px-3 text-sm font-medium text-panel-text hover:bg-panel-surface-soft disabled:opacity-40"
                  >
                    Sonraki
                    <ChevronRight size={15} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>

      {taskItem ? (
        <Suspense fallback={<LoadingState label="Yükleniyor..." />}>
          <TaskAnswerSheetModal
            task={{
              id: taskItem.taskId,
              title: taskItem.taskTitle || taskItem.testName,
              subject: taskItem.subjectName,
              notes: '',
            }}
            lessonLabel={taskItem.subjectName || taskItem.resourceBookName || 'Görev'}
            photoMode={photoMode}
            studentId={studentId}
            canRegrade={canRegrade}
            onClose={() => setActiveItem(null)}
            onSaved={() => refresh()}
          />
        </Suspense>
      ) : null}

      {manualItem ? (
        <ManualAnswersModal
          item={manualItem}
          studentId={studentId}
          onClose={() => setActiveItem(null)}
          onSaved={() => refresh()}
        />
      ) : null}
    </>
  )
}
