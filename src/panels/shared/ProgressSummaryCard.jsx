export default function ProgressSummaryCard({ title, value, description, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-panel-border bg-panel-surface p-5">
      <div className="flex items-center gap-2 text-panel-text-muted">
        {Icon ? <Icon size={18} aria-hidden="true" /> : null}
        <span className="text-sm font-medium">{title}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-panel-text">{value}</p>
      {description ? <p className="mt-1 text-sm text-panel-text-muted">{description}</p> : null}
    </div>
  )
}
