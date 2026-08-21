import { useEffect, useState } from 'react'
import { Loader2, Trash2, X } from 'lucide-react'
import { TASK_TYPES } from '../../../data/taskTypes'
import { getSchoolScheduleConflict, hasOverlap } from '../../../services/weeklyPlanService'
import { todayISODate } from '../../../utils/time'

const TASK_TYPE_OPTIONS = Object.entries(TASK_TYPES).map(([id, meta]) => ({ id, label: meta.label }))
const DURATION_OPTIONS = [10, 20, 30, 45, 60, 90]

function computeDurationMinutes(startTime, endTime) {
  if (!startTime || !endTime) return 0
  const [startH, startM] = startTime.split(':').map(Number)
  const [endH, endM] = endTime.split(':').map(Number)
  return endH * 60 + endM - (startH * 60 + startM)
}

function addMinutesToTime(startTime, minutes) {
  if (!startTime || !minutes) return ''
  const [h, m] = startTime.split(':').map(Number)
  const total = (h * 60 + m + Number(minutes)) % (24 * 60)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export default function AddTaskDrawer({
  initialTask,
  initialTemplate,
  defaultDate,
  onSave,
  onDelete,
  onClose,
  getExistingTasksForDate,
  schoolSchedule,
}) {
  const seed = { ...initialTemplate?.task, ...initialTask }
  const seedStartTime = seed.startTime || '16:00'
  const seedEndTime = seed.endTime || (seed.durationMinutes ? addMinutesToTime(seedStartTime, seed.durationMinutes) : '16:45')
  const seedDurationMinutes = Number(seed.durationMinutes) || computeDurationMinutes(seedStartTime, seedEndTime) || 45

  const [form, setForm] = useState(() => ({
    title: seed.title || '',
    taskType: seed.taskType || 'odev',
    date: seed.date || defaultDate || todayISODate(),
    startTime: seedStartTime,
    durationMinutes: seedDurationMinutes,
    description: seed.description || '',
  }))
  const [durationMode, setDurationMode] = useState(() =>
    DURATION_OPTIONS.includes(seedDurationMinutes) ? seedDurationMinutes : 'custom',
  )
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)

  const durationMinutes = Number(form.durationMinutes) || 0
  const endTime = durationMinutes > 0 ? addMinutesToTime(form.startTime, durationMinutes) : ''
  const schoolConflict = endTime ? getSchoolScheduleConflict(schoolSchedule, form.date, form.startTime, endTime) : null

  const [conflict, setConflict] = useState(false)

  useEffect(() => {
    let ignore = false

    if (!getExistingTasksForDate || durationMinutes <= 0) {
      Promise.resolve().then(() => {
        if (!ignore) setConflict(false)
      })
      return () => {
        ignore = true
      }
    }

    Promise.resolve(getExistingTasksForDate(form.date))
      .then((tasksForDate) => {
        if (!ignore) setConflict(hasOverlap(tasksForDate, form.startTime, endTime, initialTask?.id))
      })
      .catch(() => {
        if (!ignore) setConflict(false)
      })

    return () => {
      ignore = true
    }
  }, [form.date, form.startTime, endTime, getExistingTasksForDate, initialTask?.id, durationMinutes])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !saving && !deleting) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [deleting, onClose, saving])

  const handleChange = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }))
  }

  const selectDuration = (minutes) => {
    setDurationMode(minutes)
    setForm((current) => ({ ...current, durationMinutes: minutes }))
  }

  const handleCustomDurationChange = (event) => {
    setDurationMode('custom')
    setForm((current) => ({ ...current, durationMinutes: event.target.value }))
  }

  const handleDelete = async () => {
    if (deleting) return
    setDeleting(true)
    setError('')
    try {
      await onDelete(initialTask)
    } catch (err) {
      setError(err.message || 'Görev silinirken bir hata oluştu, tekrar deneyin.')
      setDeleting(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (saving || deleting) return

    if (!form.title.trim()) {
      setError('Görev konusu boş bırakılamaz.')
      return
    }
    if (!form.taskType) {
      setError('Görev türü seçin.')
      return
    }
    if (!form.date) {
      setError('Gün zorunludur.')
      return
    }
    if (!form.startTime) {
      setError('Başlangıç saati zorunludur.')
      return
    }
    if (durationMinutes <= 0) {
      setError('Süre seçin.')
      return
    }
    if (schoolConflict) {
      setError(
        `Bu saatte öğrenci okulda (${schoolConflict.startTime}-${schoolConflict.endTime}${schoolConflict.lessonName ? ` · ${schoolConflict.lessonName}` : ''}). Bu saate görev eklenemez.`,
      )
      return
    }

    setError('')
    setSaving(true)
    try {
      await onSave({
        title: form.title.trim(),
        taskType: form.taskType,
        date: form.date,
        startTime: form.startTime,
        endTime,
        durationMinutes,
        description: form.description.trim() || null,
      })
    } catch (err) {
      setError(err.message || 'Görev kaydedilirken bir hata oluştu, tekrar deneyin.')
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={initialTask ? 'Görevi Düzenle' : 'Yeni Görev Ekle'}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving && !deleting) onClose()
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-panel-surface shadow-2xl sm:max-h-[90vh] sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-panel-border px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold text-panel-text">
              {initialTask ? 'Görevi Düzenle' : 'Yeni Görev Ekle'}
            </h2>
            {endTime ? (
              <p className="mt-1 text-sm font-medium text-panel-text-muted">
                {form.startTime} - {endTime} · {durationMinutes} dk
              </p>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="Kapat"
            onClick={onClose}
            disabled={saving || deleting}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-panel-text-muted transition-colors hover:bg-panel-surface-soft hover:text-panel-text disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          {error ? (
            <div className="mb-4 rounded-xl bg-panel-accent-soft px-4 py-3 text-sm text-panel-warm">{error}</div>
          ) : null}
          {schoolConflict ? (
            <div className="mb-4 rounded-xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-600">
              Bu saatte öğrenci okulda ({schoolConflict.startTime}-{schoolConflict.endTime}
              {schoolConflict.lessonName ? ` · ${schoolConflict.lessonName}` : ''}). Bu saate görev eklenemez.
            </div>
          ) : conflict ? (
            <div className="mb-4 rounded-xl bg-panel-accent-soft px-4 py-3 text-sm text-panel-warm">
              Bu saatte başka bir görev var. Yine de ekleyebilir veya saati değiştirebilirsin.
            </div>
          ) : null}

          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-panel-text-muted">Görev konusu</span>
              <input
                value={form.title}
                onChange={handleChange('title')}
                className="rounded-xl border border-panel-border bg-white p-3 text-base text-panel-text shadow-sm outline-none transition-colors focus:border-panel-blue focus:ring-2 focus:ring-panel-blue-soft"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-panel-text-muted">Görev türü</span>
              <select
                value={form.taskType}
                onChange={handleChange('taskType')}
                className="rounded-xl border border-panel-border bg-white p-3 text-base text-panel-text shadow-sm outline-none transition-colors focus:border-panel-blue focus:ring-2 focus:ring-panel-blue-soft"
              >
                {TASK_TYPE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-panel-text-muted">Görev açıklaması</span>
              <textarea
                rows={3}
                value={form.description}
                onChange={handleChange('description')}
                className="resize-none rounded-xl border border-panel-border bg-white p-3 text-base text-panel-text shadow-sm outline-none transition-colors focus:border-panel-blue focus:ring-2 focus:ring-panel-blue-soft"
              />
            </label>

            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-panel-text-muted">Gün</span>
                <input
                  type="date"
                  value={form.date}
                  onChange={handleChange('date')}
                  className="rounded-xl border border-panel-border bg-white p-3 text-base text-panel-text shadow-sm outline-none transition-colors focus:border-panel-blue focus:ring-2 focus:ring-panel-blue-soft"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-panel-text-muted">Başlangıç saati</span>
                <input
                  type="time"
                  value={form.startTime}
                  onChange={handleChange('startTime')}
                  className="rounded-xl border border-panel-border bg-white p-3 text-base text-panel-text shadow-sm outline-none transition-colors focus:border-panel-blue focus:ring-2 focus:ring-panel-blue-soft"
                />
              </label>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-panel-text-muted">Süre</span>
              <div className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-4">
                {DURATION_OPTIONS.map((minutes) => {
                  const selected = durationMode === minutes
                  return (
                    <button
                      key={minutes}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => selectDuration(minutes)}
                      className={`h-11 rounded-xl border px-3 text-sm font-semibold transition-colors ${
                        selected
                          ? 'border-panel-blue bg-panel-blue-soft text-panel-blue'
                          : 'border-panel-border bg-white text-panel-text-muted hover:bg-panel-surface-soft'
                      }`}
                    >
                      {minutes} dk
                    </button>
                  )
                })}
                <button
                  type="button"
                  aria-pressed={durationMode === 'custom'}
                  onClick={() => setDurationMode('custom')}
                  className={`h-11 rounded-xl border px-3 text-sm font-semibold transition-colors ${
                    durationMode === 'custom'
                      ? 'border-panel-blue bg-panel-blue-soft text-panel-blue'
                      : 'border-panel-border bg-white text-panel-text-muted hover:bg-panel-surface-soft'
                  }`}
                >
                  Özel
                </button>
              </div>

              {durationMode === 'custom' ? (
                <label className="mt-1 flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-panel-text-muted">Özel süre (dk)</span>
                  <input
                    type="number"
                    min="1"
                    max="360"
                    value={form.durationMinutes}
                    onChange={handleCustomDurationChange}
                    className="rounded-xl border border-panel-border bg-white p-3 text-base text-panel-text shadow-sm outline-none transition-colors focus:border-panel-blue focus:ring-2 focus:ring-panel-blue-soft"
                  />
                </label>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-panel-border px-4 py-3 sm:flex-row sm:gap-3 sm:px-6 sm:py-4">
          {initialTask && onDelete ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || saving}
              className="flex h-12 items-center justify-center gap-2 rounded-xl border border-panel-warm/40 px-4 text-sm font-semibold text-panel-warm hover:bg-panel-warm/10 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} aria-hidden="true" />}
              Görevi Sil
            </button>
          ) : null}
          <button
            type="submit"
            disabled={deleting || saving || Boolean(schoolConflict)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-panel-blue px-4 py-3 text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
            {initialTask ? 'Değişiklikleri Kaydet' : 'Görevi Ekle'}
          </button>
        </div>
      </form>
    </div>
  )
}
