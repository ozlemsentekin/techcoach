import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../../context/useAuth'
import { CalendarCheck, CalendarDays, ChevronLeft, ChevronRight, Info } from 'lucide-react'
import {
  getWeekDates,
  getDraftTasksForDate,
  getWeekPlans,
  getSchoolSchedule,
  getTeacherLessonSchedule,
  cleanupUnlinkedHomeworkTasksForWeek,
  saveTaskForDay,
  publishDay,
} from '../../../services/weeklyPlanService'
import { addHomework } from '../../../services/homeworkService'
import { preloadPanelHomeworkResourceBooks } from '../../../services/resourceBookService'
import { patchTask, removeTask } from '../../../services/taskService'
import { addDaysISO, addMinutesToTime, getMondayOfWeek, todayISODate } from '../../../utils/time'
import Button from '../../ui/Button'
import LoadingState from '../../shared/LoadingState'
import WeeklyPlannerGrid from '../components/WeeklyPlannerGrid'
import AddTaskDrawer from '../components/AddTaskDrawer'
import AssignHomeworkModal from '../components/AssignHomeworkModal'

const currentWeekStart = getMondayOfWeek(todayISODate())

export default function WeeklyPlanPage() {
  const { authUser } = useAuth()
  const restricted = Boolean(authUser?.restricted)
  const [searchParams, setSearchParams] = useSearchParams()
  const [weekOffset, setWeekOffset] = useState(0)
  const weekStart = useMemo(() => addDaysISO(currentWeekStart, weekOffset * 7), [weekOffset])
  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart])

  const [tasksByDate, setTasksByDate] = useState({})
  const [dayStatusByDate, setDayStatusByDate] = useState({})
  const [lessonSchedule, setLessonSchedule] = useState([])
  const [schoolSchedule, setSchoolSchedule] = useState([])
  const [schoolHolidays, setSchoolHolidays] = useState([])
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
    Promise.all([
      getTeacherLessonSchedule().catch(() => []),
      getSchoolSchedule().catch(() => ({ entries: [], holidays: [] })),
    ]).then(([teacherLessons, school]) => {
      setLessonSchedule(teacherLessons)
      setSchoolSchedule(school.entries || [])
      setSchoolHolidays(school.holidays || [])
    })
  }, [])

  useEffect(() => {
    if (!restricted) preloadPanelHomeworkResourceBooks()
  }, [restricted])

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

  const getExistingTasksForDrawer = useCallback(
    (date) => tasksByDate[date] || getDraftTasksForDate(date),
    [tasksByDate],
  )

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-panel-blue-soft text-panel-blue shadow-sm sm:h-16 sm:w-16">
          <CalendarCheck size={32} strokeWidth={2.1} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-bold leading-tight text-panel-text sm:text-3xl">
            Aylin'in Haftasını Planla
          </h1>
          <p className="mt-1 text-sm font-medium leading-relaxed text-panel-blue sm:text-base">
            Dersleri, ödevleri, molaları ve serbest zamanı dengeli şekilde planla.
          </p>
        </div>
      </div>

      {banner ? (
        <div className="rounded-xl bg-panel-sage-soft px-4 py-3 text-base text-panel-text" role="status">
          {banner}
        </div>
      ) : null}

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
          variant="secondary"
          onClick={() => setWeekOffset(0)}
          className="h-11 w-full border-panel-blue-soft px-3 text-sm font-semibold text-panel-text shadow-sm hover:bg-panel-blue-soft/50 sm:w-auto sm:px-4"
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
          <WeeklyPlannerGrid
            weekDates={weekDates}
            tasksByDate={tasksByDate}
            dayStatusByDate={dayStatusByDate}
            lessonSchedule={lessonSchedule}
            schoolSchedule={schoolSchedule}
            schoolHolidays={schoolHolidays}
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
              schoolHolidays={schoolHolidays}
              onSave={handleSaveDrawerTask}
              onDelete={handleDeleteTask}
              onClose={() => setDrawerState(null)}
            />
          ) : null}

          {homeworkModalDate ? (
            <AssignHomeworkModal
              defaultTaskDate={homeworkModalDate}
              schoolSchedule={schoolSchedule}
              schoolHolidays={schoolHolidays}
              onSave={handleSaveHomework}
              onClose={() => setHomeworkModalDate('')}
            />
          ) : null}
        </>
      )}
    </div>
  )
}
