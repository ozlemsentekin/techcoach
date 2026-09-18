import { cn } from '../ui/utils'
import { ANALYSIS_ROLES, MISTAKE_REASON_LABELS, ROLE_SHORT_LABELS, hasRoleAnalysis, latestCommentByRole, roleLabel } from './mistakeAnalysis'

// Bir yanlış sorunun üç analiz rolünün (öğrenci / veli / öğretmen) durumunu gösteren küçük rozet
// dizisi. Dolu = o rolden en az bir yorumda hata nedeni seçilmiş. İzleyicinin kendi rolü boşsa
// amber vurgulanır ("senin analizin bekliyor").
export default function MistakeAnalysisBadges({ comments, viewerRole, className }) {
  const item = { analysisComments: comments }
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {ANALYSIS_ROLES.map((role) => {
        const analyzed = hasRoleAnalysis(item, role)
        const isSelf = role === viewerRole
        const latest = latestCommentByRole(comments, role)
        const title = analyzed
          ? `${roleLabel(role)} analizi: ${MISTAKE_REASON_LABELS[latest?.mistakeReason] || 'yapıldı'}`
          : isSelf
            ? `${roleLabel(role)} analizi bekliyor (sen)`
            : `${roleLabel(role)} analizi bekliyor`
        return (
          <span
            key={role}
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
            {ROLE_SHORT_LABELS[role]}
          </span>
        )
      })}
    </div>
  )
}
