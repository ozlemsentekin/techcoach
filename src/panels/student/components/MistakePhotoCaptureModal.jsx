import { useRef, useState } from 'react'
import { Camera, ImagePlus, X } from 'lucide-react'

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_UPLOAD_MB = 8
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024
const MAX_OUTPUT_DIMENSION = 1400
const OUTPUT_QUALITY = 0.82

function loadImage(src) {
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

// Profil görseli gibi kareye kırpmıyoruz: soru fotoğrafında en-boy oranı korunur, sadece uzun
// kenar MAX_OUTPUT_DIMENSION'a indirilip JPEG'e sıkıştırılır (bkz. ResourceImageField.jsx'teki
// benzer desen — orada kare kırpma vardı çünkü profil/kapak görseli için).
async function resizeQuestionPhoto(file) {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    throw new Error('JPG, PNG veya WEBP görsel seçin.')
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`Görsel en fazla ${MAX_UPLOAD_MB} MB olabilir.`)
  }

  const sourceUrl = await readFileAsDataUrl(file)
  const image = await loadImage(sourceUrl)
  const width = image.naturalWidth || image.width
  const height = image.naturalHeight || image.height
  const scale = Math.min(1, MAX_OUTPUT_DIMENSION / Math.max(width, height))
  const outputWidth = Math.max(1, Math.round(width * scale))
  const outputHeight = Math.max(1, Math.round(height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = outputWidth
  canvas.height = outputHeight
  const context = canvas.getContext('2d')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, outputWidth, outputHeight)
  context.drawImage(image, 0, 0, outputWidth, outputHeight)

  return canvas.toDataURL('image/jpeg', OUTPUT_QUALITY)
}

export default function MistakePhotoCaptureModal({ questionLabel, existingPhotoUrl, onClose, onSave }) {
  const cameraInputRef = useRef(null)
  const galleryInputRef = useRef(null)
  const [preview, setPreview] = useState(existingPhotoUrl || '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const openFilePicker = (inputRef) => {
    if (busy) return
    const input = inputRef.current
    if (!input) {
      setError('Dosya seçici açılamadı.')
      return
    }
    input.click()
  }

  const handleFile = async (file) => {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const dataUrl = await resizeQuestionPhoto(file)
      setPreview(dataUrl)
      await onSave(dataUrl)
      onClose()
    } catch (err) {
      setError(err.message || 'Fotoğraf yüklenemedi.')
    } finally {
      setBusy(false)
    }
  }

  const handleInputChange = (event) => {
    const file = event.target.files?.[0] || null
    handleFile(file)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-black/30 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Soru fotoğrafı ekle"
    >
      <div className="min-w-0 w-full max-w-sm overflow-x-hidden rounded-t-3xl border border-panel-border bg-panel-surface p-5 shadow-lg sm:rounded-2xl sm:p-6">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="break-words text-lg font-semibold leading-tight text-panel-text">
              {questionLabel ? `${questionLabel}. Soru Fotoğrafı` : 'Soru Fotoğrafı'}
            </h2>
            <p className="mt-1 text-sm text-panel-text-muted">
              Fotoğrafı Hata Defterim'de daha sonra tekrar görebilirsin.
            </p>
          </div>
          <button
            type="button"
            aria-label="Kapat"
            onClick={onClose}
            className="shrink-0 text-panel-text-muted hover:text-panel-text"
          >
            <X size={18} />
          </button>
        </div>

        {preview ? (
          <img loading="lazy" decoding="async"
            src={preview}
            alt="Soru fotoğrafı önizleme"
            className="mt-4 max-h-64 w-full rounded-xl border border-panel-border object-contain"
          />
        ) : null}

        {error ? <p className="mt-3 text-sm text-panel-warm">{error}</p> : null}

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => openFilePicker(cameraInputRef)}
            disabled={busy}
            className={`flex min-h-11 w-full min-w-0 items-center justify-center gap-2 rounded-xl bg-student-theme-primary px-4 py-3 text-sm font-semibold leading-tight text-student-theme-button-text hover:bg-student-theme-hover disabled:cursor-not-allowed disabled:opacity-60 ${
              busy ? 'pointer-events-none opacity-60' : ''
            }`}
          >
            <Camera size={16} aria-hidden="true" />
            <span className="min-w-0 truncate">{busy ? 'Yükleniyor...' : preview ? 'Yeniden Çek' : 'Kamera ile Çek'}</span>
          </button>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            disabled={busy}
            className="sr-only"
            onClick={(event) => {
              event.currentTarget.value = ''
            }}
            onChange={handleInputChange}
          />

          <button
            type="button"
            onClick={() => openFilePicker(galleryInputRef)}
            disabled={busy}
            className={`flex min-h-11 w-full min-w-0 items-center justify-center gap-2 rounded-xl border border-panel-border px-4 py-3 text-sm font-semibold leading-tight text-panel-text hover:bg-panel-surface-soft disabled:cursor-not-allowed disabled:opacity-60 ${
              busy ? 'pointer-events-none opacity-60' : ''
            }`}
          >
            <ImagePlus size={16} aria-hidden="true" />
            <span className="min-w-0 truncate">Galeriden Seç</span>
          </button>
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            className="sr-only"
            onClick={(event) => {
              event.currentTarget.value = ''
            }}
            onChange={handleInputChange}
          />
        </div>

        <p className="mt-3 text-xs text-panel-text-muted">JPG, PNG veya WEBP · en fazla {MAX_UPLOAD_MB} MB</p>
      </div>
    </div>
  )
}
