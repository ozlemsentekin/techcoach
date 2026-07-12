export default function ConfirmationDialog({
  title,
  description,
  confirmLabel = 'Onayla',
  cancelLabel = 'Vazgeç',
  onConfirm,
  onCancel,
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-sm rounded-2xl border border-panel-border bg-panel-surface p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-panel-text">{title}</h2>
        {description ? <p className="mt-2 text-base text-panel-text-muted">{description}</p> : null}
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-panel-border px-4 py-3 text-base font-medium text-panel-text"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-panel-blue px-4 py-3 text-base font-medium text-white"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
