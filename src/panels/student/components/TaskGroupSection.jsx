import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import TaskListCard from './TaskListCard'
import { SUBJECT_STYLES, DEFAULT_SUBJECT_STYLE } from './subjectStyles'

export default function TaskGroupSection({
  subject,
  tasks,
  onOpenDetails,
  onStartTimer,
  onCompleteTask,
  onUndoComplete,
  showLessonLabel = false,
  getLessonLabel,
  emphasizeTime = false,
  defaultExpanded = true,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const style = SUBJECT_STYLES[subject] || DEFAULT_SUBJECT_STYLE

  return (
    <section className="border-t border-panel-border first:border-t-0">
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
        <div className="divide-y divide-panel-border border-t border-panel-border">
          {tasks.map((task) => (
            <TaskListCard
              key={task.id}
              task={task}
              lessonLabel={getLessonLabel ? getLessonLabel(task) : subject}
              onOpenDetails={onOpenDetails}
              onStartTimer={onStartTimer}
              onCompleteTask={onCompleteTask}
              onUndoComplete={onUndoComplete}
              showLessonLabel={showLessonLabel}
              emphasizeTime={emphasizeTime}
            />
          ))}
        </div>
      ) : null}
    </section>
  )
}
