export default function LoadingState({ label = 'Yükleniyor...', fullScreen = false }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={
        fullScreen
          ? 'flex min-h-screen items-center justify-center bg-panel-bg text-panel-text-muted'
          : 'flex items-center justify-center py-12 text-panel-text-muted'
      }
    >
      <span className="text-base">{label}</span>
    </div>
  )
}
