import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getTasksForDate, updateTask, createTask, deleteTask, rescheduleTask } from '../../../services/taskService'
import { getWrongQuestions } from '../../../services/wrongQuestionService'
import { sendMessage, getMessages } from '../../../services/messageService'
import { getHomeworks, addHomework } from '../../../services/homeworkService'
import { getRequests, updateRequestStatus } from '../../../services/studentRequestService'
import {
  getWeekDates,
  getDraftTasksForDate,
  getPlanStatus,
  copyPreviousWeek,
  suggestWeekPlan,
  publishWeek,
} from '../../../services/weeklyPlanService'
import { evaluateDayBalance } from '../../../utils/planInsights'
import { todayISODate, getMondayOfWeek } from '../../../utils/time'
import { TASK_TEMPLATES } from '../../../data/taskTemplates'
import { PARENT_MESSAGE_TEMPLATES } from '../../../data/coachMessages'
import LoadingState from '../../shared/LoadingState'
import ConfirmationDialog from '../../shared/ConfirmationDialog'
import ParentMessageCard from '../components/ParentMessageCard'
import DailyPlanTable from '../components/DailyPlanTable'
import WeeklyPlanPreviewCard from '../components/WeeklyPlanPreviewCard'
import StudentRequestsCard from '../components/StudentRequestsCard'
import PlanBalanceCard from '../components/PlanBalanceCard'
import QuickActionsPanel from '../components/QuickActionsPanel'
import UpcomingDeadlinesCard from '../components/UpcomingDeadlinesCard'
import AddTaskDrawer from '../components/AddTaskDrawer'
import AddHomeworkModal from '../../student/components/AddHomeworkModal'
import RescheduleTaskModal from '../../student/components/RescheduleTaskModal'

const date = todayISODate()
const weekStart = getMondayOfWeek(date)

async function buildWeekTasksMap() {
  const days = getWeekDates(weekStart)
  const lists = await Promise.all(days.map((day) => getDraftTasksForDate(day)))
  return Object.fromEntries(days.map((day, index) => [day, lists[index]]))
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const [tasks, setTasks] = useState([])
  const [wrongQuestions, setWrongQuestions] = useState([])
  const [homeworks, setHomeworks] = useState([])
  const [requests, setRequests] = useState([])
  const [messages, setMessages] = useState([])
  const [weekTasks, setWeekTasks] = useState({})
  const [planStatus, setPlanStatus] = useState('taslak')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [drawerState, setDrawerState] = useState(null)
  const [homeworkModalOpen, setHomeworkModalOpen] = useState(false)
  const [reschedulingTask, setReschedulingTask] = useState(null)
  const [deletingTask, setDeletingTask] = useState(null)
  const [banner, setBanner] = useState('')

  useEffect(() => {
    let ignore = false

    Promise.all([
      getTasksForDate(date),
      getHomeworks(),
      buildWeekTasksMap(),
      getPlanStatus(weekStart),
      getRequests(),
      getMessages(),
      getWrongQuestions(),
    ])
      .then(([tasksData, homeworksData, weekTasksData, planStatusData, requestsData, messagesData, wrongQuestionsData]) => {
        if (ignore) return
        setTasks(tasksData)
        setHomeworks(homeworksData)
        setWeekTasks(weekTasksData)
        setPlanStatus(planStatusData)
        setRequests(requestsData)
        setMessages(messagesData)
        setWrongQuestions(wrongQuestionsData)
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

  const showBanner = (text) => {
    setBanner(text)
    window.setTimeout(() => setBanner(''), 4000)
  }

  const refreshWeek = async () => {
    setWeekTasks(await buildWeekTasksMap())
    setPlanStatus(await getPlanStatus(weekStart))
  }

  const strugglingTopic = (() => {
    const counts = {}
    wrongQuestions.forEach((item) => {
      const key = item.topic ? `${item.subject} – ${item.topic}` : item.subject
      counts[key] = (counts[key] || 0) + 1
    })
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
    return sorted[0]?.[0] || null
  })()

  const balance = evaluateDayBalance(tasks)

  const handleSendMessage = async (text) => {
    if (!text.trim()) return
    await sendMessage({ from: 'ebeveyn', text: text.trim() })
    setMessages(await getMessages())
  }

  const handleSaveDrawerTask = async (taskData) => {
    const initialTask = drawerState?.initialTask
    if (initialTask && taskData.date === initialTask.date) {
      setTasks(await updateTask(initialTask.date, initialTask.id, taskData))
    } else if (initialTask) {
      await deleteTask(initialTask.date, initialTask.id)
      await createTask(taskData.date, taskData)
      setTasks(await getTasksForDate(date))
    } else {
      await createTask(taskData.date, taskData)
      setTasks(await getTasksForDate(date))
    }
    setDrawerState(null)
    showBanner('Görev kaydedildi.')
  }

  const handleDeleteConfirmed = async () => {
    setTasks(await deleteTask(date, deletingTask.id))
    setDeletingTask(null)
  }

  const handleSaveNote = async (task, note) => {
    setTasks(await updateTask(date, task.id, { notes: note }))
  }

  const handleConfirmReschedule = async ({ newDate, newTime, reason }) => {
    const { sourceTasks } = await rescheduleTask(date, reschedulingTask.id, { newDate, newTime, reason })
    setTasks(sourceTasks)
    setReschedulingTask(null)
    showBanner('Görev taşındı.')
  }

  const handleSaveHomework = async (payload) => {
    await addHomework(payload)
    setHomeworks(await getHomeworks())
    setHomeworkModalOpen(false)
    showBanner('Ödev eklendi.')
  }

  const handleApproveRequest = async (request) => {
    setRequests(await updateRequestStatus(request.id, 'onaylandi'))
    await sendMessage({ from: 'ebeveyn', text: 'İsteğini onayladım, planına yansıttım.' })
    setMessages(await getMessages())
  }

  const handleMessageRequest = async (request) => {
    await sendMessage({ from: 'ebeveyn', text: `"${request.message}" konusunu konuşalım.` })
    setMessages(await getMessages())
    showBanner('Mesaj gönderildi.')
  }

  const handleSuggestOtherTime = async (request) => {
    setRequests(await updateRequestStatus(request.id, 'reddedildi'))
    await sendMessage({ from: 'ebeveyn', text: 'Başka bir saat önerdim, birlikte bakalım.' })
    setMessages(await getMessages())
  }

  const handlePostponeRequest = async (request) => {
    setRequests(await updateRequestStatus(request.id, 'ertelendi'))
  }

  if (loading) {
    return <LoadingState label="Panel yükleniyor..." />
  }

  return (
    <div className="grid w-full grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-5">
        {loadError ? (
          <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{loadError}</div>
        ) : null}

        {banner ? (
          <div className="rounded-xl bg-panel-sage-soft px-4 py-3 text-base text-panel-text" role="status">
            {banner}
          </div>
        ) : null}

        <DailyPlanTable
          tasks={tasks}
          onAddTask={() => setDrawerState({ defaultDate: date })}
          onEdit={(task) => setDrawerState({ initialTask: task })}
          onMove={(task) => setReschedulingTask(task)}
          onDelete={(task) => setDeletingTask(task)}
          onSaveNote={handleSaveNote}
        />

        <WeeklyPlanPreviewCard
          weekDates={getWeekDates(weekStart)}
          tasksByDate={weekTasks}
          planStatus={planStatus}
          onCopyPreviousWeek={async () => {
            await copyPreviousWeek(weekStart)
            await refreshWeek()
            showBanner('Geçen hafta bu haftanın taslağına kopyalandı.')
          }}
          onSuggestPlan={async () => {
            await suggestWeekPlan(weekStart)
            await refreshWeek()
            showBanner('Basit bir plan önerisi oluşturuldu, dilediğin gibi düzenleyebilirsin.')
          }}
          onPublish={async () => {
            await publishWeek(weekStart)
            await refreshWeek()
            setTasks(await getTasksForDate(date))
            showBanner('Plan yayınlandı.')
          }}
        />

        {strugglingTopic ? (
          <div className="panel-card p-5">
            <h2 className="text-base font-semibold text-panel-text">Gelişim alanı</h2>
            <p className="mt-1 text-base text-panel-text-muted">
              {strugglingTopic} konusunda tekrar ihtiyacı görünüyor.
            </p>
          </div>
        ) : null}

        <StudentRequestsCard
          requests={requests}
          onApprove={handleApproveRequest}
          onMessage={handleMessageRequest}
          onSuggestOther={handleSuggestOtherTime}
          onPostpone={handlePostponeRequest}
        />

        <PlanBalanceCard warnings={balance.warnings} />
      </div>

      <div className="flex flex-col gap-5">
        <QuickActionsPanel
          onPlanWeek={() => navigate('/parent/weekly-plan')}
          onAddHomework={() => setHomeworkModalOpen(true)}
          onAddTest={() => setDrawerState({ defaultDate: date, initialTemplate: TASK_TEMPLATES[0] })}
          onAddBreak={() => setDrawerState({ defaultDate: date, initialTemplate: TASK_TEMPLATES[5] })}
          onAddFreeTime={() => setDrawerState({ defaultDate: date, initialTemplate: TASK_TEMPLATES[6] })}
        />

        <UpcomingDeadlinesCard homeworks={homeworks} />

        <div className="panel-card p-5">
          <h2 className="text-base font-semibold text-panel-text">Motivasyon Mesajı Gönder</h2>
          <div className="mt-3 flex flex-col gap-2">
            {PARENT_MESSAGE_TEMPLATES.map((template) => (
              <button
                key={template}
                type="button"
                onClick={() => handleSendMessage(template)}
                className="rounded-xl border border-panel-border px-3 py-2.5 text-left text-sm text-panel-text hover:bg-panel-surface-soft"
              >
                {template}
              </button>
            ))}
          </div>
          {messages.length > 0 ? (
            <div className="mt-4 flex flex-col gap-2">
              {[...messages].reverse().slice(0, 2).map((message) => (
                <ParentMessageCard key={message.id} message={message} />
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {drawerState ? (
        <AddTaskDrawer
          initialTask={drawerState.initialTask}
          initialTemplate={drawerState.initialTemplate}
          defaultDate={drawerState.defaultDate}
          getExistingTasksForDate={(d) => (d === date ? tasks : getTasksForDate(d))}
          onSave={handleSaveDrawerTask}
          onClose={() => setDrawerState(null)}
        />
      ) : null}

      {homeworkModalOpen ? (
        <AddHomeworkModal onSave={handleSaveHomework} onClose={() => setHomeworkModalOpen(false)} />
      ) : null}

      {reschedulingTask ? (
        <RescheduleTaskModal
          task={reschedulingTask}
          onConfirm={handleConfirmReschedule}
          onClose={() => setReschedulingTask(null)}
        />
      ) : null}

      {deletingTask ? (
        <ConfirmationDialog
          title={`"${deletingTask.title}" silinsin mi?`}
          description="Bu görev bugünün planından kaldırılacak."
          confirmLabel="Sil"
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setDeletingTask(null)}
        />
      ) : null}
    </div>
  )
}
