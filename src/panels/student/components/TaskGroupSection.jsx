import { useState } from 'react'
import { AlertTriangle, BookOpen, CalendarDays, ChevronDown } from 'lucide-react'
import TaskListCard from './TaskListCard'
import { SUBJECT_STYLES, DEFAULT_SUBJECT_STYLE } from './subjectStyles'
import { daysLate } from '../../../utils/time'

function isTaskOverdue(task) {
  return daysLate(task.date) > 0 && !['tamamlandi', 'yeniden-planlandi'].includes(task.status)
}

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
  showDateOnCards = false,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const style = SUBJECT_STYLES[subject] || DEFAULT_SUBJECT_STYLE
  const isKnownSubject = Boolean(SUBJECT_STYLES[subject])
  const hasOverdueTask = tasks.some(isTaskOverdue)
  const HeaderIcon = hasOverdueTask ? AlertTriangle : isKnownSubject ? BookOpen : CalendarDays
  const accentChipClass = hasOverdueTask ? 'bg-panel-red-soft text-panel-red' : `${style.soft} ${style.text}`
  const accentTextClass = 'text-panel-text'

  return (
    <section className="border-t border-panel-border bg-panel-surface first:border-t-0">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="group flex w-full items-center gap-3 bg-panel-surface-soft/60 px-3 py-2 text-left transition-colors hover:bg-panel-surface-soft/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-student-theme-primary sm:px-4"
      >
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[11px] ${accentChipClass}`}>
          <HeaderIcon size={17} aria-hidden="true" />
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className={`block truncate text-sm font-semibold ${accentTextClass}`}>
            {subject}
          </span>
          <span className="block text-xs font-medium text-panel-text-muted">{tasks.length} görev</span>
        </span>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-panel-text-muted transition-colors group-hover:bg-panel-surface-soft">
          <ChevronDown
            size={17}
            className={`transition-transform duration-200 ${expanded ? '' : '-rotate-90'}`}
            aria-hidden="true"
          />
        </span>
      </button>

      {expanded ? (
        <div className="divide-y divide-panel-border border-t border-panel-border">
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
              showDateBadge={showDateOnCards}
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
