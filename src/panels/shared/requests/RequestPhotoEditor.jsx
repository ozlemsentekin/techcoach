import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Crop, Loader2, RotateCcw, RotateCw, Undo2, X } from 'lucide-react'
import Button from '../../ui/Button'

const MAX_EDGE = 1600

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Görsel okunamadı.'))
    image.src = url
  })
}

/**
 * Talep fotoğrafı için tam ekran büyük önizleme + basit düzenleme.
 * "view" modunda görseli büyük gösterir (kontrol için); "crop" modunda
 * kullanıcı fare/dokunmayla bir alan seçip kırpabilir, 90° döndürebilir.
 * "Kaydet"te düzenlenmiş görseli JPEG data URL olarak `onSave` ile döndürür.
 */
export default function RequestPhotoEditor({ src, title, onSave, onClose }) {
  const [working, setWorking] = useState(src)
  const [mode, setMode] = useState('view') // 'view' | 'crop'
  const [sel, setSel] = useState(null) // { x, y, w, h } — görsel kutusuna göre 0..1
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const boxRef = useRef(null)
  const dragRef = useRef(null)

  const dirty = working !== src

  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== 'Escape') return
      if (mode === 'crop') {
        setMode('view')
        setSel(null)
      } else {
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, onClose])

  const rotate = async (direction) => {
    setBusy(true)
    setError('')
    try {
      const image = await loadImage(working)
      const w = image.naturalWidth
      const h = image.naturalHeight
      const canvas = document.createElement('canvas')
      canvas.width = h
      canvas.height = w
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.rotate(((direction === 'cw' ? 90 : -90) * Math.PI) / 180)
      ctx.drawImage(image, -w / 2, -h / 2)
      setWorking(canvas.toDataURL('image/jpeg', 0.9))
      setSel(null)
    } catch (err) {
      setError(err.message || 'Görsel döndürülemedi.')
    } finally {
      setBusy(false)
    }
  }

  const applyCrop = async () => {
    if (!sel || sel.w < 0.03 || sel.h < 0.03) {
      setMode('view')
      setSel(null)
      return
    }
    setBusy(true)
    setError('')
    try {
      const image = await loadImage(working)
      const w = image.naturalWidth
      const h = image.naturalHeight
      const sx = Math.round(sel.x * w)
      const sy = Math.round(sel.y * h)
      const sw = Math.max(1, Math.round(sel.w * w))
      const sh = Math.max(1, Math.round(sel.h * h))
      const scale = Math.min(1, MAX_EDGE / Math.max(sw, sh))
      const ow = Math.round(sw * scale)
      const oh = Math.round(sh * scale)
      const canvas = document.createElement('canvas')
      canvas.width = ow
      canvas.height = oh
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, ow, oh)
      ctx.drawImage(image, sx, sy, sw, sh, 0, 0, ow, oh)
      setWorking(canvas.toDataURL('image/jpeg', 0.9))
      setSel(null)
      setMode('view')
    } catch (err) {
      setError(err.message || 'Görsel kırpılamadı.')
    } finally {
      setBusy(false)
    }
  }

  const relativePoint = (event) => {
    const rect = boxRef.current.getBoundingClientRect()
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    }
  }

  const handlePointerDown = (event) => {
    if (mode !== 'crop' || busy) return
    event.preventDefault()
    const point = relativePoint(event)
    dragRef.current = point
    setSel({ x: point.x, y: point.y, w: 0, h: 0 })
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event) => {
    if (!dragRef.current) return
    const point = relativePoint(event)
    const start = dragRef.current
    setSel({
      x: Math.min(start.x, point.x),
      y: Math.min(start.y, point.y),
      w: Math.abs(point.x - start.x),
      h: Math.abs(point.y - start.y),
    })
  }

  const handlePointerUp = () => {
    dragRef.current = null
  }

  const startCrop = () => {
    setMode('crop')
    setSel(null)
    setError('')
  }

  const cancelCrop = () => {
    setMode('view')
    setSel(null)
  }

  const reset = () => {
    setWorking(src)
    setSel(null)
    setMode('view')
    setError('')
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-panel-text"
      role="dialog"
      aria-modal="true"
      aria-label={title ? `${title} — fotoğraf` : 'Fotoğraf'}
    >
      <div
        className="flex shrink-0 items-center justify-between gap-3 px-4 pb-2"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        <h2 className="min-w-0 truncate text-sm font-semibold text-white">
          {mode === 'crop' ? 'Kırpmak için bir alan seçin' : title || 'Fotoğraf'}
        </h2>
        <button
          type="button"
          aria-label="Kapat"
          onClick={onClose}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3">
        <div ref={boxRef} className="relative inline-block leading-none">
          <img
            src={working}
            alt={title ? `${title} fotoğrafı` : 'Fotoğraf'}
            draggable={false}
            className="block max-h-[74vh] max-w-full select-none rounded-lg object-contain"
          />
          {mode === 'crop' ? (
            <div
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className="absolute inset-0 cursor-crosshair touch-none"
            >
              {sel && sel.w > 0 && sel.h > 0 ? (
                <div
                  className="pointer-events-none absolute border-2 border-white"
                  style={{
                    left: `${sel.x * 100}%`,
                    top: `${sel.y * 100}%`,
                    width: `${sel.w * 100}%`,
                    height: `${sel.h * 100}%`,
                    boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
                  }}
                />
              ) : (
                <div className="pointer-events-none absolute inset-0 bg-black/30" />
              )}
            </div>
          ) : null}
          {busy ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <Loader2 size={28} className="animate-spin text-white" aria-hidden="true" />
            </div>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="px-4 pb-1 text-center text-xs text-red-300">{error}</p>
      ) : null}

      <div
        className="flex shrink-0 flex-wrap items-center justify-center gap-2 border-t border-white/10 px-4 pt-3"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        {mode === 'crop' ? (
          <>
            <Button variant="secondary" onClick={cancelCrop} disabled={busy}>
              Vazgeç
            </Button>
            <Button onClick={applyCrop} disabled={busy || !sel || sel.w < 0.03 || sel.h < 0.03}>
              <Crop size={16} aria-hidden="true" />
              Kırp
            </Button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => rotate('ccw')}
              disabled={busy}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white/15 px-3 text-sm font-medium text-white hover:bg-white/25 disabled:opacity-40"
            >
              <RotateCcw size={16} aria-hidden="true" />
              Sola
            </button>
            <button
              type="button"
              onClick={() => rotate('cw')}
              disabled={busy}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white/15 px-3 text-sm font-medium text-white hover:bg-white/25 disabled:opacity-40"
            >
              <RotateCw size={16} aria-hidden="true" />
              Sağa
            </button>
            <button
              type="button"
              onClick={startCrop}
              disabled={busy}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white/15 px-3 text-sm font-medium text-white hover:bg-white/25 disabled:opacity-40"
            >
              <Crop size={16} aria-hidden="true" />
              Kırp
            </button>
            {dirty ? (
              <button
                type="button"
                onClick={reset}
                disabled={busy}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white/15 px-3 text-sm font-medium text-white hover:bg-white/25 disabled:opacity-40"
              >
                <Undo2 size={16} aria-hidden="true" />
                Sıfırla
              </button>
            ) : null}
            <Button onClick={() => onSave(working)} disabled={busy || !dirty}>
              <Check size={16} aria-hidden="true" />
              Kaydet
            </Button>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
