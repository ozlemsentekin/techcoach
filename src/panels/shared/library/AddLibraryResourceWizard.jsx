import { useEffect, useId, useRef, useState } from 'react'
import { Camera, ClipboardList, Eye, Info, Loader2, Plus, Sparkles, Trash2, UploadCloud, X } from 'lucide-react'
import { authRequest } from '../../../services/authClient'
import Button from '../../ui/Button'
import ResourceImageField from '../../parent/components/ResourceImageField'
import { WizardSteps } from '../../parent/components/StudentWizardShared'
import { libraryApiBase, RESOURCE_TYPE_LABELS, RESOURCE_WIZARD_STEPS } from './libraryConstants'

// Claude görselleri dahili olarak ~1568px'e küçültüyor; bunun üzerini göndermek sadece
// yükleme boyutunu ve işlem süresini artırır, kaliteyi artırmaz.
const TOC_MAX_DIMENSION = 1568
const TOC_JPEG_QUALITY = 0.82
const TOC_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const TOC_MAX_UPLOAD_BYTES = 8 * 1024 * 1024
const TOC_MAX_IMAGES = 8

const BARCODE_MIN_LENGTH = 4
const BARCODE_MAX_LENGTH = 50
const PUBLISH_YEAR_MIN = 1900

function validateBarcode(value) {
  const barcode = value.trim()
  if (!barcode) return 'Barkod kodu girilmeli.'
  if (barcode.length < BARCODE_MIN_LENGTH || barcode.length > BARCODE_MAX_LENGTH) {
    return `Barkod kodu ${BARCODE_MIN_LENGTH}-${BARCODE_MAX_LENGTH} karakter arasında olmalı.`
  }
  if (!/^\d+$/.test(barcode)) return 'Barkod kodu sadece rakamlardan oluşmalı.'
  return ''
}

function validatePublishYear(value) {
  const currentYear = new Date().getFullYear()
  const year = Number(value)
  if (!value || !Number.isInteger(year) || year < PUBLISH_YEAR_MIN || year > currentYear + 1) {
    return 'Basım yılı geçerli bir yıl olmalı.'
  }
  return ''
}

function useLocalId() {
  const counter = useRef(0)
  return () => {
    counter.current += 1
    return `local-${counter.current}`
  }
}

function emptyTest(nextId) {
  return { id: nextId(), topicName: '', name: '', pageStart: '', pageEnd: '', questionCount: '', answerKey: [] }
}

function emptyTopic(nextId) {
  return { id: nextId(), name: '', tests: [emptyTest(nextId)] }
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Görsel okunamadı.'))
    image.src = src
  })
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('Dosya okunamadı.'))
    reader.readAsDataURL(file)
  })
}

// Fihrist fotoğraflarını kırpmadan (kare değil) makul bir boyuta küçültür; metin okunaklı kalır,
// yükleme boyutu ise birden fazla sayfa gönderildiğinde makul kalır.
async function resizeTocImage(file) {
  if (!TOC_ACCEPTED_TYPES.includes(file.type)) {
    throw new Error('JPG, PNG veya WEBP görsel seçin.')
  }
  if (file.size > TOC_MAX_UPLOAD_BYTES) {
    throw new Error('Görsel en fazla 8 MB olabilir.')
  }

  const sourceUrl = await readFileAsDataUrl(file)
  const image = await loadImageElement(sourceUrl)
  const width = image.naturalWidth || image.width
  const height = image.naturalHeight || image.height
  const scale = Math.min(1, TOC_MAX_DIMENSION / Math.max(width, height))
  const outWidth = Math.round(width * scale)
  const outHeight = Math.round(height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = outWidth
  canvas.height = outHeight
  const context = canvas.getContext('2d')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, outWidth, outHeight)
  context.drawImage(image, 0, 0, outWidth, outHeight)

  return canvas.toDataURL('image/jpeg', TOC_JPEG_QUALITY)
}

const EXTRACTION_POLL_INTERVAL_MS = 2500
const EXTRACTION_POLL_MAX_ATTEMPTS = 96 // ~4 dakika üst sınır

// AI çıkarma istekleri (kapak/içindekiler/cevap anahtarı) tek bir HTTP isteğinde beklenemeyecek
// kadar uzun sürebiliyor (gözlemlenen: 60sn-4dk arası). Backend bu yüzden isteği hemen bir
// "jobId" ile yanıtlayıp işi arka planda yürütüyor; burada iş bitene kadar kısa aralıklarla
// durumu sorguluyoruz. Böylece tarayıcı bağlantısı uzun süre açık tutulmuyor.
async function pollExtractionJob(apiBase, jobId) {
  for (let attempt = 0; attempt < EXTRACTION_POLL_MAX_ATTEMPTS; attempt += 1) {
    const data = await authRequest(`${apiBase}/library/resource-books/extraction-jobs/${jobId}`, {
      method: 'GET',
      timeoutMs: 15000,
    })
    if (data.status === 'done') return data
    if (data.status === 'error') throw new Error(data.error || 'İşlem başarısız oldu.')
    await new Promise((resolve) => setTimeout(resolve, EXTRACTION_POLL_INTERVAL_MS))
  }
  throw new Error('İşlem zaman aşımına uğradı. Lütfen tekrar deneyin.')
}

// Fihristte genelde sadece başlangıç sayfası yazar; bitiş sayfası açık değilse bir sonraki
// testin başlangıcından çıkarım yapılır (aynı kitap boyunca kümülatif sayfa akışı varsayımıyla).
function applyExtractedTopics(rawTopics, nextId) {
  const flatTests = []
  rawTopics.forEach((topic, topicIndex) => {
    topic.tests.forEach((test, testIndex) => flatTests.push({ topicIndex, testIndex, test }))
  })
  flatTests.forEach((entry, i) => {
    if (entry.test.pageEnd == null && entry.test.pageStart != null) {
      const next = flatTests[i + 1]
      if (next && next.test.pageStart != null && next.test.pageStart > entry.test.pageStart) {
        entry.test.pageEnd = next.test.pageStart - 1
      }
    }
  })

  return rawTopics.map((topic) => ({
    id: nextId(),
    name: topic.name,
    tests: topic.tests.map((test) => ({
      id: nextId(),
      topicName: test.topicName,
      name: test.name,
      pageStart: Number.isInteger(test.pageStart) ? String(test.pageStart) : '',
      pageEnd: Number.isInteger(test.pageEnd) ? String(test.pageEnd) : '',
      questionCount: '',
      answerKey: [],
    })),
  }))
}

// Kaynak ekleme sihirbazının içerikler adımından (soru sayısı/test adı/sayfa aralığı) bir
// sonraki adıma geçmeden önce ve son gönderimde paylaşılan doğrulama.
function validateTopics(topics) {
  for (const topic of topics) {
    if (topic.name.trim().length < 2) {
      return 'Her içeriğin adı en az 2 karakter olmalı.'
    }
    if (!topic.tests.length) {
      return `"${topic.name}" içeriğine en az bir test eklenmeli.`
    }
    for (const test of topic.tests) {
      if (test.topicName.trim().length < 2 || test.name.trim().length < 2) {
        return 'Test konusu ve adı en az 2 karakter olmalı.'
      }
      const pageStart = Number(test.pageStart)
      if (!Number.isInteger(pageStart) || pageStart <= 0) {
        return 'Başlangıç sayfası pozitif bir tam sayı olmalı.'
      }
      const pageEnd = Number(test.pageEnd)
      if (!Number.isInteger(pageEnd) || pageEnd < pageStart) {
        return 'Bitiş sayfası başlangıç sayfasından küçük olamaz.'
      }
      const questionCount = Number(test.questionCount)
      if (!Number.isInteger(questionCount) || questionCount <= 0) {
        return 'Soru sayısı pozitif bir tam sayı olmalı.'
      }
    }
  }
  return ''
}

function PhotoUploadStep({
  images,
  setImages,
  error,
  setError,
  altPrefix,
  inputLabel,
  inputHint,
  extracting,
  extractingLabel,
  idleHint,
  guidanceTitle,
  guidanceItems,
}) {
  const inputId = useId()

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || [])
    if (!files.length) return
    if (images.length + files.length > TOC_MAX_IMAGES) {
      setError(`En fazla ${TOC_MAX_IMAGES} fotoğraf yükleyebilirsiniz.`)
      return
    }
    setError('')
    try {
      const resized = await Promise.all(
        files.map(async (file) => {
          const dataUrl = await resizeTocImage(file)
          return { id: `${Date.now()}-${Math.random()}`, dataUrl, mediaType: 'image/jpeg' }
        }),
      )
      setImages((current) => [...current, ...resized])
    } catch (err) {
      setError(err.message || 'Görsel yüklenemedi.')
    }
  }

  const removeImage = (id) => setImages((current) => current.filter((image) => image.id !== id))

  return (
    <div className="flex flex-col gap-4">
      {guidanceItems?.length ? (
        <div className="flex gap-2.5 rounded-xl bg-panel-blue-soft p-3 text-panel-blue">
          <Info size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            {guidanceTitle ? <p className="text-sm font-semibold">{guidanceTitle}</p> : null}
            <ul className="list-disc space-y-0.5 pl-4 text-xs">
              {guidanceItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-dashed border-panel-border bg-panel-surface-soft p-4 text-center">
        <label
          htmlFor={inputId}
          className="mx-auto flex w-fit cursor-pointer flex-col items-center gap-2 text-panel-blue"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-panel-blue-soft">
            <Camera size={18} aria-hidden="true" />
          </span>
          <span className="text-sm font-medium">{inputLabel}</span>
          <span className="text-xs text-panel-text-muted">{inputHint}</span>
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(event) => {
            handleFiles(event.target.files)
            event.target.value = ''
          }}
        />
      </div>

      {error ? <p className="text-sm text-panel-warm">{error}</p> : null}

      {images.length ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {images.map((image, index) => (
            <div key={image.id} className="group relative overflow-hidden rounded-lg border border-panel-border">
              <img loading="lazy" decoding="async" src={image.dataUrl} alt={`${altPrefix} ${index + 1}`} className="h-28 w-full object-cover" />
              <button
                type="button"
                aria-label="Fotoğrafı kaldır"
                onClick={() => removeImage(image.id)}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X size={13} aria-hidden="true" />
              </button>
              <span className="absolute bottom-1 left-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                {index + 1}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {extracting ? (
        <p className="flex items-center gap-1.5 text-sm font-medium text-panel-blue">
          <Sparkles size={14} className="animate-pulse" aria-hidden="true" />
          {extractingLabel}
        </p>
      ) : idleHint ? (
        <p className="text-xs text-panel-text-muted">{idleHint}</p>
      ) : null}
    </div>
  )
}

function AnswerKeyUploadButton({ onFiles, disabled, extracting }) {
  const inputId = useId()
  return (
    <>
      <label
        htmlFor={inputId}
        className={`flex h-8 items-center gap-1.5 rounded-full bg-panel-blue px-3 text-xs font-medium text-white hover:opacity-90 ${
          disabled ? 'pointer-events-none opacity-60' : 'cursor-pointer'
        }`}
      >
        <UploadCloud size={13} aria-hidden="true" />
        {extracting ? 'Okunuyor...' : 'Cevap Anahtarını Yükle'}
      </label>
      <input
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        disabled={disabled}
        className="hidden"
        onChange={(event) => {
          onFiles(event.target.files)
          event.target.value = ''
        }}
      />
    </>
  )
}

const ANSWER_KEY_LABELS = ['A', 'B', 'C', 'D']

// Admin panelindeki yayınevi > kaynak > test cevap anahtarı ekranıyla aynı ızgara tasarımı; farkı
// burada test henüz veritabanında oluşturulmadığı için cevaplar backend'e değil sihirbazın
// kendi state'ine (test.answerKey) kaydediliyor, kitap gönderiminde diğer bilgilerle birlikte gider.
function TestAnswerKeyModal({ test, onSave, onClose }) {
  const questionCount = Number(test.questionCount) || 0
  const [entries, setEntries] = useState(() => {
    const base = Array.isArray(test.answerKey) ? test.answerKey : []
    return Array.from({ length: questionCount }, (_, index) => base[index] || '')
  })

  const setLabel = (index, value) => setEntries((current) => current.map((entry, i) => (i === index ? value : entry)))
  const filledCount = entries.filter(Boolean).length

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-panel-border bg-white p-5 shadow-panel-1">
        <div className="mb-1 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-panel-text">Cevap Anahtarı</h3>
            <p className="text-xs text-panel-text-muted">
              {test.topicName ? `${test.topicName} · ` : ''}
              {test.name || 'Test'}
            </p>
          </div>
          <button type="button" aria-label="Kapat" onClick={onClose} className="shrink-0 text-panel-text-muted hover:text-panel-text">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <p className="mb-3 text-xs text-panel-text-muted">
          {filledCount}/{questionCount} sorunun cevabı girildi
        </p>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="grid grid-cols-3 gap-2.5 min-[380px]:grid-cols-4 sm:grid-cols-6">
            {entries.map((label, index) => (
              <label key={index} className="flex flex-col items-center gap-1">
                <span className="text-xs font-semibold text-panel-warm">{index + 1}</span>
                <select
                  value={label}
                  onChange={(event) => setLabel(index, event.target.value)}
                  className="w-full rounded-lg border border-panel-border p-1.5 text-center text-xs text-panel-text"
                >
                  <option value="">—</option>
                  {ANSWER_KEY_LABELS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2 border-t border-panel-border pt-4">
          <Button type="button" variant="secondary" size="md" onClick={onClose}>
            Vazgeç
          </Button>
          <Button type="button" size="md" onClick={() => onSave(entries)}>
            Kaydet
          </Button>
        </div>
      </div>
    </div>
  )
}

function TestRow({ test, canRemove, onUpdate, onRemove }) {
  const [showAnswerKey, setShowAnswerKey] = useState(false)
  const hasQuestionCount = Number(test.questionCount) > 0

  return (
    <div className="rounded-lg bg-panel-surface-soft p-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1.1fr_1.7fr_54px_54px_60px_28px_24px] sm:items-center">
        <input
          value={test.topicName}
          onChange={(event) => onUpdate({ topicName: event.target.value })}
          placeholder="Test konusu"
          className="col-span-2 rounded-lg border border-panel-border p-1.5 text-xs text-panel-text sm:col-span-1"
        />
        <input
          value={test.name}
          onChange={(event) => onUpdate({ name: event.target.value })}
          placeholder="Test adı"
          className="col-span-2 rounded-lg border border-panel-border p-1.5 text-xs text-panel-text sm:col-span-1"
        />
        <input
          type="number"
          min="1"
          value={test.pageStart}
          onChange={(event) => onUpdate({ pageStart: event.target.value })}
          placeholder="Başl."
          className="w-full rounded-lg border border-panel-border p-1.5 text-xs text-panel-text"
        />
        <input
          type="number"
          min="1"
          value={test.pageEnd}
          onChange={(event) => onUpdate({ pageEnd: event.target.value })}
          placeholder="Bit."
          className="w-full rounded-lg border border-panel-border p-1.5 text-xs text-panel-text"
        />
        <input
          type="number"
          min="1"
          value={test.questionCount}
          onChange={(event) => onUpdate({ questionCount: event.target.value })}
          placeholder="Soru"
          className="w-full rounded-lg border border-panel-blue bg-panel-blue-soft p-1.5 text-xs text-panel-text"
        />
        <button
          type="button"
          aria-label="Cevap anahtarını görüntüle/düzenle"
          title={hasQuestionCount ? 'Cevap anahtarını görüntüle/düzenle' : 'Cevap anahtarı girmeden önce soru sayısını yazın'}
          disabled={!hasQuestionCount}
          onClick={() => setShowAnswerKey(true)}
          className={`flex items-center justify-center rounded-lg border p-1.5 ${
            !hasQuestionCount
              ? 'cursor-not-allowed border-panel-border text-panel-text-muted opacity-40'
              : test.answerKey?.some(Boolean)
                ? 'border-panel-blue bg-panel-blue-soft text-panel-blue'
                : 'border-panel-border text-panel-text-muted hover:border-panel-blue hover:text-panel-blue'
          }`}
        >
          <ClipboardList size={14} aria-hidden="true" />
        </button>
        {canRemove ? (
          <button
            type="button"
            aria-label="Testi sil"
            onClick={onRemove}
            className="flex items-center justify-center rounded-lg text-panel-text-muted hover:text-panel-warm"
          >
            <Trash2 size={14} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {showAnswerKey && hasQuestionCount ? (
        <TestAnswerKeyModal
          test={test}
          onSave={(answerKey) => {
            onUpdate({ answerKey })
            setShowAnswerKey(false)
          }}
          onClose={() => setShowAnswerKey(false)}
        />
      ) : null}
    </div>
  )
}

function TopicAnswerKeyButton({ onFiles, disabled }) {
  const inputId = useId()
  return (
    <>
      <label
        htmlFor={inputId}
        aria-label="Bu bölüm için cevap anahtarı fotoğrafı ekle"
        title="Bu bölüm için cevap anahtarı fotoğrafı ekle"
        className={`flex shrink-0 items-center gap-1 rounded-full border border-panel-border px-2 py-1 text-[11px] font-medium text-panel-text-muted hover:border-panel-blue hover:text-panel-blue ${
          disabled ? 'pointer-events-none opacity-50' : 'cursor-pointer'
        }`}
      >
        <Camera size={12} aria-hidden="true" />
        Cevap Anahtarı Ekle
      </label>
      <input
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        disabled={disabled}
        className="hidden"
        onChange={(event) => {
          onFiles(event.target.files)
          event.target.value = ''
        }}
      />
    </>
  )
}

export default function AddLibraryResourceWizard({ role, grade, subjectId, subjectName, onClose, onSubmitted }) {
  const apiBase = libraryApiBase(role)
  const nextId = useLocalId()
  const submittingRef = useRef(false)

  const [step, setStep] = useState(1)
  const [resourceType, setResourceType] = useState('')
  const [name, setName] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [barcode, setBarcode] = useState('')
  const [publishYear, setPublishYear] = useState('')
  const [publishers, setPublishers] = useState(null)
  const [publisherId, setPublisherId] = useState('')
  const [useNewPublisher, setUseNewPublisher] = useState(false)
  const [newPublisherName, setNewPublisherName] = useState('')
  const [topics, setTopics] = useState(() => [emptyTopic(nextId)])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const [coverExtracting, setCoverExtracting] = useState(false)

  const [tocImages, setTocImages] = useState([])
  const [tocExtracting, setTocExtracting] = useState(false)
  const [tocError, setTocError] = useState('')

  const [answerKeyImages, setAnswerKeyImages] = useState([])
  const [answerKeyError, setAnswerKeyError] = useState('')
  const [answerKeyNotice, setAnswerKeyNotice] = useState('')
  const [answerKeyExtracting, setAnswerKeyExtracting] = useState(false)
  const [showAnswerKeyPreview, setShowAnswerKeyPreview] = useState(false)

  useEffect(() => {
    let ignore = false
    authRequest('/api/panel/publishers', { method: 'GET' })
      .then((data) => {
        if (!ignore) setPublishers(data.publishers)
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })
    return () => {
      ignore = true
    }
  }, [])

  const goToStep2 = async () => {
    if (!imageUrl) {
      setError('Kitap kapağının fotoğrafını ekleyin.')
      return
    }
    setError('')

    const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (match) {
      const [, mediaType, imageBase64] = match
      setCoverExtracting(true)
      try {
        const { jobId } = await authRequest(`${apiBase}/library/resource-books/extract-cover`, {
          method: 'POST',
          timeoutMs: 15000,
          body: JSON.stringify({ image: { imageBase64, mediaType } }),
        })
        const data = await pollExtractionJob(apiBase, jobId)
        if (data.name) setName((current) => current || data.name)
        if (data.barcode) setBarcode((current) => current || data.barcode)
        if (data.publishYear) setPublishYear((current) => current || String(data.publishYear))
        if (data.resourceType) setResourceType((current) => current || data.resourceType)
        if (data.publisherName) {
          const normalized = data.publisherName.toLocaleLowerCase('tr')
          const matchedPublisher = publishers?.find((publisher) => publisher.name.toLocaleLowerCase('tr') === normalized)
          if (matchedPublisher) {
            setPublisherId((current) => current || matchedPublisher.id)
          } else {
            setUseNewPublisher(true)
            setNewPublisherName((current) => current || data.publisherName)
          }
        }
      } catch {
        // Kapak otomatik okunamadı — kullanıcı bir sonraki adımda alanları elle doldurabilir.
      } finally {
        setCoverExtracting(false)
      }
    }

    setStep(2)
  }

  const goToStep3 = () => {
    if (!resourceType) {
      setError('Kaynak türü (Soru Bankası / Konu Anlatımlı Soru Bankası) seçilmeli.')
      return
    }
    if (name.trim().length < 2) {
      setError('Kaynak adı en az 2 karakter olmalı.')
      return
    }
    if (useNewPublisher ? newPublisherName.trim().length < 2 : !publisherId) {
      setError('Yayınevi seçilmeli veya en az 2 karakterli bir isim girilmeli.')
      return
    }
    const barcodeError = validateBarcode(barcode)
    if (barcodeError) {
      setError(barcodeError)
      return
    }
    const publishYearError = validatePublishYear(publishYear)
    if (publishYearError) {
      setError(publishYearError)
      return
    }
    setError('')
    setStep(3)
  }

  const goToStep4 = async () => {
    if (!tocImages.length) {
      setStep(4)
      return
    }

    setTocError('')
    setTocExtracting(true)
    try {
      const { jobId } = await authRequest(`${apiBase}/library/resource-books/extract-toc`, {
        method: 'POST',
        timeoutMs: 15000,
        body: JSON.stringify({
          images: tocImages.map((image) => ({
            imageBase64: image.dataUrl.split(',')[1] || '',
            mediaType: image.mediaType,
          })),
        }),
      })
      const data = await pollExtractionJob(apiBase, jobId)
      setTopics(applyExtractedTopics(data.topics, nextId))
      setStep(4)
    } catch (err) {
      setTocError(err.message)
    } finally {
      setTocExtracting(false)
    }
  }

  // Cevap anahtarından okunan test adlarını mevcut içerik/test satırlarıyla eşleştirip, henüz
  // soru sayısı girilmemiş satırları doldurur. Bölüm bazlı yüklemede (scopedTopicId) sadece test
  // adı yeterli; kitap geneli yüklemede aynı test adı farklı bölümlerde tekrar edebileceğinden
  // (Test 1, Test 2 gibi) yanlış eşleşmeyi önlemek için içerik adı da birebir uyuşmalı.
  const applyAnswerKeyMatches = (extractedTests, scopedTopicId) => {
    if (!extractedTests?.length) return 0
    let matchedCount = 0
    const nextTopics = topics.map((topic) => {
      if (scopedTopicId && topic.id !== scopedTopicId) return topic
      const normalizedTopicName = topic.name.trim().toLocaleLowerCase('tr')
      return {
        ...topic,
        tests: topic.tests.map((test) => {
          if (test.questionCount) return test
          const normalizedTestName = test.name.trim().toLocaleLowerCase('tr')
          if (!normalizedTestName) return test
          const match = extractedTests.find((entry) => {
            if (entry.testName.trim().toLocaleLowerCase('tr') !== normalizedTestName) return false
            if (scopedTopicId) return true
            const entryTopicName = (entry.topicName || '').trim().toLocaleLowerCase('tr')
            return Boolean(entryTopicName) && entryTopicName === normalizedTopicName
          })
          if (!match) return test
          matchedCount += 1
          return { ...test, questionCount: String(match.questionCount) }
        }),
      }
    })
    setTopics(nextTopics)
    return matchedCount
  }

  const handleAnswerKeyFiles = async (fileList, topicId = null) => {
    const files = Array.from(fileList || [])
    if (!files.length) return
    if (answerKeyImages.length + files.length > TOC_MAX_IMAGES) {
      setAnswerKeyError(`En fazla ${TOC_MAX_IMAGES} fotoğraf yükleyebilirsiniz.`)
      return
    }
    setAnswerKeyError('')
    setAnswerKeyNotice('')

    let resized
    try {
      resized = await Promise.all(
        files.map(async (file) => {
          const dataUrl = await resizeTocImage(file)
          return { id: `${Date.now()}-${Math.random()}`, dataUrl, mediaType: 'image/jpeg' }
        }),
      )
    } catch (err) {
      setAnswerKeyError(err.message || 'Görsel yüklenemedi.')
      return
    }
    setAnswerKeyImages((current) => [...current, ...resized])

    setAnswerKeyExtracting(true)
    try {
      const { jobId } = await authRequest(`${apiBase}/library/resource-books/extract-answer-key`, {
        method: 'POST',
        timeoutMs: 15000,
        body: JSON.stringify({
          images: resized.map((image) => ({
            imageBase64: image.dataUrl.split(',')[1] || '',
            mediaType: image.mediaType,
          })),
        }),
      })
      const data = await pollExtractionJob(apiBase, jobId)
      const matchedCount = applyAnswerKeyMatches(data.tests, topicId)
      setAnswerKeyNotice(
        matchedCount > 0
          ? `${matchedCount} testin soru sayısı cevap anahtarından otomatik dolduruldu.`
          : 'Cevap anahtarından otomatik eşleşen test bulunamadı, soru sayılarını elle girebilirsiniz.',
      )
    } catch (err) {
      setAnswerKeyError(err.message || 'Cevap anahtarı okunamadı.')
    } finally {
      setAnswerKeyExtracting(false)
    }
  }

  const removeAnswerKeyImage = (id) => setAnswerKeyImages((current) => current.filter((image) => image.id !== id))

  const updateTopic = (topicId, changes) => {
    setTopics((current) => current.map((topic) => (topic.id === topicId ? { ...topic, ...changes } : topic)))
  }

  const updateTest = (topicId, testId, changes) => {
    setTopics((current) =>
      current.map((topic) =>
        topic.id !== topicId
          ? topic
          : { ...topic, tests: topic.tests.map((test) => (test.id === testId ? { ...test, ...changes } : test)) },
      ),
    )
  }

  const addTopic = () => setTopics((current) => [...current, emptyTopic(nextId)])
  const removeTopic = (topicId) => setTopics((current) => current.filter((topic) => topic.id !== topicId))
  const addTest = (topicId) =>
    setTopics((current) =>
      current.map((topic) => (topic.id === topicId ? { ...topic, tests: [...topic.tests, emptyTest(nextId)] } : topic)),
    )
  const removeTest = (topicId, testId) =>
    setTopics((current) =>
      current.map((topic) =>
        topic.id !== topicId ? topic : { ...topic, tests: topic.tests.filter((test) => test.id !== testId) },
      ),
    )

  const handleSubmit = async () => {
    if (submittingRef.current) return

    const validationError = validateTopics(topics)
    if (validationError) {
      setError(validationError)
      return
    }

    submittingRef.current = true
    setError('')
    setSubmitting(true)
    try {
      await authRequest(`${apiBase}/library/resource-books`, {
        method: 'POST',
        body: JSON.stringify({
          grade,
          subjectId,
          resourceType,
          name: name.trim(),
          imageUrl: imageUrl.trim() || null,
          barcode: barcode.trim(),
          publishYear: Number(publishYear),
          publisherId: useNewPublisher ? null : publisherId,
          publisherName: useNewPublisher ? newPublisherName.trim() : null,
          topics: topics.map((topic) => ({
            name: topic.name.trim(),
            tests: topic.tests.map((test) => ({
              topicName: test.topicName.trim(),
              name: test.name.trim(),
              pageStart: Number(test.pageStart),
              pageEnd: Number(test.pageEnd),
              questionCount: Number(test.questionCount),
            })),
          })),
          answerKeyImages: answerKeyImages.map((image) => image.dataUrl),
        }),
      })
      setSubmitted(true)
    } catch (err) {
      setError(err.message)
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4">
        <div className="w-full max-w-md rounded-t-3xl border border-panel-border bg-panel-surface p-5 text-center shadow-panel-1 sm:rounded-2xl sm:p-6">
          <h2 className="text-lg font-bold text-panel-text">Kaydınız alındı</h2>
          <p className="mt-2 text-sm text-panel-text-muted">
            Kaynağınız admin onayından sonra herkese görünür olacak. Onay beklerken bile öğrencinize/çocuğunuza
            hemen atayabilirsiniz.
          </p>
          <Button type="button" className="mt-4 w-full" onClick={onSubmitted}>
            Tamam
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-stretch justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <div className="relative flex h-full w-full max-w-4xl flex-col overflow-hidden border border-panel-border bg-panel-surface shadow-panel-1 sm:h-[85vh] sm:max-h-[95vh] sm:rounded-2xl">
        {answerKeyExtracting || tocExtracting || coverExtracting ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/75 backdrop-blur-sm">
            <Loader2 size={40} className="animate-spin text-panel-blue" aria-hidden="true" />
            <p className="text-sm font-medium text-panel-text">
              {answerKeyExtracting
                ? 'Cevap anahtarı okunuyor, soru sayıları eşleştiriliyor...'
                : tocExtracting
                  ? 'Fotoğraflar okunuyor, içerik ve testler çıkarılıyor...'
                  : 'Kapak okunuyor, bilgiler dolduruluyor...'}
            </p>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-4 px-4 pb-3 pt-3 sm:px-6 sm:pb-3.5 sm:pt-4">
          <div>
            <h2 className="text-lg font-semibold text-panel-text">Kaynak Ekle</h2>
            <p className="text-xs text-panel-text-muted">
              {grade}. Sınıf {subjectName} dersine yeni kaynak ekliyorsunuz
            </p>
          </div>
          <button type="button" aria-label="Kapat" onClick={onClose} className="shrink-0">
            <X size={20} />
          </button>
        </div>

        <WizardSteps step={step} steps={RESOURCE_WIZARD_STEPS} />

        <div className="min-h-0 flex-1 overflow-y-auto border-t border-panel-border px-4 py-4 sm:px-6 sm:py-5">
          {error ? (
            <div className="mb-3 rounded-xl bg-panel-accent-soft px-3 py-2 text-sm text-panel-warm">{error}</div>
          ) : null}

          {step === 1 ? (
            <div className="flex flex-col items-center gap-4 py-2 text-center">
              <ResourceImageField value={imageUrl} onChange={setImageUrl} compact size={200} showUrlToggle fit="contain" />
              <p className="max-w-xs text-xs text-panel-text-muted">
                Kitabın ön kapağının net bir fotoğrafını yükleyin. Görsel otomatik olarak beyaz bir zemine
                yerleştirilir ve kapaktaki bilgiler (kitap adı, yayınevi vb.) bir sonraki adım için otomatik
                okunmaya çalışılır.
              </p>
            </div>
          ) : step === 2 ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-panel-text-muted">Kaynak Türü</span>
                <div className="flex gap-2">
                  {Object.entries(RESOURCE_TYPE_LABELS).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setResourceType(value)}
                      className={`flex-1 rounded-xl border p-2.5 text-sm font-medium transition-colors ${
                        resourceType === value
                          ? 'border-panel-blue bg-panel-blue-soft text-panel-blue'
                          : 'border-panel-border text-panel-text-muted hover:border-panel-blue'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-panel-text-muted">Kitap Adı</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
                  placeholder="Örn. 8. Sınıf Matematik Soru Bankası"
                />
              </label>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-panel-text-muted">Barkod Kodu</span>
                  <input
                    value={barcode}
                    onChange={(event) => setBarcode(event.target.value)}
                    maxLength={BARCODE_MAX_LENGTH}
                    className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
                    placeholder="Örn. KT-0001234"
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-panel-text-muted">Basım Yılı</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={PUBLISH_YEAR_MIN}
                    max={new Date().getFullYear() + 1}
                    value={publishYear}
                    onChange={(event) => setPublishYear(event.target.value)}
                    className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
                    placeholder="Örn. 2024"
                  />
                </label>
              </div>

              {!useNewPublisher ? (
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-panel-text-muted">Yayınevi</span>
                  <select
                    value={publisherId}
                    onChange={(event) => setPublisherId(event.target.value)}
                    className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
                  >
                    <option value="" disabled>
                      {publishers === null ? 'Yükleniyor...' : 'Yayınevi seçin'}
                    </option>
                    {publishers?.map((publisher) => (
                      <option key={publisher.id} value={publisher.id}>
                        {publisher.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setUseNewPublisher(true)}
                    className="w-fit text-xs font-medium text-panel-blue hover:underline"
                  >
                    Listede yok, yeni yayınevi ekle
                  </button>
                </label>
              ) : (
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-panel-text-muted">Yeni Yayınevi Adı</span>
                  <input
                    value={newPublisherName}
                    onChange={(event) => setNewPublisherName(event.target.value)}
                    className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
                    placeholder="Yayınevi adı"
                  />
                  <button
                    type="button"
                    onClick={() => setUseNewPublisher(false)}
                    className="w-fit text-xs font-medium text-panel-blue hover:underline"
                  >
                    Listeden seçmek istiyorum
                  </button>
                </label>
              )}
            </div>
          ) : step === 3 ? (
            <PhotoUploadStep
              images={tocImages}
              setImages={setTocImages}
              error={tocError}
              setError={setTocError}
              altPrefix="İçindekiler"
              inputLabel="Fihrist / İçindekiler Fotoğrafı Yükle"
              inputHint="Kitabın içindekiler sayfa(lar)ının fotoğrafını çekin veya seçin — birden fazla sayfa ekleyebilirsiniz."
              guidanceTitle="Nasıl bir fotoğraf çekmelisiniz?"
              guidanceItems={[
                'İçindekiler (fihrist) bölümü yakın planda, sayfanın tamamı kadrajda ve yazılar net okunabilir olsun.',
                'Bulanık, eğik açıdan veya parlama/gölge olan fotoğraflardan kaçının.',
                'İçindekiler birden fazla sayfaya yayılıyorsa her sayfayı ayrı ayrı, aynı özenle çekip tek tek ekleyin.',
              ]}
              idleHint={
                'Fotoğrafları yükledikten sonra "Devam Et" ile içerik başlıkları, test konuları, test adları ve sayfa ' +
                'numaraları otomatik okunmaya çalışılır; bir sonraki adımda okunan bilgileri düzenleyip soru sayılarını ' +
                'kolayca girebilirsiniz. Fotoğraf eklemeden de devam edip her şeyi elle girebilirsiniz.'
              }
            />
          ) : step === 4 ? (
            <div className="flex flex-col gap-4">
              <div className="rounded-xl border border-panel-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-panel-text">Cevap Anahtarı</p>
                    <p className="text-xs text-panel-text-muted">
                      Kitabın tüm cevap anahtarı fotoğraflarını buradan yükleyin — eşleşen testlerin soru sayısı
                      otomatik doldurulur. Birden fazla fotoğraf ekleyebilirsiniz.
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {answerKeyImages.length ? (
                      <button
                        type="button"
                        aria-label="Cevap anahtarı fotoğraflarını görüntüle/düzenle"
                        title="Cevap anahtarı fotoğraflarını görüntüle/düzenle"
                        onClick={() => setShowAnswerKeyPreview((current) => !current)}
                        className={`flex h-8 w-8 items-center justify-center rounded-full border ${
                          showAnswerKeyPreview
                            ? 'border-panel-blue bg-panel-blue-soft text-panel-blue'
                            : 'border-panel-border text-panel-text-muted hover:border-panel-blue hover:text-panel-blue'
                        }`}
                      >
                        <Eye size={15} aria-hidden="true" />
                      </button>
                    ) : null}
                    <AnswerKeyUploadButton onFiles={(files) => handleAnswerKeyFiles(files)} disabled={answerKeyExtracting} extracting={answerKeyExtracting} />
                  </div>
                </div>

                {answerKeyError ? <p className="mt-2 text-xs text-panel-warm">{answerKeyError}</p> : null}
                {!answerKeyExtracting && answerKeyNotice ? <p className="mt-2 text-xs text-panel-blue">{answerKeyNotice}</p> : null}

                {showAnswerKeyPreview && answerKeyImages.length ? (
                  <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {answerKeyImages.map((image, index) => (
                      <div key={image.id} className="group relative overflow-hidden rounded-lg border border-panel-border">
                        <img
                          loading="lazy"
                          decoding="async"
                          src={image.dataUrl}
                          alt={`Cevap anahtarı ${index + 1}`}
                          className="h-20 w-full object-cover"
                        />
                        <button
                          type="button"
                          aria-label="Fotoğrafı kaldır"
                          onClick={() => removeAnswerKeyImage(image.id)}
                          className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <X size={11} aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              {tocImages.length ? (
                <p className="rounded-lg bg-panel-blue-soft px-3 py-2 text-xs text-panel-blue">
                  İçindekiler fotoğraflarından okunabilenler önceden dolduruldu. Lütfen kontrol edip soru
                  sayılarını girin; gerekirse diğer alanları da düzenleyebilirsiniz.
                </p>
              ) : null}
              {topics.map((topic, topicIndex) => (
                <div key={topic.id} className="rounded-xl border border-panel-border p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <input
                      value={topic.name}
                      onChange={(event) => updateTopic(topic.id, { name: event.target.value })}
                      placeholder={`İçerik adı (örn. ${topicIndex + 1}. Ünite)`}
                      className="flex-1 rounded-xl border border-panel-border p-2 text-sm font-semibold text-panel-text"
                    />
                    <TopicAnswerKeyButton onFiles={(files) => handleAnswerKeyFiles(files, topic.id)} disabled={answerKeyExtracting} />
                    {topics.length > 1 ? (
                      <button
                        type="button"
                        aria-label="İçeriği sil"
                        onClick={() => removeTopic(topic.id)}
                        className="shrink-0 rounded-full p-1.5 text-panel-text-muted hover:bg-panel-accent-soft hover:text-panel-warm"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="hidden gap-2 px-2 text-[10px] font-semibold uppercase tracking-wide text-panel-text-muted sm:grid sm:grid-cols-[1.1fr_1.7fr_54px_54px_60px_28px_24px]">
                      <span>Test Konusu</span>
                      <span>Test Adı</span>
                      <span>Başl.</span>
                      <span>Bit.</span>
                      <span>Soru</span>
                      <span />
                      <span />
                    </div>
                    {topic.tests.map((test) => (
                      <TestRow
                        key={test.id}
                        test={test}
                        canRemove={topic.tests.length > 1}
                        onUpdate={(changes) => updateTest(topic.id, test.id, changes)}
                        onRemove={() => removeTest(topic.id, test.id)}
                      />
                    ))}
                    <button
                      type="button"
                      onClick={() => addTest(topic.id)}
                      className="inline-flex w-fit items-center gap-1 text-xs font-medium text-panel-blue hover:underline"
                    >
                      <Plus size={12} aria-hidden="true" />
                      Test Ekle
                    </button>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={addTopic}
                className="inline-flex w-fit items-center gap-1.5 rounded-xl border border-dashed border-panel-border px-3 py-2 text-sm font-medium text-panel-text-muted hover:border-panel-blue hover:text-panel-blue"
              >
                <Plus size={14} aria-hidden="true" />
                İçerik Ekle
              </button>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col items-stretch gap-2 border-t border-panel-border px-4 py-3 sm:flex-row sm:items-center sm:justify-end sm:px-6 sm:py-4">
          {step === 1 ? (
            <>
              <Button type="button" variant="secondary" size="md" onClick={onClose} disabled={coverExtracting}>
                Vazgeç
              </Button>
              <Button type="button" size="md" onClick={goToStep2} disabled={coverExtracting}>
                {coverExtracting ? 'Okunuyor...' : 'Devam Et'}
              </Button>
            </>
          ) : step === 2 ? (
            <>
              <Button type="button" variant="secondary" size="md" onClick={() => setStep(1)}>
                Geri
              </Button>
              <Button type="button" size="md" onClick={goToStep3}>
                Devam Et
              </Button>
            </>
          ) : step === 3 ? (
            <>
              <Button type="button" variant="secondary" size="md" onClick={() => setStep(2)} disabled={tocExtracting}>
                Geri
              </Button>
              <Button type="button" size="md" onClick={goToStep4} disabled={tocExtracting}>
                {tocExtracting ? 'Okunuyor...' : 'Devam Et'}
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="secondary" size="md" onClick={() => setStep(3)} disabled={submitting}>
                Geri
              </Button>
              <Button type="button" size="md" onClick={handleSubmit} disabled={submitting}>
                {submitting ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : null}
                {submitting ? 'Kaydediliyor...' : 'Kaydet ve Onaya Gönder'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
