import { useEffect, useRef, useState } from 'react'
import { Camera, Check, Crop, ImagePlus, RotateCcw, RotateCw, X } from 'lucide-react'
import ConfirmationDialog from '../../shared/ConfirmationDialog'

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_UPLOAD_MB = 8
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024
const MAX_OUTPUT_DIMENSION = 1400
const VERIFICATION_OUTPUT_DIMENSION = 900
const OUTPUT_QUALITY = 0.82
const VERIFICATION_OUTPUT_QUALITY = 0.7
const EDITOR_QUALITY = 0.92
const FULL_CROP = { x: 0, y: 0, width: 1, height: 1 }
const MIN_CROP_SIZE = 0.16
const SAVE_VERIFICATION_WAIT_MS = 800
const CROP_HANDLES = [
  { action: 'nw', className: '-left-2.5 -top-2.5 h-5 w-5 cursor-nwse-resize rounded-full' },
  { action: 'n', className: 'left-1/2 -top-2.5 h-5 w-12 -translate-x-1/2 cursor-ns-resize rounded-full' },
  { action: 'ne', className: '-right-2.5 -top-2.5 h-5 w-5 cursor-nesw-resize rounded-full' },
  { action: 'e', className: '-right-2.5 top-1/2 h-12 w-5 -translate-y-1/2 cursor-ew-resize rounded-full' },
  { action: 'se', className: '-bottom-2.5 -right-2.5 h-5 w-5 cursor-nwse-resize rounded-full' },
  { action: 's', className: '-bottom-2.5 left-1/2 h-5 w-12 -translate-x-1/2 cursor-ns-resize rounded-full' },
  { action: 'sw', className: '-bottom-2.5 -left-2.5 h-5 w-5 cursor-nesw-resize rounded-full' },
  { action: 'w', className: '-left-2.5 top-1/2 h-12 w-5 -translate-y-1/2 cursor-ew-resize rounded-full' },
]

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

function getQuestionNumberWarningDescription(questionLabel, verification) {
  const target = questionLabel ? `${questionLabel}. soruya` : 'Bu soruya'
  if (verification?.status === 'mismatch' && verification.detectedQuestionNumber) {
    return `${target} görsel yüklüyorsunuz ama gönderdiğiniz fotoğrafta ${verification.detectedQuestionNumber}. soru görünüyor. Yine de devam edilsin mi?`
  }

  return `${target} görsel yüklüyorsunuz ama gönderdiğiniz fotoğrafta soru numarasını doğrulayamadım. Yine de devam edilsin mi?`
}

function getDraftVerificationKey(draft) {
  if (!draft?.sourceUrl) return ''
  const crop = normalizeCrop(draft.crop || FULL_CROP)
  return [
    draft.sourceUrl.length,
    draft.sourceUrl.slice(0, 48),
    draft.sourceUrl.slice(-48),
    draft.width,
    draft.height,
    crop.x.toFixed(4),
    crop.y.toFixed(4),
    crop.width.toFixed(4),
    crop.height.toFixed(4),
  ].join(':')
}

function createUnknownQuestionNumberVerification(questionLabel) {
  return {
    status: 'unknown',
    expectedQuestionNumber: Number(questionLabel) || null,
    detectedQuestionNumber: null,
  }
}

function waitForVerification(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((resolve) => {
      window.setTimeout(() => resolve(null), timeoutMs)
    }),
  ])
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
async function renderEditedQuestionPhoto(draft, { maxDimension = MAX_OUTPUT_DIMENSION, quality = OUTPUT_QUALITY } = {}) {
  const image = await loadImage(draft.sourceUrl)
  const width = image.naturalWidth || image.width
  const height = image.naturalHeight || image.height
  const crop = normalizeCrop(draft.crop || FULL_CROP)
  const sourceX = Math.round(crop.x * width)
  const sourceY = Math.round(crop.y * height)
  const sourceWidth = Math.max(1, Math.round(crop.width * width))
  const sourceHeight = Math.max(1, Math.round(crop.height * height))
  const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight))
  const outputWidth = Math.max(1, Math.round(sourceWidth * scale))
  const outputHeight = Math.max(1, Math.round(sourceHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = outputWidth
  canvas.height = outputHeight
  const context = canvas.getContext('2d')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, outputWidth, outputHeight)
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, outputWidth, outputHeight)

  return {
    dataUrl: canvas.toDataURL('image/jpeg', quality),
    width: outputWidth,
    height: outputHeight,
  }
}

function FilePickerControl({ accept, capture, disabled, onChange, className, children }) {
  return (
    <label
      aria-disabled={disabled ? 'true' : undefined}
      className={`relative cursor-pointer overflow-hidden ${disabled ? 'pointer-events-none opacity-60' : ''} ${className}`}
    >
      <span className="pointer-events-none flex min-w-0 items-center justify-center gap-2">{children}</span>
      <input
        type="file"
        accept={accept}
        capture={capture}
        disabled={disabled}
        className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
        onClick={(event) => {
          event.currentTarget.value = ''
        }}
        onChange={onChange}
      />
    </label>
  )
}

export default function MistakePhotoCaptureModal({
  questionLabel,
  existingPhotoUrl,
  onClose,
  onSave,
  onVerifyQuestionNumber,
}) {
  const cropFrameRef = useRef(null)
  const verificationSeqRef = useRef(0)
  const verificationRef = useRef({ key: '', status: 'idle', promise: null, result: null })
  const [preview, setPreview] = useState(existingPhotoUrl || '')
  const [draft, setDraft] = useState(null)
  const [cropMode, setCropMode] = useState(false)
  const [cropDrag, setCropDrag] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [pendingSaveDataUrl, setPendingSaveDataUrl] = useState('')
  const [questionNumberWarning, setQuestionNumberWarning] = useState(null)

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

  const resetQuestionNumberVerification = () => {
    verificationSeqRef.current += 1
    verificationRef.current = { key: '', status: 'idle', promise: null, result: null }
  }

  const startQuestionNumberVerification = (photoDraft) => {
    if (!photoDraft || !questionLabel || !onVerifyQuestionNumber) return null

    const key = getDraftVerificationKey(photoDraft)
    const cached = verificationRef.current
    if (cached.key === key && cached.status === 'done') return Promise.resolve(cached.result)
    if (cached.key === key && cached.promise) return cached.promise

    const seq = ++verificationSeqRef.current
    const promise = renderEditedQuestionPhoto(photoDraft, {
      maxDimension: VERIFICATION_OUTPUT_DIMENSION,
      quality: VERIFICATION_OUTPUT_QUALITY,
    })
      .then(({ dataUrl }) => onVerifyQuestionNumber(dataUrl))
      .then((verification) => verification || createUnknownQuestionNumberVerification(questionLabel))
      .catch(() => createUnknownQuestionNumberVerification(questionLabel))
      .then((verification) => {
        if (seq === verificationSeqRef.current) {
          verificationRef.current = { key, status: 'done', promise: null, result: verification }
        }
        return verification
      })

    verificationRef.current = { key, status: 'pending', promise, result: null }
    return promise
  }

  const getQuestionNumberVerificationForSave = async (photoDraft) => {
    const verificationPromise = startQuestionNumberVerification(photoDraft)
    if (!verificationPromise) return null

    const verification = await waitForVerification(verificationPromise, SAVE_VERIFICATION_WAIT_MS)
    return verification || createUnknownQuestionNumberVerification(questionLabel)
  }

  const handleFile = async (file) => {
    if (!file) return
    setBusy(true)
    setError('')
    setPendingSaveDataUrl('')
    setQuestionNumberWarning(null)
    resetQuestionNumberVerification()
    try {
      const editablePhoto = await createEditablePhoto(file)
      setDraft(editablePhoto)
      setCropMode(false)
      startQuestionNumberVerification(editablePhoto)
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
    setPendingSaveDataUrl('')
    setQuestionNumberWarning(null)
    resetQuestionNumberVerification()
    try {
      const rotatedPhoto = await rotateEditablePhoto(draft, direction)
      setDraft(rotatedPhoto)
      setCropMode(false)
      startQuestionNumberVerification(rotatedPhoto)
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
        crop: hasCustomCrop(current.crop) ? current.crop : { ...FULL_CROP },
      }
    })
    setCropMode(true)
  }

  const handleFinishCrop = async () => {
    if (!draft) return
    if (!hasCustomCrop(draft.crop)) {
      setCropMode(false)
      return
    }

    setBusy(true)
    setError('')
    setPendingSaveDataUrl('')
    setQuestionNumberWarning(null)
    resetQuestionNumberVerification()
    try {
      const croppedPhoto = await renderEditedQuestionPhoto(draft, {
        maxDimension: MAX_OUTPUT_DIMENSION,
        quality: EDITOR_QUALITY,
      })
      const nextDraft = {
        sourceUrl: croppedPhoto.dataUrl,
        width: croppedPhoto.width,
        height: croppedPhoto.height,
        crop: { ...FULL_CROP },
      }
      setDraft(nextDraft)
      setCropMode(false)
      setCropDrag(null)
      startQuestionNumberVerification(nextDraft)
    } catch (err) {
      setError(err.message || 'Fotoğraf kırpılamadı.')
    } finally {
      setBusy(false)
    }
  }

  const handleResetCrop = () => {
    const nextDraft = draft ? { ...draft, crop: { ...FULL_CROP } } : null
    setDraft(nextDraft)
    setCropMode(false)
    setPendingSaveDataUrl('')
    setQuestionNumberWarning(null)
    resetQuestionNumberVerification()
    startQuestionNumberVerification(nextDraft)
  }

  const saveRenderedPhoto = async (dataUrl) => {
    setPreview(dataUrl)
    await onSave(dataUrl)
    onClose()
  }

  const handleSaveEditedPhoto = async () => {
    if (!draft) return
    setBusy(true)
    setError('')
    setPendingSaveDataUrl('')
    setQuestionNumberWarning(null)
    try {
      const [renderedPhoto, verification] = await Promise.all([
        renderEditedQuestionPhoto(draft),
        getQuestionNumberVerificationForSave(draft),
      ])
      if (verification && verification.status !== 'matched') {
        setPendingSaveDataUrl(renderedPhoto.dataUrl)
        setQuestionNumberWarning(verification)
        return
      }

      await saveRenderedPhoto(renderedPhoto.dataUrl)
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
    setPendingSaveDataUrl('')
    setQuestionNumberWarning(null)
    resetQuestionNumberVerification()
  }

  const handleContinueAfterQuestionWarning = async () => {
    if (!pendingSaveDataUrl || busy) return
    setBusy(true)
    setError('')
    try {
      await saveRenderedPhoto(pendingSaveDataUrl)
    } catch (err) {
      setError(err.message || 'Fotoğraf kaydedilemedi.')
      setQuestionNumberWarning(null)
      setPendingSaveDataUrl('')
    } finally {
      setBusy(false)
    }
  }

  const handleCancelQuestionWarning = () => {
    if (busy) return
    setQuestionNumberWarning(null)
    setPendingSaveDataUrl('')
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
                          {CROP_HANDLES.map((handle) => (
                            <span
                              key={handle.action}
                              aria-hidden="true"
                              onPointerDown={(event) => startCropInteraction(event, handle.action)}
                              className={`absolute border-2 border-white bg-panel-blue shadow ${handle.className}`}
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
                  onClick={cropMode ? handleFinishCrop : handleEnableCrop}
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
                  Kırpma alanını sürükleyebilir, kenar veya köşelerden boyutlandırabilirsin.
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
                <FilePickerControl
                  accept="image/*"
                  capture="environment"
                  disabled={busy}
                  onChange={handleInputChange}
                  className="rounded-xl border border-panel-border px-3 py-2 text-xs font-semibold text-panel-text hover:bg-panel-surface-soft"
                >
                  Yeniden Çek
                </FilePickerControl>
                <FilePickerControl
                  accept="image/jpeg,image/png,image/webp"
                  disabled={busy}
                  onChange={handleInputChange}
                  className="rounded-xl border border-panel-border px-3 py-2 text-xs font-semibold text-panel-text hover:bg-panel-surface-soft"
                >
                  Galeriden Değiştir
                </FilePickerControl>
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
                <FilePickerControl
                  accept="image/*"
                  capture="environment"
                  disabled={busy}
                  onChange={handleInputChange}
                  className="flex min-h-11 w-full min-w-0 items-center justify-center gap-2 rounded-xl bg-student-theme-primary px-4 py-3 text-sm font-semibold leading-tight text-student-theme-button-text hover:bg-student-theme-hover"
                >
                  <Camera size={16} aria-hidden="true" />
                  <span className="min-w-0 truncate">
                    {busy ? 'Hazırlanıyor...' : preview ? 'Yeniden Çek' : 'Kamera ile Çek'}
                  </span>
                </FilePickerControl>

                <FilePickerControl
                  accept="image/jpeg,image/png,image/webp"
                  disabled={busy}
                  onChange={handleInputChange}
                  className="flex min-h-11 w-full min-w-0 items-center justify-center gap-2 rounded-xl border border-panel-border px-4 py-3 text-sm font-semibold leading-tight text-panel-text hover:bg-panel-surface-soft"
                >
                  <ImagePlus size={16} aria-hidden="true" />
                  <span className="min-w-0 truncate">Galeriden Seç</span>
                </FilePickerControl>
              </div>

              <p className="mt-3 text-xs text-panel-text-muted">JPG, PNG veya WEBP · en fazla {MAX_UPLOAD_MB} MB</p>
            </>
          )}

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

      {questionNumberWarning ? (
        <ConfirmationDialog
          title="Soru numarası kontrolü"
          description={getQuestionNumberWarningDescription(questionLabel, questionNumberWarning)}
          confirmLabel={busy ? 'Kaydediliyor...' : 'Devam et'}
          cancelLabel="Vazgeç"
          onConfirm={handleContinueAfterQuestionWarning}
          onCancel={handleCancelQuestionWarning}
        />
      ) : null}
    </div>
  )
}
