import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Sparkles, X } from 'lucide-react'
import { dateToISO, formatDateLong, getGreetingByHour, pickGreeting } from '../../../utils/time'
import { getProgressMessage } from '../../../utils/progress'
import { resolveDisplayedMotivationMessage } from '../../../services/motivationMessageService'
import { getPublicGreetingRules } from '../../../services/contentService'
import { readJSON, writeJSON } from '../../../services/storage'
import { getDailyTaskSummary } from '../../../utils/dailyTaskSummary'

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
  const { completed, total, progress } = getDailyTaskSummary(tasks, dateISO)
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
    <section className="overflow-hidden rounded-2xl border border-panel-border bg-panel-surface">
      <div className="flex flex-col gap-3 bg-student-theme-soft/35 px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <h1 className="text-2xl font-bold leading-tight text-panel-text">
              {firstName ? `${greeting.label}, ${firstName}` : greeting.label}
            </h1>
            <span className="inline-flex items-center gap-1.5 text-xs text-panel-text-muted">
              <CalendarDays size={15} aria-hidden="true" />
              {formatDateLong(currentDate)}
            </span>
          </div>
          <p className="mt-2 flex min-w-0 items-center gap-2 text-sm text-panel-text-muted">
            <Sparkles className="shrink-0 text-student-theme-text" size={15} aria-hidden="true" />
            <span className="truncate" title={bannerLead}>{bannerLead}</span>
          </p>
        </div>
        {lgsCountdownVisible ? (
          <div className="flex shrink-0 items-center gap-2 self-start lg:self-auto">
            <CalendarDays size={16} className="text-student-theme-text" aria-hidden="true" />
            <div>
              <p className="text-[11px] text-panel-text-muted">LGS · 13 Haziran 2027</p>
              <p className="text-sm font-semibold text-panel-text">{lgsText}{lgsRemainingDays > 0 ? ' kaldı' : ''}</p>
            </div>
            <button type="button" onClick={() => setLgsHiddenPref(true)} aria-label="LGS geri sayımını gizle"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-panel-text-muted hover:bg-panel-surface focus-visible:outline-2 focus-visible:outline-student-theme-primary">
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        ) : showLgsCountdown ? (
          <button type="button" onClick={() => setLgsHiddenPref(false)}
            className="shrink-0 self-start text-xs font-medium text-panel-text-muted underline underline-offset-4">
            LGS geri sayımını göster
          </button>
        ) : null}
      </div>
    </section>
  )
}
