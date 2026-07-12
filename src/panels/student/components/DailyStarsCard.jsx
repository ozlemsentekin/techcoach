import { Star } from 'lucide-react'
import { STAR_MESSAGES } from '../../../data/coachMessages'

export default function DailyStarsCard({ count, criteria }) {
  return (
    <div className="rounded-2xl border border-panel-border bg-panel-surface p-6">
      <h2 className="text-lg font-semibold text-panel-text">Bugün {count} gelişim yıldızı kazandın</h2>
      <div className="mt-3 flex gap-1" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((index) => (
          <Star
            key={index}
            size={26}
            className={index < count ? 'fill-panel-accent text-panel-accent' : 'text-panel-border'}
          />
        ))}
      </div>
      <ul className="mt-4 flex flex-col gap-2">
        {criteria.map((item) => (
          <li key={item.label} className="flex items-center gap-2 text-sm text-panel-text-muted">
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
                item.achieved ? 'bg-panel-sage-soft text-panel-sage' : 'bg-panel-border text-panel-text-muted'
              }`}
              aria-hidden="true"
            >
              {item.achieved ? '✓' : ''}
            </span>
            <span className={item.achieved ? 'text-panel-text' : ''}>{item.label}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-panel-text-muted">
        {STAR_MESSAGES[count]} Bir yıldızın eksik olması günün kötü geçtiği anlamına gelmez.
      </p>
    </div>
  )
}
