import { formatDateLong } from '../../../utils/time'

const LGS_EXAM_DATE = new Date(new Date().getFullYear(), 5, 14)

function getJourneyDay() {
  const start = new Date(LGS_EXAM_DATE)
  start.setFullYear(start.getFullYear() - 1)
  const diffDays = Math.max(1, Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24)))
  return diffDays
}

export default function GreetingCard({ firstName, mainMessage }) {
  return (
    <div className="rounded-2xl border border-panel-border bg-panel-surface p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-panel-text">Günaydın {firstName}</h1>
        <span className="whitespace-nowrap text-sm text-panel-text-muted">{formatDateLong()}</span>
      </div>
      <p className="mt-2 text-base text-panel-text-muted">{mainMessage}</p>
      <p className="mt-3 text-sm text-panel-text-muted">LGS yolculuğunda {getJourneyDay()}. gün</p>
    </div>
  )
}
