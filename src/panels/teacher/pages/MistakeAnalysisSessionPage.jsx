import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FolderCheck,
  FolderOpen,
  Loader2,
  Play,
  RotateCcw,
  RotateCw,
  Save,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import PageHeader from '../../layout/PageHeader'
import Button from '../../ui/Button'
import LoadingState from '../../shared/LoadingState'
import EmptyState from '../../shared/EmptyState'
import AnalysisCommentFeed from '../../shared/AnalysisCommentFeed'
import { MISTAKE_REASON_LABELS } from '../../shared/mistakeAnalysis'
import {
  createTeacherMistakeAnalysis,
  deleteTeacherMistakeAnalysis,
  getTeacherMistakeAnalysisSession,
  updateTeacherMistakeAnalysis,
  updateTeacherStudentWrongQuestionPhoto,
} from '../../../services/teacherService'
import { rotateImageToDataUrl } from '../../../utils/rotateImage'

// Hata Analizi Oturumu: öğretmen ve öğrenci online derste, öğretmenin dersindeki TÜM yanlışları
// slayt gibi gezip her soru için "Sorunun konusu" + "Dikkat edilmesi gereken" yazar. "Analiz
// yapıldı" denince soru "Analiz edilecek hatalar" klasöründen "Analiz yapılanlar"a geçer ve
// öğrencinin "Hata Analizlerim" menüsünde görünür. Performans için tüm liste (fotoğraf
// adresleriyle) tek istekte gelir; ızgara görselleri tembel yüklenir, slaytta sıradaki görseller
// önceden indirilir.

const ALL_SOURCES = '__all__'
// Fotoğraf adresleri (SAS) 15-30 dk geçerli; uzun derslerde sessizce yenilenir.
const PHOTO_URL_REFRESH_MS = 12 * 60 * 1000
const PREFETCH_AHEAD = 3

function questionLabel(item) {
  if (item.mockExamTitle) {
    return [item.mockExamTitle, item.questionNumber ? `Soru ${item.questionNumber}` : null].filter(Boolean).join(' · ')
  }
  return [item.testName, item.questionNumber ? `Soru ${item.questionNumber}` : null].filter(Boolean).join(' · ') || 'Soru'
}

const ERROR_DATE_FMT = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })

function formatErrorDate(value) {
  const [y, m, d] = String(value || '').split('-').map(Number)
  if (!y || !m || !d) return ''
  return ERROR_DATE_FMT.format(new Date(y, m - 1, d))
}

// Etiket renkleri (panel-* token'ları): ada göre sabit renk — aynı kaynak her kartta aynı renkte.
const TAG_PALETTE = [
  'bg-panel-blue-soft text-panel-blue',
  'bg-panel-sage-soft text-panel-sage',
  'bg-panel-lilac-soft text-panel-lilac',
  'bg-panel-slate-soft text-panel-slate',
  'bg-panel-accent-soft text-panel-accent',
  'bg-panel-warm-soft text-panel-warm',
  'bg-panel-yellow-soft text-panel-yellow',
  'bg-panel-green-soft text-panel-green',
]

function tagTone(name, seed = 0) {
  if (!name) return 'bg-panel-surface-soft text-panel-text-muted'
  let hash = seed
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) | 0
  return TAG_PALETTE[Math.abs(hash) % TAG_PALETTE.length]
}

const MOCK_EXAM_KIND_TAGS = {
  genel: { label: 'Deneme Sınavı', tone: 'bg-panel-blue text-white' },
  brans: { label: 'Branş İzleme', tone: 'bg-panel-lilac text-white' },
  etut: { label: 'Etüt', tone: 'bg-panel-sage text-white' },
}

function Tag({ className, children, title }) {
  return (
    <span
      className={`inline-block max-w-full truncate rounded-full px-2 py-0.5 text-[10px] font-semibold leading-4 ${className}`}
      title={title}
    >
      {children}
    </span>
  )
}

// Kart alt yazısı. Kitap: yayınevi + kaynak etiketi, ünite, (varsa) test konusu, test · soru.
// Deneme: tür etiketi (Deneme Sınavı / Branş İzleme / Etüt), deneme adı, tarih, soru.
function CardCaption({ item }) {
  const question = item.questionNumber ? `Soru ${item.questionNumber}` : 'Soru'
  if (item.mockExamTitle) {
    const kind = MOCK_EXAM_KIND_TAGS[item.mockExamKind] || { label: 'Deneme', tone: 'bg-panel-blue text-white' }
    return (
      <span className="flex min-w-0 flex-col gap-1 px-2 py-2">
        <span className="flex min-w-0 flex-wrap gap-1">
          <Tag className={kind.tone}>{kind.label}</Tag>
        </span>
        <span className="block truncate text-xs font-semibold text-panel-text" title={item.mockExamTitle}>
          {item.mockExamTitle}
        </span>
        {item.errorDate ? (
          <span className="block text-[11px] text-panel-text-muted">{formatErrorDate(item.errorDate)}</span>
        ) : null}
        <span className="block text-[11px] font-semibold text-panel-text">{question}</span>
        <TeacherTopic item={item} />
      </span>
    )
  }

  const unit = item.topic
  const testTopic = item.topicName && item.topicName !== item.topic ? item.topicName : null
  return (
    <span className="flex min-w-0 flex-col gap-1 px-2 py-2">
      <span className="flex min-w-0 flex-col items-start gap-1">
        {item.publisherName ? (
          <Tag className={tagTone(item.publisherName)} title={item.publisherName}>
            {item.publisherName}
          </Tag>
        ) : null}
        <Tag className={tagTone(sourceLabel(item), 7)} title={sourceLabel(item)}>
          {sourceLabel(item)}
        </Tag>
      </span>
      {unit ? (
        <span className="block truncate text-[11px] text-panel-text" title={unit}>
          {unit}
        </span>
      ) : null}
      {testTopic ? (
        <span className="block truncate text-[11px] text-panel-text-muted" title={testTopic}>
          {testTopic}
        </span>
      ) : null}
      <span className="block truncate text-[11px] font-semibold text-panel-text">
        {[item.testName, question].filter(Boolean).join(' · ')}
      </span>
      <TeacherTopic item={item} />
    </span>
  )
}

// Öğretmenin bu soru için yazdığı konu (analiz yapıldıysa).
function TeacherTopic({ item }) {
  if (!item.myAnalysis?.questionTopic) return null
  return (
    <span className="block truncate text-[11px] text-panel-blue" title={item.myAnalysis.questionTopic}>
      Konu: {item.myAnalysis.questionTopic}
    </span>
  )
}

function sourceLabel(item) {
  return item.bookName || 'Kaynak belirtilmemiş'
}

function isEditableTarget(target) {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

function FolderCard({ active, icon, title, count, hint, onClick, tone }) {
  const Icon = icon
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex min-w-0 flex-1 items-center gap-3 rounded-2xl border p-4 text-left transition-colors ${
        active
          ? 'border-panel-blue bg-panel-blue-soft'
          : 'border-panel-border bg-panel-surface hover:bg-panel-surface-soft'
      }`}
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
          tone === 'done' ? 'bg-panel-green-soft text-panel-green' : 'bg-panel-accent-soft text-panel-accent'
        }`}
      >
        <Icon size={22} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-panel-text">{title}</span>
        <span className="block text-2xl font-bold leading-tight text-panel-text">{count}</span>
        <span className="block truncate text-xs text-panel-text-muted">{hint}</span>
      </span>
    </button>
  )
}

function Thumbnail({ item, onOpen }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-panel-border bg-panel-surface text-left hover:border-panel-blue"
    >
      <span className="relative block aspect-[4/3] w-full shrink-0 overflow-hidden bg-panel-surface-soft">
        {item.photoUrl ? (
          <img
            src={item.photoUrl}
            alt={questionLabel(item)}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover object-top"
          />
        ) : null}
        {item.myAnalysis ? (
          <span className="absolute right-1.5 top-1.5 rounded-full bg-panel-green px-1.5 py-0.5 text-[10px] font-semibold text-white">
            Analiz edildi
          </span>
        ) : null}
      </span>
      <CardCaption item={item} />
    </button>
  )
}

// Görsel döndürme (sola/sağa 90°): telefonla yan çekilmiş sorular için. Açı soru başına tarayıcıda
// hatırlanır (yalnızca görüntüleme; asıl fotoğraf değişmez).
const ROTATION_STORAGE_KEY = 'mistake-analysis-rotations'

function readRotations() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ROTATION_STORAGE_KEY) || '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeRotations(rotations) {
  try {
    window.localStorage.setItem(ROTATION_STORAGE_KEY, JSON.stringify(rotations))
  } catch {
    // depolama kapalıysa yalnızca bu oturumda geçerli
  }
}

// Döndürülmüş görseli kutuya sığdırır (90/270°'de en-boy yer değiştirir); zoomed iken gerçek
// boyutunda, kaydırılabilir alanda gösterir.
function RotatableImage({ src, alt, rotation, zoomed, onToggleZoom, onError }) {
  const containerRef = useRef(null)
  const [box, setBox] = useState({ width: 0, height: 0 })
  const [natural, setNatural] = useState(null)

  useEffect(() => {
    const element = containerRef.current
    if (!element) return undefined
    const update = () => setBox({ width: element.clientWidth, height: element.clientHeight })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const sideways = rotation % 180 !== 0
  let layout = null
  if (natural && box.width && box.height) {
    const rotatedWidth = sideways ? natural.height : natural.width
    const rotatedHeight = sideways ? natural.width : natural.height
    const scale = zoomed ? 1 : Math.min(box.width / rotatedWidth, box.height / rotatedHeight, 2)
    layout = {
      frameWidth: rotatedWidth * scale,
      frameHeight: rotatedHeight * scale,
      imageWidth: natural.width * scale,
      imageHeight: natural.height * scale,
    }
  }

  return (
    <div
      ref={containerRef}
      className={`min-h-0 flex-1 px-2 pb-2 ${zoomed ? 'overflow-auto' : 'flex items-center justify-center overflow-hidden'}`}
    >
      <div
        className="relative mx-auto shrink-0"
        style={layout ? { width: layout.frameWidth, height: layout.frameHeight } : { width: '100%', height: '100%' }}
      >
        <img
          src={src}
          alt={alt}
          onClick={onToggleZoom}
          onError={onError}
          onLoad={(event) =>
            setNatural({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })
          }
          className={`absolute left-1/2 top-1/2 max-w-none rounded-lg bg-white transition-transform duration-200 ${
            zoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'
          } ${layout ? '' : 'opacity-0'}`}
          style={{
            width: layout?.imageWidth,
            height: layout?.imageHeight,
            transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
          }}
        />
      </div>
    </div>
  )
}

function SlideViewer({
  items,
  queueIds,
  startIndex,
  folder,
  drafts,
  setDraft,
  topicSuggestions,
  onSave,
  onUndo,
  onPhotoError,
  onSaveRotation,
  onClose,
}) {
  const [index, setIndex] = useState(startIndex)
  const [zoomed, setZoomed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [flash, setFlash] = useState('')
  const [rotations, setRotations] = useState(readRotations)
  const [savingRotation, setSavingRotation] = useState(false)

  const itemsById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])
  const queue = useMemo(() => queueIds.map((id) => itemsById.get(id)).filter(Boolean), [queueIds, itemsById])
  const current = queue[index]
  const remainingPending = queue.filter((item) => !item.myAnalysis).length

  const draft = current
    ? drafts[current.id] || {
        questionTopic: current.myAnalysis?.questionTopic || '',
        note: current.myAnalysis?.note || '',
        mistakeReason: current.myAnalysis?.mistakeReason || '',
      }
    : null

  const goTo = useCallback(
    (nextIndex) => {
      if (!queue.length) return
      setIndex(Math.min(Math.max(nextIndex, 0), queue.length - 1))
      setZoomed(false)
      setError('')
    },
    [queue.length],
  )

  const rotate = useCallback((id, delta) => {
    setRotations((prev) => {
      const nextAngle = (((prev[id] || 0) + delta) % 360 + 360) % 360
      const next = { ...prev }
      if (nextAngle) next[id] = nextAngle
      else delete next[id]
      writeRotations(next)
      return next
    })
  }, [])

  const clearRotation = useCallback((id) => {
    setRotations((prev) => {
      if (!prev[id]) return prev
      const next = { ...prev }
      delete next[id]
      writeRotations(next)
      return next
    })
  }, [])

  useEffect(() => {
    if (!flash) return undefined
    const timer = setTimeout(() => setFlash(''), 2500)
    return () => clearTimeout(timer)
  }, [flash])

  // Sıradaki görselleri önceden indir — slayt geçişi beklemesin (tarayıcı önbelleğine düşer).
  const prefetchedRef = useRef(new Set())
  useEffect(() => {
    for (let offset = -1; offset <= PREFETCH_AHEAD; offset += 1) {
      const url = queue[index + offset]?.photoUrl
      if (offset === 0 || !url || prefetchedRef.current.has(url)) continue
      prefetchedRef.current.add(url)
      const image = new Image()
      image.decoding = 'async'
      image.src = url
    }
  }, [index, queue])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (isEditableTarget(event.target)) return
      if (event.key === 'ArrowLeft') goTo(index - 1)
      else if (event.key === 'ArrowRight') goTo(index + 1)
      else if ((event.key === 'r' || event.key === 'R') && queue[index]) rotate(queue[index].id, event.shiftKey ? -90 : 90)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goTo, index, onClose, queue, rotate])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  if (!current) {
    return null
  }

  const canSave = Boolean(draft.questionTopic.trim() || draft.note.trim())
  const isDone = Boolean(current.myAnalysis)

  const handleSave = async () => {
    if (!canSave || saving) return
    setSaving(true)
    setError('')
    try {
      await onSave(current, draft)
      if (!isDone) {
        // Sıradaki analiz edilmemiş soruya geç (kuyruğun sonundaysa baştan ara).
        const order = [...queue.slice(index + 1), ...queue.slice(0, index)]
        const next = order.find((item) => !item.myAnalysis)
        setFlash('Analiz yapılanlara eklendi')
        if (next) goTo(queue.indexOf(next))
      } else {
        setFlash('Analiz güncellendi')
      }
    } catch (err) {
      setError(err.message || 'Analiz kaydedilemedi.')
    } finally {
      setSaving(false)
    }
  }

  const handleUndo = async () => {
    if (saving) return
    setSaving(true)
    setError('')
    try {
      await onUndo(current)
      setFlash('Analiz edilecek hatalara geri alındı')
    } catch (err) {
      setError(err.message || 'Analiz geri alınamadı.')
    } finally {
      setSaving(false)
    }
  }

  const allDone = folder === 'pending' && remainingPending === 0
  const currentRotation = rotations[current.id] || 0

  // Döndürmeyi asıl fotoğrafa kalıcı yazar: öğrencinin Hata Defteri ve Hata Analizlerim'inde de düz görünür.
  const handleSaveRotation = async () => {
    if (!currentRotation || savingRotation) return
    setSavingRotation(true)
    setError('')
    try {
      await onSaveRotation(current, currentRotation)
      clearRotation(current.id)
      setFlash('Fotoğraf döndürülmüş haliyle kaydedildi')
    } catch (err) {
      setError(err.message || 'Döndürülen fotoğraf kaydedilemedi.')
    } finally {
      setSavingRotation(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-panel-text" role="dialog" aria-modal="true" aria-label="Hata analizi">
      <div
        className="flex shrink-0 items-center justify-between gap-3 px-4 pb-2"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-white">
            {sourceLabel(current)} · {questionLabel(current)}
          </h2>
          <p className="truncate text-xs text-white/70">
            {current.errorDate ? `${formatErrorDate(current.errorDate)} · ` : ''}
            {index + 1} / {queue.length}
            {folder === 'pending' ? ` · ${remainingPending} soru analiz bekliyor` : ' · Analiz yapılanlar'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => rotate(current.id, -90)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label="Sola döndür"
            title="Sola döndür (Shift+R)"
          >
            <RotateCcw size={18} />
          </button>
          <button
            type="button"
            onClick={() => rotate(current.id, 90)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label="Sağa döndür"
            title="Sağa döndür (R)"
          >
            <RotateCw size={18} />
          </button>
          {currentRotation ? (
            <button
              type="button"
              onClick={handleSaveRotation}
              disabled={savingRotation}
              className="flex h-9 items-center gap-1.5 rounded-full bg-white px-3 text-xs font-semibold text-panel-text hover:bg-white/90 disabled:opacity-60"
              title="Döndürülmüş hali asıl fotoğraf olarak kaydet (öğrenci de düz görür)"
            >
              {savingRotation ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              <span className="hidden sm:inline">Döndürmeyi kaydet</span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setZoomed((value) => !value)}
            className="hidden h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 sm:flex"
            aria-label={zoomed ? 'Sığdır' : 'Büyüt'}
            title={zoomed ? 'Sığdır' : 'Büyüt'}
          >
            {zoomed ? <ZoomOut size={18} /> : <ZoomIn size={18} />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label="Kapat"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative flex min-h-0 flex-1 items-stretch">
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            disabled={index === 0}
            className="absolute left-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 disabled:opacity-30"
            aria-label="Önceki soru"
          >
            <ChevronLeft size={24} />
          </button>
          {current.photoUrl ? (
            <RotatableImage
              key={current.photoUrl}
              src={current.photoUrl}
              alt={questionLabel(current)}
              rotation={currentRotation}
              zoomed={zoomed}
              onToggleZoom={() => setZoomed((value) => !value)}
              onError={() => onPhotoError(current.id)}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-white/70">Fotoğraf yüklenemedi.</p>
            </div>
          )}
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            disabled={index >= queue.length - 1}
            className="absolute right-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 disabled:opacity-30"
            aria-label="Sonraki soru"
          >
            <ChevronRight size={24} />
          </button>
        </div>

        <aside
          className="flex max-h-[48vh] shrink-0 flex-col overflow-y-auto bg-panel-surface lg:max-h-none lg:w-[380px]"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="flex flex-col gap-4 p-4">
            {allDone ? (
              <div className="flex items-center gap-2 rounded-xl bg-panel-green-soft px-3 py-2 text-sm font-semibold text-panel-green">
                <CheckCircle2 size={18} aria-hidden="true" /> Bu klasördeki tüm hatalar analiz edildi.
              </div>
            ) : null}

            <div className="flex flex-wrap gap-1.5 text-[11px]">
              {current.topic ? (
                <span className="rounded-full bg-panel-surface-soft px-2 py-0.5 text-panel-text-muted">Kaynak konusu: {current.topic}</span>
              ) : null}
              {current.correctAnswer ? (
                <span className="rounded-full bg-panel-blue-soft px-2 py-0.5 font-semibold text-panel-blue">
                  Doğru cevap: {current.correctAnswer}
                </span>
              ) : null}
              {isDone ? (
                <span className="rounded-full bg-panel-green-soft px-2 py-0.5 font-semibold text-panel-green">Analiz yapıldı</span>
              ) : null}
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-panel-text">Sorunun konusu</span>
              <input
                type="text"
                list="mistake-analysis-topic-suggestions"
                value={draft.questionTopic}
                maxLength={200}
                onChange={(event) => setDraft(current.id, { ...draft, questionTopic: event.target.value })}
                placeholder="Ör. Basınç — sıvı basıncı"
                className="h-10 rounded-xl border border-panel-border bg-panel-surface px-3 text-sm text-panel-text outline-none focus:border-panel-blue"
              />
              <datalist id="mistake-analysis-topic-suggestions">
                {topicSuggestions.map((topic) => (
                  <option key={topic} value={topic} />
                ))}
              </datalist>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-panel-text">Dikkat edilmesi gereken</span>
              <textarea
                value={draft.note}
                maxLength={1000}
                rows={5}
                onChange={(event) => setDraft(current.id, { ...draft, note: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault()
                    handleSave()
                  }
                }}
                placeholder="Bu tip sorularda nelere dikkat etmeli?"
                className="resize-y rounded-xl border border-panel-border bg-panel-surface px-3 py-2 text-sm text-panel-text outline-none focus:border-panel-blue"
              />
            </label>

            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-panel-text">
                Hata nedeni <span className="font-normal text-panel-text-muted">(isteğe bağlı)</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(MISTAKE_REASON_LABELS).map(([value, label]) => {
                  const selected = draft.mistakeReason === value
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setDraft(current.id, { ...draft, mistakeReason: selected ? '' : value })}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        selected
                          ? 'border-panel-blue bg-panel-blue text-white'
                          : 'border-panel-border bg-panel-surface text-panel-text-muted hover:text-panel-text'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            {error ? <p className="rounded-lg bg-panel-red-soft px-3 py-2 text-xs text-panel-red">{error}</p> : null}
            {flash && !error ? (
              <p className="rounded-lg bg-panel-green-soft px-3 py-2 text-xs font-semibold text-panel-green" role="status">
                {flash}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSave} disabled={!canSave || saving} className="flex-1">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                {isDone ? 'Analizi güncelle' : 'Analiz yapıldı'}
              </Button>
              {isDone ? (
                <Button variant="secondary" onClick={handleUndo} disabled={saving} title="Analiz edilecek hatalara geri al">
                  <RotateCcw size={16} /> Geri al
                </Button>
              ) : null}
            </div>
            <p className="-mt-2 text-[11px] text-panel-text-muted">Kısayollar: ← → soru değiştir · R / Shift+R döndür · Ctrl/⌘+Enter kaydet · Esc kapat</p>

            {current.otherComments?.length ? (
              <div className="flex flex-col gap-2 border-t border-panel-border pt-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-panel-text-muted">Önceki yorumlar</span>
                <AnalysisCommentFeed comments={current.otherComments} />
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  )
}

export default function MistakeAnalysisSessionPage() {
  const { studentTeacherId } = useParams()
  const [session, setSession] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [folder, setFolder] = useState('pending')
  const [source, setSource] = useState(ALL_SOURCES)
  const [viewer, setViewer] = useState(null) // { queueIds, startIndex, folder }
  const [drafts, setDrafts] = useState({})
  const refreshingRef = useRef(false)

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (refreshingRef.current) return
      refreshingRef.current = true
      try {
        const data = await getTeacherMistakeAnalysisSession(studentTeacherId)
        setSession(data)
        setLoadError('')
      } catch (err) {
        if (!silent) setLoadError(err.message || 'Hata analizi oturumu yüklenemedi.')
      } finally {
        refreshingRef.current = false
      }
    },
    [studentTeacherId],
  )

  useEffect(() => {
    load()
  }, [load])

  // Fotoğraf adreslerinin süresi dolmadan önce sessizce yenile (sunucu kaydedilenlerin doğrusu).
  useEffect(() => {
    const timer = setInterval(() => load({ silent: true }), PHOTO_URL_REFRESH_MS)
    return () => clearInterval(timer)
  }, [load])

  const failedPhotoIdsRef = useRef(new Set())
  const handlePhotoError = useCallback(
    (id) => {
      if (failedPhotoIdsRef.current.has(id)) return
      failedPhotoIdsRef.current.add(id)
      load({ silent: true })
    },
    [load],
  )

  const items = useMemo(() => session?.items || [], [session])
  const pendingItems = useMemo(() => items.filter((item) => !item.myAnalysis), [items])
  const doneItems = useMemo(
    () =>
      items
        .filter((item) => item.myAnalysis)
        .sort((a, b) => new Date(b.myAnalysis.updatedAt || b.myAnalysis.createdAt) - new Date(a.myAnalysis.updatedAt || a.myAnalysis.createdAt)),
    [items],
  )
  const folderItems = folder === 'pending' ? pendingItems : doneItems

  const sources = useMemo(() => {
    const counts = new Map()
    folderItems.forEach((item) => counts.set(sourceLabel(item), (counts.get(sourceLabel(item)) || 0) + 1))
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0], 'tr'))
  }, [folderItems])

  useEffect(() => {
    if (source !== ALL_SOURCES && !sources.some(([name]) => name === source)) setSource(ALL_SOURCES)
  }, [source, sources])

  const visibleItems = useMemo(
    () => (source === ALL_SOURCES ? folderItems : folderItems.filter((item) => sourceLabel(item) === source)),
    [folderItems, source],
  )

  const topicSuggestions = useMemo(() => {
    const set = new Set()
    items.forEach((item) => {
      if (item.myAnalysis?.questionTopic) set.add(item.myAnalysis.questionTopic)
      if (item.topic) set.add(item.topic)
    })
    return [...set].sort((a, b) => a.localeCompare(b, 'tr'))
  }, [items])

  const setDraft = useCallback((id, value) => setDrafts((prev) => ({ ...prev, [id]: value })), [])

  const replaceItem = useCallback((id, patch) => {
    setSession((prev) =>
      prev ? { ...prev, items: prev.items.map((item) => (item.id === id ? { ...item, ...patch } : item)) } : prev,
    )
  }, [])

  const clearDraft = useCallback((id) => {
    setDrafts((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  const handleSave = useCallback(
    async (item, draft) => {
      const payload = {
        questionTopic: draft.questionTopic.trim(),
        note: draft.note.trim(),
        mistakeReason: draft.mistakeReason || null,
      }
      const analysis = item.myAnalysis
        ? await updateTeacherMistakeAnalysis(studentTeacherId, item.id, item.myAnalysis.id, payload)
        : await createTeacherMistakeAnalysis(studentTeacherId, item.id, payload)
      replaceItem(item.id, { myAnalysis: analysis })
      clearDraft(item.id)
    },
    [studentTeacherId, replaceItem, clearDraft],
  )

  const handleSaveRotation = useCallback(
    async (item, degrees) => {
      const dataUrl = await rotateImageToDataUrl(item.photoUrl, degrees)
      const updated = await updateTeacherStudentWrongQuestionPhoto(studentTeacherId, item.id, dataUrl)
      if (updated?.photoUrl) replaceItem(item.id, { photoUrl: updated.photoUrl })
      else await load({ silent: true })
    },
    [studentTeacherId, replaceItem, load],
  )

  const handleUndo = useCallback(
    async (item) => {
      if (!item.myAnalysis) return
      await deleteTeacherMistakeAnalysis(studentTeacherId, item.id, item.myAnalysis.id)
      // Yazılanlar kaybolmasın: geri alınan analiz taslak olarak formda kalır.
      setDraft(item.id, {
        questionTopic: item.myAnalysis.questionTopic || '',
        note: item.myAnalysis.note || '',
        mistakeReason: item.myAnalysis.mistakeReason || '',
      })
      replaceItem(item.id, { myAnalysis: null })
    },
    [studentTeacherId, replaceItem, setDraft],
  )

  const openViewer = (startIndex = 0) => {
    if (!visibleItems.length) return
    setViewer({ queueIds: visibleItems.map((item) => item.id), startIndex, folder })
  }

  if (loadError && !session) {
    return (
      <div className="flex flex-col gap-4">
        <Link to={`/teacher/students/${studentTeacherId}`} className="inline-flex items-center gap-1 text-sm text-panel-text-muted hover:text-panel-text">
          <ArrowLeft size={16} /> Öğrenci sayfası
        </Link>
        <EmptyState title="Hata analizi açılamadı" description={loadError} action={<Button onClick={() => load()}>Tekrar dene</Button>} />
      </div>
    )
  }

  if (!session) {
    return <LoadingState label="Hatalar yükleniyor..." />
  }

  const total = items.length
  const doneCount = doneItems.length
  const percent = total ? Math.round((doneCount / total) * 100) : 0

  return (
    <div className="flex flex-col gap-5">
      <Link to={`/teacher/students/${studentTeacherId}`} className="inline-flex w-fit items-center gap-1 text-sm text-panel-text-muted hover:text-panel-text">
        <ArrowLeft size={16} /> Öğrenci sayfası
      </Link>
      <PageHeader
        title={`${String(session.studentFullName || '').trim().split(/\s+/)[0] || 'Öğrenci'} Hata Defteri`}
        subtitle={`${session.studentFullName} · ${session.subjectName} — tüm hatalar`}
        actions={
          <Button onClick={() => openViewer(0)} disabled={!visibleItems.length}>
            <Play size={16} /> {folder === 'pending' ? 'Analize başla' : 'Slaytı aç'}
          </Button>
        }
      />

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs text-panel-text-muted">
          <span>
            {doneCount} / {total} hata analiz edildi
          </span>
          <span className="font-semibold text-panel-text">%{percent}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-panel-surface-soft">
          <div className="h-full rounded-full bg-panel-green transition-[width]" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <FolderCard
          active={folder === 'pending'}
          icon={FolderOpen}
          title="Analiz edilecek hatalar"
          count={pendingItems.length}
          hint="Slayt olarak açıp analiz edin"
          onClick={() => setFolder('pending')}
        />
        <FolderCard
          active={folder === 'done'}
          icon={FolderCheck}
          tone="done"
          title="Analiz yapılanlar"
          count={doneItems.length}
          hint="Öğrenci Hata Analizlerim'de görür"
          onClick={() => setFolder('done')}
        />
      </div>

      {sources.length > 1 ? (
        <label className="flex flex-wrap items-center gap-2 text-sm text-panel-text-muted">
          Kaynak
          <select
            value={source}
            onChange={(event) => setSource(event.target.value)}
            className="h-9 min-w-0 max-w-full rounded-xl border border-panel-border bg-panel-surface px-3 text-sm text-panel-text"
          >
            <option value={ALL_SOURCES}>Tüm kaynaklar ({folderItems.length})</option>
            {sources.map(([name, count]) => (
              <option key={name} value={name}>
                {name} ({count})
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {visibleItems.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visibleItems.map((item, index) => (
            <Thumbnail key={item.id} item={item} onOpen={() => openViewer(index)} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={folder === 'pending' ? CheckCircle2 : FolderCheck}
          title={folder === 'pending' ? 'Analiz edilecek hata kalmadı' : 'Henüz analiz yapılmadı'}
          description={
            folder === 'pending'
              ? 'Tüm hatalar analiz edildi. "Analiz yapılanlar" klasöründen inceleyebilirsiniz.'
              : '"Analiz edilecek hatalar" klasöründen bir soru açıp "Analiz yapıldı" deyin.'
          }
        />
      )}

      {viewer ? (
        <SlideViewer
          items={items}
          queueIds={viewer.queueIds}
          startIndex={viewer.startIndex}
          folder={viewer.folder}
          drafts={drafts}
          setDraft={setDraft}
          topicSuggestions={topicSuggestions}
          onSave={handleSave}
          onUndo={handleUndo}
          onPhotoError={handlePhotoError}
          onSaveRotation={handleSaveRotation}
          onClose={() => setViewer(null)}
        />
      ) : null}
    </div>
  )
}
