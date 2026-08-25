import { useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { todayISODate } from '../../../utils/time'
import { cn } from '../../ui/utils'

const DURATION_PRESETS = [30, 45, 60]

function computeEndTime(startTime, durationMinutes) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime || '') || !durationMinutes) return ''
  const [startHour, startMinute] = startTime.split(':').map(Number)
  const startMinutes = startHour * 60 + startMinute
  const endMinutes = (startMinutes + durationMinutes) % (24 * 60)
  return `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`
}

export default function AssignTaskModal({ homework, onSave, onClose }) {
  const isEdit = Boolean(homework.hasTask)
  const [date, setDate] = useState(homework.taskDate || homework.assignedDate || todayISODate())
  const [startTime, setStartTime] = useState(homework.taskStartTime || '')
  const [selectedPreset, setSelectedPreset] = useState(
    DURATION_PRESETS.includes(homework.taskDurationMinutes) ? homework.taskDurationMinutes : 'custom',
  )
  const [customDuration, setCustomDuration] = useState(
    !DURATION_PRESETS.includes(homework.taskDurationMinutes) ? homework.taskDurationMinutes || 30 : 30,
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const durationMinutes = selectedPreset === 'custom' ? Number(customDuration) || 0 : selectedPreset
  const endTime = computeEndTime(startTime, durationMinutes)

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (saving) return
    if (!date || !durationMinutes || durationMinutes < 5) {
      setError('Tarih ve süre bilgilerini eksiksiz doldurun.')
      return
    }

    setSaving(true)
    setError('')
    try {
      await onSave({ date, startTime: startTime || null, durationMinutes })
    } catch (err) {
      setError(err.message || 'Bir hata oluştu, tekrar deneyin.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-t-3xl border border-panel-border bg-panel-surface p-5 shadow-panel-1 sm:rounded-2xl sm:p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-panel-text">{isEdit ? 'Görevi Düzenle' : 'Görev Oluştur'}</h2>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <p className="mb-4 text-[13px] text-panel-text-muted line-clamp-2" title={homework.title}>
          {homework.title}
        </p>

        <div className="flex flex-col gap-4">
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

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-panel-text-muted">Başlangıç saati (isteğe bağlı)</span>
            <input
              type="time"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              className="rounded-xl border border-panel-border p-3 text-sm text-panel-text"
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-panel-text-muted">Süre</span>
            <div className="flex flex-wrap gap-2">
              {DURATION_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setSelectedPreset(preset)}
                  className={cn(
                    'rounded-[10px] px-3 py-2 text-sm font-semibold transition-colors',
                    selectedPreset === preset
                      ? 'bg-panel-blue text-white shadow-sm'
                      : 'bg-panel-blue-soft text-panel-blue hover:bg-panel-blue hover:text-white',
                  )}
                >
                  {preset} dk
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSelectedPreset('custom')}
                className={cn(
                  'rounded-[10px] px-3 py-2 text-sm font-semibold transition-colors',
                  selectedPreset === 'custom'
                    ? 'bg-panel-blue text-white shadow-sm'
                    : 'bg-panel-blue-soft text-panel-blue hover:bg-panel-blue hover:text-white',
                )}
              >
                Özel
              </button>
              {selectedPreset === 'custom' ? (
                <input
                  type="number"
                  min="5"
                  max="480"
                  value={customDuration}
                  onChange={(event) => setCustomDuration(event.target.value)}
                  className="w-full rounded-[10px] border border-panel-border p-2 text-sm text-panel-text min-[420px]:w-24"
                  placeholder="dk"
                />
              ) : null}
            </div>
          </div>

          <p className="text-xs text-panel-text-muted">
            {endTime ? `Bitiş saati: ${endTime}` : 'Süre ve saat girildiğinde bitiş saati hesaplanır.'}
          </p>

          {error ? <span className="text-xs text-panel-warm">{error}</span> : null}

          <button
            type="submit"
            disabled={saving}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#1c2b5e] px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </form>
    </div>
  )
}
