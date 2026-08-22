import { CalendarDays } from 'lucide-react'
import Badge from '../../ui/Badge'

const WEEKDAYS = [
  { id: 'pazartesi', label: 'Pazartesi' },
  { id: 'sali', label: 'Salı' },
  { id: 'carsamba', label: 'Çarşamba' },
  { id: 'persembe', label: 'Perşembe' },
  { id: 'cuma', label: 'Cuma' },
  { id: 'cumartesi', label: 'Cumartesi' },
  { id: 'pazar', label: 'Pazar' },
]

function formatDayDate(dateISO) {
  return new Date(dateISO).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
}

export default function LessonScheduleGrid({ recurringEntries, oneTimeEntries, weekDates, onEntryClick }) {
  const entriesByDay = new Map(WEEKDAYS.map((day) => [day.id, []]))

  recurringEntries.forEach((entry) => {
    const list = entriesByDay.get(entry.dayOfWeek)
    if (list) list.push({ ...entry, isOneTime: false })
  })

  const dateToDay = new Map(weekDates.map((date, index) => [date, WEEKDAYS[index].id]))
  oneTimeEntries.forEach((entry) => {
    const dayId = dateToDay.get(entry.date)
    const list = dayId ? entriesByDay.get(dayId) : null
    if (list) list.push({ ...entry, isOneTime: true })
  })

  entriesByDay.forEach((list) => list.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || '')))

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
      {WEEKDAYS.map((day, index) => {
        const dayEntries = entriesByDay.get(day.id) || []
        return (
          <div key={day.id} className="flex flex-col gap-2 rounded-2xl border border-panel-border bg-panel-surface p-3">
            <p className="text-sm font-bold text-panel-text">{day.label}</p>
            {weekDates?.[index] ? (
              <p className="-mt-1.5 text-xs font-semibold text-panel-text-muted">{formatDayDate(weekDates[index])}</p>
            ) : null}
            {dayEntries.length === 0 ? (
              <p className="text-xs text-panel-text-muted">Ders yok</p>
            ) : (
              <div className="flex flex-col gap-2">
                {dayEntries.map((entry, entryIndex) => (
                  <button
                    key={entry.isOneTime ? entry.id : `${entry.studentTeacherId}-${entryIndex}`}
                    type="button"
                    onClick={() => onEntryClick?.(entry)}
                    className="flex flex-col gap-1 rounded-xl border border-[#f07b31]/45 bg-white px-2.5 py-2 text-left text-panel-blue shadow-[0_8px_20px_-6px_rgba(240,123,49,0.4)] hover:opacity-90"
                  >
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                        <CalendarDays size={12} aria-hidden="true" />
                        {entry.startTime}-{entry.endTime}
                      </span>
                      {entry.isOneTime ? (
                        <Badge tone="lilac" className="shrink-0">
                          Tek seferlik
                        </Badge>
                      ) : null}
                    </span>
                    <span className="truncate text-sm font-bold">{entry.studentFullName}</span>
                    <span className="truncate text-xs">{entry.subjectName || 'Ders seçilmedi'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
