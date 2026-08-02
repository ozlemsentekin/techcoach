import { Trash2 } from 'lucide-react'
import { cn } from '../../ui/utils'
import { isHomeworkCompleted } from './homeworkDisplay'
import PublisherBadge from './PublisherBadge'
import HomeworkProgress from './HomeworkProgress'

export default function HomeworkItemCard({ homework, onDeleteRequest }) {
  const completed = isHomeworkCompleted(homework)

  return (
    <div
      className={cn(
        'flex min-h-[52px] flex-col gap-2.5 rounded-[11px] border bg-panel-surface px-3.5 py-2.5 shadow-[0_1px_3px_rgba(20,25,40,0.025)] sm:flex-row sm:items-center sm:gap-3',
        completed ? 'border-emerald-200 bg-emerald-50/30' : 'border-panel-border',
      )}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {homework.publisherName ? <PublisherBadge name={homework.publisherName} /> : null}
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
        ) : null}
        {homework.isSplit && homework.dayPlans?.length ? (
          <p className="w-full text-[11px] text-panel-text-muted">
            {homework.dayPlans.map((plan) => `${plan.date}: ${plan.questionCount} soru`).join(' · ')}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2.5 sm:justify-end">
        <HomeworkProgress homework={homework} completed={completed} />
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
