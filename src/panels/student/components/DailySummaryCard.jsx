export default function DailySummaryCard({ items }) {
  return (
    <div className="rounded-2xl border border-panel-border bg-panel-surface p-6">
      <h2 className="text-lg font-semibold text-panel-text">Bugün seni bekleyenler</h2>
      <ul className="mt-3 flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-2 text-base text-panel-text-muted">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-panel-sage" aria-hidden="true" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}
