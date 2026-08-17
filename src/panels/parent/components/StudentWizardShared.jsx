import { Check } from 'lucide-react'

export function FieldIcon({ icon }) {
  const Icon = icon
  return (
    <Icon
      size={16}
      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-panel-blue"
      aria-hidden="true"
    />
  )
}

export function WizardSteps({ step, steps, onStepClick }) {
  const clickable = typeof onStepClick === 'function'

  return (
    <div className="flex items-center gap-2 overflow-x-auto bg-panel-accent-soft px-4 py-3 sm:gap-3 sm:px-6 sm:py-3.5">
      {steps.map((item, index) => {
        const isActive = item.key === step
        const isDone = item.key < step
        return (
          <div key={item.key} className="flex shrink-0 items-center gap-2 sm:flex-1 sm:gap-3">
            <button
              type="button"
              disabled={!clickable}
              onClick={() => onStepClick?.(item.key)}
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors sm:h-8 sm:w-8 sm:text-sm ${
                isActive
                  ? 'bg-panel-warm text-white shadow-[0_4px_10px_rgba(201,106,31,0.35)]'
                  : isDone
                    ? 'bg-panel-warm text-white'
                    : 'border border-panel-border-strong bg-white text-panel-text-muted'
              } ${clickable ? 'cursor-pointer' : ''}`}
            >
              {isDone ? <Check size={14} aria-hidden="true" /> : item.key}
            </button>
            <button
              type="button"
              disabled={!clickable}
              onClick={() => onStepClick?.(item.key)}
              className={`whitespace-nowrap text-left text-xs font-semibold sm:text-sm ${
                isActive ? 'text-panel-warm' : isDone ? 'text-panel-text' : 'text-panel-text-muted'
              } ${clickable ? 'cursor-pointer' : ''}`}
            >
              {item.label}
            </button>
            {index < steps.length - 1 ? (
              <span className={`hidden h-0.5 flex-1 rounded-full sm:block ${isDone ? 'bg-panel-warm' : 'bg-panel-border-strong'}`} />
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
