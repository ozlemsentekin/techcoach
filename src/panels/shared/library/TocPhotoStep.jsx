import { useId } from 'react'
import { Camera, Sparkles, X } from 'lucide-react'
import { TOC_MAX_IMAGES, resizeTocImage } from './libraryTocFlow'

export default function TocPhotoStep({ tocImages, setTocImages, extracting, tocError, setTocError }) {
  const inputId = useId()

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || [])
    if (!files.length) return
    if (tocImages.length + files.length > TOC_MAX_IMAGES) {
      setTocError(`En fazla ${TOC_MAX_IMAGES} fotoğraf yükleyebilirsiniz.`)
      return
    }
    setTocError('')
    try {
      const resized = await Promise.all(
        files.map(async (file) => {
          const dataUrl = await resizeTocImage(file)
          return { id: `${Date.now()}-${Math.random()}`, dataUrl, mediaType: 'image/jpeg' }
        }),
      )
      setTocImages((current) => [...current, ...resized])
    } catch (err) {
      setTocError(err.message || 'Görsel yüklenemedi.')
    }
  }

  const removeImage = (id) => setTocImages((current) => current.filter((image) => image.id !== id))

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
          <span className="text-sm font-medium">Fihrist / İçindekiler Fotoğrafı Yükle</span>
          <span className="text-xs text-panel-text-muted">
            Kitabın içindekiler sayfa(lar)ının fotoğrafını çekin veya seçin — birden fazla sayfa ekleyebilirsiniz.
          </span>
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

      {tocError ? <p className="text-sm text-panel-warm">{tocError}</p> : null}

      {tocImages.length ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {tocImages.map((image, index) => (
            <div key={image.id} className="group relative overflow-hidden rounded-lg border border-panel-border">
              <img loading="lazy" decoding="async" src={image.dataUrl} alt={`İçindekiler ${index + 1}`} className="h-28 w-full object-cover" />
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
          Fotoğraflar okunuyor, içerik ve testler çıkarılıyor...
        </p>
      ) : (
        <p className="text-xs text-panel-text-muted">
          Fotoğrafları yükledikten sonra "Devam Et" ile içerik başlıkları, test konuları, test adları ve sayfa
          numaraları otomatik okunmaya çalışılır; bir sonraki adımda okunan bilgileri düzenleyip soru sayılarını
          kolayca girebilirsiniz. Fotoğraf eklemeden de devam edip her şeyi elle girebilirsiniz.
        </p>
      )}
    </div>
  )
}
