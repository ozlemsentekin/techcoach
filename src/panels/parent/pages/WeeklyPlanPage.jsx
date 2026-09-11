import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../../context/useAuth'
import { CalendarCheck, CalendarDays, ChevronLeft, ChevronRight, Filter, Info, Search, Users, X } from 'lucide-react'
import { cachedGet, invalidateCache } from '../../../services/authClient'
import { TASK_TYPES } from '../../../data/taskTypes'
import {
  getWeekDates,
  getWeekPlans,
  getSchoolSchedule,
  getTeacherLessonSchedule,
  getPrivateLessonTeachers,
  saveTaskForDay,
} from '../../../services/weeklyPlanService'
import { preloadPanelHomeworkResourceBooks } from '../../../services/resourceBookService'
import { getUnscheduledTasks, patchTask, removeTask } from '../../../services/taskService'
import { addDaysISO, addMinutesToTime, getMondayOfWeek, todayISODate } from '../../../utils/time'
import { withGenitive } from '../../../utils/turkishSuffix'
import Button from '../../ui/Button'
import LoadingState from '../../shared/LoadingState'
import WeeklyPlannerGrid from '../components/WeeklyPlannerGrid'
import { completeTaskDirect, resolveCompletionFlow } from '../../shared/taskCompletion'
import UnscheduledTasksPanel from '../../shared/UnscheduledTasksPanel'

const AddTaskDrawer = lazy(() => import('../components/AddTaskDrawer'))
const TaskAnswerSheetModal = lazy(() => import('../../student/components/TaskAnswerSheetModal'))
const TaskCompletionFlow = lazy(() => import('../components/TaskCompletionFlow'))
const ParentLessonSlotModal = lazy(() => import('../components/ParentLessonSlotModal'))

const currentWeekStart = getMondayOfWeek(todayISODate())

export default function WeeklyPlanPage() {
  const { authUser } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [weekOffset, setWeekOffset] = useState(0)
  const weekStart = useMemo(() => addDaysISO(currentWeekStart, weekOffset * 7), [weekOffset])
  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart])

  const [students, setStudents] = useState(null)
  const [selectedStudentId, setSelectedStudentId] = useState(() => searchParams.get('studentId') || '')
  const selectedStudent = students?.find((student) => student.id === selectedStudentId)
  const studentName = selectedStudent?.fullName?.trim().split(/\s+/)[0] || ''
  const hasMultipleStudents = (students?.length || 0) > 1

  const [tasksByDate, setTasksByDate] = useState({})
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTaskTypes, setSelectedTaskTypes] = useState(() => new Set())
  const [unscheduledTasks, setUnscheduledTasks] = useState([])
  const [lessonSchedule, setLessonSchedule] = useState([])
  const [privateTeachers, setPrivateTeachers] = useState([])
  const [schoolSchedule, setSchoolSchedule] = useState([])
  const [schoolHolidays, setSchoolHolidays] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [drawerState, setDrawerState] = useState(null)
  const [managingSlot, setManagingSlot] = useState(null)
  const [answerSheetTask, setAnswerSheetTask] = useState(null)
  const [completingTask, setCompletingTask] = useState(null)
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

  const loadTeacherAndSchoolData = useCallback(() => {
    if (!selectedStudentId) return
    Promise.all([
      getTeacherLessonSchedule({ studentId: selectedStudentId }).catch(() => []),
      getPrivateLessonTeachers({ studentId: selectedStudentId }).catch(() => []),
      getSchoolSchedule({ studentId: selectedStudentId }).catch(() => ({ entries: [], holidays: [] })),
    ]).then(([teacherLessons, teachers, school]) => {
      setLessonSchedule(teacherLessons)
      setPrivateTeachers(teachers)
      setSchoolSchedule(school.entries || [])
      setSchoolHolidays(school.holidays || [])
    })
  }, [selectedStudentId])

  useEffect(() => {
    loadTeacherAndSchoolData()
  }, [loadTeacherAndSchoolData])

  useEffect(() => {
    preloadPanelHomeworkResourceBooks()
  }, [])

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

    if (initialTask && taskData.date === initialTask.date) {
      await patchTask(initialTask.id, taskData, selectedStudentId)
    } else if (initialTask) {
      // Gün değişince görev silinip yeniden oluşturulur — orijinal ekleyen (ör. öğretmen)
      // korunmalı, aksi halde "Veli ekledi" gibi yanlış görünür.
      await removeTask(initialTask.id, selectedStudentId)
      await saveTaskForDay(
        taskData.date,
        { ...taskData, createdBy: initialTask.createdBy, createdByUserId: initialTask.createdByUserId },
        { studentId: selectedStudentId },
      )
    } else {
      await saveTaskForDay(taskData.date, taskData, { studentId: selectedStudentId })
    }

    await refresh()
    setDrawerState(null)
    showBanner('Görev plana kaydedildi.')
  }

  const handleCompleteTask = async (task) => {
    if (resolveCompletionFlow(task) === 'direct') {
      await completeTaskDirect(task, selectedStudentId)
      await refresh()
      showBanner('Görev tamamlandı.')
      return
    }
    setCompletingTask(task)
  }

  const handleDeleteTask = async (task) => {
    await removeTask(task.id, selectedStudentId)
    await refresh()
    setDrawerState(null)
    showBanner('Görev silindi.')
  }

  const managingTeacher = managingSlot
    ? privateTeachers.find((teacher) => teacher.id === managingSlot.studentTeacherId) || null
    : null

  const handleLessonSlotSaved = async () => {
    invalidateCache(`/api/panel/teachers?studentId=${selectedStudentId}`)
    invalidateCache('/api/panel/teachers')
    setManagingSlot(null)
    loadTeacherAndSchoolData()
    await refresh()
    showBanner('Ders programı güncellendi.')
  }

  const handleQuickAddBreak = async (date, afterTask, minutes) => {
    const breakStart = afterTask.endTime
    const breakEnd = addMinutesToTime(breakStart, minutes)

    await saveTaskForDay(
      date,
      {
        title: 'Mola',
        taskType: 'mola',
        startTime: breakStart,
        endTime: breakEnd,
        durationMinutes: minutes,
      },
      { studentId: selectedStudentId },
    )

    await refresh()
    showBanner(`${minutes} dakikalık mola eklendi.`)
  }

  const getExistingTasksForDrawer = useCallback(
    (date) => tasksByDate[date] || [],
    [tasksByDate],
  )

  // Bu haftada fiilen görülen görev türleri (filtre çiplerini yalnızca dolu olanlarla göster).
  const availableTaskTypes = useMemo(() => {
    const seen = new Set()
    Object.values(tasksByDate).forEach((tasks) => {
      (tasks || []).forEach((task) => {
        if (task.taskType) seen.add(task.taskType)
      })
    })
    return Object.keys(TASK_TYPES).filter((type) => seen.has(type))
  }, [tasksByDate])

  const toggleTaskType = (type) => {
    setSelectedTaskTypes((current) => {
      const next = new Set(current)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  const normalizedQuery = searchQuery.trim().toLocaleLowerCase('tr-TR')
  const isFiltering = Boolean(normalizedQuery) || selectedTaskTypes.size > 0

  // Kart üstünde görünen tüm alanlarda (başlık, ders, konu, açıklama, kaynak/yayınevi,
  // ekleyen kişi, özel ders öğretmeni) serbest metin araması + görev türü filtresi.
  const filteredTasksByDate = useMemo(() => {
    if (!isFiltering) return tasksByDate

    const matchesTask = (task) => {
      if (selectedTaskTypes.size > 0 && !selectedTaskTypes.has(task.taskType)) return false
      if (!normalizedQuery) return true
      const haystack = [
        task.title,
        task.subject,
        task.topic,
        task.description,
        task.resourceBookName,
        task.publisherName,
        task.schoolResourceName,
        task.createdByName,
        task.teacherFullName,
        TASK_TYPES[task.taskType]?.label,
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('tr-TR')
      return haystack.includes(normalizedQuery)
    }

    return Object.fromEntries(
      Object.entries(tasksByDate).map(([date, tasks]) => [date, (tasks || []).filter(matchesTask)]),
    )
  }, [tasksByDate, isFiltering, normalizedQuery, selectedTaskTypes])

  const filteredTaskCount = useMemo(
    () => Object.values(filteredTasksByDate).reduce((sum, tasks) => sum + (tasks?.length || 0), 0),
    [filteredTasksByDate],
  )

  const weekNavBase = 'h-11 w-full px-3 text-sm font-semibold shadow-sm sm:w-auto sm:px-4'
  const weekNavActive = `${weekNavBase} border-transparent bg-panel-blue text-white hover:bg-panel-blue`
  const weekNavIdle = `${weekNavBase} border-panel-blue-soft text-panel-text hover:bg-panel-blue-soft/50`

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-panel-blue-soft text-panel-blue shadow-sm sm:h-16 sm:w-16">
          <CalendarCheck size={32} strokeWidth={2.1} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="break-words text-2xl font-bold leading-tight text-panel-text sm:text-3xl">
              {studentName ? `${withGenitive(studentName)} Haftasını Planla` : 'Haftalık Plan'}
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
          className={weekOffset < 0 ? weekNavActive : weekNavIdle}
          aria-pressed={weekOffset < 0}
        >
          <ChevronLeft size={18} aria-hidden="true" />
          Önceki Hafta
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setWeekOffset(0)}
          className={weekOffset === 0 ? weekNavActive : weekNavIdle}
          aria-pressed={weekOffset === 0}
        >
          <CalendarDays size={18} aria-hidden="true" />
          Bu Hafta
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setWeekOffset((current) => current + 1)}
          className={weekOffset > 0 ? weekNavActive : weekNavIdle}
          aria-pressed={weekOffset > 0}
        >
          Sonraki Hafta
          <ChevronRight size={18} aria-hidden="true" />
        </Button>
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="relative min-w-0">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-panel-text-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Başlık, ders, konu, kaynak veya ekleyen kişi ara..."
            aria-label="Bu haftadaki görevlerde ara"
            className="h-10 w-full rounded-xl border border-panel-border bg-panel-surface pl-9 pr-9 text-sm text-panel-text outline-none focus:border-panel-blue focus:ring-2 focus:ring-panel-blue/10"
          />
          {searchQuery ? (
            <button
              type="button"
              aria-label="Aramayı temizle"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-panel-text-muted hover:bg-panel-surface-soft hover:text-panel-text"
            >
              <X size={14} aria-hidden="true" />
            </button>
          ) : null}
        </div>

        {availableTaskTypes.length ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="flex items-center gap-1 text-xs font-semibold text-panel-text-muted">
              <Filter size={13} aria-hidden="true" />
              Görev türü:
            </span>
            {availableTaskTypes.map((type) => {
              const meta = TASK_TYPES[type]
              const active = selectedTaskTypes.has(type)
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleTaskType(type)}
                  aria-pressed={active}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors duration-150 ${
                    active
                      ? 'border-panel-blue bg-panel-blue text-white'
                      : 'border-panel-border bg-panel-surface text-panel-text hover:bg-panel-surface-soft'
                  }`}
                >
                  {meta?.label || type}
                </button>
              )
            })}
            {selectedTaskTypes.size ? (
              <button
                type="button"
                onClick={() => setSelectedTaskTypes(new Set())}
                className="text-xs font-semibold text-panel-blue underline underline-offset-2"
              >
                Temizle
              </button>
            ) : null}
          </div>
        ) : null}

        {isFiltering ? (
          <p className="text-xs font-semibold text-panel-text-muted">
            {filteredTaskCount > 0
              ? `${filteredTaskCount} görev bulundu.`
              : 'Bu hafta için aramayla eşleşen görev bulunamadı.'}
          </p>
        ) : null}
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
            tasksByDate={filteredTasksByDate}
            lessonSchedule={lessonSchedule}
            schoolSchedule={schoolSchedule}
            schoolHolidays={schoolHolidays}
            onAddHomework={(date) => setDrawerState({ defaultDate: date })}
            onEditTask={(task) => setDrawerState({ initialTask: task })}
            onViewAnswerSheet={setAnswerSheetTask}
            onCompleteTask={handleCompleteTask}
            onQuickAddBreak={handleQuickAddBreak}
            onManageLessonSlot={setManagingSlot}
          />

          <UnscheduledTasksPanel
            tasks={unscheduledTasks}
            studentId={selectedStudentId}
            onChanged={refresh}
          />

          <div className="flex items-center gap-3 rounded-2xl bg-panel-blue-soft px-5 py-4 text-sm font-semibold text-panel-blue">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-panel-blue/30">
              <Info size={17} aria-hidden="true" />
            </span>
            <span>Görevler tamamlandıkça plan otomatik güncellenir.</span>
          </div>

          {drawerState ? (
            <Suspense fallback={<LoadingState label="Yükleniyor..." />}>
              <AddTaskDrawer
                initialTask={drawerState.initialTask}
                defaultDate={drawerState.defaultDate}
                getExistingTasksForDate={getExistingTasksForDrawer}
                schoolSchedule={schoolSchedule}
                schoolHolidays={schoolHolidays}
                studentGrade={selectedStudent?.grade}
                onSave={handleSaveDrawerTask}
                onDelete={handleDeleteTask}
                onClose={() => setDrawerState(null)}
              />
            </Suspense>
          ) : null}

          {managingSlot ? (
            <Suspense fallback={<LoadingState label="Yükleniyor..." />}>
              <ParentLessonSlotModal
                slot={managingSlot}
                teacher={managingTeacher}
                studentId={selectedStudentId}
                onSaved={handleLessonSlotSaved}
                onClose={() => setManagingSlot(null)}
              />
            </Suspense>
          ) : null}

          {completingTask ? (
            <Suspense fallback={<LoadingState label="Yükleniyor..." />}>
              <TaskCompletionFlow
                task={completingTask}
                studentId={selectedStudentId}
                onCompleted={() => refresh()}
                onClose={() => {
                  setCompletingTask(null)
                  refresh()
                }}
              />
            </Suspense>
          ) : null}

          {answerSheetTask ? (
            <Suspense fallback={<LoadingState label="Yükleniyor..." />}>
              <TaskAnswerSheetModal
                task={answerSheetTask}
                lessonLabel={answerSheetTask.subject || 'Görev'}
                photoMode="view"
                studentId={selectedStudentId}
                canRegrade
                onClose={() => setAnswerSheetTask(null)}
                onSaved={(updatedTask) => {
                  setAnswerSheetTask(updatedTask)
                  refresh()
                }}
              />
            </Suspense>
          ) : null}

        </>
      )}
    </div>
  )
}
