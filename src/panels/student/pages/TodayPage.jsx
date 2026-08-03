import { useEffect, useMemo, useState } from 'react'
import { HelpCircle, LifeBuoy } from 'lucide-react'
import { useAuth } from '../../../context/useAuth'
import { getTasksForDate, updateTask, patchTask, toggleSubGoal, rescheduleTask } from '../../../services/taskService'
import { getCheckIn, saveCheckIn } from '../../../services/checkInService'
import { addSession } from '../../../services/studySessionService'
import { addHomework } from '../../../services/homeworkService'
import { sendMessage, addCoachNote } from '../../../services/messageService'
import { todayISODate, getMonthDates } from '../../../utils/time'
import { getNextTask } from '../../../utils/taskSelectors'
import { getAssignmentStatus } from '../../../utils/assignmentStatus'
import { FOCUS_TASK_TYPES } from '../../../data/taskTypes'
import StudentWelcomeBanner from '../components/StudentWelcomeBanner'
import EnergyCheckIn from '../components/EnergyCheckIn'
import TaskListSection from '../components/TaskListSection'
import TaskFocusScreen from '../components/TaskFocusScreen'
import SessionCompletionModal from '../components/SessionCompletionModal'
import RescheduleTaskModal from '../components/RescheduleTaskModal'
import AddHomeworkModal from '../components/AddHomeworkModal'
import StressSupportModal from '../components/StressSupportModal'
import BreathingExercise from '../components/BreathingExercise'
import LoadingState from '../../shared/LoadingState'

const date = todayISODate()

function SupportCard({ onOpenSupport }) {
  return (
    <section className="panel-card p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-student-theme-soft text-student-theme-text">
          <LifeBuoy size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-panel-text">Destek</h2>
          <p className="mt-1 text-sm text-panel-text-muted">Zorlandığında planı küçültebilir veya destek isteyebilirsin.</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onOpenSupport}
        className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-student-theme-primary/25 px-4 text-sm font-semibold text-student-theme-text hover:bg-student-theme-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-student-theme-primary"
      >
        <HelpCircle size={16} aria-hidden="true" />
        Destek Al
      </button>
    </section>
  )
}

const TIMER_STOP_STATUSES = new Set(['tamamlandi', 'kismen-tamamlandi'])

function buildTimerStopUpdates(task, stoppedAt) {
  if (!task?.timerStartedAt || task.timerStoppedAt) return {}

  const startedMs = new Date(task.timerStartedAt).getTime()
  const stoppedMs = new Date(stoppedAt).getTime()
  const updates = { timerStoppedAt: stoppedAt }

  if (Number.isFinite(startedMs) && Number.isFinite(stoppedMs)) {
    updates.timerElapsedSeconds = Math.max(0, Math.round((stoppedMs - startedMs) / 1000))
  }

  return updates
}

function buildCompletionUpdates(task, updates) {
  const completedAt = updates.completedAt || new Date().toISOString()
  const shouldStopTimer = TIMER_STOP_STATUSES.has(updates.status)

  return {
    ...updates,
    completedAt,
    ...(shouldStopTimer ? buildTimerStopUpdates(task, completedAt) : {}),
  }
}

function isUnfinishedFlowTask(task) {
  return getAssignmentStatus(task).filterKey === 'pending'
}

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

  const historyDays = useMemo(() => getMonthDates(date).filter((day) => day < date), [])

  useEffect(() => {
    let ignore = false
    Promise.all([getTasksForDate(date), getCheckIn(date)])
      .then(([tasksData, checkInData]) => {
        if (ignore) return
        setTasks(tasksData)
        setCheckIn(checkInData)
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

  useEffect(() => {
    if (historyDays.length === 0) return undefined
    let ignore = false
    Promise.all(historyDays.map((day) => getTasksForDate(day)))
      .then((results) => {
        if (ignore) return
        const map = {}
        historyDays.forEach((day, index) => {
          map[day] = results[index]
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
      ...historyDays.flatMap((day) => (historyTasks[day] || []).filter(isUnfinishedFlowTask)),
      ...tasks,
    ],
    [historyDays, historyTasks, tasks],
  )

  useEffect(() => {
    if (!banner) return undefined
    const timeout = window.setTimeout(() => setBanner(''), 4000)
    return () => window.clearTimeout(timeout)
  }, [banner])

  const focusTask = tasks.find((task) => task.id === focusTaskId) || null
  const nextTask = getNextTask(tasks)

  const isFocusType = (task) => FOCUS_TASK_TYPES.has(task.taskType) || task.taskType === 'gunluk-degerlendirme'

  const handleEnergySelect = async (levelId) => {
    setCheckIn(await saveCheckIn(date, { energyLevel: levelId, note: checkIn?.note }))
  }

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

  const handleCompleteInline = async (task) => {
    applyDayResult(task.date, await updateTask(task.date, task.id, buildCompletionUpdates(task, { status: 'tamamlandi' })))
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
    applyDayResult(task.date, await updateTask(task.date, task.id, buildCompletionUpdates(task, { status: 'kismen-tamamlandi' })))
  }

  const handleHelp = async (task) => {
    applyDayResult(task.date, await updateTask(task.date, task.id, { status: 'yardim-bekliyor' }))
    setShowStressModal(true)
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
    applyDayResult(
      task.date,
      await updateTask(task.date, task.id, buildCompletionUpdates(task, {
        completedPageCount: payload.completedPageCount,
        currentPageNumber: payload.currentPageNumber,
        status: payload.status,
      })),
    )
  }

  const handleSaveQuestionCount = async (task, payload) => {
    applyDayResult(
      task.date,
      await updateTask(task.date, task.id, buildCompletionUpdates(task, {
        completedQuestionCount: payload.completedQuestionCount,
        status: payload.status,
      })),
    )
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
        setBanner('Şu an küçültülecek bir hedef bulunamadı, planı Haftalık Plan sayfasından düzenleyebilirsin.')
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

    if (optionId === 'notify-parent') {
      await sendMessage({ from: 'ogrenci', text: 'Şu an kendimi bunalmış hissediyorum, desteğe ihtiyacım var.' })
      setBanner('Annene haber verildi.')
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
      <StudentWelcomeBanner studentName={authUser?.fullName || ''} tasks={tasks} checkIn={checkIn} />

      {loadError ? (
        <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{loadError}</div>
      ) : null}

      {banner ? (
        <div className="rounded-xl border border-student-theme-primary/20 bg-student-theme-soft px-4 py-3 text-base text-panel-text" role="status">
          {banner}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
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

        <div className="flex min-w-0 flex-col gap-5">
          <EnergyCheckIn selectedLevel={checkIn?.energyLevel} onSelect={handleEnergySelect} />
          <SupportCard onOpenSupport={() => setShowStressModal(true)} />
        </div>
      </div>

      {focusTask ? (
        <TaskFocusScreen
          task={focusTask}
          onClose={() => setFocusTaskId(null)}
          onFinishSession={handleFinishSession}
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
