import { useId, useRef, useState } from 'react'
import { Camera, ImagePlus, Info, Loader2, X } from 'lucide-react'
import { downscalePhoto, extractImageFromClipboard } from '../../../utils/photoDownscale'

const PHOTO_QUALITY_HINT =
  'Fotoğraflar net ve yakından çekilmiş olsun: yazılar okunaklı, sayfanın tamamı kadrajda, iyi ışıkta; bulanık, eğik veya gölgeli olmasın.'

/**
 * Çok fotoğraflı yakalama alanı (talep sihirbazı adımları için). Kameradan çekme,
 * galeriden çoklu seçim ve panodan yapıştırma destekler; her görseli istemcide küçültüp
 * data URL olarak `photos` dizisinde tutar.
 */
export default function RequestPhotoField({
  label,
  description,
  photos,
  onChange,
  max = 15,
  single = false,
}) {
  const cameraInputId = useId()
  const galleryInputId = useId()
  const pasteRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const limit = single ? 1 : max
  const isFull = photos.length >= limit

  const addFiles = async (files) => {
    const list = Array.from(files || []).filter((file) => file && file.type.startsWith('image/'))
    if (list.length === 0) return

    setError('')
    setBusy(true)
    try {
      const room = limit - photos.length
      const accepted = list.slice(0, room)
      const processed = []
      for (const file of accepted) {
        processed.push(await downscalePhoto(file))
      }
      onChange(single ? processed.slice(-1) : [...photos, ...processed])
      if (list.length > room) {
        setError(`En fazla ${limit} fotoğraf ekleyebilirsiniz.`)
      }
    } catch (err) {
      setError(err.message || 'Fotoğraf eklenemedi.')
    } finally {
      setBusy(false)
    }
  }

  const handleInputChange = (event) => {
    addFiles(event.target.files)
    event.target.value = ''
  }

  const handlePaste = (event) => {
    const file = extractImageFromClipboard(event)
    if (file) {
      event.preventDefault()
      addFiles([file])
    }
  }

  const removeAt = (index) => {
    onChange(photos.filter((_, i) => i !== index))
    setError('')
  }

  return (
    <div
      ref={pasteRef}
      onPaste={handlePaste}
      tabIndex={0}
      className="flex flex-col gap-3 rounded-xl border border-panel-border bg-panel-surface-soft p-3 outline-none focus-within:border-panel-blue"
    >
      <div>
        <p className="text-sm font-semibold text-panel-text">{label}</p>
        {description ? <p className="mt-0.5 text-xs text-panel-text-muted">{description}</p> : null}
      </div>

      <div className="flex items-start gap-2 rounded-lg bg-panel-blue-soft/60 px-3 py-2 text-xs text-panel-text-muted">
        <Info size={14} className="mt-0.5 shrink-0 text-panel-blue" aria-hidden="true" />
        <span>{PHOTO_QUALITY_HINT}</span>
      </div>

      {photos.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((photo, index) => (
            <div key={index} className="relative aspect-square overflow-hidden rounded-lg border border-panel-border bg-white">
              <img src={photo} alt={`${label} ${index + 1}`} className="h-full w-full object-cover" loading="lazy" decoding="async" />
              <button
                type="button"
                aria-label="Fotoğrafı kaldır"
                onClick={() => removeAt(index)}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/75"
              >
                <X size={13} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <label
          htmlFor={cameraInputId}
          className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-panel-border bg-white px-3 text-sm font-medium text-panel-text hover:bg-panel-surface-soft ${
            isFull || busy ? 'pointer-events-none opacity-50' : ''
          }`}
        >
          <Camera size={15} aria-hidden="true" />
          Kameradan Çek
        </label>
        <input
          id={cameraInputId}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleInputChange}
          disabled={isFull || busy}
        />

        <label
          htmlFor={galleryInputId}
          className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-panel-border bg-white px-3 text-sm font-medium text-panel-text hover:bg-panel-surface-soft ${
            isFull || busy ? 'pointer-events-none opacity-50' : ''
          }`}
        >
          <ImagePlus size={15} aria-hidden="true" />
          Galeriden Seç
        </label>
        <input
          id={galleryInputId}
          type="file"
          accept="image/*"
          multiple={!single}
          className="hidden"
          onChange={handleInputChange}
          disabled={isFull || busy}
        />

        {busy ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-panel-text-muted">
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            Hazırlanıyor...
          </span>
        ) : (
          <span className="text-xs text-panel-text-muted">
            {single ? (photos.length ? '1 / 1' : 'Panodan da yapıştırabilirsiniz') : `${photos.length} / ${limit} · panodan yapıştırılabilir`}
          </span>
        )}
      </div>

      {error ? <p className="text-xs text-panel-warm">{error}</p> : null}
    </div>
  )
}
