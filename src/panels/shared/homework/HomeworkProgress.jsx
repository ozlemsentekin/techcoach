import { cn } from '../../ui/utils'

export default function HomeworkProgress({ homework, completed }) {
  const hasQuestionProgress = homework.totalQuestionCount > 0
  const isReading = homework.resourceType === 'okuma_kitabi'

  if (hasQuestionProgress) {
    const percentage = Math.round((homework.completedQuestionCount / homework.totalQuestionCount) * 100)
    return (
      <div className="flex items-center gap-2">
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percentage}
          className="h-[5px] w-[90px] shrink-0 overflow-hidden rounded-full bg-[#EDF0F2] sm:w-[110px]"
        >
          <div
            className={cn('h-full rounded-full', completed ? 'bg-emerald-500' : 'bg-[#A18BDE]')}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className={cn('w-[46px] shrink-0 text-[11px] font-medium', completed ? 'text-emerald-600' : 'text-[#5D6472]')}>
          {homework.completedQuestionCount}/{homework.totalQuestionCount}
        </span>
      </div>
    )
  }

  if (isReading && homework.totalPageCount > 0) {
    return <span className="text-[11px] text-[#5D6472]">{homework.totalPageCount} sayfa</span>
  }

  return <span className="text-[11px] text-[#5D6472]">—</span>
}
