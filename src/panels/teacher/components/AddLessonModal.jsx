import { useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { todayISODate } from '../../../utils/time'
import { addTeacherRecurringLesson, addTeacherOneTimeLesson } from '../../../services/teacherService'

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

export default function AddLessonModal({ students, onSave, onClose }) {
  const [studentTeacherId, setStudentTeacherId] = useState(students[0]?.studentTeacherId || '')
  const [mode, setMode] = useState('recurring')
  const [dayOfWeek, setDayOfWeek] = useState(WEEKDAYS[0].id)
  const [date, setDate] = useState(todayISODate())
  const [startTime, setStartTime] = useState('15:00')
  const [durationMinutes, setDurationMinutes] = useState(60)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (saving) return
    if (!studentTeacherId) {
      setSaveError('Bir öğrenci seçmelisiniz.')
      return
    }

    setSaving(true)
    setSaveError('')
    try {
      if (mode === 'recurring') {
        await addTeacherRecurringLesson(studentTeacherId, { dayOfWeek, startTime, durationMinutes })
      } else {
        await addTeacherOneTimeLesson(studentTeacherId, { date, startTime, durationMinutes })
      }
      await onSave()
    } catch (err) {
      setSaveError(err.message || 'Bir hata oluştu, tekrar deneyin.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="h-full w-full max-w-lg overflow-y-auto border border-panel-border bg-panel-surface p-4 shadow-panel-1 sm:h-auto sm:max-h-[90vh] sm:rounded-2xl sm:p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-panel-text">Ders Ekle</h2>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-panel-text-muted">Öğrenci</span>
            <select
              value={studentTeacherId}
              onChange={(event) => setStudentTeacherId(event.target.value)}
              className="rounded-xl border border-panel-border p-3 text-sm text-panel-text"
            >
              {students.map((student) => (
                <option key={student.studentTeacherId} value={student.studentTeacherId}>
                  {student.studentFullName} · {student.subjectName || 'Ders seçilmedi'}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
            <button
              type="button"
              onClick={() => setMode('recurring')}
              className={`h-12 rounded-xl border text-sm font-bold transition-colors duration-150 ${
                mode === 'recurring'
                  ? 'border-panel-blue bg-panel-blue-soft text-panel-blue'
                  : 'border-panel-border bg-panel-surface text-panel-text hover:bg-panel-surface-soft'
              }`}
            >
              Her Hafta Tekrarla
            </button>
            <button
              type="button"
              onClick={() => setMode('one-time')}
              className={`h-12 rounded-xl border text-sm font-bold transition-colors duration-150 ${
                mode === 'one-time'
                  ? 'border-panel-blue bg-panel-blue-soft text-panel-blue'
                  : 'border-panel-border bg-panel-surface text-panel-text hover:bg-panel-surface-soft'
              }`}
            >
              Sadece Bu Kez
            </button>
          </div>

          {mode === 'recurring' ? (
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
          ) : (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-panel-text-muted">Tarih</span>
              <input
                type="date"
                required
                min={todayISODate()}
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="rounded-xl border border-panel-border p-3 text-sm text-panel-text"
              />
            </label>
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

          <button
            type="submit"
            disabled={saving || !studentTeacherId}
            className="flex items-center justify-center gap-2 rounded-xl bg-panel-blue px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
            {saving ? 'Kaydediliyor...' : 'Dersi Kaydet'}
          </button>
        </div>
      </form>
    </div>
  )
}
