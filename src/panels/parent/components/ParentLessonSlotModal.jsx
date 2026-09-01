import { useMemo, useState } from 'react'
import { Loader2, Trash2, X } from 'lucide-react'
import { addMinutesToTime } from '../../../utils/time'
import { updatePrivateLessonSlot } from '../../../services/weeklyPlanService'

const WEEKDAYS = [
  { id: 'pazartesi', label: 'Pzt' },
  { id: 'sali', label: 'Sal' },
  { id: 'carsamba', label: 'Çar' },
  { id: 'persembe', label: 'Per' },
  { id: 'cuma', label: 'Cum' },
  { id: 'cumartesi', label: 'Cmt' },
  { id: 'pazar', label: 'Paz' },
]
const DAY_LABEL = {
  pazartesi: 'Pazartesi',
  sali: 'Salı',
  carsamba: 'Çarşamba',
  persembe: 'Perşembe',
  cuma: 'Cuma',
  cumartesi: 'Cumartesi',
  pazar: 'Pazar',
}
const DURATION_OPTIONS = [30, 45, 60, 90, 120]

function durationFromTimes(startTime, endTime) {
  if (!startTime || !endTime) return 60
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  return Math.max(0, eh * 60 + em - (sh * 60 + sm))
}

// Veli panelinde öğretmenin sabit ders programındaki (StudentTeachers.schedule_json) bir slotu
// yeniden planlar. Değişiklik seri geneline uygulanır (bu hafta + gelecek haftalar). Tek haftalık
// kaydırma öğretmen panelindeki "Sadece Bu Dersi Güncelle" akışına aittir.
export default function ParentLessonSlotModal({ slot, teacher, studentId, onSaved, onClose }) {
  const [dayOfWeek, setDayOfWeek] = useState(slot.dayOfWeek)
  const [startTime, setStartTime] = useState(slot.startTime || '')
  const [durationMinutes, setDurationMinutes] = useState(durationFromTimes(slot.startTime, slot.endTime))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const endTime = useMemo(
    () => (startTime && durationMinutes > 0 ? addMinutesToTime(startTime, durationMinutes) : ''),
    [startTime, durationMinutes],
  )

  const title = slot.subjectName ? `${slot.subjectName} Dersi` : 'Planlı Ders'

  const missingTeacher = !teacher
  const isPreset = DURATION_OPTIONS.includes(durationMinutes)

  const handleSave = async (event) => {
    event.preventDefault()
    if (saving || deleting || missingTeacher) return
    if (!startTime || !endTime) {
      setError('Başlangıç saati ve süre girilmeli.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const teachers = await updatePrivateLessonSlot(studentId, teacher, {
        originalDayOfWeek: slot.dayOfWeek,
        originalStartTime: slot.startTime,
        dayOfWeek,
        startTime,
        endTime,
      })
      await onSaved(teachers)
    } catch (err) {
      setError(err.message || 'Ders güncellenemedi, tekrar deneyin.')
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (saving || deleting || missingTeacher) return
    setDeleting(true)
    setError('')
    try {
      const teachers = await updatePrivateLessonSlot(studentId, teacher, {
        originalDayOfWeek: slot.dayOfWeek,
        originalStartTime: slot.startTime,
        removeSlot: true,
      })
      await onSaved(teachers)
    } catch (err) {
      setError(err.message || 'Ders silinemedi, tekrar deneyin.')
      setDeleting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Planlı Dersi Düzenle"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving && !deleting) onClose()
      }}
    >
      <form
        onSubmit={handleSave}
        className="flex w-full min-w-0 flex-col gap-4 rounded-t-3xl bg-panel-surface p-4 shadow-2xl sm:max-w-md sm:rounded-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-panel-text">{title}</h2>
            <p className="mt-0.5 text-sm text-panel-text-muted">
              {slot.teacherFullName ? `${slot.teacherFullName} · ` : ''}
              {DAY_LABEL[slot.dayOfWeek] || slot.dayOfWeek} {slot.startTime}-{slot.endTime}
            </p>
          </div>
          <button
            type="button"
            aria-label="Kapat"
            onClick={onClose}
            disabled={saving || deleting}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-panel-text-muted hover:bg-panel-surface-soft"
          >
            <X size={19} />
          </button>
        </div>

        {missingTeacher ? (
          <p className="rounded-xl bg-panel-accent-soft px-4 py-3 text-sm text-panel-warm">
            Bu dersin öğretmen kaydı bulunamadı. Çocuklarım sayfasından öğretmeni kontrol edin.
          </p>
        ) : (
          <>
            <p className="rounded-xl bg-panel-blue-soft/50 px-3 py-2 text-xs font-medium text-panel-blue">
              Değişiklik bu ders saatinin tamamına (bu hafta ve sonraki haftalar) uygulanır.
            </p>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-panel-text-muted">Gün</span>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                {WEEKDAYS.map((day) => (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => setDayOfWeek(day.id)}
                    className={`h-10 rounded-xl border text-sm font-bold transition-colors duration-150 ${
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

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-panel-text-muted">Başlangıç saati</span>
              <input
                type="time"
                required
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                className="rounded-xl border border-panel-border p-3 text-sm text-panel-text focus:border-panel-blue focus:outline-none"
              />
            </label>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-panel-text-muted">Süre</span>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {DURATION_OPTIONS.map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() => setDurationMinutes(minutes)}
                    className={`h-10 rounded-xl border text-sm font-bold transition-colors duration-150 ${
                      isPreset && durationMinutes === minutes
                        ? 'border-panel-blue bg-panel-blue-soft text-panel-blue'
                        : 'border-panel-border bg-panel-surface text-panel-text hover:bg-panel-surface-soft'
                    }`}
                  >
                    {minutes}
                  </button>
                ))}
                <input
                  type="number"
                  min="5"
                  max="480"
                  value={isPreset ? '' : durationMinutes || ''}
                  onChange={(event) => setDurationMinutes(Number(event.target.value) || 0)}
                  placeholder="Özel"
                  className={`h-10 min-w-0 rounded-xl border px-2 text-center text-sm font-bold text-panel-text focus:border-panel-blue focus:outline-none ${
                    !isPreset && durationMinutes ? 'border-panel-blue bg-panel-blue-soft' : 'border-panel-border bg-panel-surface'
                  }`}
                />
              </div>
              {endTime ? (
                <span className="text-xs text-panel-text-muted">
                  Yeni saat: {startTime} - {endTime}
                </span>
              ) : null}
            </div>

            {error ? <span className="text-xs font-semibold text-panel-warm">{error}</span> : null}

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving || deleting}
                className="flex h-12 items-center justify-center gap-2 rounded-xl border border-panel-warm/40 px-4 text-sm font-semibold text-panel-warm hover:bg-panel-warm/10 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} aria-hidden="true" />}
                Bu Dersi Kaldır
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
          </>
        )}
      </form>
    </div>
  )
}
