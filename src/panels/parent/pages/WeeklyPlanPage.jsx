import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../../context/useAuth'
import { CalendarCheck, CalendarDays, ChevronLeft, ChevronRight, Info, Users } from 'lucide-react'
import { cachedGet } from '../../../services/authClient'
import {
  getWeekDates,
  getDraftTasksForDate,
  getWeekPlans,
  getSchoolSchedule,
  getTeacherLessonSchedule,
  saveTaskForDay,
  publishDay,
} from '../../../services/weeklyPlanService'
import { addHomework } from '../../../services/homeworkService'
import { preloadPanelHomeworkResourceBooks } from '../../../services/resourceBookService'
import { getUnscheduledTasks, patchTask, removeTask } from '../../../services/taskService'
import { addDaysISO, addMinutesToTime, getMondayOfWeek, todayISODate } from '../../../utils/time'
import Button from '../../ui/Button'
import LoadingState from '../../shared/LoadingState'
import WeeklyPlannerGrid from '../components/WeeklyPlannerGrid'
import TaskAnswerSheetModal from '../../student/components/TaskAnswerSheetModal'
import AddTaskDrawer from '../components/AddTaskDrawer'
import AssignHomeworkModal from '../components/AssignHomeworkModal'
import UnscheduledTasksPanel from '../../shared/UnscheduledTasksPanel'

const currentWeekStart = getMondayOfWeek(todayISODate())

export default function WeeklyPlanPage() {
  const { authUser } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [weekOffset, setWeekOffset] = useState(0)
  const weekStart = useMemo(() => addDaysISO(currentWeekStart, weekOffset * 7), [weekOffset])
  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart])

  const [students, setStudents] = useState(null)
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const selectedStudent = students?.find((student) => student.id === selectedStudentId)
  const studentName = selectedStudent?.fullName?.trim().split(/\s+/)[0] || ''
  const restricted = Boolean(selectedStudent ? selectedStudent.restricted : authUser?.restricted)
  const hasMultipleStudents = (students?.length || 0) > 1

  const [tasksByDate, setTasksByDate] = useState({})
  const [dayStatusByDate, setDayStatusByDate] = useState({})
  const [unscheduledTasks, setUnscheduledTasks] = useState([])
  const [lessonSchedule, setLessonSchedule] = useState([])
  const [schoolSchedule, setSchoolSchedule] = useState([])
  const [schoolHolidays, setSchoolHolidays] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [drawerState, setDrawerState] = useState(null)
  const [answerSheetTask, setAnswerSheetTask] = useState(null)
  const [homeworkModalDate, setHomeworkModalDate] = useState('')
  const [banner, setBanner] = useState('')

  // authUser.id'ye bağlı: admin bir veliyi impersonate ettiğinde ParentApp yeniden mount
  // olmadığından, kimlik değişince öğrenci listesini yeniden çekmezsek önceki kullanıcının
  // çocuğu seçili kalır (bkz. DashboardPage aynı desen).
  useEffect(() => {
    let ignore = false
    cachedGet('/api/parent/students')
      .then((data) => {
        if (ignore) return
        const sorted = [...(data.students || [])].sort((a, b) => a.fullName.localeCompare(b.fullName, 'tr'))
        setStudents(sorted)
        setSelectedStudentId((current) =>
          current && sorted.some((student) => student.id === current) ? current : sorted[0]?.id || '',
        )
      })
      .catch((err) => {
        if (!ignore) {
          setStudents([])
          setLoadError(err.message)
          setLoading(false)
        }
      })
    return () => {
      ignore = true
    }
  }, [authUser?.id])

  const loadWeekPlans = useCallback(
    (nextWeekStart) => getWeekPlans(nextWeekStart, { studentId: selectedStudentId }),
    [selectedStudentId],
  )

  const applyWeekPlans = useCallback((plans) => {
    setTasksByDate(plans.tasksByDate)
    setDayStatusByDate(plans.dayStatusByDate)
  }, [])

  const loadUnscheduled = useCallback(() => {
    if (!selectedStudentId) return
    getUnscheduledTasks({ studentId: selectedStudentId })
      .then(setUnscheduledTasks)
      .catch(() => setUnscheduledTasks([]))
  }, [selectedStudentId])

  const refresh = useCallback(async (nextWeekStart = weekStart) => {
    applyWeekPlans(await loadWeekPlans(nextWeekStart))
    loadUnscheduled()
  }, [applyWeekPlans, loadWeekPlans, loadUnscheduled, weekStart])

  useEffect(() => {
    if (!selectedStudentId) return undefined
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
  }, [applyWeekPlans, loadWeekPlans, weekStart, selectedStudentId])

  useEffect(() => {
    if (!selectedStudentId) return
    Promise.all([
      getTeacherLessonSchedule({ studentId: selectedStudentId }).catch(() => []),
      getSchoolSchedule({ studentId: selectedStudentId }).catch(() => ({ entries: [], holidays: [] })),
    ]).then(([teacherLessons, school]) => {
      setLessonSchedule(teacherLessons)
      setSchoolSchedule(school.entries || [])
      setSchoolHolidays(school.holidays || [])
    })
  }, [selectedStudentId])

  useEffect(() => {
    if (!restricted) preloadPanelHomeworkResourceBooks()
  }, [restricted])

  useEffect(() => {
    loadUnscheduled()
  }, [loadUnscheduled])

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
      await patchTask(initialTask.id, taskData, selectedStudentId)
    } else if (initialTask) {
      await removeTask(initialTask.id, selectedStudentId)
      await saveTaskForDay(taskData.date, taskData, targetStatus, { studentId: selectedStudentId })
    } else {
      await saveTaskForDay(taskData.date, taskData, targetStatus, { studentId: selectedStudentId })
    }

    await refresh()
    setDrawerState(null)
    showBanner(targetStatus === 'yayinlandi' ? 'Görev plana kaydedildi.' : 'Görev taslağa kaydedildi.')
  }

  const handleDeleteTask = async (task) => {
    await removeTask(task.id, selectedStudentId)
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
      studentId: selectedStudentId,
    })
    await refresh()
    setHomeworkModalDate('')
    showBanner('Ödev eklendi ve haftalık plana kaydedildi.')
  }

  const handlePublishDay = async (date) => {
    await publishDay(date, { studentId: selectedStudentId })
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
      { studentId: selectedStudentId },
    )

    await refresh()
    showBanner(`${minutes} dakikalık mola eklendi.`)
  }

  const getExistingTasksForDrawer = useCallback(
    (date) => tasksByDate[date] || getDraftTasksForDate(date, { studentId: selectedStudentId }),
    [tasksByDate, selectedStudentId],
  )

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-panel-blue-soft text-panel-blue shadow-sm sm:h-16 sm:w-16">
          <CalendarCheck size={32} strokeWidth={2.1} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="break-words text-2xl font-bold leading-tight text-panel-text sm:text-3xl">
              {studentName ? `${studentName}'in Haftasını Planla` : 'Haftalık Plan'}
            </h1>
            {hasMultipleStudents ? (
              <label className="inline-flex w-fit items-center gap-2 rounded-full border border-panel-border bg-panel-surface-soft px-3 py-1 text-sm font-semibold text-panel-text">
                <Users size={15} aria-hidden="true" />
                <select
                  value={selectedStudentId}
                  onChange={(event) => setSelectedStudentId(event.target.value)}
                  aria-label="Öğrenci seç"
                  className="bg-transparent text-sm font-semibold text-panel-text focus:outline-none"
                >
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.fullName}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
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
            onViewAnswerSheet={setAnswerSheetTask}
            onPublishDay={handlePublishDay}
            onQuickAddBreak={restricted ? undefined : handleQuickAddBreak}
          />

          <UnscheduledTasksPanel
            tasks={unscheduledTasks}
            studentId={selectedStudentId}
            onChanged={refresh}
            readOnly={restricted}
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

          {answerSheetTask ? (
            <TaskAnswerSheetModal
              task={answerSheetTask}
              lessonLabel={answerSheetTask.subject || 'Görev'}
              photoMode="view"
              studentId={selectedStudentId}
              canRegrade={!restricted}
              onClose={() => setAnswerSheetTask(null)}
              onSaved={(updatedTask) => {
                setAnswerSheetTask(updatedTask)
                refresh()
              }}
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
