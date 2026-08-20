import { useEffect, useId, useRef, useState } from 'react'
import { Camera, Plus, Sparkles, Trash2, X } from 'lucide-react'
import { authRequest } from '../../../services/authClient'
import Button from '../../ui/Button'
import ResourceImageField from '../../parent/components/ResourceImageField'
import { libraryApiBase, RESOURCE_SOURCE_LABELS } from './libraryConstants'

const TOC_MAX_DIMENSION = 1600
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
  if (/^\d+$/.test(barcode)) return 'Barkod kodu sadece rakamlardan oluşamaz.'
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
  return { id: nextId(), topicName: '', name: '', pageStart: '', pageEnd: '', questionCount: '' }
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
              <img src={image.dataUrl} alt={`${altPrefix} ${index + 1}`} className="h-28 w-full object-cover" />
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

export default function AddLibraryResourceWizard({ role, grade, subjectId, subjectName, onClose, onSubmitted }) {
  const apiBase = libraryApiBase(role)
  const nextId = useLocalId()

  const [step, setStep] = useState(1)
  const [resourceSource, setResourceSource] = useState('')
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

  const [tocImages, setTocImages] = useState([])
  const [tocExtracting, setTocExtracting] = useState(false)
  const [tocError, setTocError] = useState('')

  const [answerKeyImages, setAnswerKeyImages] = useState([])
  const [answerKeyError, setAnswerKeyError] = useState('')

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

  const goToStep2 = () => {
    if (!resourceSource) {
      setError('Kaynak türü (Okul Kaynağı / Özel Kaynak) seçilmeli.')
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
    setStep(2)
  }

  const goToStep3 = async () => {
    if (!tocImages.length) {
      setStep(3)
      return
    }

    setTocError('')
    setTocExtracting(true)
    try {
      const data = await authRequest(`${apiBase}/library/resource-books/extract-toc`, {
        method: 'POST',
        timeoutMs: 60000,
        body: JSON.stringify({
          images: tocImages.map((image) => ({
            imageBase64: image.dataUrl.split(',')[1] || '',
            mediaType: image.mediaType,
          })),
        }),
      })
      setTopics(applyExtractedTopics(data.topics, nextId))
      setStep(3)
    } catch (err) {
      setTocError(err.message)
    } finally {
      setTocExtracting(false)
    }
  }

  const goToStep4 = () => {
    const validationError = validateTopics(topics)
    if (validationError) {
      setError(validationError)
      return
    }
    setError('')
    setStep(4)
  }

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
    const validationError = validateTopics(topics)
    if (validationError) {
      setError(validationError)
      return
    }

    setError('')
    setSubmitting(true)
    try {
      await authRequest(`${apiBase}/library/resource-books`, {
        method: 'POST',
        body: JSON.stringify({
          grade,
          subjectId,
          resourceSource,
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
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 p-4">
        <div className="w-full max-w-md panel-card p-6 text-center">
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

  const stepLabel =
    step === 1
      ? 'Kapak'
      : step === 2
        ? 'İçindekiler Fotoğrafları'
        : step === 3
          ? 'İçerikler'
          : 'Cevap Anahtarı Fotoğrafları'

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 p-2 sm:p-4">
      <div className="flex h-full max-h-[95vh] w-full max-w-4xl flex-col overflow-hidden panel-card p-4 sm:h-[85vh] sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-panel-text">Kaynak Ekle</h2>
            <p className="text-xs text-panel-text-muted">
              {grade}. Sınıf · {subjectName} · Adım {step}/4 — {stepLabel}
            </p>
          </div>
          <button type="button" aria-label="Kapat" onClick={onClose} className="shrink-0">
            <X size={20} />
          </button>
        </div>

        {error ? (
          <div className="mb-3 rounded-xl bg-panel-accent-soft px-3 py-2 text-sm text-panel-warm">{error}</div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {step === 1 ? (
            <div className="flex flex-col gap-4">
              <div className="flex justify-center">
                <ResourceImageField value={imageUrl} onChange={setImageUrl} compact size={140} showUrlToggle />
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-panel-text-muted">Kaynak Türü</span>
                <div className="flex gap-2">
                  {Object.entries(RESOURCE_SOURCE_LABELS).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setResourceSource(value)}
                      className={`flex-1 rounded-xl border p-2.5 text-sm font-medium transition-colors ${
                        resourceSource === value
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
          ) : step === 2 ? (
            <PhotoUploadStep
              images={tocImages}
              setImages={setTocImages}
              error={tocError}
              setError={setTocError}
              altPrefix="İçindekiler"
              inputLabel="Fihrist / İçindekiler Fotoğrafı Yükle"
              inputHint="Kitabın içindekiler sayfa(lar)ının fotoğrafını çekin veya seçin — birden fazla sayfa ekleyebilirsiniz."
              extracting={tocExtracting}
              extractingLabel="Fotoğraflar okunuyor, içerik ve testler çıkarılıyor..."
              idleHint={
                'Fotoğrafları yükledikten sonra "Devam Et" ile içerik başlıkları, test konuları, test adları ve sayfa ' +
                'numaraları otomatik okunmaya çalışılır; bir sonraki adımda okunan bilgileri düzenleyip soru sayılarını ' +
                'kolayca girebilirsiniz. Fotoğraf eklemeden de devam edip her şeyi elle girebilirsiniz.'
              }
            />
          ) : step === 3 ? (
            <div className="flex flex-col gap-4">
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
                    <div className="hidden gap-2 px-2 text-[10px] font-semibold uppercase tracking-wide text-panel-text-muted sm:grid sm:grid-cols-[1.1fr_1.7fr_54px_54px_60px_24px]">
                      <span>Test Konusu</span>
                      <span>Test Adı</span>
                      <span>Başl.</span>
                      <span>Bit.</span>
                      <span>Soru</span>
                      <span />
                    </div>
                    {topic.tests.map((test) => (
                      <div
                        key={test.id}
                        className="grid grid-cols-2 gap-2 rounded-lg bg-panel-surface-soft p-2 sm:grid-cols-[1.1fr_1.7fr_54px_54px_60px_24px] sm:items-center"
                      >
                        <input
                          value={test.topicName}
                          onChange={(event) => updateTest(topic.id, test.id, { topicName: event.target.value })}
                          placeholder="Test konusu"
                          className="col-span-2 rounded-lg border border-panel-border p-1.5 text-xs text-panel-text sm:col-span-1"
                        />
                        <input
                          value={test.name}
                          onChange={(event) => updateTest(topic.id, test.id, { name: event.target.value })}
                          placeholder="Test adı"
                          className="col-span-2 rounded-lg border border-panel-border p-1.5 text-xs text-panel-text sm:col-span-1"
                        />
                        <input
                          type="number"
                          min="1"
                          value={test.pageStart}
                          onChange={(event) => updateTest(topic.id, test.id, { pageStart: event.target.value })}
                          placeholder="Başl."
                          className="w-full rounded-lg border border-panel-border p-1.5 text-xs text-panel-text"
                        />
                        <input
                          type="number"
                          min="1"
                          value={test.pageEnd}
                          onChange={(event) => updateTest(topic.id, test.id, { pageEnd: event.target.value })}
                          placeholder="Bit."
                          className="w-full rounded-lg border border-panel-border p-1.5 text-xs text-panel-text"
                        />
                        <input
                          type="number"
                          min="1"
                          value={test.questionCount}
                          onChange={(event) => updateTest(topic.id, test.id, { questionCount: event.target.value })}
                          placeholder="Soru"
                          className="w-full rounded-lg border border-panel-blue bg-panel-blue-soft p-1.5 text-xs text-panel-text"
                        />
                        {topic.tests.length > 1 ? (
                          <button
                            type="button"
                            aria-label="Testi sil"
                            onClick={() => removeTest(topic.id, test.id)}
                            className="flex items-center justify-center rounded-lg text-panel-text-muted hover:text-panel-warm"
                          >
                            <Trash2 size={14} aria-hidden="true" />
                          </button>
                        ) : null}
                      </div>
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
          ) : (
            <PhotoUploadStep
              images={answerKeyImages}
              setImages={setAnswerKeyImages}
              error={answerKeyError}
              setError={setAnswerKeyError}
              altPrefix="Cevap anahtarı"
              inputLabel="Cevap Anahtarı Fotoğrafı Yükle"
              inputHint="Kitabın cevap anahtarı sayfa(lar)ının fotoğrafını çekin veya seçin — birden fazla sayfa ekleyebilirsiniz."
              idleHint='Cevap anahtarı fotoğrafı eklemeden de "Gönder" ile devam edebilirsiniz; daha sonra da ekleyebilirsiniz.'
            />
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2 border-t border-panel-border pt-4">
          {step === 1 ? (
            <>
              <Button type="button" variant="secondary" size="md" onClick={onClose}>
                Vazgeç
              </Button>
              <Button type="button" size="md" onClick={goToStep2}>
                Devam Et
              </Button>
            </>
          ) : step === 2 ? (
            <>
              <Button type="button" variant="secondary" size="md" onClick={() => setStep(1)} disabled={tocExtracting}>
                Geri
              </Button>
              <Button type="button" size="md" onClick={goToStep3} disabled={tocExtracting}>
                {tocExtracting ? 'Okunuyor...' : 'Devam Et'}
              </Button>
            </>
          ) : step === 3 ? (
            <>
              <Button type="button" variant="secondary" size="md" onClick={() => setStep(2)}>
                Geri
              </Button>
              <Button type="button" size="md" onClick={goToStep4}>
                Devam Et
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="secondary" size="md" onClick={() => setStep(3)} disabled={submitting}>
                Geri
              </Button>
              <Button type="button" size="md" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Gönderiliyor...' : 'Gönder'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
