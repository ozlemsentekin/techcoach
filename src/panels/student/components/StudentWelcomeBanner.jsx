import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Clock } from 'lucide-react'
import { dateToISO, formatDateLong, formatTime, getGreetingByHour } from '../../../utils/time'
import { calculateProgress } from '../../../utils/progress'
import { resolveDisplayedMotivationMessage } from '../../../services/motivationMessageService'
import PageHeader from '../../layout/PageHeader'
import StudentStatsCards from './StudentStatsCards'
import MotivationCard from './MotivationCard'

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

  const greeting = getGreetingByHour(currentDate.getHours())
  const firstName = (studentName || '').split(' ')[0]

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-[18px] border border-[#E7E8EE] bg-white p-[23px] shadow-[0_8px_24px_rgba(31,38,75,0.06)]">
        <PageHeader
          title={
            <span className="flex items-center gap-2">
              {greeting.text}, {firstName}
              <span aria-hidden="true">👋</span>
            </span>
          }
          actions={
            <div className="inline-flex items-center gap-2.5 rounded-full border border-[#E7E8EE] bg-[#F8F9FC] px-4 py-2 text-sm">
              <span className="inline-flex items-center gap-1.5 font-medium text-panel-text">
                <CalendarDays size={15} className="text-panel-text-muted" aria-hidden="true" />
                {formatDateLong(currentDate)}
              </span>
              <span className="h-1 w-1 shrink-0 rounded-full bg-[#C7CAD9]" aria-hidden="true" />
              <span className="inline-flex items-center gap-1.5 font-medium text-panel-text">
                <Clock size={15} className="text-panel-text-muted" aria-hidden="true" />
                {formatTime(currentDate)}
              </span>
            </div>
          }
        />
        <MotivationCard message={motivationMessage} />
      </div>

      <StudentStatsCards tasks={tasks} completed={completed} total={total} progress={progress} />
    </div>
  )
}
