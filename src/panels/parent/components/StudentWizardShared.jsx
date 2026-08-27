import { Calendar, Check } from 'lucide-react'

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

// Doğum tarihi alanı: boşken kutunun içinde "Doğum Tarihi" etiketi görünür (native
// "gg.aa.yyyy" metni şeffaflaştırılır); tıklanınca takvim açılır. min/max/name gibi
// ek nitelikler `rest` ile geçirilir.
export function BirthDateField({ value, onChange, disabled = false, className, ...rest }) {
  const hasValue = Boolean(value)
  return (
    <div className="relative">
      <FieldIcon icon={Calendar} />
      <input
        type="date"
        value={value || ''}
        onChange={onChange}
        disabled={disabled}
        aria-label="Doğum Tarihi"
        className={[
          'w-full rounded-xl border p-2 pl-9 text-base focus:border-panel-blue focus:outline-none',
          disabled
            ? 'cursor-not-allowed border-panel-border bg-[#f4f5f6] text-panel-text-muted'
            : 'border-panel-border text-panel-text',
          hasValue ? '' : 'text-transparent',
          className || '',
        ]
          .filter(Boolean)
          .join(' ')}
        {...rest}
      />
      {hasValue ? null : (
        <span className="pointer-events-none absolute left-9 top-1/2 -translate-y-1/2 text-base text-panel-text-muted">
          Doğum Tarihi
        </span>
      )}
    </div>
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
          <div key={item.key} className="flex shrink-0 items-center gap-2 sm:min-w-0 sm:flex-1 sm:gap-3">
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
              className={`whitespace-nowrap text-left text-xs font-semibold sm:min-w-0 sm:whitespace-normal sm:text-sm ${
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
