import { ENERGY_LEVELS, ENERGY_MESSAGES } from '../../../data/taskTypes'

export default function EnergyCheckIn({ selectedLevel, onSelect }) {
  return (
    <div className="panel-card p-6">
      <h2 className="text-lg font-semibold text-panel-text">Bugün kendini nasıl hissediyorsun?</h2>
      <p className="mt-1 text-sm text-panel-text-muted">Kendini ifade etmek, motivasyonunu artırır.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {ENERGY_LEVELS.map((level) => (
          <button
            key={level.id}
            type="button"
            onClick={() => onSelect(level.id)}
            aria-pressed={selectedLevel === level.id}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors ${
              selectedLevel === level.id
                ? 'border-panel-blue bg-panel-blue-soft text-panel-blue'
                : 'border-panel-border text-panel-text hover:bg-panel-surface-soft'
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
        <p className="mt-4 rounded-xl bg-panel-blue-soft px-4 py-3 text-base text-panel-text">
          {ENERGY_MESSAGES[selectedLevel]}
        </p>
      ) : null}
    </div>
  )
}
