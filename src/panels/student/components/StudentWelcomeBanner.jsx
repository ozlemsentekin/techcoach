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

function LgsCountdownIllustration() {
  return (
    <svg
      className="h-28 w-36 shrink-0 sm:h-32 sm:w-44"
      viewBox="0 0 220 160"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="lgs-countdown-path" x1="38" y1="122" x2="178" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--color-student-theme-primary)" stopOpacity="0.35" />
          <stop offset="1" stopColor="var(--color-student-theme-primary)" />
        </linearGradient>
        <linearGradient id="lgs-countdown-card" x1="62" y1="30" x2="154" y2="118" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--color-panel-surface)" />
          <stop offset="1" stopColor="var(--color-student-theme-soft)" />
        </linearGradient>
      </defs>

      <rect x="18" y="22" width="184" height="116" rx="30" fill="var(--color-panel-surface)" opacity="0.72" />
      <circle cx="170" cy="40" r="26" fill="var(--color-student-theme-soft)" />
      <circle cx="52" cy="116" r="18" fill="var(--color-student-theme-soft)" />

      <path
        d="M38 122 C70 82 98 126 126 92 C143 72 158 58 182 48"
        stroke="var(--color-student-theme-primary)"
        strokeWidth="12"
        strokeLinecap="round"
        opacity="0.12"
      />
      <path
        d="M38 122 C70 82 98 126 126 92 C143 72 158 58 182 48"
        stroke="url(#lgs-countdown-path)"
        strokeWidth="5"
        strokeLinecap="round"
      />

      <rect x="70" y="32" width="76" height="68" rx="18" fill="url(#lgs-countdown-card)" />
      <rect x="82" y="46" width="52" height="7" rx="3.5" fill="var(--color-student-theme-primary)" opacity="0.2" />
      <rect x="82" y="61" width="28" height="7" rx="3.5" fill="var(--color-student-theme-primary)" opacity="0.32" />
      <rect x="82" y="76" width="42" height="7" rx="3.5" fill="var(--color-student-theme-primary)" opacity="0.2" />

      <g transform="translate(150 76)">
        <rect x="0" y="0" width="42" height="36" rx="12" fill="var(--color-panel-surface)" />
        <rect x="0" y="0" width="42" height="12" rx="8" fill="var(--color-student-theme-primary)" />
        <text
          x="21"
          y="27"
          textAnchor="middle"
          fontFamily="Inter, Manrope, Arial, sans-serif"
          fontSize="14"
          fontWeight="800"
          fill="var(--color-student-theme-primary)"
        >
          13
        </text>
      </g>

      <circle cx="38" cy="122" r="8" fill="var(--color-panel-surface)" />
      <circle cx="38" cy="122" r="4" fill="var(--color-student-theme-primary)" />
      <circle cx="182" cy="48" r="10" fill="var(--color-student-theme-primary)" />
      <circle cx="182" cy="48" r="4" fill="var(--color-student-theme-button-text)" />
    </svg>
  )
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

  return (
    <div className="flex flex-col gap-5">
      <section className="student-theme-banner overflow-hidden rounded-2xl border border-student-theme-primary/25 bg-student-theme-soft shadow-panel-2">
        <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,400px)] lg:items-stretch">
          <div className="min-w-0">
            <div className="flex h-full flex-col justify-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="student-theme-banner-pill inline-flex items-center gap-2 rounded-full border border-student-theme-primary/15 bg-panel-surface/80 px-3 py-1 text-sm font-semibold text-student-theme-text">
                    <CalendarDays size={15} aria-hidden="true" />
                    {formatDateLong(currentDate)}
                  </span>
                  <span className="student-theme-banner-pill inline-flex items-center gap-2 rounded-full border border-student-theme-primary/15 bg-panel-surface/80 px-3 py-1 text-sm font-semibold text-student-theme-text">
                    <Clock size={15} aria-hidden="true" />
                    {formatTime(currentDate)}
                  </span>
                </div>

                <h1 className="student-theme-banner-text mt-4 text-2xl font-bold text-panel-text sm:text-3xl">
                  {greeting.label}, {firstName || 'Aylin'}
                </h1>
                <p className="student-theme-banner-muted mt-3 flex max-w-3xl items-start gap-2 text-base font-semibold leading-relaxed text-panel-text-muted">
                  <Sparkles className="student-theme-banner-accent mt-0.5 shrink-0 text-student-theme-text" size={18} aria-hidden="true" />
                  <span>{bannerLead}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="student-theme-lgs-card relative flex min-h-40 overflow-hidden rounded-2xl border border-student-theme-primary/20 bg-panel-surface/70 p-4 shadow-sm">
            <div className="student-theme-lgs-visual-bg pointer-events-none absolute inset-y-0 right-0 w-2/3 bg-student-theme-soft/70" aria-hidden="true" />
            <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-student-theme-primary/10" aria-hidden="true" />
            <div className="relative flex min-w-0 flex-1 items-center justify-between gap-4">
              <div className="min-w-0">
                <span className="student-theme-lgs-label inline-flex rounded-full bg-student-theme-soft px-3 py-1 text-xs font-bold uppercase tracking-wide text-student-theme-text">
                  LGS 2027
                </span>
                {lgsRemainingDays > 0 ? (
                  <div className="mt-4">
                    <p className="student-theme-lgs-title text-5xl font-bold leading-none text-panel-text">{lgsRemainingDays}</p>
                    <p className="student-theme-lgs-accent mt-1 text-base font-bold text-student-theme-text">gün kaldı</p>
                  </div>
                ) : (
                  <p className="student-theme-lgs-title mt-4 text-2xl font-bold text-panel-text">
                    {lgsRemainingDays === 0 ? 'Bugün' : 'Tamamlandı'}
                  </p>
                )}
                <p className="student-theme-lgs-muted mt-4 text-xs font-semibold text-panel-text-muted">13 Haziran 2027</p>
              </div>
              <LgsCountdownIllustration />
            </div>
          </div>
        </div>

        <div className="student-theme-banner-progress border-t border-student-theme-primary/15 bg-panel-surface/55 px-4 py-3 sm:px-5">
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="student-theme-banner-text font-semibold text-panel-text">Gün ilerlemesi</span>
            <span className="student-theme-banner-text font-bold text-student-theme-text">
              %{progress} · {completed} / {total}
            </span>
          </div>
          <div
            className="student-theme-banner-progress-track h-2 overflow-hidden rounded-full bg-student-theme-soft"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-label="Bugünkü görev ilerlemesi"
          >
            <div className="student-theme-banner-progress-fill h-full rounded-full bg-student-theme-primary" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </section>

      <StudentStatsCards tasks={tasks} />
    </div>
  )
}
