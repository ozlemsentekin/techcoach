export default function HomeworkCard({ homework }) {
  const progress =
    homework.totalQuestionCount > 0
      ? Math.round((homework.completedQuestionCount / homework.totalQuestionCount) * 100)
      : 0

  return (
    <div className="rounded-2xl border border-panel-border bg-panel-surface p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-panel-text-muted">{homework.subject}</p>
        <span className="text-sm text-panel-text-muted">Teslim: {homework.dueDate}</span>
      </div>
      <h3 className="mt-1 text-base font-semibold text-panel-text">{homework.title}</h3>
      {homework.totalQuestionCount > 0 ? (
        <>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-panel-blue-soft">
            <div className="h-full rounded-full bg-panel-blue" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1.5 text-sm text-panel-text-muted">
            {homework.completedQuestionCount} / {homework.totalQuestionCount} soru tamamlandı
          </p>
        </>
      ) : null}
      {homework.isSplit ? (
        <p className="mt-2 text-sm text-panel-text-muted">
          {homework.dayPlans.map((plan) => `${plan.date}: ${plan.questionCount} soru`).join(' · ')}
        </p>
      ) : null}
    </div>
  )
}
