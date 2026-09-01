import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Clock, Sparkles, X } from 'lucide-react'
import { dateToISO, formatDateLong, formatTime, getGreetingByHour, pickGreeting } from '../../../utils/time'
import { calculateProgress, getProgressMessage } from '../../../utils/progress'
import { resolveDisplayedMotivationMessage } from '../../../services/motivationMessageService'
import { getPublicGreetingRules } from '../../../services/contentService'
import { readJSON, writeJSON } from '../../../services/storage'

const LGS_DATE = new Date(2027, 5, 13)
const LGS_HIDDEN_STORAGE_KEY = 'student:lgs_countdown_hidden'

function daysUntil(targetDate, currentDate) {
  const startOfCurrent = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate())
  const startOfTarget = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate())
  return Math.ceil((startOfTarget.getTime() - startOfCurrent.getTime()) / (1000 * 60 * 60 * 24))
}

export default function StudentWelcomeBanner({ studentId, studentName, grade, tasks = [], checkIn }) {
  // LGS geri sayım banner'ı yalnızca 8. sınıf öğrencilerinde gösterilir.
  const showLgsCountdown = String(grade ?? '').trim() === '8'
  const [currentDate, setCurrentDate] = useState(() => new Date())

  // Bazı öğrenciler geri sayımı görünce stres oluyor; kartı kapatabilsinler.
  // Tercih öğrenci bazında (aynı tarayıcıda birden fazla öğrenci olabilir) saklanır.
  const lgsHiddenKey = studentId || 'anon'
  const [lgsHidden, setLgsHidden] = useState(
    () => readJSON(LGS_HIDDEN_STORAGE_KEY, {})[lgsHiddenKey] === true,
  )

  const setLgsHiddenPref = (hidden) => {
    setLgsHidden(hidden)
    const map = readJSON(LGS_HIDDEN_STORAGE_KEY, {}) || {}
    if (hidden) {
      map[lgsHiddenKey] = true
    } else {
      delete map[lgsHiddenKey]
    }
    writeJSON(LGS_HIDDEN_STORAGE_KEY, map)
  }

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
  const lgsCountdownVisible = showLgsCountdown && !lgsHidden

  return (
    <section className="panel-card overflow-hidden">
      <div className="h-2 w-full bg-student-theme-primary" aria-hidden="true" />
      <div
        className={`grid gap-5 bg-gradient-to-br from-student-theme-soft/50 via-transparent to-transparent p-5 lg:items-start ${
          lgsCountdownVisible ? 'lg:grid-cols-[minmax(0,1fr)_320px]' : ''
        }`}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-panel-sage-soft px-3 py-1 text-sm font-medium text-panel-sage">
              <CalendarDays size={14} aria-hidden="true" />
              {formatDateLong(currentDate)}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-panel-blue-soft px-3 py-1 text-sm font-medium text-panel-blue">
              <Clock size={14} aria-hidden="true" />
              {formatTime(currentDate)}
            </span>
            {showLgsCountdown && lgsHidden ? (
              <button
                type="button"
                onClick={() => setLgsHiddenPref(false)}
                className="inline-flex items-center gap-2 rounded-full border border-panel-border bg-panel-surface px-3 py-1 text-sm font-medium text-panel-text-muted transition hover:text-panel-text"
              >
                <CalendarDays size={14} aria-hidden="true" />
                LGS geri sayımını göster
              </button>
            ) : null}
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <h1 className="text-2xl font-bold leading-tight text-panel-text sm:text-3xl">
              {firstName ? `${greeting.label}, ${firstName}` : greeting.label}
            </h1>
            <p className="flex max-w-3xl items-start gap-2 text-base font-medium leading-relaxed text-panel-text-muted">
              <Sparkles className="mt-0.5 shrink-0 text-panel-blue" size={17} aria-hidden="true" />
              <span className="line-clamp-2">{bannerLead}</span>
            </p>
          </div>
        </div>

        {lgsCountdownVisible ? (
          <div className="relative flex min-w-0 items-center gap-3 rounded-xl border border-panel-border bg-panel-surface px-4 py-3 pl-5 shadow-sm">
            <button
              type="button"
              onClick={() => setLgsHiddenPref(true)}
              aria-label="LGS geri sayımını gizle"
              title="LGS geri sayımını gizle"
              className="absolute -left-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-panel-border bg-panel-surface text-panel-text-muted shadow-sm transition hover:text-panel-text"
            >
              <X size={13} aria-hidden="true" />
            </button>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-panel-blue-soft text-panel-blue">
              <CalendarDays size={18} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-xs font-medium text-panel-text-muted">LGS 2027</p>
                <p className="text-xs font-semibold text-panel-text-muted">13 Haziran 2027</p>
              </div>
              <div className="mt-1 flex items-end gap-2">
                <p className="text-3xl font-bold leading-none text-panel-text">{lgsText}</p>
                {lgsRemainingDays > 0 ? (
                  <p className="pb-0.5 text-sm font-bold text-panel-blue">kaldı</p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="border-t border-panel-border bg-panel-surface-soft/60 p-4 sm:p-5">
        <div className="mb-2 flex items-center justify-between gap-3 text-sm">
          <span className="font-medium text-panel-text">Gün ilerlemesi</span>
          <span className="font-bold text-panel-blue">
            %{progress} · {completed} / {total}
          </span>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-panel-border"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          aria-label="Bugünkü görev ilerlemesi"
        >
          <div className="h-full rounded-full bg-panel-blue" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </section>
  )
}
