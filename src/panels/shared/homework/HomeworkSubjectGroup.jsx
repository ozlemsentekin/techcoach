import { cn } from '../../ui/utils'
import { getSubjectTone } from '../../../utils/subjectStyles'
import { SUBJECT_ICONS, DEFAULT_SUBJECT_ICON, SUBJECT_ICON_TONE_CLASSES } from './homeworkDisplay'
import HomeworkItemCard from './HomeworkItemCard'

export default function HomeworkSubjectGroup({ subject, items, onDeleteRequest, onEditRequest, onAssignTaskRequest }) {
  const tone = getSubjectTone(subject)
  const Icon = SUBJECT_ICONS[subject] || DEFAULT_SUBJECT_ICON

  return (
    <div className="rounded-xl border border-panel-border bg-panel-surface-soft/45 p-3">
      <div className="flex items-center gap-3 px-1 py-1">
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]',
            SUBJECT_ICON_TONE_CLASSES[tone],
          )}
        >
          <Icon size={18} aria-hidden="true" />
        </span>
        <span className="text-[15px] font-bold text-panel-text">{subject}</span>
        <span className="text-xs text-panel-text-muted">{items.length} ödev</span>
      </div>

      <div className="mt-1 flex flex-col gap-2.5 pl-4 sm:pl-[26px]">
        {items.map((homework, index) => (
          <div key={homework.id} className="relative pl-5 sm:pl-6">
            <span
              aria-hidden="true"
              className="absolute left-0 top-0 border-l-[1.5px] border-dashed border-student-theme-primary/25"
              style={{ height: index === items.length - 1 ? '20px' : '100%' }}
            />
            <span
              aria-hidden="true"
              className="absolute left-0 top-5 w-3 border-t-[1.5px] border-dashed border-student-theme-primary/25 sm:w-4"
            />
            <HomeworkItemCard
              homework={homework}
              onDeleteRequest={onDeleteRequest}
              onEditRequest={onEditRequest}
              onAssignTaskRequest={onAssignTaskRequest}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
