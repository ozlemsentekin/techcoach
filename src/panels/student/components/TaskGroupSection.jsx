import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import TaskListCard from './TaskListCard'
import { SUBJECT_STYLES, DEFAULT_SUBJECT_STYLE } from './subjectStyles'

export default function TaskGroupSection({ subject, tasks, onOpenDetails }) {
  const [expanded, setExpanded] = useState(true)
  const style = SUBJECT_STYLES[subject] || DEFAULT_SUBJECT_STYLE

  return (
    <div className="overflow-hidden rounded-2xl border border-panel-border bg-panel-surface shadow-panel-1">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="flex w-full flex-wrap items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-panel-surface-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-student-theme-primary sm:px-5"
      >
        {expanded ? (
          <ChevronDown size={16} className="shrink-0 text-panel-text-muted" aria-hidden="true" />
        ) : (
          <ChevronRight size={16} className="shrink-0 text-panel-text-muted" aria-hidden="true" />
        )}
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-bold tracking-wide ${style.soft} ${style.text}`}>
          {subject.toLocaleUpperCase('tr-TR')}
        </span>
        <span className="ml-auto inline-flex items-center rounded-full bg-panel-surface-soft px-2.5 py-1 text-xs font-medium text-panel-text-muted">
          {tasks.length} görev
        </span>
      </button>

      {expanded ? (
        <div className="flex flex-col gap-4 border-t border-panel-border px-4 pb-4 pt-4 sm:px-5">
          {tasks.map((task) => (
            <TaskListCard key={task.id} task={task} onOpenDetails={onOpenDetails} showLessonLabel={false} />
          ))}
        </div>
      ) : null}
    </div>
  )
}
