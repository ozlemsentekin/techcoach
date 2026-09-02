import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../../context/useAuth'
import { getTasksForDate, getTasksForDateRange, updateTask, patchTask, toggleSubGoal, rescheduleTask } from '../../../services/taskService'
import { getCheckIn } from '../../../services/checkInService'
import { addSession } from '../../../services/studySessionService'
import { addHomework } from '../../../services/homeworkService'
import { buildTeacherLessonTasksForDate, getTeacherLessonSchedule } from '../../../services/weeklyPlanService'
import { addCoachNote } from '../../../services/messageService'
import { todayISODate, addDaysISO } from '../../../utils/time'
import { getNextTask } from '../../../utils/taskSelectors'
import { isBacklogTask } from '../../../utils/backlogTasks'
import { FOCUS_TASK_TYPES } from '../../../data/taskTypes'
import useVisiblePolling from '../../../hooks/useVisiblePolling'
import StudentWelcomeBanner from '../components/StudentWelcomeBanner'
import StudentStatsCards from '../components/StudentStatsCards'
import TaskListSection from '../components/TaskListSection'
import TaskFocusScreen from '../components/TaskFocusScreen'
import SessionCompletionModal from '../components/SessionCompletionModal'
import RescheduleTaskModal from '../components/RescheduleTaskModal'
import AddHomeworkModal from '../components/AddHomeworkModal'
import StressSupportModal from '../components/StressSupportModal'
import BreathingExercise from '../components/BreathingExercise'
import LoadingState from '../../shared/LoadingState'
import { TIMER_STOP_STATUSES, buildTimerStopUpdates, buildCompletionUpdates } from '../../shared/taskCompletion'

const date = todayISODate()
const STUDENT_SUPPORT_EVENT = 'student-support-requested'
const STUDENT_ENERGY_UPDATED_EVENT = 'student-energy-updated'
const PENDING_SUPPORT_KEY = 'student_support_pending'

// Veli panelindeki "Biriken Görev" ile aynı geriye dönük pencere (bkz. getBacklogTasks).
const BACKLOG_LOOKBACK_DAYS = 30

export default function TodayPage() {
  const { authUser } = useAuth()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [checkIn, setCheckIn] = useState(null)
  const [focusTaskId, setFocusTaskId] = useState(null)
  const [pendingSession, setPendingSession] = useState(null)
  const [reschedulingTask, setReschedulingTask] = useState(null)
  const [showHomeworkModal, setShowHomeworkModal] = useState(false)
  const [showStressModal, setShowStressModal] = useState(false)
  const [showBreathing, setShowBreathing] = useState(false)
  const [banner, setBanner] = useState('')
  const [historyTasks, setHistoryTasks] = useState({})
  const [teacherLessonSchedule, setTeacherLessonSchedule] = useState([])

  const historyDays = useMemo(
    () => Array.from({ length: BACKLOG_LOOKBACK_DAYS }, (_, index) => addDaysISO(date, -(index + 1))),
    [],
  )

  useEffect(() => {
    let ignore = false
    Promise.all([
      getTasksForDate(date),
      getCheckIn(date),
      getTeacherLessonSchedule().catch(() => []),
    ])
      .then(([tasksData, checkInData, teacherLessons]) => {
        if (ignore) return
        setTasks(tasksData)
        setCheckIn(checkInData)
        setTeacherLessonSchedule(teacherLessons)
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
  }, [])

  // Mola süresi dolduğunda backend'i sistem olarak otomatik tamamlar (bkz. autoCompleteExpiredBreaks);
  // burada periyodik yenileme yalnızca bu değişikliğin ekrana yansımasını sağlar.
  useVisiblePolling(() => {
    getTasksForDate(date).then(setTasks).catch(() => {})
  }, 30000)

  useEffect(() => {
    if (historyDays.length === 0) return undefined
    let ignore = false
    const from = historyDays.reduce((min, day) => (day < min ? day : min))
    const to = historyDays.reduce((max, day) => (day > max ? day : max))
    getTasksForDateRange(from, to)
      .then((rangeTasks) => {
        if (ignore) return
        const map = {}
        historyDays.forEach((day) => {
          map[day] = []
        })
        rangeTasks.forEach((task) => {
          if (map[task.date]) map[task.date].push(task)
        })
        setHistoryTasks(map)
      })
      .catch((err) => {
        if (!ignore) setLoadError(err.message)
      })
    return () => {
      ignore = true
    }
  }, [historyDays])

  useEffect(() => {
    const handleSupportRequested = () => setShowStressModal(true)
    const handleEnergyUpdated = (event) => {
      if (event.detail?.checkIn) setCheckIn(event.detail.checkIn)
    }

    window.addEventListener(STUDENT_SUPPORT_EVENT, handleSupportRequested)
    window.addEventListener(STUDENT_ENERGY_UPDATED_EVENT, handleEnergyUpdated)

    let pendingSupportTimeout
    if (window.sessionStorage.getItem(PENDING_SUPPORT_KEY) === '1') {
      window.sessionStorage.removeItem(PENDING_SUPPORT_KEY)
      pendingSupportTimeout = window.setTimeout(handleSupportRequested, 0)
    }

    return () => {
      if (pendingSupportTimeout) window.clearTimeout(pendingSupportTimeout)
      window.removeEventListener(STUDENT_SUPPORT_EVENT, handleSupportRequested)
      window.removeEventListener(STUDENT_ENERGY_UPDATED_EVENT, handleEnergyUpdated)
    }
  }, [])

  /** Bir günün API sonucunu, o gün 'tasks' (bugün) ya da 'historyTasks' (ayın geçmiş günleri) neredeyse oraya yazar. */
  const applyDayResult = (dayDate, dayTasks) => {
    if (dayDate === date) {
      setTasks(dayTasks)
      return
    }
    setHistoryTasks((current) => {
      if (!historyDays.includes(dayDate)) return current
      return { ...current, [dayDate]: dayTasks }
    })
  }

  const listTasks = useMemo(
    () => [
      ...historyDays.flatMap((day) => (historyTasks[day] || []).filter(isBacklogTask)),
      ...buildTeacherLessonTasksForDate(teacherLessonSchedule, date),
      ...tasks,
    ],
    [historyDays, historyTasks, teacherLessonSchedule, tasks],
  )

  useEffect(() => {
    if (!banner) return undefined
    const timeout = window.setTimeout(() => setBanner(''), 4000)
    return () => window.clearTimeout(timeout)
  }, [banner])

  const focusTask = tasks.find((task) => task.id === focusTaskId) || null
  const nextTask = getNextTask(tasks)

  const isFocusType = (task) => FOCUS_TASK_TYPES.has(task.taskType) || task.taskType === 'gunluk-degerlendirme'

  const handleStart = async (task) => {
    if (isFocusType(task)) {
      if (task.status === 'bekliyor') {
        setTasks(await updateTask(date, task.id, { status: 'devam-ediyor' }))
      }
      setFocusTaskId(task.id)
    } else {
      setTasks(await updateTask(date, task.id, { status: 'devam-ediyor' }))
    }
  }

  const handleStartTimer = async (task) => {
    try {
      const startedAt = new Date().toISOString()
      applyDayResult(
        task.date,
        await updateTask(task.date, task.id, {
          status: 'devam-ediyor',
          timerStartedAt: startedAt,
          timerStoppedAt: null,
          timerElapsedSeconds: null,
        }),
      )
      setBanner('Sayaç başlatıldı.')
    } catch (err) {
      setLoadError(err.message)
    }
  }

  const handleFocusTimerStart = async (task) => {
    if (task.timerStartedAt) return

    try {
      const startedAt = new Date().toISOString()
      applyDayResult(
        task.date,
        await updateTask(task.date, task.id, {
          status: 'devam-ediyor',
          timerStartedAt: startedAt,
          timerStoppedAt: null,
          timerElapsedSeconds: null,
        }),
      )
    } catch (err) {
      setLoadError(err.message)
    }
  }

  const handleCompleteInline = async (task) => {
    try {
      applyDayResult(task.date, await updateTask(task.date, task.id, buildCompletionUpdates(task, { status: 'tamamlandi' })))
    } catch (err) {
      setLoadError(err.message || 'Görev tamamlanamadı.')
    }
  }

  const handleUndoComplete = async (task) => {
    try {
      applyDayResult(
        task.date,
        await updateTask(task.date, task.id, {
          status: 'bekliyor',
          completedAt: null,
          timerStartedAt: null,
          timerStoppedAt: null,
          timerElapsedSeconds: null,
        }),
      )
      setBanner('Görev tekrar yapılacaklara alındı.')
    } catch (err) {
      setLoadError(err.message)
    }
  }

  const handlePartialComplete = async (task) => {
    try {
      applyDayResult(task.date, await updateTask(task.date, task.id, buildCompletionUpdates(task, { status: 'kismen-tamamlandi' })))
    } catch (err) {
      setLoadError(err.message || 'Görev güncellenemedi.')
    }
  }

  const handleHelp = async (task) => {
    try {
      applyDayResult(task.date, await updateTask(task.date, task.id, { status: 'yardim-bekliyor' }))
      setShowStressModal(true)
    } catch (err) {
      setLoadError(err.message || 'Görev güncellenemedi.')
    }
  }

  const handleAnswerSheetSaved = async (updatedTask) => {
    try {
      let finalTask = updatedTask
      const timerUpdates = TIMER_STOP_STATUSES.has(updatedTask.status)
        ? buildTimerStopUpdates(updatedTask, updatedTask.completedAt || new Date().toISOString())
        : {}
      if (Object.keys(timerUpdates).length > 0) {
        finalTask = await patchTask(updatedTask.id, timerUpdates)
      }

      const replaceWithFinalTask = (list) => list.map((task) => (task.id === finalTask.id ? finalTask : task))
      if (finalTask.date === date) {
        setTasks(replaceWithFinalTask)
        return
      }
      setHistoryTasks((current) => {
        if (!historyDays.includes(finalTask.date)) return current
        return { ...current, [finalTask.date]: replaceWithFinalTask(current[finalTask.date] || []) }
      })
    } catch (err) {
      setLoadError(err.message)
    }
  }

  const handleSaveReadingProgress = async (task, payload) => {
    try {
      applyDayResult(
        task.date,
        await updateTask(task.date, task.id, buildCompletionUpdates(task, {
          completedPageCount: payload.completedPageCount,
          currentPageNumber: payload.currentPageNumber,
          status: payload.status,
        })),
      )
    } catch (err) {
      setLoadError(err.message || 'İlerleme kaydedilemedi.')
    }
  }

  const handleSaveQuestionCount = async (task, payload) => {
    try {
      applyDayResult(
        task.date,
        await updateTask(task.date, task.id, buildCompletionUpdates(task, {
          completedQuestionCount: payload.completedQuestionCount,
          status: payload.status,
        })),
      )
    } catch (err) {
      setLoadError(err.message || 'İlerleme kaydedilemedi.')
    }
  }

  const handleSaveNotes = async (task, notes) => {
    const updatedTasks = await updateTask(task.date, task.id, { notes })
    applyDayResult(task.date, updatedTasks)
    return updatedTasks.find((item) => item.id === task.id) || { ...task, notes }
  }

  const handleConfirmReschedule = async ({ newDate, newTime, reason }) => {
    const sourceDate = reschedulingTask.date
    const { sourceTasks, targetTasks } = await rescheduleTask(sourceDate, reschedulingTask.id, { newDate, newTime, reason })
    applyDayResult(sourceDate, sourceTasks)
    if (newDate !== sourceDate) applyDayResult(newDate, targetTasks)
    setReschedulingTask(null)
    setBanner('Görev taşındı. Kaybolmadı, yeni zamanında seni bekliyor.')
  }

  const handleToggleSubGoal = async (index) => {
    if (!focusTaskId) return
    setTasks(await toggleSubGoal(date, focusTaskId, index))
  }

  const handleFinishSession = ({ elapsedSeconds, completedQuestionCount, stuckNote }) => {
    const task = focusTask
    setFocusTaskId(null)
    setPendingSession({ task, elapsedSeconds, completedQuestionCount, stuckNote })
  }

  const handleSaveSession = async (payload) => {
    const { task, elapsedSeconds, stuckNote } = pendingSession
    setTasks(
      await updateTask(date, task.id, buildCompletionUpdates(task, {
        completedQuestionCount: payload.completedQuestionCount,
        correctCount: payload.correctCount,
        wrongCount: payload.wrongCount,
        blankCount: payload.blankCount,
        difficulty: payload.difficulty,
        emotion: payload.emotion,
        notes: payload.note,
        status: payload.status,
      })),
    )
    await addSession({
      taskId: task.id,
      startedAt: new Date(Date.now() - elapsedSeconds * 1000).toISOString(),
      endedAt: new Date().toISOString(),
      durationMinutes: Math.round(elapsedSeconds / 60),
      completedQuestionCount: payload.completedQuestionCount,
      correctCount: payload.correctCount,
      wrongCount: payload.wrongCount,
      blankCount: payload.blankCount,
      difficultyRating: payload.difficulty,
      emotion: payload.emotion,
      note: payload.note || stuckNote,
    })
  }

  const handleSubmitReflection = async (answers) => {
    setTasks(
      await updateTask(date, focusTaskId, buildCompletionUpdates(focusTask, {
        status: 'tamamlandi',
        reflectionAnswers: answers,
      })),
    )
    setFocusTaskId(null)
  }

  const handleSaveHomework = async (payload) => {
    await addHomework(payload)
    setShowHomeworkModal(false)
    setBanner('Ödevini planladın. Artık hepsini aklında tutmak zorunda değilsin.')
  }

  const handleStressOption = async (optionId) => {
    setShowStressModal(false)

    if (optionId === 'breathe') {
      setShowBreathing(true)
      return
    }

    if (optionId === 'break') {
      setBanner('5 dakikalık dinlenme zamanın başladı.')
      return
    }

    if (optionId === 'shrink-plan') {
      const target = tasks.find(
        (task) => task.id === nextTask?.id && task.targetQuestionCount,
      )
      if (target) {
        const reduced = Math.max(5, Math.floor(target.targetQuestionCount / 2))
        setTasks(await updateTask(date, target.id, { targetQuestionCount: reduced }))
        setBanner(`${target.targetQuestionCount} soru yerine önce ${reduced} soruyla başlamak ister misin?`)
      } else {
        setBanner('Şu an küçültülecek bir hedef bulunamadı. Velinden planını güncellemesini isteyebilirsin.')
      }
      return
    }

    if (optionId === 'easy-task') {
      const easiest = [...tasks]
        .filter((task) => task.status === 'bekliyor' && isFocusType(task))
        .sort((a, b) => a.durationMinutes - b.durationMinutes)[0]
      if (easiest) {
        handleStart(easiest)
      } else {
        setBanner('Şu an kolay bir görev bulunamadı.')
      }
      return
    }

    if (optionId === 'note-coach') {
      await addCoachNote(`Yardıma ihtiyacım var: ${nextTask?.title || 'genel destek'}`)
      setBanner('Koçuna not bırakıldı.')
    }
  }

  if (loading) {
    return <LoadingState label="Bugünkü plan yükleniyor..." />
  }

  return (
    <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
      <StudentWelcomeBanner studentId={authUser?.id} studentName={authUser?.fullName || ''} grade={authUser?.grade} tasks={tasks} checkIn={checkIn} />

      {loadError ? (
        <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{loadError}</div>
      ) : null}

      {banner ? (
        <div className="rounded-xl border border-student-theme-primary/20 bg-student-theme-soft px-4 py-3 text-base text-panel-text" role="status">
          {banner}
        </div>
      ) : null}

      <div className="flex flex-col gap-5">
        <div className="order-2 md:order-none">
          <StudentStatsCards tasks={tasks} />
        </div>

        <div className="order-1 md:order-none">
          <TaskListSection
            tasks={listTasks}
            onStartTimer={handleStartTimer}
            onComplete={handleCompleteInline}
            onUndoComplete={handleUndoComplete}
            onPartialComplete={handlePartialComplete}
            onReschedule={(task) => setReschedulingTask(task)}
            onHelp={handleHelp}
            onAnswerSheetSaved={handleAnswerSheetSaved}
            onSaveReadingProgress={handleSaveReadingProgress}
            onSaveQuestionCount={handleSaveQuestionCount}
            onSaveNotes={handleSaveNotes}
          />
        </div>
      </div>

      {focusTask ? (
        <TaskFocusScreen
          task={focusTask}
          onClose={() => setFocusTaskId(null)}
          onFinishSession={handleFinishSession}
          onStartTimer={handleFocusTimerStart}
          onToggleSubGoal={handleToggleSubGoal}
          onSubmitReflection={handleSubmitReflection}
          onOpenHomeworkModal={() => setShowHomeworkModal(true)}
        />
      ) : null}

      {pendingSession ? (
        <SessionCompletionModal
          task={pendingSession.task}
          initialCompletedQuestionCount={pendingSession.completedQuestionCount}
          onSave={handleSaveSession}
          onClose={() => setPendingSession(null)}
        />
      ) : null}

      {reschedulingTask ? (
        <RescheduleTaskModal
          task={reschedulingTask}
          onConfirm={handleConfirmReschedule}
          onClose={() => setReschedulingTask(null)}
        />
      ) : null}

      {showHomeworkModal ? (
        <AddHomeworkModal onSave={handleSaveHomework} onClose={() => setShowHomeworkModal(false)} />
      ) : null}

      {showStressModal ? (
        <StressSupportModal onSelectOption={handleStressOption} onClose={() => setShowStressModal(false)} />
      ) : null}

      {showBreathing ? <BreathingExercise onClose={() => setShowBreathing(false)} /> : null}
    </div>
  )
}
