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
      className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-black/30 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full min-w-0 max-w-full overflow-x-hidden rounded-t-3xl border border-panel-border bg-panel-surface p-5 shadow-lg sm:max-w-sm sm:rounded-2xl sm:p-6">
        <h2 className="break-words text-lg font-semibold text-panel-text">{title}</h2>
        {description ? <p className="mt-2 break-words text-base text-panel-text-muted">{description}</p> : null}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:gap-3">
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
