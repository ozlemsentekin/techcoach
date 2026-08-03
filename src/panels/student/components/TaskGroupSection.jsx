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
  timeline = false,
  highlightTaskId = null,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const style = SUBJECT_STYLES[subject] || DEFAULT_SUBJECT_STYLE

  return (
    <section className="border-t border-panel-border bg-panel-surface first:border-t-0">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 bg-panel-surface-soft/45 px-3 py-3 text-left transition-colors hover:bg-panel-surface-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-student-theme-primary sm:px-4"
      >
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${style.dot}`} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className={`inline-flex max-w-full items-center rounded-[10px] px-2.5 py-1 text-sm font-bold ${style.soft} ${style.text}`}>
            <span className="truncate">{subject.toLocaleUpperCase('tr-TR')}</span>
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center rounded-[10px] bg-panel-surface px-2.5 py-1 text-xs font-semibold text-panel-text-muted">
          {tasks.length} görev
        </span>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-panel-text-muted">
          {expanded ? (
            <ChevronDown size={17} aria-hidden="true" />
          ) : (
            <ChevronRight size={17} aria-hidden="true" />
          )}
        </span>
      </button>

      {expanded ? (
        <div className={timeline ? 'border-t border-panel-border' : 'divide-y divide-panel-border/80 border-t border-panel-border'}>
          {tasks.map((task, index) => (
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
              timeline={timeline}
              isFirst={index === 0}
              isLast={index === tasks.length - 1}
              highlight={task.id === highlightTaskId}
            />
          ))}
        </div>
      ) : null}
    </section>
  )
}
