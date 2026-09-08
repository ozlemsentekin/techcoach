import { FileText, ImageIcon } from 'lucide-react'

/**
 * Bir görevin dosya ekini (resim veya PDF; base64 data URL) gösterir.
 * Tıklayınca dosyayı yeni sekmede açar — data URL'ler bazı tarayıcılarda üst düzey
 * gezinmede engellendiğinden önce Blob URL'ye çevrilir.
 */
export default function TaskAttachment({ url, name, label = 'Ek dosya', className = '' }) {
  if (!url) return null

  const isImage = url.startsWith('data:image/') || /\.(jpe?g|png|webp)$/i.test(url)

  const openAttachment = () => {
    try {
      if (url.startsWith('data:')) {
        const [meta, base64] = url.split(',')
        const mime = meta.slice(5, meta.indexOf(';')) || 'application/octet-stream'
        const bytes = atob(base64)
        const buffer = new Uint8Array(bytes.length)
        for (let i = 0; i < bytes.length; i += 1) buffer[i] = bytes.charCodeAt(i)
        const blobUrl = URL.createObjectURL(new Blob([buffer], { type: mime }))
        window.open(blobUrl, '_blank', 'noopener')
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000)
      } else {
        window.open(url, '_blank', 'noopener')
      }
    } catch {
      window.open(url, '_blank', 'noopener')
    }
  }

  return (
    <button
      type="button"
      onClick={openAttachment}
      className={`flex w-full items-center gap-3 rounded-xl border border-panel-border bg-panel-surface p-2.5 text-left transition-colors hover:border-panel-blue hover:bg-panel-blue-soft/50 ${className}`}
    >
      {isImage ? (
        <img src={url} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
      ) : (
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-panel-blue-soft text-panel-blue">
          <FileText size={20} aria-hidden="true" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium uppercase tracking-wide text-panel-text-muted">{label}</span>
        <span className="flex items-center gap-1 truncate text-sm font-medium text-panel-text">
          {isImage ? <ImageIcon size={13} aria-hidden="true" /> : <FileText size={13} aria-hidden="true" />}
          <span className="truncate">{name || 'dosya'}</span>
        </span>
      </span>
    </button>
  )
}
