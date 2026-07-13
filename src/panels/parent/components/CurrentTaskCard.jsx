import { TASK_TYPES } from '../../../data/taskTypes'
import TaskTypeIcon from '../../shared/TaskTypeIcon'

export default function CurrentTaskCard({ task, onEncourage, onExtendTime, onOpenDetail, onEdit }) {
  if (!task) {
    return (
      <div className="rounded-2xl border border-panel-border bg-panel-surface p-5">
        <h2 className="text-base font-semibold text-panel-text">Şu anda</h2>
        <p className="mt-2 text-base text-panel-text-muted">
          Aylin şu an planlı bir görev üzerinde çalışmıyor.
        </p>
      </div>
    )
  }

  const meta = TASK_TYPES[task.taskType] || {}
  const progress =
    task.targetQuestionCount && task.targetQuestionCount > 0
      ? Math.min(100, Math.round(((task.completedQuestionCount || 0) / task.targetQuestionCount) * 100))
      : null

  return (
    <div className="rounded-2xl border border-panel-border bg-panel-surface p-5">
      <h2 className="text-base font-semibold text-panel-text">Şu anda</h2>
      <div className="mt-3 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-panel-blue-soft text-panel-blue">
          <TaskTypeIcon name={meta.icon} size={18} />
        </div>
        <div>
          <p className="text-base font-semibold text-panel-text">{task.title}</p>
          {task.targetQuestionCount ? (
            <p className="text-sm text-panel-text-muted">
              {task.completedQuestionCount || 0} / {task.targetQuestionCount} soru tamamlandı
            </p>
          ) : (
            <p className="text-sm text-panel-text-muted">Devam ediyor</p>
          )}
        </div>
      </div>

      {progress !== null ? (
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-panel-blue-soft">
          <div className="h-full rounded-full bg-panel-blue" style={{ width: `${progress}%` }} />
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onEncourage}
          className="rounded-lg bg-panel-blue px-3 py-2 text-sm font-semibold text-white"
        >
          Cesaret Mesajı Gönder
        </button>
        <button
          type="button"
          onClick={onExtendTime}
          className="rounded-lg border border-panel-border px-3 py-2 text-sm font-medium text-panel-text"
        >
          Süreye 10 dk ekle
        </button>
        <button
          type="button"
          onClick={onOpenDetail}
          className="rounded-lg border border-panel-border px-3 py-2 text-sm font-medium text-panel-text"
        >
          Detayı Aç
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="rounded-lg border border-panel-border px-3 py-2 text-sm font-medium text-panel-text"
        >
          Görevi Düzenle
        </button>
      </div>
    </div>
  )
}
