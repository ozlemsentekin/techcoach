import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

export default function SchoolPhotoModal({ photo, onClose }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    const dialog = dialogRef.current
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    return () => {
      dialog.close()
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [])

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="school-photo-title"
      onCancel={(event) => { event.preventDefault(); onClose() }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] max-w-5xl overflow-y-auto rounded-2xl border border-panel-border bg-panel-surface p-0 text-panel-text shadow-panel-2 backdrop:bg-black/70"
    >
      <div className="overflow-hidden rounded-2xl">
        <div className="flex items-center justify-between gap-3 px-4 py-2">
          <h2 id="school-photo-title" className="text-base font-bold">{photo.name}</h2>
          <button autoFocus type="button" onClick={onClose} aria-label="Fotoğrafı kapat" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-panel-text-muted hover:bg-student-theme-soft/40 focus-visible:outline-2 focus-visible:outline-student-theme-primary">
            <X size={22} aria-hidden="true" />
          </button>
        </div>
        <img src={photo.largeSrc} alt={photo.alt} className="max-h-[calc(100dvh-104px)] w-full object-contain" />
      </div>
    </dialog>
  )
}
