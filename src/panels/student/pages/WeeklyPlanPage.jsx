import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Coffee, Star } from 'lucide-react'
import { getTasksForDateRange } from '../../../services/taskService'
import {
  getSchoolSchedule,
  getTeacherLessonSchedule,
  getWeekDates,
  totalAcademicMinutes,
} from '../../../services/weeklyPlanService'
import { addDaysISO, getMondayOfWeek, todayISODate } from '../../../utils/time'
import PageHeader from '../../layout/PageHeader'
import LoadingState from '../../shared/LoadingState'
import Button from '../../ui/Button'
import WeeklyPlannerGrid from '../../parent/components/WeeklyPlannerGrid'

const currentWeekStart = getMondayOfWeek(todayISODate())

const SUMMARY_ITEMS = {
  study: {
    icon: Clock3,
    label: 'Çalışma süresi',
    iconClassName: 'bg-student-theme-soft text-student-theme-text',
  },
  break: {
    icon: Coffee,
    label: 'Planlanan mola',
    iconClassName: 'bg-panel-accent-soft text-panel-warm',
  },
  free: {
    icon: Star,
    label: 'Serbest zaman',
    iconClassName: 'bg-emerald-50 text-emerald-600',
  },
}

function groupTasksByDate(tasks, dates) {
  const tasksByDate = Object.fromEntries(dates.map((date) => [date, []]))
  tasks.forEach((task) => {
    if (tasksByDate[task.date]) tasksByDate[task.date].push(task)
  })
  return tasksByDate
}

function getDayStatusByDate(tasksByDate, dates) {
  return Object.fromEntries(dates.map((date) => [date, tasksByDate[date]?.length ? 'yayinlandi' : 'bos']))
}

function formatSummaryDuration(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours > 0 && minutes > 0) return `${hours}sa ${minutes}dk`
  if (hours > 0) return `${hours}sa`
  return `${minutes}dk`
}

function getWeekSummary(tasks) {
  const breakCount = tasks.filter((task) => ['mola', 'dinlenme'].includes(task.taskType)).length
  const freeMinutes = tasks
    .filter((task) => task.taskType === 'serbest-zaman')
    .reduce((sum, task) => sum + (task.durationMinutes || 0), 0)

  return {
    studyDuration: formatSummaryDuration(totalAcademicMinutes(tasks)),
    breakCount: `${breakCount} mola`,
    freeDuration: formatSummaryDuration(freeMinutes),
  }
}

function SummaryItem({ type, value }) {
  const item = SUMMARY_ITEMS[type]
  const Icon = item.icon

  return (
    <div className="flex min-w-0 items-center gap-3 sm:gap-4">
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full sm:h-14 sm:w-14 ${item.iconClassName}`}>
        <Icon size={26} strokeWidth={2.1} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-panel-blue sm:text-sm">{item.label}</span>
        <span className="mt-1 block break-words text-xl font-bold text-panel-text sm:text-2xl">{value}</span>
      </span>
    </div>
  )
}

export default function WeeklyPlanPage() {
  const [weekOffset, setWeekOffset] = useState(0)
  const weekStart = useMemo(() => addDaysISO(currentWeekStart, weekOffset * 7), [weekOffset])
  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart])

  const [tasksByDate, setTasksByDate] = useState({})
  const [dayStatusByDate, setDayStatusByDate] = useState({})
  const [lessonSchedule, setLessonSchedule] = useState([])
  const [schoolSchedule, setSchoolSchedule] = useState([])
  const [loadedWeekStart, setLoadedWeekStart] = useState('')
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let ignore = false
    const weekEnd = weekDates[weekDates.length - 1]

    Promise.all([
      getTasksForDateRange(weekStart, weekEnd),
      getTeacherLessonSchedule().catch(() => []),
      getSchoolSchedule().catch(() => []),
    ])
      .then(([tasks, teacherLessons, schoolLessons]) => {
        if (ignore) return
        const nextTasksByDate = groupTasksByDate(tasks, weekDates)
        setTasksByDate(nextTasksByDate)
        setDayStatusByDate(getDayStatusByDate(nextTasksByDate, weekDates))
        setLessonSchedule(teacherLessons)
        setSchoolSchedule(schoolLessons)
        setLoadError('')
        setLoadedWeekStart(weekStart)
      })
      .catch((err) => {
        if (ignore) return
        setTasksByDate({})
        setDayStatusByDate({})
        setLoadError(err.message)
        setLoadedWeekStart(weekStart)
      })

    return () => {
      ignore = true
    }
  }, [weekDates, weekStart])

  const allTasks = useMemo(() => weekDates.flatMap((date) => tasksByDate[date] || []), [tasksByDate, weekDates])
  const weekSummary = useMemo(() => getWeekSummary(allTasks), [allTasks])
  const loading = loadedWeekStart !== weekStart

  return (
    <div className="flex w-full flex-col gap-5">
      <PageHeader
        title="Haftalık Planım"
        subtitle="Bu hafta seni bekleyen dersleri, ödevleri, molaları ve serbest zamanı gün gün takip et."
      />

      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={() => setWeekOffset((current) => current - 1)}
          className="h-11 w-full border-panel-blue-soft px-3 text-sm font-semibold text-panel-text shadow-sm hover:bg-panel-blue-soft/50 sm:w-auto sm:px-4"
        >
          <ChevronLeft size={18} aria-hidden="true" />
          Önceki Hafta
        </Button>
        <Button
          type="button"
          variant={weekOffset === 0 ? 'primary' : 'secondary'}
          onClick={() => setWeekOffset(0)}
          className={
            weekOffset === 0
              ? 'h-11 w-full px-3 text-sm font-semibold sm:w-auto sm:px-4'
              : 'h-11 w-full border-panel-blue-soft px-3 text-sm font-semibold text-panel-text shadow-sm hover:bg-panel-blue-soft/50 sm:w-auto sm:px-4'
          }
        >
          <CalendarDays size={18} aria-hidden="true" />
          Bu Hafta
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setWeekOffset((current) => current + 1)}
          className="h-11 w-full border-panel-blue-soft px-3 text-sm font-semibold text-panel-text shadow-sm hover:bg-panel-blue-soft/50 sm:w-auto sm:px-4"
        >
          Sonraki Hafta
          <ChevronRight size={18} aria-hidden="true" />
        </Button>
      </div>

      {loadError ? (
        <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{loadError}</div>
      ) : null}

      {loading ? (
        <LoadingState label="Haftalık plan yükleniyor..." />
      ) : (
        <>
          <div className="grid gap-4 rounded-2xl border border-panel-border bg-panel-surface px-4 py-4 shadow-sm sm:grid-cols-3 lg:px-8">
            <SummaryItem type="study" value={weekSummary.studyDuration} />
            <SummaryItem type="break" value={weekSummary.breakCount} />
            <SummaryItem type="free" value={weekSummary.freeDuration} />
          </div>

          <WeeklyPlannerGrid
            weekDates={weekDates}
            tasksByDate={tasksByDate}
            dayStatusByDate={dayStatusByDate}
            lessonSchedule={lessonSchedule}
            schoolSchedule={schoolSchedule}
          />
        </>
      )}
    </div>
  )
}
