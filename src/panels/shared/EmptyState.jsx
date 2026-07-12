import { Sparkles } from 'lucide-react'

export default function EmptyState({ title, description, icon }) {
  const Icon = icon || Sparkles

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-panel-border bg-panel-surface px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-panel-lilac-soft text-panel-lilac">
        <Icon size={24} aria-hidden="true" />
      </div>
      <h2 className="text-lg font-semibold text-panel-text">{title}</h2>
      {description ? (
        <p className="max-w-sm text-base text-panel-text-muted">{description}</p>
      ) : null}
    </div>
  )
}
