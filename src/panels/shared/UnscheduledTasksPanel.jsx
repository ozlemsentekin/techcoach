import { useState } from 'react'
import { CalendarPlus, Inbox, Trash2 } from 'lucide-react'
import { patchTask, removeTask } from '../../services/taskService'
import { TASK_TYPES } from '../../data/taskTypes'
import AssignTaskModal from './homework/AssignTaskModal'
import ConfirmationDialog from './ConfirmationDialog'

function computeEndTime(startTime, durationMinutes) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime || '') || !durationMinutes) return null
  const [hour, minute] = startTime.split(':').map(Number)
  const end = (hour * 60 + minute + durationMinutes) % (24 * 60)
  return `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`
}

/**
 * Ödev/görev tekilleştirme (Faz 2): bir güne/saate atanmamış ders-tipi görevler. Haftalık Plan
 * sayfasında takvimin altında listelenir; buradan bir güne atanır (takvime düşer) ya da silinir.
 */
export default function UnscheduledTasksPanel({ tasks, studentId, onChanged, readOnly = false }) {
  const [assigningTask, setAssigningTask] = useState(null)
  const [deletingTask, setDeletingTask] = useState(null)
  const [error, setError] = useState('')

  if (!tasks?.length) return null

  const handleAssign = async ({ date, startTime, durationMinutes }) => {
    setError('')
    await patchTask(
      assigningTask.id,
      {
        date,
        startTime: startTime || null,
        endTime: computeEndTime(startTime, durationMinutes),
        durationMinutes,
        isUnscheduled: false,
      },
      studentId,
    )
    setAssigningTask(null)
    await onChanged()
  }

  const handleDeleteConfirmed = async () => {
    const taskId = deletingTask?.id
    setDeletingTask(null)
    try {
      setError('')
      await removeTask(taskId, studentId)
      await onChanged()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-panel-border bg-panel-surface p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-panel-blue-soft text-panel-blue">
          <Inbox size={18} aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-sm font-bold text-panel-text">Atanmamış Görevler</h2>
          <p className="text-xs text-panel-text-muted">Bir güne atanınca haftalık plana düşer.</p>
        </div>
      </div>

      {error ? <p className="text-xs text-panel-warm">{error}</p> : null}

      <ul className="flex flex-col gap-2">
        {tasks.map((task) => {
          const typeLabel = TASK_TYPES[task.taskType]?.label || 'Görev'
          const target =
            task.targetQuestionCount > 0
              ? `${task.targetQuestionCount} soru`
              : task.targetPageCount > 0
                ? `${task.targetPageCount} sayfa`
                : null
          return (
            <li
              key={task.id}
              className="flex flex-col gap-2.5 rounded-[11px] border border-panel-border bg-panel-surface px-3.5 py-2.5 sm:flex-row sm:items-center sm:gap-3"
            >
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-panel-blue/20 bg-panel-blue-soft px-2.5 py-1 text-[11px] font-medium text-panel-blue">
                  {task.subject || typeLabel}
                </span>
                <p
                  className="min-w-0 flex-1 text-[13px] font-semibold leading-[1.4] text-panel-text line-clamp-2"
                  title={task.description || task.title}
                >
                  {task.description || task.title}
                </p>
                {target ? <span className="shrink-0 text-[11px] text-panel-text-muted">{target}</span> : null}
              </div>

              {readOnly ? null : (
                <div className="flex shrink-0 items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setAssigningTask(task)}
                    className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-panel-border px-2.5 py-1 text-[11px] font-semibold text-panel-text-muted hover:border-panel-blue hover:text-panel-blue"
                  >
                    <CalendarPlus size={12} aria-hidden="true" />
                    Güne Ata
                  </button>
                  <button
                    type="button"
                    aria-label="Görevi sil"
                    onClick={() => setDeletingTask(task)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-panel-text-muted transition-colors hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {assigningTask ? (
        <AssignTaskModal
          homework={{
            title: assigningTask.description || assigningTask.title,
            hasTask: false,
            assignedDate: assigningTask.assignedDate,
          }}
          onSave={handleAssign}
          onClose={() => setAssigningTask(null)}
        />
      ) : null}

      {deletingTask ? (
        <ConfirmationDialog
          title="Görevi sil"
          description={`"${deletingTask.description || deletingTask.title}" görevini silmek istediğine emin misin?`}
          confirmLabel="Sil"
          cancelLabel="Vazgeç"
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setDeletingTask(null)}
        />
      ) : null}
    </section>
  )
}
