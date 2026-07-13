import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getTasksForDate, updateTask, createTask, deleteTask, rescheduleTask } from '../../../services/taskService'
import { getCheckIn } from '../../../services/checkInService'
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
import { todayISODate, formatDateLong, getMondayOfWeek } from '../../../utils/time'
import { ENERGY_LEVELS } from '../../../data/taskTypes'
import { TASK_TEMPLATES } from '../../../data/taskTemplates'
import { PARENT_MESSAGE_TEMPLATES } from '../../../data/coachMessages'
import PageHeader from '../../layout/PageHeader'
import ProgressSummaryCard from '../../shared/ProgressSummaryCard'
import ConfirmationDialog from '../../shared/ConfirmationDialog'
import ParentMessageCard from '../components/ParentMessageCard'
import CurrentTaskCard from '../components/CurrentTaskCard'
import DailyPlanTable from '../components/DailyPlanTable'
import WeeklyPlanPreviewCard from '../components/WeeklyPlanPreviewCard'
import StudentRequestsCard from '../components/StudentRequestsCard'
import PlanBalanceCard from '../components/PlanBalanceCard'
import QuickActionsPanel from '../components/QuickActionsPanel'
import UpcomingDeadlinesCard from '../components/UpcomingDeadlinesCard'
import AddTaskDrawer from '../components/AddTaskDrawer'
import AddHomeworkModal from '../../student/components/AddHomeworkModal'
import RescheduleTaskModal from '../../student/components/RescheduleTaskModal'
import { CheckCircle2, Clock, RotateCw, HeartPulse } from 'lucide-react'

const date = todayISODate()
const weekStart = getMondayOfWeek(date)

function buildWeekTasksMap() {
  return Object.fromEntries(getWeekDates(weekStart).map((day) => [day, getDraftTasksForDate(day)]))
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const [tasks, setTasks] = useState(() => getTasksForDate(date))
  const [checkIn] = useState(() => getCheckIn(date))
  const [homeworks, setHomeworks] = useState(() => getHomeworks())
  const [requests, setRequests] = useState(() => getRequests())
  const [messages, setMessages] = useState(() => getMessages())
  const [weekTasks, setWeekTasks] = useState(() => buildWeekTasksMap())
  const [planStatus, setPlanStatus] = useState(() => getPlanStatus(weekStart))
  const [drawerState, setDrawerState] = useState(null)
  const [homeworkModalOpen, setHomeworkModalOpen] = useState(false)
  const [reschedulingTask, setReschedulingTask] = useState(null)
  const [deletingTask, setDeletingTask] = useState(null)
  const [banner, setBanner] = useState('')

  const showBanner = (text) => {
    setBanner(text)
    window.setTimeout(() => setBanner(''), 4000)
  }

  const refreshWeek = () => {
    setWeekTasks(buildWeekTasksMap())
    setPlanStatus(getPlanStatus(weekStart))
  }

  const summary = {
    total: tasks.length,
    completed: tasks.filter((task) => task.status === 'tamamlandi').length,
    partial: tasks.filter((task) => task.status === 'kismen-tamamlandi').length,
    rescheduled: tasks.filter((task) => task.status === 'yeniden-planlandi').length,
  }

  const energyLabel = checkIn
    ? ENERGY_LEVELS.find((level) => level.id === checkIn.energyLevel)?.label
    : 'Henüz belirtilmedi'

  const strugglingTopic = (() => {
    const counts = {}
    getWrongQuestions().forEach((item) => {
      const key = item.topic ? `${item.subject} – ${item.topic}` : item.subject
      counts[key] = (counts[key] || 0) + 1
    })
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
    return sorted[0]?.[0] || null
  })()

  const currentTask = tasks.find((task) => task.status === 'devam-ediyor') || null
  const balance = evaluateDayBalance(tasks)

  const handleSendMessage = (text) => {
    if (!text.trim()) return
    sendMessage({ from: 'ebeveyn', text: text.trim() })
    setMessages(getMessages())
  }

  const handleSaveDrawerTask = (taskData) => {
    const initialTask = drawerState?.initialTask
    if (initialTask && taskData.date === initialTask.date) {
      updateTask(initialTask.date, initialTask.id, taskData)
    } else if (initialTask) {
      deleteTask(initialTask.date, initialTask.id)
      createTask(taskData.date, taskData)
    } else {
      createTask(taskData.date, taskData)
    }
    setTasks(getTasksForDate(date))
    setDrawerState(null)
    showBanner('Görev kaydedildi.')
  }

  const handleDeleteConfirmed = () => {
    deleteTask(date, deletingTask.id)
    setTasks(getTasksForDate(date))
    setDeletingTask(null)
  }

  const handleSaveNote = (task, note) => {
    updateTask(date, task.id, { notes: note })
    setTasks(getTasksForDate(date))
  }

  const handleConfirmReschedule = ({ newDate, newTime, reason }) => {
    const { sourceTasks } = rescheduleTask(date, reschedulingTask.id, { newDate, newTime, reason })
    setTasks(sourceTasks)
    setReschedulingTask(null)
    showBanner('Görev taşındı.')
  }

  const handleExtendTime = () => {
    if (!currentTask) return
    const [h, m] = currentTask.endTime.split(':').map(Number)
    const total = h * 60 + m + 10
    const newEndTime = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
    updateTask(date, currentTask.id, { endTime: newEndTime, durationMinutes: (currentTask.durationMinutes || 0) + 10 })
    setTasks(getTasksForDate(date))
    showBanner('Süreye 10 dakika eklendi.')
  }

  const handleEncourage = () => {
    sendMessage({ from: 'ebeveyn', text: PARENT_MESSAGE_TEMPLATES[0] })
    setMessages(getMessages())
    showBanner('Cesaret mesajı gönderildi.')
  }

  const handleSaveHomework = (payload) => {
    addHomework(payload)
    setHomeworks(getHomeworks())
    setHomeworkModalOpen(false)
    showBanner('Ödev eklendi.')
  }

  const handleApproveRequest = (request) => {
    setRequests(updateRequestStatus(request.id, 'onaylandi'))
    sendMessage({ from: 'ebeveyn', text: 'İsteğini onayladım, planına yansıttım.' })
    setMessages(getMessages())
  }

  const handleMessageRequest = (request) => {
    sendMessage({ from: 'ebeveyn', text: `"${request.message}" konusunu konuşalım.` })
    setMessages(getMessages())
    showBanner('Mesaj gönderildi.')
  }

  const handleSuggestOtherTime = (request) => {
    setRequests(updateRequestStatus(request.id, 'reddedildi'))
    sendMessage({ from: 'ebeveyn', text: 'Başka bir saat önerdim, birlikte bakalım.' })
    setMessages(getMessages())
  }

  const handlePostponeRequest = (request) => {
    setRequests(updateRequestStatus(request.id, 'ertelendi'))
  }

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Aylin'in Bugünü"
          subtitle={formatDateLong()}
          actions={
            <>
              <button
                type="button"
                onClick={() => navigate('/parent/weekly-plan')}
                className="rounded-xl border border-panel-border bg-panel-surface px-4 py-2.5 text-sm font-semibold text-panel-text"
              >
                Bugünkü Planı Düzenle
              </button>
              <button
                type="button"
                onClick={() => setDrawerState({ defaultDate: date })}
                className="rounded-xl bg-panel-blue px-4 py-2.5 text-sm font-semibold text-white"
              >
                + Yeni Görev Ekle
              </button>
            </>
          }
        />

        {banner ? (
          <div className="rounded-xl bg-panel-sage-soft px-4 py-3 text-base text-panel-text" role="status">
            {banner}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <ProgressSummaryCard
            icon={CheckCircle2}
            title="Tamamlanan"
            value={`${summary.completed} / ${summary.total}`}
            description="Bugün planlanan görevlerden"
          />
          <ProgressSummaryCard
            icon={Clock}
            title="Kısmen tamamlanan"
            value={summary.partial}
            description="Emek gösterilen görevler"
          />
          <ProgressSummaryCard
            icon={RotateCw}
            title="Yeniden planlanan"
            value={summary.rescheduled}
            description="Kaybolmadı, esnek planlama"
          />
          <ProgressSummaryCard icon={HeartPulse} title="Bugünkü enerji" value={energyLabel} description="Nazik bir destek iyi gelebilir" />
        </div>

        <CurrentTaskCard
          task={currentTask}
          onEncourage={handleEncourage}
          onExtendTime={handleExtendTime}
          onOpenDetail={() => currentTask && setDrawerState({ initialTask: currentTask })}
          onEdit={() => currentTask && setDrawerState({ initialTask: currentTask })}
        />

        <DailyPlanTable
          tasks={tasks}
          onEdit={(task) => setDrawerState({ initialTask: task })}
          onMove={(task) => setReschedulingTask(task)}
          onDelete={(task) => setDeletingTask(task)}
          onSaveNote={handleSaveNote}
        />

        <WeeklyPlanPreviewCard
          weekDates={getWeekDates(weekStart)}
          tasksByDate={weekTasks}
          planStatus={planStatus}
          onCopyPreviousWeek={() => {
            copyPreviousWeek(weekStart)
            refreshWeek()
            showBanner('Geçen hafta bu haftanın taslağına kopyalandı.')
          }}
          onSuggestPlan={() => {
            suggestWeekPlan(weekStart)
            refreshWeek()
            showBanner('Basit bir plan önerisi oluşturuldu, dilediğin gibi düzenleyebilirsin.')
          }}
          onPublish={() => {
            publishWeek(weekStart)
            refreshWeek()
            setTasks(getTasksForDate(date))
            showBanner('Plan yayınlandı.')
          }}
        />

        {strugglingTopic ? (
          <div className="rounded-2xl border border-panel-border bg-panel-surface p-5">
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

        <div className="rounded-2xl border border-panel-border bg-panel-surface p-5">
          <h2 className="text-base font-semibold text-panel-text">Motivasyon Mesajı Gönder</h2>
          <div className="mt-3 flex flex-col gap-2">
            {PARENT_MESSAGE_TEMPLATES.map((template) => (
              <button
                key={template}
                type="button"
                onClick={() => handleSendMessage(template)}
                className="rounded-xl border border-panel-border px-3 py-2.5 text-left text-sm text-panel-text hover:bg-panel-bg"
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
