import { useState } from 'react'
import { X } from 'lucide-react'
import { RESCHEDULE_REASONS } from '../../../data/taskTypes'
import { todayISODate } from '../../../utils/time'

function tomorrowISODate() {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export default function RescheduleTaskModal({ task, onConfirm, onClose }) {
  const [newDate, setNewDate] = useState(tomorrowISODate())
  const [newTime, setNewTime] = useState(task.startTime)
  const [reason, setReason] = useState(RESCHEDULE_REASONS[0])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 md:items-center md:p-4">
      <div className="w-full max-w-md rounded-t-3xl border border-panel-border bg-panel-surface p-6 md:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-panel-text">"{task.title}" görevini taşı</h2>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-panel-text-muted">Yeni tarih</span>
              <input
                type="date"
                min={todayISODate()}
                value={newDate}
                onChange={(event) => setNewDate(event.target.value)}
                className="rounded-xl border border-panel-border p-3 text-base text-panel-text"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-panel-text-muted">Yeni saat</span>
              <input
                type="time"
                value={newTime}
                onChange={(event) => setNewTime(event.target.value)}
                className="rounded-xl border border-panel-border p-3 text-base text-panel-text"
              />
            </label>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-panel-text-muted">Neden taşıyorsun?</p>
            <div className="flex flex-wrap gap-2">
              {RESCHEDULE_REASONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setReason(option)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                    reason === option
                      ? 'border-panel-blue bg-panel-blue-soft text-panel-blue'
                      : 'border-panel-border text-panel-text'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onConfirm({ newDate, newTime, reason })}
            className="rounded-xl bg-panel-blue px-4 py-3 text-base font-semibold text-white"
          >
            Taşı
          </button>
        </div>
      </div>
    </div>
  )
}
