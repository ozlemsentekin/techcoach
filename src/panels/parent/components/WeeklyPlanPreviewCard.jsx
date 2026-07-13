import { Link } from 'react-router-dom'
import { TASK_TYPES } from '../../../data/taskTypes'
import { formatDateShort } from '../../../utils/time'

const DAY_LABELS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cts', 'Paz']

export default function WeeklyPlanPreviewCard({ weekDates, tasksByDate, onCopyPreviousWeek, onSuggestPlan, onPublish, planStatus }) {
  return (
    <div className="rounded-2xl border border-panel-border bg-panel-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-panel-text">Aylin'in Haftasını Planla</h2>
        <Link to="/parent/weekly-plan" className="text-sm font-medium text-panel-blue hover:underline">
          Tümünü Gör
        </Link>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {weekDates.map((date, index) => (
          <div key={date} className="rounded-xl border border-panel-border p-2 text-center">
            <p className="text-xs font-medium text-panel-text-muted">{DAY_LABELS[index]}</p>
            <p className="text-[11px] text-panel-text-muted">{formatDateShort(date)}</p>
            <div className="mt-1 flex flex-col gap-1">
              {(tasksByDate[date] || []).slice(0, 3).map((task) => {
                const meta = TASK_TYPES[task.taskType] || {}
                return (
                  <span
                    key={task.id}
                    className="truncate rounded-md bg-panel-blue-soft px-1 py-0.5 text-[10px] font-medium text-panel-blue"
                    title={task.title}
                  >
                    {meta.label || task.title}
                  </span>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onCopyPreviousWeek}
          className="rounded-xl border border-panel-border px-3 py-2 text-sm font-medium text-panel-text"
        >
          Geçen Haftayı Kopyala
        </button>
        <button
          type="button"
          onClick={onSuggestPlan}
          className="rounded-xl border border-panel-border px-3 py-2 text-sm font-medium text-panel-text"
        >
          Otomatik Plan Öner
        </button>
        <button
          type="button"
          onClick={onPublish}
          className="rounded-xl bg-panel-blue px-3 py-2 text-sm font-semibold text-white"
        >
          {planStatus === 'yayinlandi' ? 'Yeniden Yayınla' : 'Planı Yayınla'}
        </button>
      </div>
    </div>
  )
}
