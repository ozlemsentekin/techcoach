import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../../context/useAuth'
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ListChecks,
  Plus,
  Sparkles,
} from 'lucide-react'
import { getTasksForDate, patchTask, createTask, removeTask } from '../../../services/taskService'
import { sendMessage } from '../../../services/messageService'
import { getRequests, updateRequestStatus } from '../../../services/studentRequestService'
import { evaluateDayBalance } from '../../../utils/planInsights'
import { getCurrentTask, getPendingTasks, getSortedTasks } from '../../../utils/taskSelectors'
import { formatDateLong, todayISODate } from '../../../utils/time'
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

function getTodayStats(plannedTasks, pendingTasks) {
  const completedCount = plannedTasks.filter((task) => task.status === 'tamamlandi').length
  const remainingCount = Math.max(0, plannedTasks.length - completedCount)
  const remainingMinutes = pendingTasks.reduce((sum, task) => sum + (task.durationMinutes || 0), 0)
  const completionRate = plannedTasks.length > 0 ? Math.round((completedCount / plannedTasks.length) * 100) : 0

  return {
    plannedCount: plannedTasks.length,
    completedCount,
    remainingCount,
    remainingMinutes,
    completionRate,
  }
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

function SummaryStat({ icon, label, value, tone = 'blue' }) {
  const Icon = icon
  const toneClassNames = {
    blue: 'bg-panel-blue-soft text-panel-blue',
    sage: 'bg-panel-sage-soft text-panel-sage',
    warm: 'bg-panel-accent-soft text-panel-warm',
    lilac: 'bg-panel-blue-soft text-panel-blue',
  }

  return (
    <div className="flex min-w-0 items-center gap-2 rounded-xl bg-panel-surface-soft/70 px-3 py-2.5">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${toneClassNames[tone]}`}>
        <Icon size={16} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-panel-text-muted">{label}</p>
        <p className="truncate text-base font-bold text-panel-text">{value}</p>
      </div>
    </div>
  )
}

function TodaySummaryCard({ stats, focusTask }) {
  return (
    <section className="panel-card overflow-hidden">
      <div className="border-b border-panel-border bg-panel-surface-soft/35 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-panel-text">Bugünün Özeti</h2>
          <span className="rounded-full bg-panel-blue-soft px-2.5 py-1 text-xs font-bold text-panel-blue">
            %{stats.completionRate}
          </span>
        </div>
      </div>

      <div className="p-4">
        <div className="h-2 overflow-hidden rounded-full bg-panel-border">
          <div className="h-full rounded-full bg-panel-accent" style={{ width: `${stats.completionRate}%` }} />
        </div>

        <div className="mt-4 grid gap-2">
          <SummaryStat icon={ListChecks} label="Planlanan" value={stats.plannedCount} />
          <SummaryStat icon={CheckCircle2} label="Tamamlanan" value={stats.completedCount} tone="sage" />
          <SummaryStat icon={Clock3} label="Kalan Süre" value={formatDuration(stats.remainingMinutes)} tone="warm" />
          <SummaryStat icon={AlertTriangle} label="Bekleyen" value={stats.remainingCount} tone="lilac" />
        </div>

        <div className="mt-4 rounded-xl border border-panel-border bg-panel-surface px-3 py-3">
          <p className="text-xs font-bold uppercase text-panel-text-muted">Sıradaki Odak</p>
          {focusTask ? (
            <>
              <p className="mt-1 line-clamp-2 text-sm font-semibold text-panel-text">{getTaskSummary(focusTask)}</p>
              <p className="mt-1 text-xs font-medium text-panel-text-muted">
                {focusTask.startTime} - {focusTask.endTime}
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-panel-text-muted">Bekleyen görev yok.</p>
          )}
        </div>
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

function TodaySidePanel({
  stats,
  focusTask,
  requests,
  warnings,
  onApprove,
  onMessage,
  onSuggestOther,
  onPostpone,
}) {
  const pendingRequests = getPendingRequests(requests)
  const visibleWarnings = getVisibleBalanceWarnings(warnings)

  return (
    <aside className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-5 xl:self-start">
      <TodaySummaryCard stats={stats} focusTask={focusTask} />

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
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [drawerState, setDrawerState] = useState(null)
  const [deletingTask, setDeletingTask] = useState(null)
  const [answerSheetTask, setAnswerSheetTask] = useState(null)
  const [banner, setBanner] = useState('')
  const bannerTimeoutRef = useRef(null)

  useEffect(() => {
    let ignore = false

    Promise.all([
      getTasksForDate(date),
      getRequests(),
    ])
      .then(([tasksData, requestsData]) => {
        if (ignore) return
        setTasks(tasksData)
        setRequests(requestsData)
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
  useEffect(() => {
    const interval = window.setInterval(() => {
      getTasksForDate(date)
        .then((tasksData) => setTasks(tasksData))
        .catch(() => {})
    }, 30000)
    return () => window.clearInterval(interval)
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
    const plannedTasks = sortedTasks.filter((task) => task.status !== 'yeniden-planlandi')
    const pendingTasks = getPendingTasks(plannedTasks, { alreadySorted: true })
    const nextTask = pendingTasks[0] || null
    const currentTask = getCurrentTask(pendingTasks, nextTask, { alreadySorted: true })

    return {
      balance: evaluateDayBalance(sortedTasks, { alreadySorted: true }),
      focusTask: currentTask || nextTask,
      todayStats: getTodayStats(plannedTasks, pendingTasks),
    }
  }, [tasks])

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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <DailyPlanTable
          tasks={tasks}
          onAddTask={restricted ? null : () => setDrawerState({ defaultDate: date })}
          onEdit={(task) => setDrawerState({ initialTask: task })}
          onDelete={(task) => setDeletingTask(task)}
          onOpenAnswerSheet={setAnswerSheetTask}
        />

        <TodaySidePanel
          stats={dashboardModel.todayStats}
          focusTask={dashboardModel.focusTask}
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
