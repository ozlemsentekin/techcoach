import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  Check,
  ChevronDown,
  Download,
  Images,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react'
import Button from '../ui/Button'
import LoadingState from './LoadingState'
import EmptyState from './EmptyState'
import WrongQuestionGalleryModal from './WrongQuestionGalleryModal'

const DATE_FMT = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })
const TIME_FMT = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' })

// Backend'deki aiAnalysis.js MAX_IMAGES ile aynı — sadece kullanıcıya bilgi vermek için.
const MAX_QUESTIONS_PER_REPORT = 12

const ROLE_LABEL = { ogrenci: 'Öğrenci', ebeveyn: 'Veli', ogretmen: 'Öğretmen' }
const PRIORITY = {
  yuksek: { label: 'Yüksek öncelik', className: 'bg-panel-red-soft text-panel-red' },
  orta: { label: 'Orta öncelik', className: 'bg-amber-100 text-amber-700' },
  dusuk: { label: 'Düşük öncelik', className: 'bg-panel-surface-soft text-panel-text-muted' },
}

function formatDateTime(value) {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return '—'
  return `${DATE_FMT.format(date)} · ${TIME_FMT.format(date)}`
}

/* ------------------------------------------------------------------ Yeni rapor modalı */

const DATE_FILTERS = [
  { key: 'today', label: 'Bugün', days: 0 },
  { key: '3d', label: 'Son 3 Gün', days: 3 },
  { key: '7d', label: 'Son 1 Hafta', days: 7 },
  { key: '30d', label: 'Son 1 Ay', days: 30 },
  { key: 'all', label: 'Tümü', days: null },
]

function isWithinDateFilter(createdAt, key) {
  const filter = DATE_FILTERS.find((f) => f.key === key)
  if (!filter || filter.days == null) return true
  const date = createdAt ? new Date(createdAt) : null
  if (!date || Number.isNaN(date.getTime())) return false
  const cutoff = new Date()
  if (filter.days === 0) cutoff.setHours(0, 0, 0, 0)
  else cutoff.setDate(cutoff.getDate() - filter.days)
  return date >= cutoff
}

// Hata Defteri'ndeki WrongQuestionThumbnail'a benzer (bkz. WrongQuestionsView.jsx) ama tıklama
// galeri açmak yerine seçimi açar/kapatır; sağ üstte küçük bir onay rozeti gösterir.
function SelectableThumbnail({ item, fetchPhoto, selected, disabled, onToggle }) {
  const [photoUrl, setPhotoUrl] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false
    fetchPhoto(item.id)
      .then((url) => {
        if (!ignore) setPhotoUrl(url)
      })
      .catch((err) => {
        if (!ignore) setError(err.message || 'Fotoğraf yüklenemedi.')
      })
    return () => {
      ignore = true
    }
  }, [item.id, fetchPhoto])

  const caption = `${item.testName || 'Test'} · Soru ${item.questionNumber ?? '-'}`

  return (
    <button
      type="button"
      onClick={() => onToggle(item.id)}
      disabled={disabled}
      aria-pressed={selected}
      title={caption}
      className={`group relative flex flex-col overflow-hidden rounded-xl border-2 text-left shadow-sm transition-colors ${
        selected ? 'border-panel-blue' : 'border-panel-border hover:border-panel-blue/40'
      } ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
    >
      <span
        className={`absolute right-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full border ${
          selected ? 'border-panel-blue bg-panel-blue text-white' : 'border-panel-border bg-white/90 text-white/0'
        }`}
      >
        <Check size={12} aria-hidden="true" />
      </span>
      <p className="line-clamp-1 px-2 py-1.5 text-[11px] font-medium text-panel-text">{caption}</p>
      <div className="flex aspect-square w-full items-center justify-center bg-panel-surface-soft">
        {photoUrl ? (
          <img loading="lazy" decoding="async" src={photoUrl} alt={caption} className="h-full w-full object-cover" />
        ) : error ? (
          <AlertCircle size={18} className="text-panel-text-muted" aria-hidden="true" />
        ) : (
          <Loader2 size={18} className="animate-spin text-panel-text-muted" aria-hidden="true" />
        )}
      </div>
    </button>
  )
}

function CreateReportModal({ subject, fetchScope, createReport, fetchPhoto, onClose, onCreated }) {
  const [questions, setQuestions] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [dateFilter, setDateFilter] = useState('all')
  const [topicFilter, setTopicFilter] = useState('')
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    let ignore = false
    fetchScope(subject)
      .then(({ questions: list }) => {
        if (!ignore) setQuestions(list)
      })
      .catch((err) => {
        if (!ignore) setLoadError(err.message || 'Sorular yüklenemedi.')
      })
    return () => {
      ignore = true
    }
  }, [subject, fetchScope])

  // Tarih filtresi soru listesini daraltır; içerik (konu) filtresi onun üzerine uygulanır —
  // içerik dropdown'undaki sayılar da bu yüzden seçili tarih penceresine göre güncellenir.
  const dateFiltered = useMemo(
    () => (questions || []).filter((q) => isWithinDateFilter(q.createdAt, dateFilter)),
    [questions, dateFilter],
  )

  const topics = useMemo(() => {
    const counts = new Map()
    dateFiltered.forEach((q) => counts.set(q.topic, (counts.get(q.topic) || 0) + 1))
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [dateFiltered])

  const filtered = useMemo(
    () => (topicFilter ? dateFiltered.filter((q) => q.topic === topicFilter) : dateFiltered),
    [dateFiltered, topicFilter],
  )

  const atCap = selected.size >= MAX_QUESTIONS_PER_REPORT

  const toggle = (id) => {
    setSelected((prev) => {
      if (prev.has(id)) {
        const next = new Set(prev)
        next.delete(id)
        return next
      }
      if (prev.size >= MAX_QUESTIONS_PER_REPORT) return prev
      return new Set(prev).add(id)
    })
  }

  const selectVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      for (const q of filtered) {
        if (next.size >= MAX_QUESTIONS_PER_REPORT) break
        next.add(q.id)
      }
      return next
    })
  }

  const submit = async () => {
    if (busy || selected.size === 0) return
    setBusy(true)
    setSubmitError('')
    try {
      const report = await createReport({ subject, wrongQuestionIds: [...selected] })
      onCreated(report)
    } catch (err) {
      setSubmitError(err.message || 'Rapor oluşturulamadı.')
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center overflow-y-auto bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Yeni AI raporu"
    >
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl border border-panel-border bg-panel-surface shadow-lg sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-panel-border px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-lg font-semibold text-panel-text">Yeni AI Raporu</h2>
            <p className="mt-0.5 text-sm text-panel-text-muted">{subject}</p>
          </div>
          <button
            type="button"
            aria-label="Kapat"
            onClick={onClose}
            disabled={busy}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-panel-text-muted hover:bg-panel-surface-soft disabled:opacity-40"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {busy ? (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <Loader2 size={28} className="animate-spin text-panel-blue" aria-hidden="true" />
            <p className="text-sm font-medium text-panel-text">Hata görselleri analiz ediliyor…</p>
            <p className="max-w-xs text-xs text-panel-text-muted">
              Bu işlem birkaç dakika sürebilir, lütfen sayfadan ayrılmayın.
            </p>
          </div>
        ) : loadError ? (
          <p className="m-5 rounded-xl bg-panel-accent-soft px-4 py-3 text-sm text-panel-warm sm:m-6">{loadError}</p>
        ) : questions === null ? (
          <div className="py-10">
            <LoadingState label="Sorular yükleniyor…" />
          </div>
        ) : questions.length === 0 ? (
          <p className="m-5 rounded-xl border border-dashed border-panel-border px-4 py-6 text-center text-sm text-panel-text-muted sm:m-6">
            Bu derste analiz <em>edilmemiş</em> hata görseli kalmadı — daha önce raporlanmış görseller tekrar
            seçilmez. Yeni yanlışlar için Hata Defteri'nden fotoğraf ekledikçe burada tekrar görünecek.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-2.5 border-b border-panel-border px-5 py-3 sm:px-6">
              <div className="flex flex-wrap gap-1.5">
                {DATE_FILTERS.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setDateFilter(f.key)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                      dateFilter === f.key
                        ? 'bg-panel-blue text-white'
                        : 'bg-panel-surface-soft text-panel-text-muted hover:text-panel-text'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={topicFilter}
                  onChange={(event) => setTopicFilter(event.target.value)}
                  aria-label="İçeriğe göre filtrele"
                  className="h-9 rounded-lg border border-panel-border bg-panel-surface px-2.5 text-xs font-medium text-panel-text"
                >
                  <option value="">Tüm içerikler ({dateFiltered.length})</option>
                  {topics.map(([name, count]) => (
                    <option key={name} value={name}>
                      {name} ({count})
                    </option>
                  ))}
                </select>
                <button type="button" onClick={selectVisible} className="text-xs font-semibold text-panel-blue hover:underline">
                  Görünenlerden seç
                </button>
                {selected.size > 0 ? (
                  <button
                    type="button"
                    onClick={() => setSelected(new Set())}
                    className="text-xs font-semibold text-panel-text-muted hover:underline"
                  >
                    Seçimi temizle
                  </button>
                ) : null}
              </div>
            </div>

            {filtered.length === 0 ? (
              <p className="m-5 rounded-xl border border-dashed border-panel-border px-4 py-6 text-center text-sm text-panel-text-muted sm:m-6">
                Bu filtreyle eşleşen soru yok.
              </p>
            ) : (
              <div className="grid flex-1 grid-cols-3 gap-2 overflow-y-auto px-5 py-3 min-[480px]:grid-cols-4 sm:grid-cols-5 sm:px-6 lg:grid-cols-6">
                {filtered.map((q) => (
                  <SelectableThumbnail
                    key={q.id}
                    item={q}
                    fetchPhoto={fetchPhoto}
                    selected={selected.has(q.id)}
                    disabled={atCap && !selected.has(q.id)}
                    onToggle={toggle}
                  />
                ))}
              </div>
            )}

            {submitError ? (
              <p className="mx-5 mt-3 rounded-xl bg-panel-accent-soft px-4 py-3 text-sm text-panel-warm sm:mx-6">
                {submitError}
              </p>
            ) : null}

            <div className="flex flex-col gap-2 border-t border-panel-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <span className="text-xs font-medium text-panel-text-muted">
                {selected.size} / {MAX_QUESTIONS_PER_REPORT} soru seçildi
              </span>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={onClose}>
                  Vazgeç
                </Button>
                <Button onClick={submit} disabled={selected.size === 0}>
                  <Sparkles size={15} aria-hidden="true" />
                  Rapor Oluştur
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ Rapor detayı */

function Section({ title, children }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-panel-text-muted">{title}</h3>
      {children}
    </section>
  )
}

function AnalyzedQuestionRow({ question }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-panel-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm"
      >
        <span className="min-w-0 flex-1 truncate font-medium text-panel-text">
          {question.testName} · Soru {question.questionNumber}
        </span>
        <span className="shrink-0 rounded-md bg-panel-surface-soft px-1.5 py-0.5 text-xs font-semibold text-panel-text-muted">
          Doğru: {question.correctAnswer || '—'}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-panel-text-muted transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div className="flex flex-col gap-2 border-t border-panel-border px-3 py-3 text-sm">
          {question.topic ? <p className="text-xs text-panel-text-muted">{question.topic}</p> : null}
          <p>
            <span className="font-semibold text-panel-text">Ne soruyor: </span>
            <span className="text-panel-text-muted">{question.whatItAsked}</span>
          </p>
          <p>
            <span className="font-semibold text-panel-text">Olası hata: </span>
            <span className="text-panel-text-muted">{question.likelyMistake}</span>
          </p>
        </div>
      ) : null}
    </div>
  )
}

// Rapor metni + analize giren tüm hata görsellerini tek PDF'e alır (görseller tembel çekilir).
function ReportPdfButton({ detail, fetchPhoto }) {
  const [status, setStatus] = useState('idle')
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [error, setError] = useState('')

  const handleExport = async () => {
    if (status === 'loading') return
    setStatus('loading')
    setError('')
    setProgress({ done: 0, total: detail.wrongQuestions?.length || 0 })
    try {
      const [{ buildAiReportPdf, buildAiReportPdfFileName }, { savePdfDocument }] = await Promise.all([
        import('../../utils/aiReportPdf'),
        import('../../utils/savePdfDocument'),
      ])
      const doc = await buildAiReportPdf(detail, fetchPhoto, (done, total) => setProgress({ done, total }))
      await savePdfDocument(doc, buildAiReportPdfFileName(detail.subject, detail.createdAt))
    } catch (err) {
      setError(err.message || 'PDF oluşturulamadı.')
    } finally {
      setStatus('idle')
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button variant="secondary" onClick={handleExport} disabled={status === 'loading'}>
        {status === 'loading' ? (
          <>
            <Loader2 size={15} className="animate-spin" aria-hidden="true" />
            {progress.total ? `PDF hazırlanıyor (${progress.done}/${progress.total})` : 'PDF hazırlanıyor…'}
          </>
        ) : (
          <>
            <Download size={15} aria-hidden="true" />
            PDF olarak indir
          </>
        )}
      </Button>
      {error ? <span className="text-xs text-panel-warm">{error}</span> : null}
    </div>
  )
}

function ReportDetailModal({
  reportId,
  fetchReportDetail,
  fetchPhoto,
  updateMistakeAnalysis,
  updateMistakeMeta,
  viewerRole,
  onClose,
}) {
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')
  const [galleryOpen, setGalleryOpen] = useState(false)

  useEffect(() => {
    let ignore = false
    fetchReportDetail(reportId)
      .then((data) => {
        if (!ignore) setDetail(data)
      })
      .catch((err) => {
        if (!ignore) setError(err.message || 'Rapor yüklenemedi.')
      })
    return () => {
      ignore = true
    }
  }, [reportId, fetchReportDetail])

  const report = detail?.report

  return (
    <>
      <div
        className="fixed inset-0 z-[55] flex justify-center overflow-y-auto bg-black/40 p-0 sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-label="AI raporu"
      >
        <div className="min-h-full w-full max-w-3xl bg-panel-surface p-4 shadow-lg sm:my-auto sm:min-h-0 sm:rounded-2xl sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-panel-text">AI Analiz Raporu</h2>
              {detail ? (
                <p className="mt-0.5 text-sm text-panel-text-muted">
                  {detail.subject} · {formatDateTime(detail.createdAt)} ·{' '}
                  {ROLE_LABEL[detail.createdByRole] || detail.createdByRole} oluşturdu
                </p>
              ) : null}
            </div>
            <button
              type="button"
              aria-label="Kapat"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-panel-text-muted hover:bg-panel-surface-soft"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          {error ? (
            <p className="mt-4 rounded-xl bg-panel-accent-soft px-4 py-3 text-sm text-panel-warm">{error}</p>
          ) : !detail ? (
            <div className="py-12">
              <LoadingState label="Rapor yükleniyor…" />
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-6">
              {detail.topicNames?.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {detail.topicNames.map((name) => (
                    <span
                      key={name}
                      className="rounded-full bg-panel-blue-soft/50 px-2.5 py-1 text-xs font-medium text-panel-blue"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="flex flex-wrap items-start gap-2">
                {detail.wrongQuestions?.length ? (
                  <Button variant="secondary" onClick={() => setGalleryOpen(true)}>
                    <Images size={15} aria-hidden="true" />
                    Hata görsellerini gör ({detail.wrongQuestions.length})
                  </Button>
                ) : null}
                <ReportPdfButton detail={detail} fetchPhoto={fetchPhoto} />
              </div>

              {report?.overview ? (
                <Section title="Genel durum">
                  <p className="text-sm leading-relaxed text-panel-text">{report.overview}</p>
                </Section>
              ) : null}

              {report?.gaps?.length ? (
                <Section title="Eksik konular">
                  <div className="flex flex-col gap-2">
                    {report.gaps.map((gap, index) => {
                      const tone = PRIORITY[gap.priority] || PRIORITY.orta
                      return (
                        <div key={index} className="rounded-xl border border-panel-border p-3">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold text-panel-text">{gap.title}</p>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${tone.className}`}>
                              {tone.label}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-panel-text-muted">{gap.explanation}</p>
                        </div>
                      )
                    })}
                  </div>
                </Section>
              ) : null}

              {report?.studyRecommendations?.length ? (
                <Section title="Çalışma önerileri">
                  <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm text-panel-text">
                    {report.studyRecommendations.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ol>
                </Section>
              ) : null}

              {report?.reinforcementTopics?.length ? (
                <Section title="Tekrar edilecek kazanımlar">
                  <div className="flex flex-wrap gap-1.5">
                    {report.reinforcementTopics.map((name) => (
                      <span
                        key={name}
                        className="rounded-lg bg-panel-surface-soft px-2.5 py-1 text-xs font-medium text-panel-text"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </Section>
              ) : null}

              {report?.analyzedQuestions?.length ? (
                <Section title={`Analiz edilen sorular (${report.analyzedQuestions.length})`}>
                  <div className="flex flex-col gap-1.5">
                    {report.analyzedQuestions.map((question, index) => (
                      <AnalyzedQuestionRow key={index} question={question} />
                    ))}
                  </div>
                </Section>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {galleryOpen && detail?.wrongQuestions?.length ? (
        <WrongQuestionGalleryModal
          title={detail.subject}
          items={detail.wrongQuestions}
          fetchPhoto={fetchPhoto}
          viewerRole={viewerRole}
          onUpdateMistakeAnalysis={updateMistakeAnalysis}
          onUpdateMistakeMeta={updateMistakeMeta}
          onClose={() => setGalleryOpen(false)}
        />
      ) : null}
    </>
  )
}

/* ------------------------------------------------------------------ Ana görünüm */

/**
 * AI Raporları — ders sekmeleri + rapor tablosu + yeni rapor / rapor detayı akışı.
 * Öğrenci, veli ve öğretmen panellerinde ortak.
 * @param {(subject:string)=>Promise<{questions:object[]}>} fetchScope
 * @param {(reportId:string)=>Promise<object>} fetchReportDetail
 * @param {({subject:string,wrongQuestionIds:string[]})=>Promise<object>} createReport
 * @param {(wrongQuestionId:string)=>Promise<string>} fetchPhoto
 * @param {(id:string, patch:object)=>Promise<any>} [updateMistakeAnalysis]
 * @param {'ogrenci'|'ebeveyn'|'ogretmen'} [viewerRole]
 * @param {boolean} [canCreate]
 */
export default function AiReportsView({
  fetchReports,
  fetchScope,
  fetchReportDetail,
  createReport,
  fetchPhoto,
  updateMistakeAnalysis,
  updateMistakeMeta,
  viewerRole = 'ogrenci',
  canCreate = false,
}) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [pickedSubject, setPickedSubject] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [detailReportId, setDetailReportId] = useState(null)

  useEffect(() => {
    let ignore = false
    fetchReports()
      .then((result) => {
        if (!ignore) {
          setData(result)
          setError('')
        }
      })
      .catch((err) => {
        if (!ignore) setError(err.message || 'Raporlar yüklenemedi.')
      })
    return () => {
      ignore = true
    }
  }, [fetchReports, reloadKey])

  const subjects = useMemo(() => {
    if (!data) return []
    const names = new Set()
    data.availableSubjects.forEach((s) => names.add(s.subject))
    data.reports.forEach((r) => names.add(r.subject))
    return [...names].sort((a, b) => a.localeCompare(b, 'tr'))
  }, [data])

  const activeSubject = subjects.includes(pickedSubject) ? pickedSubject : subjects[0] || ''

  const refresh = () => setReloadKey((k) => k + 1)

  if (error && !data) {
    return <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{error}</div>
  }

  if (!data) {
    return <LoadingState label="Raporlar yükleniyor…" />
  }

  const subjectHasScope = data.availableSubjects.some((s) => s.subject === activeSubject && s.questionCount > 0)
  const rows = data.reports.filter((r) => r.subject === activeSubject)

  if (!subjects.length) {
    return (
      <EmptyState
        icon={Sparkles}
        title="Henüz AI raporu yok"
        description="Hata Defteri'nde bir derste hata görselli sorular biriktiğinde buradan o sorulardan konu-eksiği analizi oluşturabilirsiniz."
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Ders sekmeleri */}
      <div className="flex flex-wrap gap-1.5 border-b border-panel-border pb-2">
        {subjects.map((subject) => (
          <button
            key={subject}
            type="button"
            onClick={() => setPickedSubject(subject)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              subject === activeSubject
                ? 'bg-panel-blue text-white'
                : 'text-panel-text-muted hover:bg-panel-surface-soft hover:text-panel-text'
            }`}
          >
            {subject}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-panel-text-muted">
          {rows.length} rapor{activeSubject ? ` · ${activeSubject}` : ''}
        </p>
        {canCreate ? (
          <Button onClick={() => setCreateOpen(true)} disabled={!subjectHasScope} size="sm">
            <Sparkles size={14} aria-hidden="true" />
            Yeni Rapor Oluştur
          </Button>
        ) : null}
      </div>

      {canCreate && !subjectHasScope ? (
        <p className="flex items-center gap-2 rounded-xl border border-panel-border bg-panel-surface-soft px-3 py-2 text-xs text-panel-text-muted">
          <AlertTriangle size={14} className="shrink-0" aria-hidden="true" />
          Bu derste analiz edilebilir hata görseli yok. Hata Defteri'nden yanlış sorulara fotoğraf ekledikçe rapor
          oluşturabilirsiniz.
        </p>
      ) : null}

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-panel-border bg-panel-surface px-4 py-10 text-center text-sm text-panel-text-muted">
          Bu ders için henüz rapor oluşturulmadı.
        </div>
      ) : (
        <>
          {/* Mobil: kart listesi */}
          <div className="grid gap-2 md:hidden">
            {rows.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => setDetailReportId(row.id)}
                className="rounded-xl border border-panel-border bg-panel-surface p-3 text-left"
              >
                <p className="text-xs font-medium text-panel-text-muted">{formatDateTime(row.createdAt)}</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {row.topicNames.map((name) => (
                    <span
                      key={name}
                      className="rounded-md bg-panel-blue-soft/50 px-1.5 py-0.5 text-[11px] font-medium text-panel-blue"
                    >
                      {name}
                    </span>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-panel-text-muted">
                  {row.questionCount} soru · {ROLE_LABEL[row.createdByRole] || row.createdByRole}
                </p>
              </button>
            ))}
          </div>

          {/* Masaüstü: tablo */}
          <div className="hidden overflow-hidden rounded-2xl border border-panel-border bg-panel-surface shadow-sm md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-panel-border bg-panel-surface-soft text-[11px] font-semibold uppercase tracking-wide text-panel-text-muted">
                    <th className="px-4 py-3">Tarih · Saat</th>
                    <th className="px-4 py-3">Analiz edilen içerikler</th>
                    <th className="px-2 py-3 text-center">Soru</th>
                    <th className="px-4 py-3">Oluşturan</th>
                    <th className="px-4 py-3 text-right">Rapor</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-panel-border/50 last:border-0 hover:bg-panel-blue-soft/20">
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-panel-text">{formatDateTime(row.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {row.topicNames.map((name) => (
                            <span
                              key={name}
                              className="rounded-md bg-panel-blue-soft/50 px-1.5 py-0.5 text-[11px] font-medium text-panel-blue"
                            >
                              {name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-2 py-3 text-center text-sm tabular-nums text-panel-text-muted">
                        {row.questionCount}
                      </td>
                      <td className="px-4 py-3 text-sm text-panel-text-muted">
                        {ROLE_LABEL[row.createdByRole] || row.createdByRole}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setDetailReportId(row.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-panel-blue transition-colors hover:bg-panel-blue-soft/50"
                        >
                          <Sparkles size={14} aria-hidden="true" />
                          Raporu Aç
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {createOpen ? (
        <CreateReportModal
          subject={activeSubject}
          fetchScope={fetchScope}
          createReport={createReport}
          fetchPhoto={fetchPhoto}
          onClose={() => setCreateOpen(false)}
          onCreated={(report) => {
            setCreateOpen(false)
            refresh()
            if (report?.id) setDetailReportId(report.id)
          }}
        />
      ) : null}

      {detailReportId ? (
        <ReportDetailModal
          reportId={detailReportId}
          fetchReportDetail={fetchReportDetail}
          fetchPhoto={fetchPhoto}
          updateMistakeAnalysis={updateMistakeAnalysis}
          updateMistakeMeta={updateMistakeMeta}
          viewerRole={viewerRole}
          onClose={() => setDetailReportId(null)}
        />
      ) : null}
    </div>
  )
}
