import { useEffect, useState } from 'react'
import {
  BookOpen,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  Hash,
  Image as ImageIcon,
  Loader2,
  Send,
  X,
} from 'lucide-react'
import { cn } from '../ui/utils'
import AnalysisCommentFeed from './AnalysisCommentFeed'
import AnalysisPhotoViewer from './AnalysisPhotoViewer'

const MISTAKE_REASON_OPTIONS = [
  { value: 'dikkat-hatasi', label: 'Dikkat Hatası' },
  { value: 'bilgi-eksikligi', label: 'Bilgi Eksikliği' },
  { value: 'soruyu-anlamadim', label: 'Soruyu Anlamadım' },
]

// Yorum kutusunun placeholder'ı izleyicinin rolüne göre değişir.
const ANALYSIS_PROMPT_BY_ROLE = {
  ogrenci: 'Bu soruyu neden yanlış yaptın?',
  ebeveyn: 'Sence çocuğun bu soruyu neden yanlış yaptı?',
  ogretmen: 'Öğrencinin bu sorudaki hatası ne?',
}

function InfoField({ icon, label, value }) {
  if (!value) return null
  const Icon = icon
  return (
    <div className="flex min-w-0 items-start gap-2">
      <Icon size={14} className="mt-0.5 shrink-0 text-panel-text-muted" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-panel-text-muted">{label}</p>
        <p className="line-clamp-2 break-words text-sm font-semibold text-panel-text" title={value}>
          {value}
        </p>
      </div>
    </div>
  )
}

// Hata Defterim'de bir içeriğe (konuya) ait tüm fotoğrafları gezip her soruya öğrenci/veli/öğretmen
// yorumu (hata nedeni + not) eklemeyi sağlayan tam ekran galeri — bkz. Analiz Yorumları bölümü.
// Tek fotoğraflık eski PhotoLightbox'ın yerine geçer. `items` gelirken fotoğrafları içermez (sadece hasPhoto bayrağı,
// bkz. WrongQuestionsView) — her fotoğraf sadece görüntülendiği an fetchPhoto ile tembel çekilir,
// onlarca fotoğrafı tek seferde indirmenin getirdiği yavaşlığı önlemek için (bkz. progress.js'deki
// getWrongQuestionPhotoHandler). Bir item `photoUrl` taşıyorsa (ör. cevap kağıdında yeni çekilen
// fotoğraf) tembel çekim atlanır. `onCapturePhoto` verilirse fotoğrafı değiştirme butonu çıkar
// (öğrencinin kendi cevap kağıdı akışı). `onIndexChange` üst bileşenin aktif index'i takip
// etmesini sağlar (galeri fotoğraf çekimi sırasında geçici olarak kapanıp açılabildiği için).
export default function WrongQuestionGalleryModal({
  title,
  items,
  initialIndex = 0,
  fetchPhoto,
  onClose,
  viewerRole = 'ogrenci',
  onUpdateMistakeAnalysis,
  onUpdateMistakeMeta,
  onCapturePhoto,
  onIndexChange,
  fetchAnalysisPhotos,
  onAddAnalysisPhoto,
  onRemoveAnalysisPhoto,
}) {
  const [index, setIndex] = useState(initialIndex)
  const [photosById, setPhotosById] = useState({})
  const [photoError, setPhotoError] = useState('')
  const [zoomed, setZoomed] = useState(false)
  // Hata Analiz görselleri kendi tam ekran galerisinde (AnalysisPhotoViewer) yönetilir — birden
  // fazla görsel olabildiği için ana soru fotoğrafından bağımsız, kendi slayt/ekleme/silme/yazdırma
  // mantığı orada.
  const [analysisViewerOpen, setAnalysisViewerOpen] = useState(false)
  // Konu alanı: item değişince testin içerik adıyla ön-dolu gelir, alandan çıkınca (blur) yalnızca
  // değişmişse kaydedilir (onUpdateMistakeMeta). Analiz yorumları artık ayrı bir composer'la
  // (draftReason/draftNote) eklenir — bkz. aşağısı.
  const [meta, setMeta] = useState({ topic: '' })
  const [savedMeta, setSavedMeta] = useState({ topic: '' })
  const [metaStatus, setMetaStatus] = useState('idle') // idle | saving | saved | error

  // Yeni yorum composer'ı: her item için sıfırdan başlar (draft, gönderilmiş bir alanı düzenlemez).
  const [draftReason, setDraftReason] = useState('')
  const [draftNote, setDraftNote] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [commentError, setCommentError] = useState('')

  const item = items[index]
  const hasMultiple = items.length > 1
  const currentPhotoUrl = item ? item.photoUrl || photosById[item.id] : undefined
  const comments = item?.analysisComments || []

  const goTo = (nextIndex) => {
    setZoomed(false)
    setAnalysisViewerOpen(false)
    setIndex((nextIndex + items.length) % items.length)
  }

  useEffect(() => {
    onIndexChange?.(index)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (zoomed) setZoomed(false)
        else if (analysisViewerOpen) setAnalysisViewerOpen(false)
        else onClose()
      } else if (event.key === 'ArrowLeft' && hasMultiple) goTo(index - 1)
      else if (event.key === 'ArrowRight' && hasMultiple) goTo(index + 1)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, hasMultiple, zoomed, analysisViewerOpen])

  useEffect(() => {
    if (!item || item.photoUrl || photosById[item.id]) return
    let ignore = false
    setPhotoError('')
    fetchPhoto(item.id)
      .then((photoUrl) => {
        if (!ignore) setPhotosById((prev) => ({ ...prev, [item.id]: photoUrl }))
      })
      .catch((err) => {
        if (!ignore) setPhotoError(err.message || 'Fotoğraf yüklenemedi.')
      })
    return () => {
      ignore = true
    }
  }, [item, fetchPhoto, photosById])

  // Prev/next'e basınca beklemeden görünsün diye komşu fotoğrafları sessizce önceden çeker.
  useEffect(() => {
    if (!hasMultiple) return
    ;[items[(index + 1) % items.length], items[(index - 1 + items.length) % items.length]].forEach((neighbor) => {
      if (neighbor && !neighbor.photoUrl && !photosById[neighbor.id]) {
        fetchPhoto(neighbor.id)
          .then((photoUrl) => setPhotosById((prev) => (prev[neighbor.id] ? prev : { ...prev, [neighbor.id]: photoUrl })))
          .catch(() => {})
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, items, hasMultiple])

  // Yeni item'a geçince composer sıfırlanır — draft, gönderilmiş bir yorumu düzenlemez.
  useEffect(() => {
    setDraftReason('')
    setDraftNote('')
    setCommentError('')
  }, [item?.id])

  const handleSubmitComment = async () => {
    if (!item || submittingComment) return
    const note = draftNote.trim()
    if (!note && !draftReason) return
    setSubmittingComment(true)
    setCommentError('')
    try {
      await onUpdateMistakeAnalysis(item.id, { mistakeReason: draftReason || undefined, note: note || undefined })
      setDraftReason('')
      setDraftNote('')
    } catch (err) {
      setCommentError(err.message || 'Yorum eklenemedi.')
    } finally {
      setSubmittingComment(false)
    }
  }

  // Konu alanı için varsayılan: kayıtlı konu yoksa testin içerik/test adı otomatik dolar.
  useEffect(() => {
    const initial = { topic: item ? item.topic || item.testName || title || '' : '' }
    setMeta(initial)
    setSavedMeta(initial)
    setMetaStatus('idle')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id])

  const commitMetaField = async (field) => {
    if (!item || !onUpdateMistakeMeta) return
    const value = meta[field].trim()
    if (value === (savedMeta[field] || '').trim()) return
    setMetaStatus('saving')
    try {
      await onUpdateMistakeMeta(item.id, { topic: value })
      setSavedMeta((prev) => ({ ...prev, [field]: value }))
      setMeta((prev) => ({ ...prev, [field]: value }))
      setMetaStatus('saved')
    } catch {
      setMetaStatus('error')
    }
  }

  if (!item) return null

  // "Test Konusu - Test Adı" — konu ile test adı aynıysa ya da konu yoksa sadece test adı.
  const testTopic = item.topicName || item.topic || ''
  const testLabel =
    testTopic && testTopic !== item.testName
      ? `${testTopic}${item.testName ? ` - ${item.testName}` : ''}`
      : item.testName

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-panel-text"
      role="dialog"
      aria-modal="true"
      aria-label={title ? `${title} fotoğraf galerisi` : 'Soru fotoğrafı galerisi'}
    >
      <div
        className="flex shrink-0 items-center justify-between gap-3 px-4 pb-2"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-white">{title || 'Genel'}</h2>
          <p className="text-xs text-white/70">
            {index + 1} / {items.length}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onCapturePhoto ? (
            <button
              type="button"
              onClick={() => onCapturePhoto(item)}
              className="flex h-10 items-center gap-1.5 rounded-full bg-white/15 px-3 text-xs font-semibold text-white hover:bg-white/25"
            >
              <Camera size={16} aria-hidden="true" />
              {currentPhotoUrl ? 'Fotoğrafı Değiştir' : 'Fotoğraf Ekle'}
            </button>
          ) : null}
          <button
            type="button"
            aria-label="Kapat"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-center gap-2 overflow-y-auto px-3 pb-2" style={{ maxHeight: '46vh' }}>
        <div className="w-full max-w-2xl rounded-2xl border-2 border-panel-accent bg-panel-surface px-4 py-3 shadow-panel-2">
          {onUpdateMistakeMeta ? (
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-panel-text-muted">Konu</span>
              <input
                type="text"
                value={meta.topic}
                onChange={(event) => setMeta((prev) => ({ ...prev, topic: event.target.value }))}
                onBlur={() => commitMetaField('topic')}
                placeholder="Konu"
                className="w-full rounded-lg border border-panel-border bg-panel-surface px-3 py-1.5 text-sm text-panel-text focus:border-panel-blue focus:outline-none"
              />
              {metaStatus === 'saving' ? (
                <span className="flex items-center gap-1 text-[11px] text-panel-text-muted">
                  <Loader2 size={12} className="animate-spin" aria-hidden="true" /> Kaydediliyor...
                </span>
              ) : metaStatus === 'saved' ? (
                <span className="flex items-center gap-1 text-[11px] text-emerald-600">
                  <Check size={12} aria-hidden="true" /> Kaydedildi
                </span>
              ) : metaStatus === 'error' ? (
                <span className="text-[11px] text-panel-red">Kaydedilemedi, tekrar dene.</span>
              ) : null}
            </label>
          ) : null}

          {/* Hata Analiz Görseli: veli ekler/kaldırır (onAddAnalysisPhoto/onRemoveAnalysisPhoto),
              herkes görüntüler (item.hasAnalysisPhoto + fetchAnalysisPhotos). Birden fazla görsel
              olabilir — slayt gibi gezinme + yazdırma AnalysisPhotoViewer içinde. */}
          {item.hasAnalysisPhoto || onAddAnalysisPhoto ? (
            <div className={cn('flex flex-wrap items-center gap-2 pt-3', onUpdateMistakeMeta ? 'mt-3 border-t border-panel-border' : '')}>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-panel-text-muted">
                Hata Analiz Görseli
              </span>
              {item.hasAnalysisPhoto ? (
                <button
                  type="button"
                  onClick={() => setAnalysisViewerOpen(true)}
                  className="flex items-center gap-1.5 rounded-full border-2 border-panel-blue px-3 py-1.5 text-xs font-bold text-panel-blue hover:bg-panel-blue-soft"
                >
                  <ImageIcon size={14} aria-hidden="true" />
                  Görseli Göster{item.analysisPhotoCount > 1 ? ` (${item.analysisPhotoCount})` : ''}
                </button>
              ) : (
                <span className="text-xs text-panel-text-muted">Henüz görsel eklenmedi.</span>
              )}
              {onAddAnalysisPhoto ? (
                <button
                  type="button"
                  onClick={() => setAnalysisViewerOpen(true)}
                  className="flex items-center gap-1.5 rounded-full border border-panel-border px-3 py-1.5 text-xs font-semibold text-panel-text hover:bg-panel-surface-soft"
                >
                  <Camera size={14} aria-hidden="true" />
                  Görsel Ekle
                </button>
              ) : null}
            </div>
          ) : null}

          {/* Analiz Yorumları: öğrenci/veli/öğretmen aynı soruya istediği kadar yorum bırakabilir
              (bkz. mistakeAnalysis.js dosya başı yorumu) — herkes tüm yorumları görür, composer
              sadece onUpdateMistakeAnalysis verilen (yazma yetkisi olan) izleyicide çıkar. */}
          {onUpdateMistakeAnalysis || comments.length > 0 ? (
            <div className={cn('pt-3', onUpdateMistakeMeta || item.hasAnalysisPhoto || onAddAnalysisPhoto ? 'mt-3 border-t border-panel-border' : '')}>
              <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-panel-text-muted">
                Analiz Yorumları{comments.length ? ` (${comments.length})` : ''}
              </span>

              {comments.length > 0 ? (
                <div className="mb-3 max-h-40 overflow-y-auto pr-1">
                  <AnalysisCommentFeed comments={comments} />
                </div>
              ) : (
                <p className="mb-3 text-xs text-panel-text-muted">Henüz yorum yok.</p>
              )}

              {onUpdateMistakeAnalysis ? (
                <div className="flex flex-col gap-2 rounded-lg border border-panel-border bg-panel-surface-soft p-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    {MISTAKE_REASON_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={draftReason === option.value}
                        onClick={() => setDraftReason((prev) => (prev === option.value ? '' : option.value))}
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors',
                          draftReason === option.value
                            ? 'border-panel-blue bg-panel-blue text-white'
                            : 'border-panel-border text-panel-text-muted hover:border-panel-blue hover:text-panel-blue',
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <textarea
                    rows={2}
                    value={draftNote}
                    onChange={(event) => setDraftNote(event.target.value)}
                    placeholder={ANALYSIS_PROMPT_BY_ROLE[viewerRole] || 'Bir yorum ekle'}
                    className="w-full resize-none rounded-lg border border-panel-border bg-panel-surface px-3 py-1.5 text-sm text-panel-text focus:border-panel-blue focus:outline-none"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-panel-red">{commentError}</span>
                    <button
                      type="button"
                      disabled={submittingComment || (!draftNote.trim() && !draftReason)}
                      onClick={handleSubmitComment}
                      className="flex shrink-0 items-center gap-1.5 rounded-full bg-panel-blue px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-panel-blue/90 disabled:opacity-50"
                    >
                      {submittingComment ? (
                        <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                      ) : (
                        <Send size={14} aria-hidden="true" />
                      )}
                      Yorum Ekle
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="relative flex flex-1 min-h-0 items-center justify-center px-3 py-2">
        {hasMultiple ? (
          <button
            type="button"
            aria-label="Önceki fotoğraf"
            onClick={() => goTo(index - 1)}
            className="absolute left-2 z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-panel-surface text-panel-text shadow-panel-2 hover:bg-panel-surface-soft md:left-6"
          >
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
        ) : null}

        <div className="flex h-full min-h-[200px] max-w-full items-center justify-center">
          {currentPhotoUrl ? (
            <img loading="lazy" decoding="async"
              src={currentPhotoUrl}
              alt={`${item.topic || title || 'Soru'} fotoğrafı`}
              onClick={() => setZoomed(true)}
              className="max-h-full max-w-full cursor-zoom-in rounded-xl object-contain shadow-panel-2"
            />
          ) : photoError ? (
            <div className="flex flex-col items-center gap-3 text-white/70">
              <p className="max-w-xs text-center text-sm">{photoError}</p>
              {onCapturePhoto ? (
                <button
                  type="button"
                  onClick={() => onCapturePhoto(item)}
                  className="flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/25"
                >
                  <Camera size={16} aria-hidden="true" />
                  Fotoğraf Ekle
                </button>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-white/70">
              <Loader2 size={28} className="animate-spin" aria-hidden="true" />
              <span className="text-xs">Fotoğraf yükleniyor...</span>
            </div>
          )}
        </div>

        {hasMultiple ? (
          <button
            type="button"
            aria-label="Sonraki fotoğraf"
            onClick={() => goTo(index + 1)}
            className="absolute right-2 z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-panel-surface text-panel-text shadow-panel-2 hover:bg-panel-surface-soft md:right-6"
          >
            <ChevronRight size={22} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div
        className="shrink-0 rounded-t-2xl bg-panel-surface px-4 pt-2 shadow-panel-2"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-panel-border" aria-hidden="true" />
        <div className="mx-auto grid w-full max-w-4xl grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
          <InfoField icon={BookOpen} label="Kaynak" value={item.publisherName} />
          <InfoField icon={FileText} label="Test" value={testLabel} />
          <InfoField icon={Hash} label="Soru No" value={item.questionNumber} />
          <InfoField icon={Check} label="Doğru Cevap" value={item.correctAnswer} />
        </div>
      </div>

      {zoomed && currentPhotoUrl ? (
        <div
          className="fixed inset-0 z-[70] flex cursor-zoom-out items-center justify-center bg-panel-text/95 p-4"
          role="button"
          tabIndex={-1}
          aria-label="Fotoğrafı kapat"
          onClick={() => setZoomed(false)}
        >
          <img loading="lazy" decoding="async"
            src={currentPhotoUrl}
            alt={`${item.topic || title || 'Soru'} fotoğrafı büyütülmüş`}
            className="max-h-[95vh] max-w-[95vw] rounded-xl object-contain shadow-2xl"
          />
          <button
            type="button"
            aria-label="Kapat"
            onClick={() => setZoomed(false)}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {analysisViewerOpen ? (
        <AnalysisPhotoViewer
          wrongQuestionId={item.id}
          fetchPhotos={fetchAnalysisPhotos}
          onAddPhoto={onAddAnalysisPhoto}
          onDeletePhoto={onRemoveAnalysisPhoto}
          contextLabel={[item.publisherName, testLabel, item.questionNumber ? `Soru ${item.questionNumber}` : null]
            .filter(Boolean)
            .join(' · ')}
          onClose={() => setAnalysisViewerOpen(false)}
        />
      ) : null}
    </div>
  )
}
