import { cn } from '../ui/utils'
import { ANALYSIS_LANES, MISTAKE_REASON_LABELS, isLaneAnalyzed } from './mistakeAnalysis'

// Bir yanlış sorunun üç analiz kulvarının (öğrenci / veli / öğretmen) durumunu gösteren küçük
// rozet dizisi. Dolu = o kulvarda hata nedeni seçilmiş. İzleyicinin kendi kulvarı boşsa amber
// vurgulanır ("senin analizin bekliyor").
export default function MistakeAnalysisBadges({ analyses, viewerRole, className }) {
  const item = { analyses }
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {ANALYSIS_LANES.map((lane) => {
        const analyzed = isLaneAnalyzed(item, lane.role)
        const isSelf = lane.role === viewerRole
        const reason = analyses?.[lane.role]?.mistakeReason
        const title = analyzed
          ? `${lane.label} analizi: ${MISTAKE_REASON_LABELS[reason] || 'yapıldı'}`
          : isSelf
            ? `${lane.label} analizi bekliyor (sen)`
            : `${lane.label} analizi bekliyor`
        return (
          <span
            key={lane.role}
            title={title}
            className={cn(
              'inline-flex h-5 min-w-5 items-center justify-center rounded-full border px-1 text-[10px] font-bold leading-none',
              analyzed
                ? 'border-emerald-500 bg-emerald-500 text-white'
                : isSelf
                  ? 'border-amber-400 bg-amber-50 text-amber-700'
                  : 'border-panel-border bg-panel-surface text-panel-text-muted',
            )}
          >
            {lane.short}
          </span>
        )
      })}
    </div>
  )
}
