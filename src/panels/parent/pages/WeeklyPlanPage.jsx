import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../../context/useAuth'
import { CalendarCheck, CalendarDays, ChevronLeft, ChevronRight, Clock3, Coffee, Copy, Info, Star } from 'lucide-react'
import {
  getWeekDates,
  getDraftTasksForDate,
  getWeekPlans,
  getSchoolSchedule,
  cleanupUnlinkedHomeworkTasksForWeek,
  saveTaskForDay,
  publishDay,
  copyPreviousWeek,
  totalAcademicMinutes,
} from '../../../services/weeklyPlanService'
import { addHomework } from '../../../services/homeworkService'
import { patchTask, removeTask } from '../../../services/taskService'
import { addDaysISO, addMinutesToTime, getMondayOfWeek, todayISODate } from '../../../utils/time'
import Button from '../../ui/Button'
import LoadingState from '../../shared/LoadingState'
import WeeklyPlannerGrid from '../components/WeeklyPlannerGrid'
import AddTaskDrawer from '../components/AddTaskDrawer'
import AssignHomeworkModal from '../components/AssignHomeworkModal'

const currentWeekStart = getMondayOfWeek(todayISODate())

const SUMMARY_ITEMS = {
  study: {
    icon: Clock3,
    label: 'Toplam çalışma süresi',
    iconClassName: 'bg-panel-blue-soft text-panel-blue',
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
    <div className="flex min-w-0 items-center gap-4">
      <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${item.iconClassName}`}>
        <Icon size={28} strokeWidth={2.1} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-panel-blue">{item.label}</span>
        <span className="mt-1 block break-words text-2xl font-bold text-panel-text">{value}</span>
      </span>
    </div>
  )
}

export default function WeeklyPlanPage() {
  const { authUser } = useAuth()
  const restricted = Boolean(authUser?.restricted)
  const [searchParams, setSearchParams] = useSearchParams()
  const [weekOffset, setWeekOffset] = useState(0)
  const weekStart = useMemo(() => addDaysISO(currentWeekStart, weekOffset * 7), [weekOffset])
  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart])

  const [tasksByDate, setTasksByDate] = useState({})
  const [dayStatusByDate, setDayStatusByDate] = useState({})
  const [schoolSchedule, setSchoolSchedule] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [drawerState, setDrawerState] = useState(null)
  const [homeworkModalDate, setHomeworkModalDate] = useState('')
  const [banner, setBanner] = useState('')

  const loadWeekPlans = useCallback(async (nextWeekStart) => {
    await cleanupUnlinkedHomeworkTasksForWeek(nextWeekStart)
    return getWeekPlans(nextWeekStart)
  }, [])

  const applyWeekPlans = useCallback((plans) => {
    setTasksByDate(plans.tasksByDate)
    setDayStatusByDate(plans.dayStatusByDate)
  }, [])

  const refresh = useCallback(async (nextWeekStart = weekStart) => {
    applyWeekPlans(await loadWeekPlans(nextWeekStart))
  }, [applyWeekPlans, loadWeekPlans, weekStart])

  useEffect(() => {
    let ignore = false
    setLoading(true)
    loadWeekPlans(weekStart)
      .then((plans) => {
        if (!ignore) applyWeekPlans(plans)
      })
      .catch((err) => {
        if (!ignore) setLoadError(err.message)
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [applyWeekPlans, loadWeekPlans, weekStart])

  useEffect(() => {
    getSchoolSchedule()
      .then(setSchoolSchedule)
      .catch(() => setSchoolSchedule([]))
  }, [])

  useEffect(() => {
    if (searchParams.get('openDrawer') === '1') {
      setDrawerState({ defaultDate: weekDates.includes(todayISODate()) ? todayISODate() : weekDates[0] })
      setSearchParams({}, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const showBanner = (text) => {
    setBanner(text)
    window.setTimeout(() => setBanner(''), 4000)
  }

  const handleSaveDrawerTask = async (taskData) => {
    const initialTask = drawerState?.initialTask
    const targetStatus = dayStatusByDate[taskData.date]

    if (initialTask && taskData.date === initialTask.date) {
      // Aynı gün içinde düzenleme: görev zaten hangi durumdaysa (taslak/canlı) o durumda kalır.
      await patchTask(initialTask.id, taskData)
    } else if (initialTask) {
      await removeTask(initialTask.id)
      await saveTaskForDay(taskData.date, taskData, targetStatus)
    } else {
      await saveTaskForDay(taskData.date, taskData, targetStatus)
    }

    await refresh()
    setDrawerState(null)
    showBanner(targetStatus === 'yayinlandi' ? 'Görev plana kaydedildi.' : 'Görev taslağa kaydedildi.')
  }

  const handleDeleteTask = async (task) => {
    await removeTask(task.id)
    await refresh()
    setDrawerState(null)
    showBanner('Görev silindi.')
  }

  const handleSaveHomework = async (payload) => {
    const scheduledDate = payload.taskDate || homeworkModalDate
    await addHomework({
      ...payload,
      dueDate: scheduledDate || payload.dueDate,
      taskDate: scheduledDate,
    })
    await refresh()
    setHomeworkModalDate('')
    showBanner('Ödev eklendi ve haftalık plana kaydedildi.')
  }

  const handlePublishDay = async (date) => {
    await publishDay(date)
    await refresh()
    showBanner('Gün yayınlandı.')
  }

  const handleQuickAddBreak = async (date, afterTask, minutes) => {
    const breakStart = afterTask.endTime
    const breakEnd = addMinutesToTime(breakStart, minutes)
    const targetStatus = dayStatusByDate[date]

    await saveTaskForDay(
      date,
      {
        title: 'Mola',
        taskType: 'mola',
        startTime: breakStart,
        endTime: breakEnd,
        durationMinutes: minutes,
      },
      targetStatus,
    )

    await refresh()
    showBanner(`${minutes} dakikalık mola eklendi.`)
  }

  const allTasks = useMemo(() => weekDates.flatMap((date) => tasksByDate[date] || []), [tasksByDate, weekDates])
  const weekSummary = useMemo(() => getWeekSummary(allTasks), [allTasks])
  const getExistingTasksForDrawer = useCallback(
    (date) => tasksByDate[date] || getDraftTasksForDate(date),
    [tasksByDate],
  )

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex min-w-0 items-start gap-4">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-panel-blue-soft text-panel-blue shadow-sm">
          <CalendarCheck size={34} strokeWidth={2.1} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h1 className="break-words text-3xl font-bold leading-tight text-panel-text">
            Aylin'in Haftasını Planla
          </h1>
          <p className="mt-1 text-base font-medium text-panel-blue">
            Dersleri, ödevleri, molaları ve serbest zamanı dengeli şekilde planla.
          </p>
        </div>
      </div>

      {banner ? (
        <div className="rounded-xl bg-panel-sage-soft px-4 py-3 text-base text-panel-text" role="status">
          {banner}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={() => setWeekOffset((current) => current - 1)}
          className="h-11 border-panel-blue-soft px-4 text-sm font-semibold text-panel-text shadow-sm hover:bg-panel-blue-soft/50"
        >
          <ChevronLeft size={18} aria-hidden="true" />
          Önceki Hafta
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setWeekOffset(0)}
          className="h-11 border-panel-blue-soft px-4 text-sm font-semibold text-panel-text shadow-sm hover:bg-panel-blue-soft/50"
        >
          <CalendarDays size={18} aria-hidden="true" />
          Bu Hafta
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setWeekOffset((current) => current + 1)}
          className="h-11 border-panel-blue-soft px-4 text-sm font-semibold text-panel-text shadow-sm hover:bg-panel-blue-soft/50"
        >
          Sonraki Hafta
          <ChevronRight size={18} aria-hidden="true" />
        </Button>

        {restricted ? null : (
          <span className="mx-1 hidden h-9 w-px bg-panel-border sm:block" aria-hidden="true" />
        )}

        {restricted ? null : (
        <Button
          type="button"
          variant="secondary"
          onClick={async () => {
            await copyPreviousWeek(weekStart)
            await refresh()
            showBanner('Geçen hafta bu haftanın taslağına kopyalandı.')
          }}
          className="h-11 border-panel-blue-soft px-4 text-sm font-semibold text-panel-text shadow-sm hover:bg-panel-blue-soft/50"
        >
          <Copy size={18} aria-hidden="true" />
          Geçen Haftayı Kopyala
        </Button>
        )}
      </div>

      {loadError ? (
        <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{loadError}</div>
      ) : null}

      {loading ? (
        <LoadingState label="Haftalık plan yükleniyor..." />
      ) : (
        <>
          <div className="grid gap-5 rounded-2xl border border-panel-border bg-panel-surface px-5 py-4 shadow-sm sm:grid-cols-3 lg:px-10">
            <SummaryItem type="study" value={weekSummary.studyDuration} />
            <SummaryItem type="break" value={weekSummary.breakCount} />
            <SummaryItem type="free" value={weekSummary.freeDuration} />
          </div>

          <WeeklyPlannerGrid
            weekDates={weekDates}
            tasksByDate={tasksByDate}
            dayStatusByDate={dayStatusByDate}
            schoolSchedule={schoolSchedule}
            onAddHomework={restricted ? undefined : (date) => setHomeworkModalDate(date)}
            onAddTask={restricted ? undefined : (date, initialTemplate) => setDrawerState({ defaultDate: date, initialTemplate })}
            onEditTask={(task) => setDrawerState({ initialTask: task })}
            onPublishDay={handlePublishDay}
            onQuickAddBreak={restricted ? undefined : handleQuickAddBreak}
          />

          <div className="flex items-center gap-3 rounded-2xl bg-panel-blue-soft px-5 py-4 text-sm font-semibold text-panel-blue">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-panel-blue/30">
              <Info size={17} aria-hidden="true" />
            </span>
            <span>Görevler tamamlandıkça plan otomatik güncellenir.</span>
          </div>

          {drawerState ? (
            <AddTaskDrawer
              initialTask={drawerState.initialTask}
              initialTemplate={drawerState.initialTemplate}
              defaultDate={drawerState.defaultDate}
              getExistingTasksForDate={getExistingTasksForDrawer}
              schoolSchedule={schoolSchedule}
              onSave={handleSaveDrawerTask}
              onDelete={handleDeleteTask}
              onClose={() => setDrawerState(null)}
            />
          ) : null}

          {homeworkModalDate ? (
            <AssignHomeworkModal
              defaultTaskDate={homeworkModalDate}
              schoolSchedule={schoolSchedule}
              onSave={handleSaveHomework}
              onClose={() => setHomeworkModalDate('')}
            />
          ) : null}
        </>
      )}
    </div>
  )
}
