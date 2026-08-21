import { useEffect, useRef, useState } from 'react'
import { Camera, Check, Crop, ImagePlus, RotateCcw, RotateCw, X } from 'lucide-react'

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_UPLOAD_MB = 8
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024
const MAX_OUTPUT_DIMENSION = 1400
const OUTPUT_QUALITY = 0.82
const EDITOR_QUALITY = 0.92
const FULL_CROP = { x: 0, y: 0, width: 1, height: 1 }
const DEFAULT_CROP = { x: 0.06, y: 0.06, width: 0.88, height: 0.88 }
const MIN_CROP_SIZE = 0.16

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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function normalizeCrop(crop) {
  const width = clamp(crop.width, MIN_CROP_SIZE, 1)
  const height = clamp(crop.height, MIN_CROP_SIZE, 1)
  return {
    width,
    height,
    x: clamp(crop.x, 0, 1 - width),
    y: clamp(crop.y, 0, 1 - height),
  }
}

function hasCustomCrop(crop) {
  if (!crop) return false
  return crop.x > 0.001 || crop.y > 0.001 || crop.width < 0.999 || crop.height < 0.999
}

function nextCropFromDrag(action, startCrop, dx, dy) {
  if (action === 'move') {
    return normalizeCrop({ ...startCrop, x: startCrop.x + dx, y: startCrop.y + dy })
  }

  let x = startCrop.x
  let y = startCrop.y
  let width = startCrop.width
  let height = startCrop.height

  if (action.includes('w')) {
    x = startCrop.x + dx
    width = startCrop.width - dx
    if (width < MIN_CROP_SIZE) {
      x = startCrop.x + startCrop.width - MIN_CROP_SIZE
      width = MIN_CROP_SIZE
    }
  }
  if (action.includes('e')) {
    width = startCrop.width + dx
  }
  if (action.includes('n')) {
    y = startCrop.y + dy
    height = startCrop.height - dy
    if (height < MIN_CROP_SIZE) {
      y = startCrop.y + startCrop.height - MIN_CROP_SIZE
      height = MIN_CROP_SIZE
    }
  }
  if (action.includes('s')) {
    height = startCrop.height + dy
  }

  return normalizeCrop({ x, y, width, height })
}

function validateQuestionPhoto(file) {
  const fileType = String(file.type || '').toLowerCase()
  if (fileType && !ACCEPTED_IMAGE_TYPES.includes(fileType)) {
    throw new Error('JPG, PNG veya WEBP görsel seçin.')
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`Görsel en fazla ${MAX_UPLOAD_MB} MB olabilir.`)
  }
}

async function createEditablePhoto(file) {
  validateQuestionPhoto(file)
  const sourceUrl = await readFileAsDataUrl(file)
  const image = await loadImage(sourceUrl)
  return {
    sourceUrl,
    width: image.naturalWidth || image.width,
    height: image.naturalHeight || image.height,
    crop: { ...FULL_CROP },
  }
}

async function rotateEditablePhoto(draft, direction) {
  const image = await loadImage(draft.sourceUrl)
  const sourceWidth = image.naturalWidth || image.width
  const sourceHeight = image.naturalHeight || image.height
  const canvas = document.createElement('canvas')
  canvas.width = sourceHeight
  canvas.height = sourceWidth
  const context = canvas.getContext('2d')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.translate(canvas.width / 2, canvas.height / 2)
  context.rotate((direction * Math.PI) / 2)
  context.drawImage(image, -sourceWidth / 2, -sourceHeight / 2)

  return {
    sourceUrl: canvas.toDataURL('image/jpeg', EDITOR_QUALITY),
    width: canvas.width,
    height: canvas.height,
    crop: { ...FULL_CROP },
  }
}

// Profil görseli gibi kareye zorlamıyoruz: soru fotoğrafında düzenlenen alan korunur,
// sadece uzun kenar MAX_OUTPUT_DIMENSION'a indirilip JPEG'e sıkıştırılır.
async function renderEditedQuestionPhoto(draft) {
  const image = await loadImage(draft.sourceUrl)
  const width = image.naturalWidth || image.width
  const height = image.naturalHeight || image.height
  const crop = normalizeCrop(draft.crop || FULL_CROP)
  const sourceX = Math.round(crop.x * width)
  const sourceY = Math.round(crop.y * height)
  const sourceWidth = Math.max(1, Math.round(crop.width * width))
  const sourceHeight = Math.max(1, Math.round(crop.height * height))
  const scale = Math.min(1, MAX_OUTPUT_DIMENSION / Math.max(sourceWidth, sourceHeight))
  const outputWidth = Math.max(1, Math.round(sourceWidth * scale))
  const outputHeight = Math.max(1, Math.round(sourceHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = outputWidth
  canvas.height = outputHeight
  const context = canvas.getContext('2d')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, outputWidth, outputHeight)
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, outputWidth, outputHeight)

  return canvas.toDataURL('image/jpeg', OUTPUT_QUALITY)
}

export default function MistakePhotoCaptureModal({ questionLabel, existingPhotoUrl, onClose, onSave }) {
  const cameraInputRef = useRef(null)
  const galleryInputRef = useRef(null)
  const cropFrameRef = useRef(null)
  const [preview, setPreview] = useState(existingPhotoUrl || '')
  const [draft, setDraft] = useState(null)
  const [cropMode, setCropMode] = useState(false)
  const [cropDrag, setCropDrag] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!cropDrag) return undefined

    const handleMove = (event) => {
      if (!cropDrag.rect.width || !cropDrag.rect.height) return
      const dx = (event.clientX - cropDrag.startX) / cropDrag.rect.width
      const dy = (event.clientY - cropDrag.startY) / cropDrag.rect.height
      setDraft((current) =>
        current
          ? {
              ...current,
              crop: nextCropFromDrag(cropDrag.action, cropDrag.startCrop, dx, dy),
            }
          : current,
      )
    }

    const handleEnd = () => {
      setCropDrag(null)
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleEnd)
    window.addEventListener('pointercancel', handleEnd)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleEnd)
      window.removeEventListener('pointercancel', handleEnd)
    }
  }, [cropDrag])

  const openFilePicker = (inputRef) => {
    if (busy) return
    const input = inputRef.current
    if (!input) {
      setError('Dosya seçici açılamadı.')
      return
    }
    input.click()
  }

  const startCropInteraction = (event, action) => {
    if (!draft) return
    const rect = cropFrameRef.current?.getBoundingClientRect()
    if (!rect) return
    event.preventDefault()
    event.stopPropagation()
    setCropMode(true)
    setCropDrag({
      action,
      rect,
      startX: event.clientX,
      startY: event.clientY,
      startCrop: normalizeCrop(draft.crop || FULL_CROP),
    })
  }

  const handleFile = async (file) => {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const editablePhoto = await createEditablePhoto(file)
      setDraft(editablePhoto)
      setCropMode(false)
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

  const handleRotate = async (direction) => {
    if (!draft) return
    setBusy(true)
    setError('')
    try {
      const rotatedPhoto = await rotateEditablePhoto(draft, direction)
      setDraft(rotatedPhoto)
      setCropMode(false)
    } catch (err) {
      setError(err.message || 'Fotoğraf döndürülemedi.')
    } finally {
      setBusy(false)
    }
  }

  const handleEnableCrop = () => {
    setDraft((current) => {
      if (!current) return current
      return {
        ...current,
        crop: hasCustomCrop(current.crop) ? current.crop : { ...DEFAULT_CROP },
      }
    })
    setCropMode(true)
  }

  const handleResetCrop = () => {
    setDraft((current) => (current ? { ...current, crop: { ...FULL_CROP } } : current))
    setCropMode(false)
  }

  const handleSaveEditedPhoto = async () => {
    if (!draft) return
    setBusy(true)
    setError('')
    try {
      const dataUrl = await renderEditedQuestionPhoto(draft)
      setPreview(dataUrl)
      await onSave(dataUrl)
      onClose()
    } catch (err) {
      setError(err.message || 'Fotoğraf kaydedilemedi.')
    } finally {
      setBusy(false)
    }
  }

  const handleCancelEdit = () => {
    setDraft(null)
    setCropMode(false)
    setCropDrag(null)
    setError('')
  }

  const crop = normalizeCrop(draft?.crop || FULL_CROP)
  const customCrop = hasCustomCrop(draft?.crop)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-black/30 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Soru fotoğrafı ekle"
    >
      <div className="flex max-h-[94dvh] min-w-0 w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-panel-border bg-panel-surface shadow-lg sm:rounded-2xl">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0 p-5 pb-0 sm:p-6 sm:pb-0">
            <h2 className="break-words text-lg font-semibold leading-tight text-panel-text">
              {questionLabel ? `${questionLabel}. Soru Fotoğrafı` : 'Soru Fotoğrafı'}
            </h2>
            <p className="mt-1 text-sm text-panel-text-muted">
              {draft
                ? 'Fotoğrafı kaydetmeden önce kırpabilir veya sağa sola döndürebilirsin.'
                : "Fotoğrafı Hata Defterim'de daha sonra tekrar görebilirsin."}
            </p>
          </div>
          <button
            type="button"
            aria-label="Kapat"
            onClick={onClose}
            className="mr-5 mt-5 shrink-0 text-panel-text-muted hover:text-panel-text sm:mr-6 sm:mt-6"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
          {draft ? (
            <div className="min-w-0">
              <div className="rounded-2xl border border-panel-border bg-panel-surface-soft p-2">
                <div className="flex min-h-56 items-center justify-center overflow-hidden rounded-xl bg-panel-text p-2">
                  <div
                    ref={cropFrameRef}
                    className={`relative inline-block max-w-full ${cropMode ? 'touch-none' : ''}`}
                  >
                    <img
                      loading="lazy"
                      decoding="async"
                      src={draft.sourceUrl}
                      alt="Düzenlenecek soru fotoğrafı"
                      draggable={false}
                      className="block max-h-[48dvh] max-w-full select-none rounded-lg object-contain"
                    />
                    {cropMode ? (
                      <div className="absolute inset-0 touch-none">
                        <div
                          className="absolute cursor-move border-2 border-white bg-white/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.46)]"
                          style={{
                            left: `${crop.x * 100}%`,
                            top: `${crop.y * 100}%`,
                            width: `${crop.width * 100}%`,
                            height: `${crop.height * 100}%`,
                          }}
                          onPointerDown={(event) => startCropInteraction(event, 'move')}
                        >
                          {['nw', 'ne', 'sw', 'se'].map((handle) => (
                            <span
                              key={handle}
                              aria-hidden="true"
                              onPointerDown={(event) => startCropInteraction(event, handle)}
                              className={`absolute h-5 w-5 rounded-full border-2 border-white bg-panel-blue shadow ${
                                handle.includes('n') ? '-top-2.5' : '-bottom-2.5'
                              } ${handle.includes('w') ? '-left-2.5' : '-right-2.5'}`}
                            />
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleRotate(-1)}
                  disabled={busy}
                  className="flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-xl border border-panel-border px-2 py-2 text-xs font-semibold text-panel-text hover:bg-panel-surface-soft disabled:opacity-60"
                >
                  <RotateCcw size={15} aria-hidden="true" />
                  <span className="truncate">Sola Döndür</span>
                </button>
                <button
                  type="button"
                  onClick={cropMode ? () => setCropMode(false) : handleEnableCrop}
                  disabled={busy}
                  className={`flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-semibold disabled:opacity-60 ${
                    cropMode
                      ? 'border-panel-blue bg-panel-blue text-white'
                      : 'border-panel-border text-panel-text hover:bg-panel-surface-soft'
                  }`}
                >
                  <Crop size={15} aria-hidden="true" />
                  <span className="truncate">{cropMode ? 'Kırpmayı Bitir' : 'Kırp'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleRotate(1)}
                  disabled={busy}
                  className="flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-xl border border-panel-border px-2 py-2 text-xs font-semibold text-panel-text hover:bg-panel-surface-soft disabled:opacity-60"
                >
                  <RotateCw size={15} aria-hidden="true" />
                  <span className="truncate">Sağa Döndür</span>
                </button>
              </div>

              {cropMode ? (
                <p className="mt-2 text-xs text-panel-text-muted">
                  Kırpma alanını sürükleyebilir, köşelerden boyutlandırabilirsin.
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2">
                {customCrop ? (
                  <button
                    type="button"
                    onClick={handleResetCrop}
                    disabled={busy}
                    className="rounded-xl border border-panel-border px-3 py-2 text-xs font-semibold text-panel-text hover:bg-panel-surface-soft disabled:opacity-60"
                  >
                    Kırpmayı Sıfırla
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => openFilePicker(cameraInputRef)}
                  disabled={busy}
                  className="rounded-xl border border-panel-border px-3 py-2 text-xs font-semibold text-panel-text hover:bg-panel-surface-soft disabled:opacity-60"
                >
                  Yeniden Çek
                </button>
                <button
                  type="button"
                  onClick={() => openFilePicker(galleryInputRef)}
                  disabled={busy}
                  className="rounded-xl border border-panel-border px-3 py-2 text-xs font-semibold text-panel-text hover:bg-panel-surface-soft disabled:opacity-60"
                >
                  Galeriden Değiştir
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={busy}
                  className="rounded-xl border border-panel-border px-3 py-2 text-xs font-semibold text-panel-text hover:bg-panel-surface-soft disabled:opacity-60"
                >
                  Vazgeç
                </button>
              </div>
            </div>
          ) : (
            <>
              {preview ? (
                <img
                  loading="lazy"
                  decoding="async"
                  src={preview}
                  alt="Soru fotoğrafı önizleme"
                  className="max-h-64 w-full rounded-xl border border-panel-border object-contain"
                />
              ) : null}

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
                  <span className="min-w-0 truncate">
                    {busy ? 'Hazırlanıyor...' : preview ? 'Yeniden Çek' : 'Kamera ile Çek'}
                  </span>
                </button>

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
              </div>

              <p className="mt-3 text-xs text-panel-text-muted">JPG, PNG veya WEBP · en fazla {MAX_UPLOAD_MB} MB</p>
            </>
          )}

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

          {error ? <p className="mt-3 text-sm text-panel-warm">{error}</p> : null}
        </div>

        {draft ? (
          <div className="border-t border-panel-border p-4 sm:px-6">
            <button
              type="button"
              onClick={handleSaveEditedPhoto}
              disabled={busy}
              className="flex min-h-12 w-full min-w-0 items-center justify-center gap-2 rounded-xl bg-student-theme-primary px-4 py-3 text-sm font-semibold text-student-theme-button-text hover:bg-student-theme-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Check size={17} aria-hidden="true" />
              <span className="truncate">{busy ? 'Kaydediliyor...' : 'Fotoğrafı Kaydet'}</span>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
