import { useState } from 'react'
import { Loader2, Trash2, X } from 'lucide-react'
import { todayISODate } from '../../../utils/time'
import {
  updateTeacherRecurringLesson,
  deleteTeacherRecurringLesson,
  deleteTeacherRecurringLessonOccurrence,
  updateTeacherOneTimeLesson,
  deleteTeacherOneTimeLesson,
} from '../../../services/teacherService'

function formatOccurrenceDate(dateISO) {
  if (!dateISO) return 'bu hafta'
  return new Date(dateISO).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })
}

const WEEKDAYS = [
  { id: 'pazartesi', label: 'Pzt' },
  { id: 'sali', label: 'Sal' },
  { id: 'carsamba', label: 'Çar' },
  { id: 'persembe', label: 'Per' },
  { id: 'cuma', label: 'Cum' },
  { id: 'cumartesi', label: 'Cmt' },
  { id: 'pazar', label: 'Paz' },
]

const DURATION_OPTIONS = [30, 45, 60, 90]

function DurationPicker({ value, onChange }) {
  const [customValue, setCustomValue] = useState('')
  const isPreset = DURATION_OPTIONS.includes(value)

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-panel-text-muted">Süre</span>
      <div className="grid grid-cols-2 gap-2 min-[380px]:grid-cols-3 sm:grid-cols-5">
        {DURATION_OPTIONS.map((minutes) => (
          <button
            key={minutes}
            type="button"
            onClick={() => {
              setCustomValue('')
              onChange(minutes)
            }}
            className={`h-11 rounded-xl border text-sm font-bold transition-colors duration-150 ${
              isPreset && value === minutes
                ? 'border-panel-blue bg-panel-blue-soft text-panel-blue'
                : 'border-panel-border bg-panel-surface text-panel-text hover:bg-panel-surface-soft'
            }`}
          >
            {minutes} dk
          </button>
        ))}
        <input
          type="number"
          min="5"
          max="480"
          value={customValue}
          onChange={(event) => {
            setCustomValue(event.target.value)
            const minutes = Number(event.target.value)
            if (minutes > 0) onChange(minutes)
          }}
          placeholder="Özel"
          className={`h-11 min-w-0 rounded-xl border px-2 text-center text-sm font-bold text-panel-text focus:border-panel-blue focus:outline-none ${
            !isPreset && value ? 'border-panel-blue bg-panel-blue-soft' : 'border-panel-border bg-panel-surface'
          }`}
        />
      </div>
    </div>
  )
}

function durationFromTimes(startTime, endTime) {
  const [startHours, startMinutes] = startTime.split(':').map(Number)
  const [endHours, endMinutes] = endTime.split(':').map(Number)
  return endHours * 60 + endMinutes - (startHours * 60 + startMinutes)
}

export default function EditLessonModal({ entry, onSave, onDelete, onClose }) {
  const [dayOfWeek, setDayOfWeek] = useState(entry.isOneTime ? WEEKDAYS[0].id : entry.dayOfWeek)
  const [date, setDate] = useState(entry.isOneTime ? entry.date : todayISODate())
  const [startTime, setStartTime] = useState(entry.startTime)
  const [durationMinutes, setDurationMinutes] = useState(durationFromTimes(entry.startTime, entry.endTime))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (saving || deleting) return

    setSaving(true)
    setSaveError('')
    try {
      if (entry.isOneTime) {
        await updateTeacherOneTimeLesson(entry.studentTeacherId, entry.id, { date, startTime, durationMinutes })
      } else {
        await updateTeacherRecurringLesson(entry.studentTeacherId, {
          originalDayOfWeek: entry.dayOfWeek,
          originalStartTime: entry.startTime,
          dayOfWeek,
          startTime,
          durationMinutes,
        })
      }
      await onSave()
    } catch (err) {
      setSaveError(err.message || 'Bir hata oluştu, tekrar deneyin.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (scope = 'series') => {
    if (saving || deleting) return
    setDeleting(true)
    setSaveError('')
    try {
      if (entry.isOneTime) {
        await deleteTeacherOneTimeLesson(entry.studentTeacherId, entry.id)
      } else if (scope === 'occurrence') {
        await deleteTeacherRecurringLessonOccurrence(entry.studentTeacherId, {
          dayOfWeek: entry.dayOfWeek,
          startTime: entry.startTime,
          date: entry.occurrenceDate,
        })
      } else {
        await deleteTeacherRecurringLesson(entry.studentTeacherId, { dayOfWeek: entry.dayOfWeek, startTime: entry.startTime })
      }
      await onDelete()
    } catch (err) {
      setSaveError(err.message || 'Bir hata oluştu, tekrar deneyin.')
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="h-full w-full max-w-lg overflow-y-auto border border-panel-border bg-panel-surface p-4 shadow-panel-1 sm:h-auto sm:max-h-[90vh] sm:rounded-2xl sm:p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-panel-text">Dersi Düzenle</h2>
            <p className="text-xs text-panel-text-muted">
              {entry.studentFullName} · {entry.subjectName || 'Ders seçilmedi'}
            </p>
          </div>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {entry.isOneTime ? (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-panel-text-muted">Tarih</span>
              <input
                type="date"
                required
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="rounded-xl border border-panel-border p-3 text-sm text-panel-text"
              />
            </label>
          ) : (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-panel-text-muted">Gün</span>
              <div className="grid grid-cols-3 gap-2 min-[420px]:grid-cols-4 sm:grid-cols-7">
                {WEEKDAYS.map((day) => (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => setDayOfWeek(day.id)}
                    className={`h-11 rounded-xl border text-sm font-bold transition-colors duration-150 ${
                      dayOfWeek === day.id
                        ? 'border-panel-blue bg-panel-blue-soft text-panel-blue'
                        : 'border-panel-border bg-panel-surface text-panel-text hover:bg-panel-surface-soft'
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-panel-text-muted">Başlangıç saati</span>
            <input
              type="time"
              required
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              className="rounded-xl border border-panel-border p-3 text-sm text-panel-text"
            />
          </label>

          <DurationPicker value={durationMinutes} onChange={setDurationMinutes} />

          {saveError ? <span className="text-xs text-panel-warm">{saveError}</span> : null}

          {!entry.isOneTime && confirmingDelete ? (
            <div className="flex flex-col gap-2 rounded-xl border border-panel-warm/40 bg-panel-warm/5 p-3">
              <span className="text-xs font-medium text-panel-text">
                Bu ders her hafta tekrar ediyor. Ne silinsin?
              </span>
              <button
                type="button"
                onClick={() => handleDelete('occurrence')}
                disabled={saving || deleting}
                className="flex h-11 items-center justify-center gap-2 rounded-xl border border-panel-warm/40 px-4 text-sm font-semibold text-panel-warm hover:bg-panel-warm/10 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} aria-hidden="true" />}
                Sadece {formatOccurrenceDate(entry.occurrenceDate)} dersini sil
              </button>
              <button
                type="button"
                onClick={() => handleDelete('series')}
                disabled={saving || deleting}
                className="flex h-11 items-center justify-center gap-2 rounded-xl border border-panel-warm/40 px-4 text-sm font-semibold text-panel-warm hover:bg-panel-warm/10 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} aria-hidden="true" />}
                Tüm haftalardan sil
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                disabled={saving || deleting}
                className="flex h-11 items-center justify-center rounded-xl border border-panel-border px-4 text-sm font-semibold text-panel-text hover:bg-panel-surface-soft disabled:cursor-not-allowed disabled:opacity-70"
              >
                Vazgeç
              </button>
            </div>
          ) : null}

          <div className="flex flex-col gap-2 min-[420px]:flex-row">
            <button
              type="button"
              onClick={() => (entry.isOneTime ? handleDelete('series') : setConfirmingDelete(true))}
              disabled={saving || deleting || (!entry.isOneTime && confirmingDelete)}
              className="flex h-12 items-center justify-center gap-2 rounded-xl border border-panel-warm/40 px-4 text-sm font-semibold text-panel-warm hover:bg-panel-warm/10 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} aria-hidden="true" />}
              Dersi Sil
            </button>
            <button
              type="submit"
              disabled={saving || deleting}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-panel-blue px-4 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : null}
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
