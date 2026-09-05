import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { getTasksForDateRange, getUnscheduledTasks, patchTask, removeTask } from '../../../services/taskService'
import {
  getSchoolSchedule,
  getTeacherLessonSchedule,
  getWeekDates,
  saveTaskForDay,
} from '../../../services/weeklyPlanService'
import { addDaysISO, addMinutesToTime, getMondayOfWeek, todayISODate } from '../../../utils/time'
import PageHeader from '../../layout/PageHeader'
import LoadingState from '../../shared/LoadingState'
import Button from '../../ui/Button'
import WeeklyPlannerGrid from '../../parent/components/WeeklyPlannerGrid'
import AddTaskDrawer from '../../parent/components/AddTaskDrawer'
import UnscheduledTasksPanel from '../../shared/UnscheduledTasksPanel'

const currentWeekStart = getMondayOfWeek(todayISODate())

function groupTasksByDate(tasks, dates) {
  const tasksByDate = Object.fromEntries(dates.map((date) => [date, []]))
  tasks.forEach((task) => {
    if (tasksByDate[task.date]) tasksByDate[task.date].push(task)
  })
  return tasksByDate
}

export default function WeeklyPlanPage() {
  const [weekOffset, setWeekOffset] = useState(0)
  const weekStart = useMemo(() => addDaysISO(currentWeekStart, weekOffset * 7), [weekOffset])
  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart])

  const [tasksByDate, setTasksByDate] = useState({})
  const [lessonSchedule, setLessonSchedule] = useState([])
  const [schoolSchedule, setSchoolSchedule] = useState([])
  const [schoolHolidays, setSchoolHolidays] = useState([])
  const [loadedWeekStart, setLoadedWeekStart] = useState('')
  const [loadError, setLoadError] = useState('')
  const [unscheduledTasks, setUnscheduledTasks] = useState([])
  const [refreshToken, setRefreshToken] = useState(0)
  const [drawerState, setDrawerState] = useState(null)
  const [banner, setBanner] = useState('')

  const reload = () => setRefreshToken((token) => token + 1)

  const showBanner = (text) => {
    setBanner(text)
    window.setTimeout(() => setBanner(''), 4000)
  }

  // Öğrenci haftalık plana kendi görevini ekler ve yalnızca kendi eklediklerini düzenler/siler
  // (bkz. canEditTask + api tasks.js NOT_TASK_CREATOR). Görevler taslak değil doğrudan canlı yazılır.
  const handleSaveDrawerTask = async (taskData) => {
    const initialTask = drawerState?.initialTask

    if (initialTask && taskData.date === initialTask.date) {
      await patchTask(initialTask.id, taskData)
    } else if (initialTask) {
      // Gün değişince görev yeniden oluşturulur — orijinal ekleyen korunmalı.
      await removeTask(initialTask.id)
      await saveTaskForDay(taskData.date, {
        ...taskData,
        createdBy: initialTask.createdBy,
        createdByUserId: initialTask.createdByUserId,
      })
    } else {
      await saveTaskForDay(taskData.date, taskData)
    }

    reload()
    setDrawerState(null)
    showBanner('Görev plana kaydedildi.')
  }

  const handleDeleteTask = async (task) => {
    await removeTask(task.id)
    reload()
    setDrawerState(null)
    showBanner('Görev silindi.')
  }

  const handleQuickAddBreak = async (date, afterTask, minutes) => {
    const breakStart = afterTask.endTime
    await saveTaskForDay(date, {
      title: 'Mola',
      taskType: 'mola',
      startTime: breakStart,
      endTime: addMinutesToTime(breakStart, minutes),
      durationMinutes: minutes,
    })
    reload()
    showBanner(`${minutes} dakikalık mola eklendi.`)
  }

  const getExistingTasksForDrawer = (date) => tasksByDate[date] || []

  useEffect(() => {
    let ignore = false
    getUnscheduledTasks()
      .then((tasks) => {
        if (!ignore) setUnscheduledTasks(tasks)
      })
      .catch(() => {
        if (!ignore) setUnscheduledTasks([])
      })
    return () => {
      ignore = true
    }
  }, [refreshToken])

  useEffect(() => {
    let ignore = false
    const weekEnd = weekDates[weekDates.length - 1]

    Promise.all([
      getTasksForDateRange(weekStart, weekEnd),
      getTeacherLessonSchedule().catch(() => []),
      getSchoolSchedule().catch(() => ({ entries: [], holidays: [] })),
    ])
      .then(([tasks, teacherLessons, school]) => {
        if (ignore) return
        setTasksByDate(groupTasksByDate(tasks, weekDates))
        setLessonSchedule(teacherLessons)
        setSchoolSchedule(school.entries || [])
        setSchoolHolidays(school.holidays || [])
        setLoadError('')
        setLoadedWeekStart(weekStart)
      })
      .catch((err) => {
        if (ignore) return
        setTasksByDate({})
        setLoadError(err.message)
        setLoadedWeekStart(weekStart)
      })

    return () => {
      ignore = true
    }
  }, [weekDates, weekStart, refreshToken])

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
          className="h-11 w-full border-student-theme-primary/25 px-3 text-sm font-semibold text-panel-text shadow-sm hover:bg-student-theme-soft hover:text-student-theme-text sm:w-auto sm:px-4"
        >
          <ChevronLeft size={18} aria-hidden="true" />
          Önceki Hafta
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setWeekOffset(0)}
          className={
            weekOffset === 0
              ? 'h-11 w-full border-transparent bg-student-theme-primary px-3 text-sm font-semibold text-student-theme-button-text shadow-sm hover:bg-student-theme-hover sm:w-auto sm:px-4'
              : 'h-11 w-full border-student-theme-primary/25 px-3 text-sm font-semibold text-panel-text shadow-sm hover:bg-student-theme-soft hover:text-student-theme-text sm:w-auto sm:px-4'
          }
        >
          <CalendarDays size={18} aria-hidden="true" />
          Bu Hafta
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setWeekOffset((current) => current + 1)}
          className="h-11 w-full border-student-theme-primary/25 px-3 text-sm font-semibold text-panel-text shadow-sm hover:bg-student-theme-soft hover:text-student-theme-text sm:w-auto sm:px-4"
        >
          Sonraki Hafta
          <ChevronRight size={18} aria-hidden="true" />
        </Button>
      </div>

      {banner ? (
        <div className="rounded-xl bg-panel-sage-soft px-4 py-3 text-base text-panel-text" role="status">
          {banner}
        </div>
      ) : null}

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
            lessonSchedule={lessonSchedule}
            schoolSchedule={schoolSchedule}
            schoolHolidays={schoolHolidays}
            onAddHomework={(date) => setDrawerState({ defaultDate: date })}
            onEditTask={(task) => setDrawerState({ initialTask: task })}
            onQuickAddBreak={handleQuickAddBreak}
            canEditTask={(task) => task.createdBy === 'ogrenci'}
          />

          <UnscheduledTasksPanel tasks={unscheduledTasks} onChanged={() => reload()} />

          {drawerState ? (
            <AddTaskDrawer
              initialTask={drawerState.initialTask}
              defaultDate={drawerState.defaultDate}
              getExistingTasksForDate={getExistingTasksForDrawer}
              schoolSchedule={schoolSchedule}
              schoolHolidays={schoolHolidays}
              onSave={handleSaveDrawerTask}
              onDelete={handleDeleteTask}
              onClose={() => setDrawerState(null)}
            />
          ) : null}
        </>
      )}
    </div>
  )
}
