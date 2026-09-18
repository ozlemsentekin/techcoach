import { formatAnalysisDate, MISTAKE_REASON_LABELS, roleLabel } from './mistakeAnalysis'

// Bir yanlış sorunun analiz yorumlarını (öğrenci/veli/öğretmen, kronolojik) tek tip kartlarla
// gösterir — hem Hata Defteri'ndeki WrongQuestionGalleryModal'ın (yorum ekleme composer'ının
// üstünde) hem "Hata Analizlerim" özet sayfasındaki salt-okunur AnalysisDetailModal'ın ortak
// gösterim bileşeni. En yeni yorum en üstte.
export default function AnalysisCommentFeed({ comments, emptyLabel = 'Henüz yorum yok.' }) {
  if (!comments?.length) {
    return <p className="text-xs text-panel-text-muted">{emptyLabel}</p>
  }

  return (
    <div className="flex flex-col gap-2">
      {[...comments].reverse().map((comment) => (
        <div key={comment.id} className="rounded-lg border border-panel-border bg-panel-surface-soft px-3 py-2 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
            <span className="font-semibold text-panel-text">
              {comment.analyzedByName || roleLabel(comment.role)}
              <span className="ml-1 font-normal text-panel-text-muted">· {roleLabel(comment.role)}</span>
            </span>
            <span className="shrink-0 text-[11px] text-panel-text-muted">{formatAnalysisDate(comment.createdAt)}</span>
          </div>
          {comment.mistakeReason ? (
            <span className="mt-1 inline-block rounded-full bg-panel-blue-soft px-2 py-0.5 text-[11px] font-semibold text-panel-blue">
              {MISTAKE_REASON_LABELS[comment.mistakeReason] || comment.mistakeReason}
            </span>
          ) : null}
          {comment.note ? <p className="mt-1 whitespace-pre-wrap text-panel-text">{comment.note}</p> : null}
        </div>
      ))}
    </div>
  )
}
