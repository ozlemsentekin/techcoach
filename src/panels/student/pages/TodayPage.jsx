import { useEffect, useState } from 'react'
import { useAuth } from '../../../context/useAuth'
import { getTasksForDate, updateTask, toggleSubGoal, rescheduleTask } from '../../../services/taskService'
import { getCheckIn, saveCheckIn } from '../../../services/checkInService'
import { addSession } from '../../../services/studySessionService'
import { addHomework } from '../../../services/homeworkService'
import { sendMessage, addCoachNote } from '../../../services/messageService'
import { computeDailyStars } from '../../../services/starService'
import { todayISODate } from '../../../utils/time'
import { getNextTask, getCurrentTask } from '../../../utils/taskSelectors'
import { FOCUS_TASK_TYPES } from '../../../data/taskTypes'
import { MONDAY_DAILY_SUMMARY, MONDAY_MAIN_MESSAGE } from '../../../data/mondayDemoData'
import GreetingCard from '../components/GreetingCard'
import EnergyCheckIn from '../components/EnergyCheckIn'
import DailySummaryCard from '../components/DailySummaryCard'
import NextTaskCard from '../components/NextTaskCard'
import DailyTimeline from '../components/DailyTimeline'
import DailyStarsCard from '../components/DailyStarsCard'
import TaskFocusScreen from '../components/TaskFocusScreen'
import SessionCompletionModal from '../components/SessionCompletionModal'
import RescheduleTaskModal from '../components/RescheduleTaskModal'
import AddHomeworkModal from '../components/AddHomeworkModal'
import StressSupportModal from '../components/StressSupportModal'
import BreathingExercise from '../components/BreathingExercise'

const date = todayISODate()

export default function TodayPage() {
  const { authUser } = useAuth()
  const [tasks, setTasks] = useState(() => getTasksForDate(date))
  const [checkIn, setCheckIn] = useState(() => getCheckIn(date))
  const [focusTaskId, setFocusTaskId] = useState(null)
  const [pendingSession, setPendingSession] = useState(null)
  const [reschedulingTask, setReschedulingTask] = useState(null)
  const [showHomeworkModal, setShowHomeworkModal] = useState(false)
  const [showStressModal, setShowStressModal] = useState(false)
  const [showBreathing, setShowBreathing] = useState(false)
  const [banner, setBanner] = useState('')

  useEffect(() => {
    if (!banner) return undefined
    const timeout = window.setTimeout(() => setBanner(''), 4000)
    return () => window.clearTimeout(timeout)
  }, [banner])

  const focusTask = tasks.find((task) => task.id === focusTaskId) || null
  const nextTask = getNextTask(tasks)
  const currentTask = getCurrentTask(tasks, nextTask)
  const stars = computeDailyStars(tasks, checkIn)

  const isFocusType = (task) => FOCUS_TASK_TYPES.has(task.taskType) || task.taskType === 'gunluk-degerlendirme'

  const handleEnergySelect = (levelId) => {
    setCheckIn(saveCheckIn(date, { energyLevel: levelId, note: checkIn?.note }))
  }

  const handleStart = (task) => {
    if (isFocusType(task)) {
      if (task.status === 'bekliyor') {
        setTasks(updateTask(date, task.id, { status: 'devam-ediyor' }))
      }
      setFocusTaskId(task.id)
    } else {
      setTasks(updateTask(date, task.id, { status: 'devam-ediyor' }))
    }
  }

  const handleCompleteInline = (task) => {
    setTasks(updateTask(date, task.id, { status: 'tamamlandi', completedAt: new Date().toISOString() }))
  }

  const handlePartialComplete = (task) => {
    setTasks(updateTask(date, task.id, { status: 'kismen-tamamlandi', completedAt: new Date().toISOString() }))
  }

  const handleHelp = (task) => {
    setTasks(updateTask(date, task.id, { status: 'yardim-bekliyor' }))
    setShowStressModal(true)
  }

  const handleConfirmReschedule = ({ newDate, newTime, reason }) => {
    const { sourceTasks } = rescheduleTask(date, reschedulingTask.id, { newDate, newTime, reason })
    setTasks(sourceTasks)
    setReschedulingTask(null)
    setBanner('Görev taşındı. Kaybolmadı, yeni zamanında seni bekliyor.')
  }

  const handleToggleSubGoal = (index) => {
    if (!focusTaskId) return
    setTasks(toggleSubGoal(date, focusTaskId, index))
  }

  const handleFinishSession = ({ elapsedSeconds, completedQuestionCount, stuckNote }) => {
    const task = focusTask
    setFocusTaskId(null)
    setPendingSession({ task, elapsedSeconds, completedQuestionCount, stuckNote })
  }

  const handleSaveSession = (payload) => {
    const { task, elapsedSeconds, stuckNote } = pendingSession
    setTasks(
      updateTask(date, task.id, {
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
    addSession({
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

  const handleSubmitReflection = (answers) => {
    setTasks(
      updateTask(date, focusTaskId, {
        status: 'tamamlandi',
        completedAt: new Date().toISOString(),
        reflectionAnswers: answers,
      }),
    )
    setFocusTaskId(null)
  }

  const handleSaveHomework = (payload) => {
    addHomework(payload)
    setShowHomeworkModal(false)
    setBanner('Ödevini planladın. Artık hepsini aklında tutmak zorunda değilsin.')
  }

  const handleStressOption = (optionId) => {
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
        setTasks(updateTask(date, target.id, { targetQuestionCount: reduced }))
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
      sendMessage({ from: 'ogrenci', text: 'Şu an kendimi bunalmış hissediyorum, desteğe ihtiyacım var.' })
      setBanner('Annene haber verildi.')
      return
    }

    if (optionId === 'note-coach') {
      addCoachNote(`Yardıma ihtiyacım var: ${nextTask?.title || 'genel destek'}`)
      setBanner('Koçuna not bırakıldı.')
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <GreetingCard firstName={authUser?.fullName?.split(' ')[0] || ''} mainMessage={MONDAY_MAIN_MESSAGE} />

      <button
        type="button"
        onClick={() => setShowStressModal(true)}
        className="rounded-xl border border-panel-accent bg-panel-accent-soft px-4 py-3 text-base font-semibold text-panel-warm"
      >
        Şu an çok bunaldım
      </button>

      {banner ? (
        <div className="rounded-xl bg-panel-sage-soft px-4 py-3 text-base text-panel-text" role="status">
          {banner}
        </div>
      ) : null}

      <EnergyCheckIn selectedLevel={checkIn?.energyLevel} onSelect={handleEnergySelect} />

      <DailySummaryCard items={MONDAY_DAILY_SUMMARY} />

      <NextTaskCard
        currentTask={currentTask}
        nextTask={nextTask}
        onStart={handleStart}
        onLater={() => setBanner('İstediğinde başlayabilirsin.')}
        onEdit={(task) => setReschedulingTask(task)}
        onHelp={handleHelp}
      />

      <DailyStarsCard count={stars.count} criteria={stars.criteria} />

      <DailyTimeline
        tasks={tasks}
        onStart={handleStart}
        onComplete={handleCompleteInline}
        onPartialComplete={handlePartialComplete}
        onReschedule={(task) => setReschedulingTask(task)}
        onHelp={handleHelp}
      />

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
