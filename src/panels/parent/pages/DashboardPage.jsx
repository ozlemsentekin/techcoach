import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../../context/useAuth'
import { AlertTriangle, CalendarDays, Plus, Sparkles } from 'lucide-react'
import { getTasksForDate, patchTask, createTask, removeTask } from '../../../services/taskService'
import { getSchoolSchedule, getBacklogTasks, getTeacherLessonSchedule, buildTeacherLessonTasksForDate } from '../../../services/weeklyPlanService'
import { sendMessage } from '../../../services/messageService'
import { getRequests, updateRequestStatus } from '../../../services/studentRequestService'
import { evaluateDayBalance } from '../../../utils/planInsights'
import { getSortedTasks } from '../../../utils/taskSelectors'
import { formatDateLong, todayISODate } from '../../../utils/time'
import useVisiblePolling from '../../../hooks/useVisiblePolling'
import LoadingState from '../../shared/LoadingState'
import ConfirmationDialog from '../../shared/ConfirmationDialog'
import DailyPlanTable from '../components/DailyPlanTable'
import AddTaskDrawer from '../components/AddTaskDrawer'
import TaskAnswerSheetModal from '../../student/components/TaskAnswerSheetModal'

const date = todayISODate()
const LOW_PRIORITY_BALANCE_WARNINGS = new Set(['Mola eklenmemiş', 'Serbest zaman yok'])

function getPendingRequests(requests) {
  return requests.filter((request) => request.status === 'bekliyor')
}

function getVisibleBalanceWarnings(warnings) {
  return warnings
    .filter((warning) => warning.tone !== 'ok' && !LOW_PRIORITY_BALANCE_WARNINGS.has(warning.title))
    .slice(0, 2)
}

function ParentHomeHeader({ onAddTask }) {
  return (
    <section className="rounded-2xl border border-panel-border bg-panel-surface px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="text-2xl font-bold text-panel-text sm:text-3xl">Aylin'in Bugünü</h1>
            <p className="inline-flex w-fit items-center gap-2 rounded-full border border-panel-accent/35 bg-panel-accent-soft px-3 py-1 text-sm font-semibold text-panel-blue">
              <CalendarDays size={15} aria-hidden="true" />
              {formatDateLong(new Date())}
            </p>
          </div>
          <p className="mt-1 text-sm leading-6 text-panel-text-muted">Plan akışı, sıradaki görev ve veli aksiyonları.</p>
        </div>

        {onAddTask ? (
          <button
            type="button"
            onClick={onAddTask}
            className="inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-panel-blue px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-90 sm:w-auto"
          >
            <Plus size={17} aria-hidden="true" />
            Görev Ekle
          </button>
        ) : null}
      </div>
    </section>
  )
}

function RequestActions({ request, onApprove, onMessage, onSuggestOther, onPostpone }) {
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
      <button
        type="button"
        onClick={() => onApprove(request)}
        className="inline-flex h-9 items-center justify-center rounded-xl bg-panel-blue px-3 text-sm font-semibold text-white hover:opacity-90"
      >
        Onayla
      </button>
      <button
        type="button"
        onClick={() => onMessage(request)}
        className="inline-flex h-9 items-center justify-center rounded-xl border border-panel-border px-3 text-sm font-semibold text-panel-text hover:bg-panel-surface-soft"
      >
        Mesaj Gönder
      </button>
      <button
        type="button"
        onClick={() => onSuggestOther(request)}
        className="inline-flex h-9 items-center justify-center rounded-xl border border-panel-border px-3 text-sm font-semibold text-panel-text hover:bg-panel-surface-soft"
      >
        Başka Saat
      </button>
      <button
        type="button"
        onClick={() => onPostpone(request)}
        className="inline-flex h-9 items-center justify-center rounded-xl border border-panel-border px-3 text-sm font-semibold text-panel-text-muted hover:bg-panel-surface-soft"
      >
        Ertele
      </button>
    </div>
  )
}

function TodaySidePanel({ requests, warnings, onApprove, onMessage, onSuggestOther, onPostpone }) {
  const pendingRequests = getPendingRequests(requests)
  const visibleWarnings = getVisibleBalanceWarnings(warnings)

  if (pendingRequests.length === 0 && visibleWarnings.length === 0) {
    return null
  }

  return (
    <aside className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-5 xl:self-start">
      {pendingRequests.length > 0 ? (
        <section className="panel-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase text-panel-text-muted">Öğrenci Talebi</p>
              <h2 className="mt-2 text-lg font-bold text-panel-text">{pendingRequests.length} bekleyen talep</h2>
            </div>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-panel-sage-soft text-panel-sage">
              <Sparkles size={18} aria-hidden="true" />
            </span>
          </div>

          <div className="mt-4 flex flex-col gap-4">
            {pendingRequests.slice(0, 2).map((request) => (
              <div key={request.id} className="border-t border-panel-border pt-4 first:border-t-0 first:pt-0">
                <p className="text-sm font-medium leading-6 text-panel-text">{request.message}</p>
                <RequestActions
                  request={request}
                  onApprove={onApprove}
                  onMessage={onMessage}
                  onSuggestOther={onSuggestOther}
                  onPostpone={onPostpone}
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {visibleWarnings.length > 0 ? (
        <section className="panel-card p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-panel-accent-soft text-panel-warm">
              <AlertTriangle size={18} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase text-panel-text-muted">Plan Notu</p>
              <h2 className="mt-1 text-base font-semibold text-panel-text">Dikkat isteyen başlıklar</h2>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            {visibleWarnings.map((warning) => (
              <div key={warning.title} className="rounded-xl bg-panel-accent-soft px-4 py-3">
                <p className="text-sm font-bold text-panel-text">{warning.title}</p>
                <p className="mt-1 text-sm leading-6 text-panel-text-muted">{warning.message}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </aside>
  )
}

export default function DashboardPage() {
  const { authUser } = useAuth()
  const restricted = Boolean(authUser?.restricted)
  const [tasks, setTasks] = useState([])
  const [backlogTasks, setBacklogTasks] = useState([])
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [drawerState, setDrawerState] = useState(null)
  const [deletingTask, setDeletingTask] = useState(null)
  const [answerSheetTask, setAnswerSheetTask] = useState(null)
  const [schoolSchedule, setSchoolSchedule] = useState([])
  const [teacherLessonSchedule, setTeacherLessonSchedule] = useState([])
  const [banner, setBanner] = useState('')
  const bannerTimeoutRef = useRef(null)

  useEffect(() => {
    let ignore = false

    Promise.all([
      getTasksForDate(date),
      getBacklogTasks(date),
      getRequests(),
      getTeacherLessonSchedule().catch(() => []),
    ])
      .then(([tasksData, backlogTasksData, requestsData, teacherLessonScheduleData]) => {
        if (ignore) return
        setTasks(tasksData)
        setBacklogTasks(backlogTasksData)
        setRequests(requestsData)
        setTeacherLessonSchedule(teacherLessonScheduleData)
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

  // Mola süresi dolduğunda backend'i sistem olarak otomatik tamamlar (bkz. tasks.js
  // autoCompleteExpiredBreaks); burada periyodik yenileme yalnızca gün özeti ve
  // akışın taze kalmasını sağlar.
  useVisiblePolling(() => {
    getTasksForDate(date)
      .then((tasksData) => setTasks(tasksData))
      .catch(() => {})
    getBacklogTasks(date)
      .then((backlogTasksData) => setBacklogTasks(backlogTasksData))
      .catch(() => {})
  }, 30000)

  useEffect(() => {
    getSchoolSchedule()
      .then(setSchoolSchedule)
      .catch(() => setSchoolSchedule([]))
  }, [])

  useEffect(() => () => {
    if (bannerTimeoutRef.current) window.clearTimeout(bannerTimeoutRef.current)
  }, [])

  const showBanner = useCallback((text) => {
    if (bannerTimeoutRef.current) window.clearTimeout(bannerTimeoutRef.current)
    setBanner(text)
    bannerTimeoutRef.current = window.setTimeout(() => {
      setBanner('')
      bannerTimeoutRef.current = null
    }, 4000)
  }, [])

  const dashboardModel = useMemo(() => {
    const sortedTasks = getSortedTasks(tasks)
    return {
      balance: evaluateDayBalance(sortedTasks, { alreadySorted: true }),
    }
  }, [tasks])

  const dailyFlowTasks = useMemo(
    () => [...tasks, ...buildTeacherLessonTasksForDate(teacherLessonSchedule, date)],
    [tasks, teacherLessonSchedule],
  )

  const getExistingTasksForDrawer = useCallback(
    (targetDate) => (targetDate === date ? tasks : getTasksForDate(targetDate)),
    [tasks],
  )

  const handleSaveDrawerTask = async (taskData) => {
    const initialTask = drawerState?.initialTask
    if (initialTask && taskData.date === initialTask.date) {
      const updatedTask = await patchTask(initialTask.id, taskData)
      setTasks((current) => current.map((task) => (task.id === updatedTask.id ? updatedTask : task)))
    } else if (initialTask) {
      await removeTask(initialTask.id)
      const createdTask = await createTask(taskData.date, taskData)
      setTasks((current) => {
        const withoutInitialTask = current.filter((task) => task.id !== initialTask.id)
        return createdTask.date === date ? getSortedTasks([...withoutInitialTask, createdTask]) : withoutInitialTask
      })
    } else {
      const createdTask = await createTask(taskData.date, taskData)
      if (createdTask.date === date) {
        setTasks((current) => getSortedTasks([...current, createdTask]))
      }
    }
    setDrawerState(null)
    showBanner('Görev kaydedildi.')
  }

  const handleDeleteConfirmed = async () => {
    await removeTask(deletingTask.id)
    setTasks((current) => current.filter((task) => task.id !== deletingTask.id))
    setDeletingTask(null)
  }

  const handleApproveRequest = async (request) => {
    setRequests(await updateRequestStatus(request.id, 'onaylandi'))
    await sendMessage({ from: 'ebeveyn', text: 'İsteğini onayladım, planına yansıttım.' })
    showBanner('Talep onaylandı.')
  }

  const handleMessageRequest = async (request) => {
    await sendMessage({ from: 'ebeveyn', text: `"${request.message}" konusunu konuşalım.` })
    showBanner('Mesaj gönderildi.')
  }

  const handleSuggestOtherTime = async (request) => {
    setRequests(await updateRequestStatus(request.id, 'reddedildi'))
    await sendMessage({ from: 'ebeveyn', text: 'Başka bir saat önerdim, birlikte bakalım.' })
    showBanner('Alternatif saat mesajı gönderildi.')
  }

  const handlePostponeRequest = async (request) => {
    setRequests(await updateRequestStatus(request.id, 'ertelendi'))
  }

  if (loading) {
    return <LoadingState label="Panel yükleniyor..." />
  }

  const hasSidePanelContent =
    getPendingRequests(requests).length > 0 || getVisibleBalanceWarnings(dashboardModel.balance.warnings).length > 0

  return (
    <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-4">
      {loadError ? (
        <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{loadError}</div>
      ) : null}

      {banner ? (
        <div className="rounded-xl bg-panel-sage-soft px-4 py-3 text-base text-panel-text" role="status">
          {banner}
        </div>
      ) : null}

      <ParentHomeHeader
        onAddTask={restricted ? null : () => setDrawerState({ defaultDate: date })}
      />

      <div
        className={`grid gap-4 xl:items-start ${
          hasSidePanelContent ? 'xl:grid-cols-[minmax(0,1fr)_320px]' : 'xl:grid-cols-1'
        }`}
      >
        <DailyPlanTable
          tasks={dailyFlowTasks}
          backlogTasks={backlogTasks}
          onAddTask={restricted ? null : () => setDrawerState({ defaultDate: date })}
          onEdit={(task) => setDrawerState({ initialTask: task })}
          onDelete={(task) => setDeletingTask(task)}
          onOpenAnswerSheet={setAnswerSheetTask}
        />

        <TodaySidePanel
          requests={requests}
          warnings={dashboardModel.balance.warnings}
          onApprove={handleApproveRequest}
          onMessage={handleMessageRequest}
          onSuggestOther={handleSuggestOtherTime}
          onPostpone={handlePostponeRequest}
        />
      </div>

      {drawerState ? (
        <AddTaskDrawer
          initialTask={drawerState.initialTask}
          initialTemplate={drawerState.initialTemplate}
          defaultDate={drawerState.defaultDate}
          getExistingTasksForDate={getExistingTasksForDrawer}
          schoolSchedule={schoolSchedule}
          onSave={handleSaveDrawerTask}
          onClose={() => setDrawerState(null)}
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

      {answerSheetTask ? (
        <TaskAnswerSheetModal
          task={answerSheetTask}
          lessonLabel={answerSheetTask.subject || 'Görev'}
          photoMode="view"
          onClose={() => setAnswerSheetTask(null)}
          onSaved={(updatedTask) => {
            setTasks((prev) => prev.map((item) => (item.id === updatedTask.id ? updatedTask : item)))
            setAnswerSheetTask(updatedTask)
          }}
        />
      ) : null}
    </div>
  )
}
