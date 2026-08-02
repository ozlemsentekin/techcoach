import { useId, useState } from 'react'
import { ImagePlus, Link, UploadCloud, X } from 'lucide-react'

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024
const OUTPUT_SIZE = 512
const OUTPUT_QUALITY = 0.86

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

async function resizeImageFile(file) {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    throw new Error('JPG, PNG veya WEBP görsel seçin.')
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('Görsel en fazla 4 MB olabilir.')
  }

  const sourceUrl = await readFileAsDataUrl(file)
  const image = await loadImage(sourceUrl)
  const sourceSize = Math.min(image.naturalWidth || image.width, image.naturalHeight || image.height)
  const sourceX = ((image.naturalWidth || image.width) - sourceSize) / 2
  const sourceY = ((image.naturalHeight || image.height) - sourceSize) / 2

  const canvas = document.createElement('canvas')
  canvas.width = OUTPUT_SIZE
  canvas.height = OUTPUT_SIZE

  const context = canvas.getContext('2d')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
  context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE)

  return canvas.toDataURL('image/jpeg', OUTPUT_QUALITY)
}

export default function ResourceImageField({ value, onChange }) {
  const inputId = useId()
  const [error, setError] = useState('')
  const [showUrlInput, setShowUrlInput] = useState(Boolean(value && !value.startsWith('data:image/')))
  const [uploading, setUploading] = useState(false)

  const handleFile = async (file) => {
    if (!file) return

    setUploading(true)
    setError('')
    try {
      const imageDataUrl = await resizeImageFile(file)
      onChange(imageDataUrl)
      setShowUrlInput(false)
    } catch (err) {
      setError(err.message || 'Görsel yüklenemedi.')
    } finally {
      setUploading(false)
    }
  }

  const handleFileChange = (event) => {
    handleFile(event.target.files?.[0] || null)
    event.target.value = ''
  }

  const handleDrop = (event) => {
    event.preventDefault()
    handleFile(event.dataTransfer.files?.[0] || null)
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-panel-text-muted">Kapak / Profil Görseli</span>
      <div
        className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-[#d7dadd] bg-[#fbfcfc] p-3"
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        {value ? (
          <img src={value} alt="Kaynak görseli" className="h-20 w-20 rounded-xl border border-[#e5e8e9] object-cover shadow-sm" />
        ) : (
          <span className="flex h-20 w-20 items-center justify-center rounded-xl bg-[#f5f2fb] text-[#655e94]">
            <ImagePlus size={24} aria-hidden="true" />
          </span>
        )}

        <div className="flex min-w-[180px] flex-1 flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <label
              htmlFor={inputId}
              className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#655e94] px-4 text-sm font-medium text-white transition-colors hover:opacity-90"
            >
              <UploadCloud size={15} aria-hidden="true" />
              {uploading ? 'Yükleniyor...' : value ? 'Görseli Değiştir' : 'Görsel Yükle'}
            </label>
            <input id={inputId} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileChange} />

            <button
              type="button"
              onClick={() => setShowUrlInput((current) => !current)}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-panel-border bg-white px-3 text-sm font-medium text-panel-text hover:bg-[#f8f7fb]"
            >
              <Link size={14} aria-hidden="true" />
              URL
            </button>

            {value ? (
              <button
                type="button"
                onClick={() => onChange('')}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-panel-border bg-white px-3 text-sm font-medium text-panel-text hover:bg-panel-accent-soft hover:text-panel-warm"
              >
                <X size={14} aria-hidden="true" />
                Kaldır
              </button>
            ) : null}
          </div>

          <p className="text-xs text-panel-text-muted">JPG, PNG veya WEBP yükleyin; görsel otomatik kare profil boyutuna hazırlanır.</p>
        </div>
      </div>

      {showUrlInput ? (
        <input
          value={value || ''}
          onChange={(event) => onChange(event.target.value)}
          placeholder="https://..."
          className="rounded-xl border border-panel-border p-2.5 text-sm text-panel-text"
        />
      ) : null}

      {error ? <span className="text-xs text-panel-warm">{error}</span> : null}
    </div>
  )
}
