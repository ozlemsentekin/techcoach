import { CalendarClock } from 'lucide-react'
import { todayISODate } from '../../../utils/time'

function daysUntil(dateISO) {
  const diff = Math.round((new Date(dateISO) - new Date(todayISODate())) / (1000 * 60 * 60 * 24))
  if (diff <= 0) return 'Bugün'
  if (diff === 1) return '1 gün kaldı'
  return `${diff} gün kaldı`
}

export default function UpcomingDeadlinesCard({ homeworks }) {
  const upcoming = [...homeworks]
    .filter((homework) => homework.status !== 'tamamlandi')
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 3)

  return (
    <div className="rounded-2xl border border-panel-border bg-panel-surface p-5">
      <h2 className="text-base font-semibold text-panel-text">Yaklaşan Teslimler</h2>
      {upcoming.length === 0 ? (
        <p className="mt-2 text-sm text-panel-text-muted">Yaklaşan bir teslim yok.</p>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {upcoming.map((homework) => (
            <div key={homework.id} className="flex items-start gap-2">
              <CalendarClock size={16} className="mt-0.5 text-panel-text-muted" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-panel-text">
                  {homework.subject} {homework.title}
                </p>
                <p className="text-xs text-panel-text-muted">{daysUntil(homework.dueDate)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
