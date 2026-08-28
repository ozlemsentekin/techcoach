import { CalendarPlus, Clock, Pencil, Trash2 } from 'lucide-react'
import { cn } from '../../ui/utils'
import { isHomeworkCompleted, isHomeworkOverdue } from './homeworkDisplay'
import PublisherBadge from './PublisherBadge'
import HomeworkProgress from './HomeworkProgress'

function formatShortDate(dateISO) {
  return new Date(dateISO).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
}

export default function HomeworkItemCard({ homework, onDeleteRequest, onEditRequest, onAssignTaskRequest }) {
  const completed = isHomeworkCompleted(homework)
  const overdue = isHomeworkOverdue(homework)

  return (
    <div
      className={cn(
        'flex min-h-[52px] flex-col gap-2.5 rounded-[11px] border bg-panel-surface px-3.5 py-2.5 shadow-[0_1px_3px_rgba(20,25,40,0.025)] sm:flex-row sm:items-center sm:gap-3',
        completed
          ? 'border-emerald-200 bg-emerald-50/30'
          : overdue
            ? 'border-panel-red/40 bg-panel-red-soft/25'
            : 'border-panel-border',
      )}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {homework.publisherName ? (
          <PublisherBadge name={homework.publisherName} />
        ) : homework.schoolResourceName ? (
          <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-panel-blue/20 bg-panel-blue-soft px-2.5 py-1 text-[11px] font-medium text-panel-blue">
            Okul Ödevi
          </span>
        ) : null}
        <p
          className="min-w-0 flex-1 text-[13px] font-semibold leading-[1.4] text-panel-text line-clamp-2"
          title={homework.title}
        >
          {homework.title}
        </p>
        {completed ? (
          <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
            Tamamlandı
          </span>
        ) : overdue ? (
          <span className="shrink-0 rounded-full bg-panel-red-soft px-2 py-0.5 text-[10px] font-semibold text-panel-red">
            Gecikti
          </span>
        ) : null}
        {homework.isSplit && homework.dayPlans?.length ? (
          <p className="w-full text-[11px] text-panel-text-muted">
            {homework.dayPlans.map((plan) => `${plan.date}: ${plan.questionCount} soru`).join(' · ')}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2.5 sm:justify-end">
        <HomeworkProgress homework={homework} completed={completed} />
        {onAssignTaskRequest && !homework.isTaskOnly ? (
          homework.hasTask ? (
            <button
              type="button"
              onClick={() => onAssignTaskRequest(homework)}
              className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-panel-blue-soft px-2.5 py-1 text-[11px] font-semibold text-panel-blue hover:bg-panel-blue hover:text-white"
            >
              <Clock size={12} aria-hidden="true" />
              {formatShortDate(homework.taskDate)}, {homework.taskStartTime}–{homework.taskEndTime}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onAssignTaskRequest(homework)}
              className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-panel-border px-2.5 py-1 text-[11px] font-semibold text-panel-text-muted hover:border-panel-blue hover:text-panel-blue"
            >
              <CalendarPlus size={12} aria-hidden="true" />
              Görev Oluştur
            </button>
          )
        ) : null}
        {onEditRequest && !homework.isTaskOnly ? (
          <button
            type="button"
            aria-label="Ödevi düzenle"
            onClick={() => onEditRequest(homework)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-panel-text-muted transition-colors hover:bg-panel-blue-soft hover:text-panel-blue"
          >
            <Pencil size={16} aria-hidden="true" />
          </button>
        ) : null}
        {onDeleteRequest && !homework.isTaskOnly ? (
          <button
            type="button"
            aria-label="Ödevi sil"
            onClick={() => onDeleteRequest(homework)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-panel-text-muted transition-colors hover:bg-red-50 hover:text-red-500"
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  )
}
