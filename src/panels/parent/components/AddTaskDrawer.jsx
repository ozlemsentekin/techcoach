import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { TASK_TYPES } from '../../../data/taskTypes'
import { TASK_TEMPLATES } from '../../../data/taskTemplates'
import { hasOverlap } from '../../../services/weeklyPlanService'
import { todayISODate } from '../../../utils/time'

const PRIORITY_OPTIONS = [
  { id: 'dusuk', label: 'Düşük' },
  { id: 'orta', label: 'Orta' },
  { id: 'yuksek', label: 'Yüksek' },
]

const TASK_TYPE_OPTIONS = Object.entries(TASK_TYPES).map(([id, meta]) => ({ id, label: meta.label }))

function computeDurationMinutes(startTime, endTime) {
  if (!startTime || !endTime) return 0
  const [startH, startM] = startTime.split(':').map(Number)
  const [endH, endM] = endTime.split(':').map(Number)
  return endH * 60 + endM - (startH * 60 + startM)
}

function addMinutesToTime(startTime, minutes) {
  const [h, m] = startTime.split(':').map(Number)
  const total = h * 60 + m + minutes
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export default function AddTaskDrawer({ initialTask, initialTemplate, defaultDate, onSave, onClose, getExistingTasksForDate }) {
  const seed = { ...initialTemplate?.task, ...initialTask }
  const seedStartTime = seed.startTime || '16:00'
  const seedEndTime = seed.endTime || (seed.durationMinutes ? addMinutesToTime(seedStartTime, seed.durationMinutes) : '16:45')

  const [form, setForm] = useState(() => ({
    title: seed.title || '',
    taskType: seed.taskType || 'odev',
    subject: seed.subject || '',
    topic: seed.topic || '',
    date: seed.date || defaultDate || todayISODate(),
    startTime: seedStartTime,
    endTime: seedEndTime,
    targetQuestionCount: seed.targetQuestionCount || '',
    priority: seed.priority || 'orta',
    description: seed.description || '',
    parentNote: seed.parentNote || '',
  }))
  const [error, setError] = useState('')

  const durationMinutes = computeDurationMinutes(form.startTime, form.endTime)

  const conflict = useMemo(() => {
    if (!getExistingTasksForDate || durationMinutes <= 0) return false
    const tasksForDate = getExistingTasksForDate(form.date)
    return hasOverlap(tasksForDate, form.startTime, form.endTime, initialTask?.id)
  }, [form.date, form.startTime, form.endTime, getExistingTasksForDate, initialTask?.id, durationMinutes])

  const handleChange = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }))
  }

  const applyTemplate = (template) => {
    setForm((current) => {
      const startTime = template.task.startTime || current.startTime
      const endTime =
        template.task.endTime || (template.task.durationMinutes ? addMinutesToTime(startTime, template.task.durationMinutes) : current.endTime)
      return { ...current, ...template.task, startTime, endTime }
    })
  }

  const handleSubmit = (event) => {
    event.preventDefault()

    if (!form.title.trim()) {
      setError('Görev adı boş bırakılamaz.')
      return
    }
    if (!form.date) {
      setError('Tarih zorunludur.')
      return
    }
    if (durationMinutes <= 0) {
      setError('Bitiş saati başlangıç saatinden önce olamaz.')
      return
    }

    setError('')
    onSave({
      title: form.title.trim(),
      taskType: form.taskType,
      subject: form.subject.trim() || undefined,
      topic: form.topic.trim() || undefined,
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      durationMinutes,
      targetQuestionCount: form.targetQuestionCount ? Number(form.targetQuestionCount) : undefined,
      priority: form.priority,
      description: form.description.trim() || undefined,
      parentNote: form.parentNote.trim() || undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
      <form
        onSubmit={handleSubmit}
        className="flex h-full w-full max-w-md flex-col gap-4 overflow-y-auto bg-panel-surface p-6"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-panel-text">
            {initialTask ? 'Görevi Düzenle' : 'Yeni Görev Ekle'}
          </h2>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {!initialTask ? (
          <div>
            <p className="mb-2 text-sm font-medium text-panel-text-muted">Hızlı şablonlar</p>
            <div className="flex flex-wrap gap-2">
              {TASK_TEMPLATES.map((template) => (
                <button
                  key={template.label}
                  type="button"
                  onClick={() => applyTemplate(template)}
                  className="rounded-full border border-panel-border px-3 py-1.5 text-xs font-medium text-panel-text hover:bg-panel-bg"
                >
                  {template.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {error ? <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-sm text-panel-warm">{error}</div> : null}
        {conflict ? (
          <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-sm text-panel-warm">
            Bu saatte başka bir görev var. Yine de ekleyebilir veya saati değiştirebilirsin.
          </div>
        ) : null}

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-panel-text-muted">Görev adı</span>
          <input
            value={form.title}
            onChange={handleChange('title')}
            className="rounded-xl border border-panel-border p-3 text-base text-panel-text"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-panel-text-muted">Görev türü</span>
          <select
            value={form.taskType}
            onChange={handleChange('taskType')}
            className="rounded-xl border border-panel-border p-3 text-base text-panel-text"
          >
            {TASK_TYPE_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">Ders</span>
            <input
              value={form.subject}
              onChange={handleChange('subject')}
              className="rounded-xl border border-panel-border p-3 text-base text-panel-text"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">Konu</span>
            <input
              value={form.topic}
              onChange={handleChange('topic')}
              className="rounded-xl border border-panel-border p-3 text-base text-panel-text"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-panel-text-muted">Tarih</span>
          <input
            type="date"
            value={form.date}
            onChange={handleChange('date')}
            className="rounded-xl border border-panel-border p-3 text-base text-panel-text"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">Başlangıç saati</span>
            <input
              type="time"
              value={form.startTime}
              onChange={handleChange('startTime')}
              className="rounded-xl border border-panel-border p-3 text-base text-panel-text"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">Bitiş saati</span>
            <input
              type="time"
              value={form.endTime}
              onChange={handleChange('endTime')}
              className="rounded-xl border border-panel-border p-3 text-base text-panel-text"
            />
          </label>
        </div>
        <p className="text-sm text-panel-text-muted">Süre: {durationMinutes > 0 ? `${durationMinutes} dakika` : '—'}</p>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-panel-text-muted">Hedef soru sayısı (isteğe bağlı)</span>
          <input
            type="number"
            min="0"
            value={form.targetQuestionCount}
            onChange={handleChange('targetQuestionCount')}
            className="rounded-xl border border-panel-border p-3 text-base text-panel-text"
          />
        </label>

        <div>
          <p className="mb-2 text-sm font-medium text-panel-text-muted">Öncelik</p>
          <div className="flex gap-2">
            {PRIORITY_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setForm((current) => ({ ...current, priority: option.id }))}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                  form.priority === option.id
                    ? 'border-panel-blue bg-panel-blue-soft text-panel-blue'
                    : 'border-panel-border text-panel-text'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-panel-text-muted">Açıklama</span>
          <textarea
            rows={2}
            value={form.description}
            onChange={handleChange('description')}
            className="rounded-xl border border-panel-border p-3 text-base text-panel-text"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-panel-text-muted">Öğrenciye gösterilecek not (isteğe bağlı)</span>
          <textarea
            rows={2}
            placeholder="Bu testte hızdan çok dikkatli okumaya odaklan."
            value={form.parentNote}
            onChange={handleChange('parentNote')}
            className="rounded-xl border border-panel-border p-3 text-base text-panel-text"
          />
        </label>

        <button
          type="submit"
          className="mt-auto rounded-xl bg-panel-blue px-4 py-3 text-base font-semibold text-white"
        >
          {initialTask ? 'Değişiklikleri Kaydet' : 'Görevi Ekle'}
        </button>
      </form>
    </div>
  )
}
