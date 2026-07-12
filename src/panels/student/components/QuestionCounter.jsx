export default function QuestionCounter({ value, target, onChange }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-panel-border bg-panel-surface p-6">
      <p className="text-sm font-medium text-panel-text-muted">Çözülen soru sayısı</p>
      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label="Soru sayısını azalt"
          onClick={() => onChange(Math.max(0, value - 1))}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-panel-border text-xl font-semibold text-panel-text"
        >
          −
        </button>
        <span className="min-w-[3ch] text-center text-3xl font-semibold text-panel-text">{value}</span>
        <button
          type="button"
          aria-label="Soru sayısını artır"
          onClick={() => onChange(target ? Math.min(target, value + 1) : value + 1)}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-panel-border text-xl font-semibold text-panel-text"
        >
          +
        </button>
      </div>
      {target ? <p className="text-sm text-panel-text-muted">Hedef: {target} soru</p> : null}
    </div>
  )
}
