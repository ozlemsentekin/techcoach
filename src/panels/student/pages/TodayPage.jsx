import { useEffect, useState } from 'react'
import { useAuth } from '../../../context/useAuth'
import { getTasksForDate, updateTask, toggleSubGoal, rescheduleTask } from '../../../services/taskService'
import { getCheckIn, saveCheckIn } from '../../../services/checkInService'
import { addSession } from '../../../services/studySessionService'
import { addHomework } from '../../../services/homeworkService'
import { sendMessage, addCoachNote } from '../../../services/messageService'
import { todayISODate } from '../../../utils/time'
import { getNextTask } from '../../../utils/taskSelectors'
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

  const handleCompleteInline = async (task) => {
    setTasks(await updateTask(date, task.id, { status: 'tamamlandi', completedAt: new Date().toISOString() }))
  }

  const handlePartialComplete = async (task) => {
    setTasks(await updateTask(date, task.id, { status: 'kismen-tamamlandi', completedAt: new Date().toISOString() }))
  }

  const handleHelp = async (task) => {
    setTasks(await updateTask(date, task.id, { status: 'yardim-bekliyor' }))
    setShowStressModal(true)
  }

  const handleAnswerSheetSaved = (updatedTask) => {
    setTasks((current) => current.map((task) => (task.id === updatedTask.id ? updatedTask : task)))
  }

  const handleSaveReadingProgress = async (task, payload) => {
    setTasks(
      await updateTask(date, task.id, {
        completedPageCount: payload.completedPageCount,
        currentPageNumber: payload.currentPageNumber,
        status: payload.status,
        completedAt: new Date().toISOString(),
      }),
    )
  }

  const handleSaveQuestionCount = async (task, payload) => {
    setTasks(
      await updateTask(date, task.id, {
        completedQuestionCount: payload.completedQuestionCount,
        status: payload.status,
        completedAt: new Date().toISOString(),
      }),
    )
  }

  const handleConfirmReschedule = async ({ newDate, newTime, reason }) => {
    const { sourceTasks } = await rescheduleTask(date, reschedulingTask.id, { newDate, newTime, reason })
    setTasks(sourceTasks)
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
      await updateTask(date, task.id, {
        completedQuestionCount: payload.completedQuestionCount,
        correctCount: payload.correctCount,
        wrongCount: payload.wrongCount,
        blankCount: payload.blankCount,
        difficulty: payload.difficulty,
        emotion: payload.emotion,
        notes: payload.note,
        status: payload.status,
        completedAt: new Date().toISOString(),
      }),
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
      await updateTask(date, focusTaskId, {
        status: 'tamamlandi',
        completedAt: new Date().toISOString(),
        reflectionAnswers: answers,
      }),
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
    <div className="flex w-full flex-col gap-5">
      <StudentWelcomeBanner studentName={authUser?.fullName || ''} tasks={tasks} checkIn={checkIn} />

      {loadError ? (
        <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{loadError}</div>
      ) : null}

      {banner ? (
        <div className="rounded-xl bg-panel-sage-soft px-4 py-3 text-base text-panel-text" role="status">
          {banner}
        </div>
      ) : null}

      <TaskListSection
        tasks={tasks}
        onComplete={handleCompleteInline}
        onPartialComplete={handlePartialComplete}
        onReschedule={(task) => setReschedulingTask(task)}
        onHelp={handleHelp}
        onAnswerSheetSaved={handleAnswerSheetSaved}
        onSaveReadingProgress={handleSaveReadingProgress}
        onSaveQuestionCount={handleSaveQuestionCount}
      />

      <EnergyCheckIn selectedLevel={checkIn?.energyLevel} onSelect={handleEnergySelect} />

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
