import { X } from 'lucide-react'
import { FOCUS_TASK_TYPES } from '../../../data/taskTypes'

const CREATED_BY_LABELS = {
  ebeveyn: 'Ebeveyn',
  ogrenci: 'Kendim',
  koc: 'Koç',
}

const ACTIVE_STATUSES = new Set(['bekliyor', 'devam-ediyor', 'yardim-bekliyor'])

function DetailRow({ label, value }) {
  if (!value) return null
  return (
    <div className="flex flex-col gap-0.5 border-b border-panel-border py-3 first:pt-0 last:border-0">
      <span className="text-xs font-medium uppercase tracking-wide text-panel-text-muted">{label}</span>
      <span className="text-sm text-panel-text">{value}</span>
    </div>
  )
}

export default function TaskDetailsDrawer({ task, lessonLabel, onClose, onComplete, onPartialComplete, onReschedule, onHelp }) {
  const isFocusType = FOCUS_TASK_TYPES.has(task.taskType) || task.taskType === 'gunluk-degerlendirme'
  const isActive = ACTIVE_STATUSES.has(task.status)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 md:items-stretch md:justify-end">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-3xl border border-panel-border bg-panel-surface md:h-full md:max-h-none md:rounded-none md:rounded-l-2xl">
        <div className="flex items-center justify-between border-b border-panel-border p-5">
          <h2 className="text-lg font-semibold text-panel-text">Görev Detayı</h2>
          <button type="button" aria-label="Kapat" onClick={onClose} className="text-panel-text-muted hover:text-panel-text">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <h3 className="text-xl font-semibold text-panel-text">{task.title}</h3>

          <div className="mt-2 flex flex-col">
            <DetailRow label="Ders" value={lessonLabel} />
            <DetailRow label="Konu" value={task.topic} />
            <DetailRow label="İçerik" value={task.description} />
            <DetailRow
              label="Soru Sayısı"
              value={task.targetQuestionCount ? `${task.completedQuestionCount || 0} / ${task.targetQuestionCount} soru` : null}
            />
            <DetailRow label="Tahmini Süre" value={task.durationMinutes ? `${task.durationMinutes} dakika` : null} />
            <DetailRow label="Son Teslim Zamanı" value={task.endTime ? `Bugün ${task.endTime}` : null} />
            <DetailRow label="Ödevi Atayan" value={CREATED_BY_LABELS[task.createdBy] || task.createdBy} />
            <DetailRow label="Öğretmen / Ebeveyn Notu" value={task.parentNote} />
            <DetailRow label="Kendi Notların" value={task.notes} />
          </div>
        </div>

        {isActive ? (
          <div className="flex flex-col gap-2 border-t border-panel-border p-5">
            {!isFocusType ? (
              <button
                type="button"
                onClick={() => onComplete(task)}
                aria-label="Görevi tamamladım olarak işaretle"
                className="rounded-lg bg-student-theme-primary px-4 py-2.5 text-sm font-semibold text-student-theme-button-text hover:bg-student-theme-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-student-theme-primary"
              >
                Tamamladım
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onPartialComplete(task)}
              aria-label="Görevi kısmen tamamladım olarak işaretle"
              className="rounded-lg border border-panel-border px-4 py-2.5 text-sm font-medium text-panel-text hover:border-student-theme-primary hover:bg-student-theme-soft hover:text-student-theme-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-student-theme-primary"
            >
              Kısmen tamamladım
            </button>
            <button
              type="button"
              onClick={() => onReschedule(task)}
              aria-label="Görevi başka bir güne veya saate taşı"
              className="rounded-lg border border-panel-border px-4 py-2.5 text-sm font-medium text-panel-text hover:border-student-theme-primary hover:bg-student-theme-soft hover:text-student-theme-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-student-theme-primary"
            >
              Yarına / başka saate taşı
            </button>
            <button
              type="button"
              onClick={() => onHelp(task)}
              aria-label="Bu görev için yardım iste"
              className="rounded-lg border border-panel-border px-4 py-2.5 text-sm font-medium text-panel-text hover:border-student-theme-primary hover:bg-student-theme-soft hover:text-student-theme-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-student-theme-primary"
            >
              Yardıma ihtiyacım var
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
