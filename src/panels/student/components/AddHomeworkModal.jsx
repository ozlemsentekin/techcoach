import { useState } from 'react'
import { X } from 'lucide-react'
import { splitQuestionsAcrossDays } from '../../../services/homeworkService'
import { todayISODate } from '../../../utils/time'

function addDaysISO(baseDate, days) {
  const date = new Date(baseDate)
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export default function AddHomeworkModal({ onSave, onClose }) {
  const [subject, setSubject] = useState('')
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState(addDaysISO(todayISODate(), 3))
  const [totalQuestionCount, setTotalQuestionCount] = useState(0)
  const [splitDays, setSplitDays] = useState(1)

  const assignedDate = todayISODate()
  const dayPlans =
    splitDays > 1
      ? splitQuestionsAcrossDays(
          Number(totalQuestionCount) || 0,
          Array.from({ length: splitDays }, (_, index) => addDaysISO(assignedDate, index)),
        )
      : []

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!subject.trim() || !title.trim()) return

    onSave({
      subject: subject.trim(),
      title: title.trim(),
      assignedDate,
      dueDate,
      totalQuestionCount: Number(totalQuestionCount) || 0,
      dayPlans,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border border-panel-border bg-panel-surface p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-panel-text">Ödev Ekle</h2>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">Ders</span>
            <input
              required
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              className="rounded-xl border border-panel-border p-3 text-base text-panel-text"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">Ödev başlığı</span>
            <input
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="örn. Sayfa 40-42 arası sorular"
              className="rounded-xl border border-panel-border p-3 text-base text-panel-text"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">Son teslim tarihi</span>
            <input
              type="date"
              min={assignedDate}
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              className="rounded-xl border border-panel-border p-3 text-base text-panel-text"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">Toplam soru sayısı</span>
            <input
              type="number"
              min="0"
              value={totalQuestionCount}
              onChange={(event) => setTotalQuestionCount(event.target.value)}
              className="rounded-xl border border-panel-border p-3 text-base text-panel-text"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">Kaç güne bölünsün?</span>
            <input
              type="number"
              min="1"
              max="14"
              value={splitDays}
              onChange={(event) => setSplitDays(Math.max(1, Number(event.target.value)))}
              className="rounded-xl border border-panel-border p-3 text-base text-panel-text"
            />
          </label>

          {dayPlans.length > 1 ? (
            <div className="rounded-xl bg-panel-blue-soft p-3 text-sm text-panel-text">
              {dayPlans.map((plan) => `${plan.date}: ${plan.questionCount} soru`).join(' · ')}
            </div>
          ) : null}

          <button type="submit" className="rounded-xl bg-panel-blue px-4 py-3 text-base font-semibold text-white">
            Ödevi Kaydet
          </button>
        </div>
      </form>
    </div>
  )
}
