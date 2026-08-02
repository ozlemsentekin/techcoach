import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ListChecks,
  MessageCircle,
  Pencil,
  Plus,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { getTasksForDate, updateTask, createTask, deleteTask, rescheduleTask } from '../../../services/taskService'
import { getWrongQuestions } from '../../../services/wrongQuestionService'
import { sendMessage, getMessages } from '../../../services/messageService'
import { getRequests, updateRequestStatus } from '../../../services/studentRequestService'
import { evaluateDayBalance } from '../../../utils/planInsights'
import { getCurrentTask, getNextTask, getPendingTasks, getSortedTasks } from '../../../utils/taskSelectors'
import { formatDateLong, todayISODate } from '../../../utils/time'
import { PARENT_MESSAGE_TEMPLATES } from '../../../data/coachMessages'
import LoadingState from '../../shared/LoadingState'
import ConfirmationDialog from '../../shared/ConfirmationDialog'
import ParentMessageCard from '../components/ParentMessageCard'
import DailyPlanTable from '../components/DailyPlanTable'
import StudentRequestsCard from '../components/StudentRequestsCard'
import PlanBalanceCard from '../components/PlanBalanceCard'
import AddTaskDrawer from '../components/AddTaskDrawer'
import RescheduleTaskModal from '../../student/components/RescheduleTaskModal'

const date = todayISODate()

function formatDuration(minutes) {
  if (!minutes) return '0dk'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins}dk`
  if (mins === 0) return `${hours}sa`
  return `${hours}sa ${mins}dk`
}

function getDescriptionLines(task) {
  return (task?.description || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function getTaskSummary(task) {
  if (!task) return ''
  return getDescriptionLines(task)[0] || task.title || 'Görev'
}

function DashboardMetric({ icon, label, value, tone = 'blue' }) {
  const Icon = icon
  const toneClassNames = {
    blue: 'bg-panel-blue-soft text-panel-blue',
    sage: 'bg-panel-sage-soft text-panel-sage',
    warm: 'bg-panel-warm-soft text-panel-warm',
    lilac: 'bg-panel-lilac-soft text-panel-lilac',
  }

  return (
    <div className="min-w-0 rounded-xl border border-panel-border bg-panel-surface px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${toneClassNames[tone]}`}>
          <Icon size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-panel-text-muted">{label}</p>
          <p className="truncate text-xl font-bold text-panel-text">{value}</p>
        </div>
      </div>
    </div>
  )
}

function TodayOverview({ tasks, onAddTask }) {
  const sortedTasks = getSortedTasks(tasks)
  const pendingTasks = getPendingTasks(tasks)
  const completedCount = sortedTasks.filter((task) => task.status === 'tamamlandi').length
  const incompleteCount = Math.max(0, sortedTasks.length - completedCount)
  const remainingMinutes = pendingTasks.reduce((sum, task) => sum + (task.durationMinutes || 0), 0)
  const completionRate = sortedTasks.length > 0 ? Math.round((completedCount / sortedTasks.length) * 100) : 0

  return (
    <section className="panel-card overflow-hidden">
      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 rounded-full bg-panel-sage-soft px-3 py-1 text-sm font-medium text-panel-sage">
            <CalendarDays size={15} aria-hidden="true" />
            {formatDateLong(new Date())}
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <h1 className="text-2xl font-bold text-panel-text sm:text-3xl">Bugün</h1>
            <p className="max-w-2xl text-base text-panel-text-muted">
              Aylin'in planı ve günün ilerleyişi tek ekranda.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onAddTask}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-panel-blue px-4 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 active:opacity-90"
        >
          <Plus size={18} aria-hidden="true" />
          Görev Ekle
        </button>
      </div>

      <div className="border-t border-panel-border bg-panel-surface-soft/60 p-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardMetric icon={ListChecks} label="Toplam Görev" value={sortedTasks.length} />
          <DashboardMetric icon={CheckCircle2} label="Tamamlanan" value={completedCount} tone="sage" />
          <DashboardMetric icon={Clock3} label="Kalan Süre" value={formatDuration(remainingMinutes)} tone="warm" />
          <DashboardMetric icon={AlertTriangle} label="Tamamlanmamış" value={incompleteCount} tone="lilac" />
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-panel-text">Gün İlerlemesi</span>
            <span className="font-bold text-panel-blue">%{completionRate}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-panel-border">
            <div className="h-full rounded-full bg-panel-blue" style={{ width: `${completionRate}%` }} />
          </div>
        </div>
      </div>
    </section>
  )
}

function FocusTaskCard({ task, onEdit, onMove }) {
  if (!task) {
    return (
      <section className="panel-card p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-panel-sage-soft text-panel-sage">
            <CheckCircle2 size={18} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-panel-text">Sıradaki Odak</h2>
            <p className="mt-1 text-sm text-panel-text-muted">Bugün için bekleyen görev görünmüyor.</p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="panel-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-panel-blue">Sıradaki Odak</p>
          <h2 className="mt-2 line-clamp-2 text-lg font-bold text-panel-text">{getTaskSummary(task)}</h2>
          <p className="mt-2 text-sm font-medium text-panel-text-muted">
            {task.startTime} - {task.endTime}
          </p>
        </div>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-panel-blue-soft text-panel-blue">
          <Sparkles size={19} aria-hidden="true" />
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onEdit(task)}
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-panel-border px-3 text-sm font-medium text-panel-text hover:bg-panel-surface-soft"
        >
          <Pencil size={15} aria-hidden="true" />
          Düzenle
        </button>
        <button
          type="button"
          onClick={() => onMove(task)}
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-panel-border px-3 text-sm font-medium text-panel-text hover:bg-panel-surface-soft"
        >
          <Clock3 size={15} aria-hidden="true" />
          Taşı
        </button>
      </div>
    </section>
  )
}

function LearningSignalCard({ topic }) {
  return (
    <section className="panel-card p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-panel-warm-soft text-panel-warm">
          {topic ? <TrendingUp size={18} aria-hidden="true" /> : <AlertTriangle size={18} aria-hidden="true" />}
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-panel-text">Gelişim Alanı</h2>
          <p className="mt-1 text-sm text-panel-text-muted">
            {topic ? `${topic} konusunda tekrar ihtiyacı görünüyor.` : 'Bugün için belirgin bir zorlanma alanı görünmüyor.'}
          </p>
        </div>
      </div>
    </section>
  )
}

function MotivationMessagePanel({ messages, onSendMessage }) {
  return (
    <section className="panel-card p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-panel-lilac-soft text-panel-lilac">
          <MessageCircle size={18} aria-hidden="true" />
        </span>
        <h2 className="text-base font-semibold text-panel-text">Motivasyon Mesajı</h2>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {PARENT_MESSAGE_TEMPLATES.map((template) => (
          <button
            key={template}
            type="button"
            onClick={() => onSendMessage(template)}
            className="rounded-xl border border-panel-border bg-panel-surface px-3 py-2.5 text-left text-sm text-panel-text transition-colors hover:bg-panel-surface-soft"
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
    </section>
  )
}

export default function DashboardPage() {
  const [tasks, setTasks] = useState([])
  const [wrongQuestions, setWrongQuestions] = useState([])
  const [requests, setRequests] = useState([])
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [drawerState, setDrawerState] = useState(null)
  const [reschedulingTask, setReschedulingTask] = useState(null)
  const [deletingTask, setDeletingTask] = useState(null)
  const [banner, setBanner] = useState('')

  useEffect(() => {
    let ignore = false

    Promise.all([
      getTasksForDate(date),
      getRequests(),
      getMessages(),
      getWrongQuestions(),
    ])
      .then(([tasksData, requestsData, messagesData, wrongQuestionsData]) => {
        if (ignore) return
        setTasks(tasksData)
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
  const nextTask = getNextTask(tasks)
  const currentTask = getCurrentTask(tasks, nextTask)
  const focusTask = currentTask || nextTask

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
    <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
      {loadError ? (
        <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{loadError}</div>
      ) : null}

      {banner ? (
        <div className="rounded-xl bg-panel-sage-soft px-4 py-3 text-base text-panel-text" role="status">
          {banner}
        </div>
      ) : null}

      <TodayOverview tasks={tasks} onAddTask={() => setDrawerState({ defaultDate: date })} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-5">
          <DailyPlanTable
            tasks={tasks}
            onAddTask={() => setDrawerState({ defaultDate: date })}
            onEdit={(task) => setDrawerState({ initialTask: task })}
            onMove={(task) => setReschedulingTask(task)}
            onDelete={(task) => setDeletingTask(task)}
            onSaveNote={handleSaveNote}
          />

          <div className="grid gap-5 lg:grid-cols-2">
            <StudentRequestsCard
              requests={requests}
              onApprove={handleApproveRequest}
              onMessage={handleMessageRequest}
              onSuggestOther={handleSuggestOtherTime}
              onPostpone={handlePostponeRequest}
            />

            <PlanBalanceCard warnings={balance.warnings} />
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <FocusTaskCard
            task={focusTask}
            onEdit={(task) => setDrawerState({ initialTask: task })}
            onMove={(task) => setReschedulingTask(task)}
          />
          <LearningSignalCard topic={strugglingTopic} />
          <MotivationMessagePanel messages={messages} onSendMessage={handleSendMessage} />
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
