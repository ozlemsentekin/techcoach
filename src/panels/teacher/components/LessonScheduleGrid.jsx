import { CalendarDays } from 'lucide-react'
import { Link } from 'react-router-dom'

const WEEKDAYS = [
  { id: 'pazartesi', label: 'Pazartesi' },
  { id: 'sali', label: 'Salı' },
  { id: 'carsamba', label: 'Çarşamba' },
  { id: 'persembe', label: 'Perşembe' },
  { id: 'cuma', label: 'Cuma' },
  { id: 'cumartesi', label: 'Cumartesi' },
  { id: 'pazar', label: 'Pazar' },
]

export default function LessonScheduleGrid({ entries }) {
  const entriesByDay = new Map(WEEKDAYS.map((day) => [day.id, []]))
  entries.forEach((entry) => {
    const list = entriesByDay.get(entry.dayOfWeek)
    if (list) list.push(entry)
  })
  entriesByDay.forEach((list) => list.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || '')))

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {WEEKDAYS.map((day) => {
        const dayEntries = entriesByDay.get(day.id) || []
        return (
          <div key={day.id} className="flex flex-col gap-2 rounded-2xl border border-panel-border bg-panel-surface p-3">
            <p className="text-sm font-bold text-panel-text">{day.label}</p>
            {dayEntries.length === 0 ? (
              <p className="text-xs text-panel-text-muted">Ders yok</p>
            ) : (
              <div className="flex flex-col gap-2">
                {dayEntries.map((entry, index) => (
                  <Link
                    key={`${entry.studentTeacherId}-${index}`}
                    to={`/teacher/students/${entry.studentTeacherId}`}
                    className="flex flex-col gap-1 rounded-xl bg-panel-blue-soft px-2.5 py-2 text-panel-blue hover:opacity-90"
                  >
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                      <CalendarDays size={12} aria-hidden="true" />
                      {entry.startTime}-{entry.endTime}
                    </span>
                    <span className="truncate text-sm font-bold">{entry.studentFullName}</span>
                    <span className="truncate text-xs">{entry.subjectName || 'Ders seçilmedi'}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
