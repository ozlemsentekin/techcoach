import { useState } from 'react'
import { Loader2, Trash2, X } from 'lucide-react'
import { todayISODate } from '../../../utils/time'
import {
  updateTeacherRecurringLesson,
  deleteTeacherRecurringLesson,
  moveTeacherRecurringLessonOccurrence,
} from '../../../services/teacherService'

const WEEKDAYS = [
  { id: 'pazartesi', label: 'Pazartesi' },
  { id: 'sali', label: 'Salı' },
  { id: 'carsamba', label: 'Çarşamba' },
  { id: 'persembe', label: 'Perşembe' },
  { id: 'cuma', label: 'Cuma' },
  { id: 'cumartesi', label: 'Cumartesi' },
  { id: 'pazar', label: 'Pazar' },
]

const WEEKDAY_SHORT = [
  { id: 'pazartesi', label: 'Pzt' },
  { id: 'sali', label: 'Sal' },
  { id: 'carsamba', label: 'Çar' },
  { id: 'persembe', label: 'Per' },
  { id: 'cuma', label: 'Cum' },
  { id: 'cumartesi', label: 'Cmt' },
  { id: 'pazar', label: 'Paz' },
]

const DURATION_OPTIONS = [30, 45, 60, 90]

function durationFromTimes(startTime, endTime) {
  const [startHours, startMinutes] = startTime.split(':').map(Number)
  const [endHours, endMinutes] = endTime.split(':').map(Number)
  return endHours * 60 + endMinutes - (startHours * 60 + startMinutes)
}

function formatSlotDate(dateISO) {
  if (!dateISO) return ''
  return new Date(dateISO).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })
}

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

export default function ScheduleSlotModal({ studentTeacherId, slot, onDone, onClose }) {
  const [mode, setMode] = useState('choose')
  const [date, setDate] = useState(slot.date)
  const [dayOfWeek, setDayOfWeek] = useState(slot.dayOfWeek)
  const [startTime, setStartTime] = useState(slot.startTime)
  const [durationMinutes, setDurationMinutes] = useState(durationFromTimes(slot.startTime, slot.endTime))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saveError, setSaveError] = useState('')

  const dayLabel = WEEKDAYS.find((day) => day.id === slot.dayOfWeek)?.label || slot.dayOfWeek

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (saving || deleting) return

    setSaving(true)
    setSaveError('')
    try {
      if (mode === 'occurrence') {
        await moveTeacherRecurringLessonOccurrence(studentTeacherId, {
          dayOfWeek: slot.dayOfWeek,
          originalStartTime: slot.startTime,
          originalDate: slot.date,
          date,
          startTime,
          durationMinutes,
        })
      } else {
        await updateTeacherRecurringLesson(studentTeacherId, {
          originalDayOfWeek: slot.dayOfWeek,
          originalStartTime: slot.startTime,
          dayOfWeek,
          startTime,
          durationMinutes,
        })
      }
      await onDone()
    } catch (err) {
      setSaveError(err.message || 'Bir hata oluştu, tekrar deneyin.')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteSeries = async () => {
    if (saving || deleting) return
    setDeleting(true)
    setSaveError('')
    try {
      await deleteTeacherRecurringLesson(studentTeacherId, { dayOfWeek: slot.dayOfWeek, startTime: slot.startTime })
      await onDone()
    } catch (err) {
      setSaveError(err.message || 'Bir hata oluştu, tekrar deneyin.')
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <div className="h-full w-full max-w-lg overflow-y-auto border border-panel-border bg-panel-surface p-4 shadow-panel-1 sm:h-auto sm:max-h-[90vh] sm:rounded-2xl sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-panel-text">Planlı Ders</h2>
            <p className="text-xs text-panel-text-muted">
              {dayLabel} {formatSlotDate(slot.date)} · {slot.startTime}-{slot.endTime}
            </p>
          </div>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {mode === 'choose' ? (
          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => {
                setDate(slot.date)
                setStartTime(slot.startTime)
                setDurationMinutes(durationFromTimes(slot.startTime, slot.endTime))
                setMode('occurrence')
              }}
              className="flex h-12 items-center justify-center rounded-xl border border-panel-blue-soft bg-panel-surface px-4 text-sm font-semibold text-panel-blue hover:bg-panel-blue-soft/50"
            >
              Sadece Bu Dersi Güncelle
            </button>
            <button
              type="button"
              onClick={() => {
                setDayOfWeek(slot.dayOfWeek)
                setStartTime(slot.startTime)
                setDurationMinutes(durationFromTimes(slot.startTime, slot.endTime))
                setMode('series')
              }}
              className="flex h-12 items-center justify-center rounded-xl border border-panel-blue-soft bg-panel-surface px-4 text-sm font-semibold text-panel-blue hover:bg-panel-blue-soft/50"
            >
              Tüm Seri İçin Güncelle
            </button>
            {saveError ? <span className="text-xs text-panel-warm">{saveError}</span> : null}
            <button
              type="button"
              onClick={handleDeleteSeries}
              disabled={deleting}
              className="flex h-12 items-center justify-center gap-2 rounded-xl border border-panel-warm/40 px-4 text-sm font-semibold text-panel-warm hover:bg-panel-warm/10 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} aria-hidden="true" />}
              Serinin Tamamını Sil
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {mode === 'occurrence' ? (
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-panel-text-muted">Yeni tarih</span>
                <input
                  type="date"
                  required
                  min={todayISODate()}
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className="rounded-xl border border-panel-border p-3 text-sm text-panel-text"
                />
              </label>
            ) : (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-panel-text-muted">Gün</span>
                <div className="grid grid-cols-3 gap-2 min-[420px]:grid-cols-4 sm:grid-cols-7">
                  {WEEKDAY_SHORT.map((day) => (
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

            <div className="flex flex-col gap-2 min-[420px]:flex-row">
              <button
                type="button"
                onClick={() => {
                  setSaveError('')
                  setMode('choose')
                }}
                disabled={saving}
                className="flex h-12 items-center justify-center rounded-xl border border-panel-border px-4 text-sm font-semibold text-panel-text hover:bg-panel-surface-soft disabled:cursor-not-allowed disabled:opacity-70"
              >
                Geri
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-panel-blue px-4 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
