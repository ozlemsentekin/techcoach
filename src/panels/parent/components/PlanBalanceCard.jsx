import { CheckCircle2, AlertTriangle } from 'lucide-react'

export default function PlanBalanceCard({ warnings }) {
  return (
    <div className="rounded-2xl border border-panel-border bg-panel-surface p-5">
      <h2 className="text-base font-semibold text-panel-text">Plan Denge Kontrolü</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {warnings.map((warning) => (
          <div
            key={warning.title}
            className={`rounded-xl border p-3 ${
              warning.tone === 'ok'
                ? 'border-panel-sage bg-panel-sage-soft'
                : 'border-panel-accent bg-panel-accent-soft'
            }`}
          >
            <div className="flex items-center gap-2">
              {warning.tone === 'ok' ? (
                <CheckCircle2 size={16} className="text-panel-sage" aria-hidden="true" />
              ) : (
                <AlertTriangle size={16} className="text-panel-warm" aria-hidden="true" />
              )}
              <p className="text-sm font-semibold text-panel-text">{warning.title}</p>
            </div>
            <p className="mt-1 text-sm text-panel-text-muted">{warning.message}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
