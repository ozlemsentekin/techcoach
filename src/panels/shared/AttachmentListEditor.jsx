import { useState } from 'react'
import { FileText, Paperclip, X } from 'lucide-react'
import {
  ATTACHMENT_ACCEPT,
  MAX_ATTACHMENT_COUNT,
  MAX_ATTACHMENTS_TOTAL_BYTES,
  attachmentBytes,
  pickAttachment,
} from '../../utils/fileAttachment'

const isImageUrl = (url) => url.startsWith('data:image/') || /^https?:.*\.(jpe?g|png|webp)$/i.test(url)

/**
 * Göreve birden fazla dosya ekleme alanı (en fazla MAX_ATTACHMENT_COUNT). Veli/öğrenci
 * "Görev Ekle" çekmecesi ve öğretmen "Konu Tekrarı" formunda ortak.
 * @param {{ url: string, name: string }[]} attachments
 * @param {(next: { url: string, name: string }[]) => void} onChange
 */
export default function AttachmentListEditor({ attachments, onChange, label = 'Dosya ekle (isteğe bağlı)' }) {
  const [error, setError] = useState('')
  const remaining = MAX_ATTACHMENT_COUNT - attachments.length

  const handleFiles = async (event) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!files.length) return
    setError('')
    if (files.length > remaining) {
      setError(`En fazla ${MAX_ATTACHMENT_COUNT} dosya ekleyebilirsin.`)
    }
    const next = [...attachments]
    let totalBytes = next.reduce((sum, item) => sum + attachmentBytes(item), 0)
    for (const file of files.slice(0, Math.max(0, remaining))) {
      const result = await pickAttachment(file)
      if (result.error) {
        setError(`${file.name}: ${result.error}`)
        continue
      }
      if (totalBytes + file.size > MAX_ATTACHMENTS_TOTAL_BYTES) {
        setError('Dosyaların toplam boyutu en fazla 15 MB olabilir.')
        break
      }
      totalBytes += file.size
      next.push({ url: result.url, name: result.name })
    }
    onChange(next)
  }

  const removeAt = (index) => {
    setError('')
    onChange(attachments.filter((_, i) => i !== index))
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-panel-text-muted">{label}</span>
      {attachments.map((attachment, index) => (
        <div
          key={`${attachment.name}-${index}`}
          className="flex items-center gap-3 rounded-xl border border-panel-border bg-white p-2.5"
        >
          {isImageUrl(attachment.url) ? (
            <img src={attachment.url} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
          ) : (
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-panel-blue-soft text-panel-blue">
              <FileText size={20} aria-hidden="true" />
            </span>
          )}
          <span className="min-w-0 flex-1 truncate text-sm text-panel-text">{attachment.name}</span>
          <button
            type="button"
            onClick={() => removeAt(index)}
            className="shrink-0 rounded-lg p-1.5 text-panel-text-muted hover:bg-panel-surface-soft hover:text-panel-warm"
            aria-label={`${attachment.name} dosyasını kaldır`}
          >
            <X size={16} />
          </button>
        </div>
      ))}
      {remaining > 0 ? (
        <label className="flex cursor-pointer items-center gap-2 self-start rounded-xl border border-dashed border-panel-border bg-white px-3 py-2.5 text-sm font-medium text-panel-blue hover:border-panel-blue hover:bg-panel-blue-soft">
          <Paperclip size={16} aria-hidden="true" />
          {attachments.length ? 'Başka dosya ekle' : 'Dosya seç'} (JPG, PNG, WEBP, PDF · dosya başına en fazla 5 MB ·{' '}
          en fazla {MAX_ATTACHMENT_COUNT} dosya)
          <input type="file" accept={ATTACHMENT_ACCEPT} multiple onChange={handleFiles} className="sr-only" />
        </label>
      ) : (
        <span className="text-xs text-panel-text-muted">En fazla {MAX_ATTACHMENT_COUNT} dosya eklenebilir.</span>
      )}
      {error ? <span className="text-xs text-panel-warm">{error}</span> : null}
    </div>
  )
}
