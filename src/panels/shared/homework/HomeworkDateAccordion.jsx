import { Calendar, CalendarOff, ChevronDown } from 'lucide-react'
import { cn } from '../../ui/utils'
import { formatGroupDate } from './homeworkDisplay'
import HomeworkSubjectGroup from './HomeworkSubjectGroup'

export default function HomeworkDateAccordion({
  dateGroup,
  isOpen,
  onToggle,
  onDeleteRequest,
  onAssignTaskRequest,
  isPast = false,
}) {
  const isUnassigned = !dateGroup.dueDate
  const contentId = `homework-date-${isUnassigned ? 'unassigned' : dateGroup.dueDate.replace(/[^a-zA-Z0-9-]/g, '-')}`

  return (
    <div
      className={cn(
        'overflow-hidden rounded-[14px] border border-panel-border bg-panel-surface shadow-[0_2px_8px_rgba(20,25,40,0.04)]',
        isPast && 'opacity-60',
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={contentId}
        className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3.5 text-left sm:flex-nowrap sm:px-5 sm:py-4"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-student-theme-soft text-student-theme-text">
            {isUnassigned ? <CalendarOff size={18} aria-hidden="true" /> : <Calendar size={18} aria-hidden="true" />}
          </span>
          <span className="text-[16px] font-bold text-panel-text">
            {isUnassigned ? 'Atama yapılmadı' : formatGroupDate(dateGroup.dueDate)}
          </span>
        </span>

        <span className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
          <span className="whitespace-nowrap rounded-full bg-student-theme-soft px-2.5 py-1 text-xs font-semibold text-student-theme-text">
            {dateGroup.totalHomeworkCount} ödev · {dateGroup.completedHomeworkCount} tamamlandı
          </span>
          <span className="flex items-center gap-2">
            <span
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={dateGroup.completionPercentage}
              className="h-[6px] w-[130px] overflow-hidden rounded-full bg-panel-surface-soft sm:w-[150px]"
            >
              <div
                className="h-full rounded-full bg-student-theme-primary"
                style={{ width: `${dateGroup.completionPercentage}%` }}
              />
            </span>
            <span className="w-9 shrink-0 text-right text-xs font-semibold text-student-theme-text">
              %{dateGroup.completionPercentage}
            </span>
          </span>
          <ChevronDown
            size={18}
            className={cn('shrink-0 text-panel-text-muted transition-transform', isOpen ? 'rotate-180' : '')}
            aria-hidden="true"
          />
        </span>
      </button>

      {isOpen ? (
        <div id={contentId} className="flex flex-col gap-3 border-t border-panel-border px-3 pb-4 pt-3 sm:px-4">
          {dateGroup.subjects.map((subjectGroup) => (
            <HomeworkSubjectGroup
              key={subjectGroup.subject}
              subject={subjectGroup.subject}
              items={subjectGroup.items}
              onDeleteRequest={onDeleteRequest}
              onAssignTaskRequest={onAssignTaskRequest}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
