import { useEffect, useRef } from 'react'
import { ArrowLeft, X } from 'lucide-react'

export default function TaskResourcePicker({ title, summary, canConfirm, onCancel, onConfirm, children }) {
  const dialogRef = useRef(null)
  const cancelRef = useRef(onCancel)
  useEffect(() => { cancelRef.current = onCancel }, [onCancel])

  useEffect(() => {
    const previousFocus = document.activeElement
    const dialog = dialogRef.current
    dialog.querySelector('button')?.focus()
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        cancelRef.current()
      }
      if (event.key === 'Tab') {
        const elements = [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]')].filter((element) => element.getClientRects().length)
        const first = elements[0]
        const last = elements[elements.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }
    }
    dialog.addEventListener('keydown', handleKeyDown)
    return () => {
      dialog.removeEventListener('keydown', handleKeyDown)
      previousFocus?.focus()
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel() }}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="task-resource-picker-title" className="flex h-[100dvh] w-full max-w-5xl flex-col overflow-hidden bg-panel-surface shadow-2xl sm:h-[min(90dvh,850px)] sm:rounded-2xl">
        <header className="flex shrink-0 items-center gap-3 border-b border-panel-border p-4 sm:px-6">
          <button type="button" onClick={onCancel} aria-label="Görev formuna dön" className="rounded-lg p-2 text-panel-text hover:bg-panel-blue-soft"><ArrowLeft size={20} /></button>
          <div className="flex-1">
            <h2 id="task-resource-picker-title" className="text-lg font-semibold text-panel-text">{title}</h2>
            <p className="mt-1 text-sm text-panel-text-muted">Dersi ve kaynağı seçin, ardından görev içeriğini belirleyin.</p>
          </div>
          <button type="button" onClick={onCancel} aria-label="Seçimden vazgeç" className="rounded-lg p-2 text-panel-text-muted hover:bg-panel-blue-soft"><X size={20} /></button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain p-4 sm:p-6 [&>*]:shrink-0">{children}</div>
        <footer className="flex shrink-0 flex-wrap items-center gap-3 border-t border-panel-border bg-panel-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
          <p aria-live="polite" className="w-full text-sm font-semibold text-panel-text sm:w-auto sm:flex-1">{summary}</p>
          <button type="button" onClick={onCancel} className="rounded-xl border border-panel-border px-4 py-3 text-sm font-semibold text-panel-text">Vazgeç</button>
          <button type="button" onClick={onConfirm} disabled={!canConfirm} className="flex-1 rounded-xl bg-panel-blue px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none">Seçimi tamamla</button>
        </footer>
      </section>
    </div>
  )
}
