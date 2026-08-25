import { CalendarClock, CheckCircle2, Circle, X, XCircle } from 'lucide-react'

function formatDate(dateISO) {
  if (!dateISO) return ''
  return new Date(dateISO).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function TaskDetailModal({ task, onReschedule, onClose }) {
  const isGraded = task.status === 'tamamlandi' && task.correctCount != null
  const hasQuestionProgress = task.targetQuestionCount > 0

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-3xl border border-panel-border bg-panel-surface p-5 shadow-panel-1 sm:rounded-2xl sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-panel-text">Görev Detayı</h2>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-sm font-bold text-panel-text">{task.description || task.title}</p>

          <p className="inline-flex items-center gap-1.5 text-sm text-panel-text-muted">
            <CalendarClock size={14} aria-hidden="true" />
            {formatDate(task.date)}
            {task.startTime && task.endTime ? ` · ${task.startTime}–${task.endTime}` : ' · Saat eklenmedi'}
          </p>

          {task.resourceBookName ? (
            <p className="text-xs text-panel-text-muted">
              {task.publisherName ? `${task.publisherName} · ` : ''}
              {task.resourceBookName}
            </p>
          ) : null}

          <span
            className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${
              task.status === 'tamamlandi'
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-panel-surface-soft text-panel-text-muted'
            }`}
          >
            {task.status === 'tamamlandi' ? 'Tamamlandı' : 'Bekliyor'}
          </span>

          {hasQuestionProgress ? (
            <p className="text-sm text-panel-text-muted">
              {task.completedQuestionCount || 0}/{task.targetQuestionCount} soru
            </p>
          ) : null}

          {isGraded ? (
            <div className="grid grid-cols-3 gap-2 rounded-xl border border-panel-border bg-panel-surface-soft p-3">
              <div className="flex flex-col items-center gap-1">
                <CheckCircle2 size={18} className="text-emerald-600" aria-hidden="true" />
                <span className="text-sm font-bold text-panel-text">{task.correctCount ?? 0}</span>
                <span className="text-[11px] text-panel-text-muted">Doğru</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <XCircle size={18} className="text-panel-red" aria-hidden="true" />
                <span className="text-sm font-bold text-panel-text">{task.wrongCount ?? 0}</span>
                <span className="text-[11px] text-panel-text-muted">Yanlış</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Circle size={18} className="text-panel-text-muted" aria-hidden="true" />
                <span className="text-sm font-bold text-panel-text">{task.blankCount ?? 0}</span>
                <span className="text-[11px] text-panel-text-muted">Boş</span>
              </div>
            </div>
          ) : null}

          {onReschedule ? (
            <button
              type="button"
              onClick={onReschedule}
              className="mt-2 flex items-center justify-center gap-2 rounded-xl border border-panel-blue-soft bg-panel-surface px-4 py-3 text-sm font-semibold text-panel-blue hover:bg-panel-blue-soft/60"
            >
              Yeniden Planla
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
