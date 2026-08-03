import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Clock, Sparkles } from 'lucide-react'
import { dateToISO, formatDateLong, formatTime, getGreetingByHour, pickGreeting } from '../../../utils/time'
import { calculateProgress, getProgressMessage } from '../../../utils/progress'
import { resolveDisplayedMotivationMessage } from '../../../services/motivationMessageService'
import { getPublicGreetingRules } from '../../../services/contentService'
import StudentStatsCards from './StudentStatsCards'

const LGS_DATE = new Date(2027, 5, 13)

function daysUntil(targetDate, currentDate) {
  const startOfCurrent = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate())
  const startOfTarget = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate())
  return Math.ceil((startOfTarget.getTime() - startOfCurrent.getTime()) / (1000 * 60 * 60 * 24))
}

export default function StudentWelcomeBanner({ studentName, tasks = [], checkIn }) {
  const [currentDate, setCurrentDate] = useState(() => new Date())

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCurrentDate(new Date())
    }, 60000)
    return () => window.clearInterval(interval)
  }, [])

  const dateISO = dateToISO(currentDate)
  const completed = useMemo(() => tasks.filter((task) => task.status === 'tamamlandi').length, [tasks])
  const total = tasks.length
  const progress = calculateProgress(completed, total)
  const hasHelpRequest = useMemo(() => tasks.some((task) => task.status === 'yardim-bekliyor'), [tasks])

  const [motivationMessage, setMotivationMessage] = useState(null)
  const [greetingRules, setGreetingRules] = useState(null)

  useEffect(() => {
    let ignore = false
    getPublicGreetingRules().then((rules) => {
      if (!ignore) setGreetingRules(rules)
    })
    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    let ignore = false
    resolveDisplayedMotivationMessage(dateISO, { tasks, checkIn }).then((message) => {
      if (!ignore) setMotivationMessage(message)
    })
    return () => {
      ignore = true
    }
    // tasks/checkIn kasıtlı olarak dep listesinde değil: her render'da yeni referans alırlar,
    // bunun yerine türetilmiş primitive değerler (completed/total/hasHelpRequest) izleniyor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateISO, completed, total, checkIn?.energyLevel, hasHelpRequest])

  const greeting = greetingRules ? pickGreeting(greetingRules, currentDate.getHours()) : getGreetingByHour(currentDate.getHours())
  const firstName = (studentName || '').split(' ')[0]
  const progressMessage = getProgressMessage(progress)
  const lgsRemainingDays = daysUntil(LGS_DATE, currentDate)
  const bannerMessage = motivationMessage || { title: progressMessage, body: '' }
  const bannerLead = bannerMessage.body ? `${bannerMessage.title} ${bannerMessage.body}` : bannerMessage.title
  const lgsText =
    lgsRemainingDays > 0
      ? `${lgsRemainingDays} gün`
      : lgsRemainingDays === 0
        ? 'Bugün'
        : 'Tamamlandı'

  return (
    <div className="flex flex-col gap-3">
      <section className="student-theme-banner overflow-hidden rounded-2xl border border-student-theme-primary/25 shadow-panel-2">
        <div className="grid gap-3 p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="student-theme-banner-pill inline-flex h-8 items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 text-xs font-semibold text-white sm:text-sm">
                <CalendarDays size={14} aria-hidden="true" />
                {formatDateLong(currentDate)}
              </span>
              <span className="student-theme-banner-pill inline-flex h-8 items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 text-xs font-semibold text-white sm:text-sm">
                <Clock size={14} aria-hidden="true" />
                {formatTime(currentDate)}
              </span>
            </div>

            <h1 className="student-theme-banner-text mt-3 text-2xl font-bold leading-tight text-white sm:text-3xl">
              {greeting.label}, {firstName || 'Aylin'}
            </h1>
            <p className="student-theme-banner-muted mt-2 flex max-w-4xl items-start gap-2 text-sm font-semibold leading-relaxed text-white/80 sm:text-base">
              <Sparkles className="student-theme-banner-accent mt-0.5 shrink-0 text-white" size={16} aria-hidden="true" />
              <span className="line-clamp-2">{bannerLead}</span>
            </p>
          </div>

          <div className="student-theme-lgs-card flex min-w-0 items-center gap-3 rounded-[14px] border border-white/15 bg-white/10 px-3 py-3 shadow-sm">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-white/10 text-white">
              <CalendarDays size={18} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="student-theme-lgs-label text-xs font-bold text-white">LGS 2027</p>
                <p className="student-theme-lgs-muted text-xs font-semibold text-white/70">13 Haziran 2027</p>
              </div>
              <div className="mt-1 flex items-end gap-2">
                <p className="student-theme-lgs-title text-3xl font-bold leading-none text-white">{lgsText}</p>
                {lgsRemainingDays > 0 ? (
                  <p className="student-theme-lgs-accent pb-0.5 text-sm font-bold text-white/80">kaldı</p>
                ) : null}
              </div>
            </div>
          </div>
        </div>

      </section>

      <section className="student-theme-progress-card rounded-[14px] border border-student-theme-primary/15 bg-panel-surface px-3 py-3 shadow-panel-1 sm:px-4">
        <div className="mb-2 flex items-center justify-between gap-3 text-sm">
          <span className="font-semibold text-panel-text">Gün ilerlemesi</span>
          <span className="font-bold text-student-theme-text">
            %{progress} · {completed} / {total}
          </span>
        </div>
        <div
          className="student-theme-banner-progress-track h-3 overflow-hidden rounded-full border border-student-theme-primary/10 bg-panel-surface-soft"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          aria-label="Bugünkü görev ilerlemesi"
        >
          <div className="student-theme-banner-progress-fill h-full rounded-full shadow-sm" style={{ width: `${progress}%` }} />
        </div>
      </section>

      <StudentStatsCards tasks={tasks} />
    </div>
  )
}
