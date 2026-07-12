import { ENERGY_LEVELS, ENERGY_MESSAGES } from '../../../data/taskTypes'

export default function EnergyCheckIn({ selectedLevel, onSelect }) {
  return (
    <div className="rounded-2xl border border-panel-border bg-panel-surface p-6">
      <h2 className="text-lg font-semibold text-panel-text">Bugün kendini nasıl hissediyorsun?</h2>
      <div className="mt-4 grid grid-cols-5 gap-2">
        {ENERGY_LEVELS.map((level) => (
          <button
            key={level.id}
            type="button"
            onClick={() => onSelect(level.id)}
            aria-pressed={selectedLevel === level.id}
            aria-label={level.label}
            className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-center transition-colors ${
              selectedLevel === level.id
                ? 'border-panel-blue bg-panel-blue-soft'
                : 'border-panel-border hover:bg-panel-bg'
            }`}
          >
            <span className="text-2xl" aria-hidden="true">
              {level.icon}
            </span>
            <span className="text-xs font-medium leading-tight text-panel-text">{level.label}</span>
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
