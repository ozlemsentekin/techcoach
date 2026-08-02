import { HeartPulse } from 'lucide-react'
import { ENERGY_LEVELS, ENERGY_MESSAGES } from '../../../data/taskTypes'

export default function EnergyCheckIn({ selectedLevel, onSelect }) {
  return (
    <section className="panel-card p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-student-theme-soft text-student-theme-text">
          <HeartPulse size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-panel-text">Enerji Durumu</h2>
          <p className="mt-1 text-sm text-panel-text-muted">Bugün kendini nasıl hissediyorsun?</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
        {ENERGY_LEVELS.map((level) => (
          <button
            key={level.id}
            type="button"
            onClick={() => onSelect(level.id)}
            aria-pressed={selectedLevel === level.id}
            className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-student-theme-primary ${
              selectedLevel === level.id
                ? 'border-student-theme-primary bg-student-theme-soft text-student-theme-text'
                : 'border-panel-border text-panel-text hover:border-student-theme-primary hover:bg-student-theme-soft hover:text-student-theme-text'
            }`}
          >
            <span className="text-lg" aria-hidden="true">
              {level.icon}
            </span>
            {level.label}
          </button>
        ))}
      </div>
      {selectedLevel ? (
        <p className="mt-4 rounded-xl bg-student-theme-soft px-4 py-3 text-sm font-medium text-panel-text">
          {ENERGY_MESSAGES[selectedLevel]}
        </p>
      ) : null}
    </section>
  )
}
