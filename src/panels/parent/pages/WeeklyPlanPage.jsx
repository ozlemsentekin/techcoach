import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarCheck, CalendarDays, ChevronLeft, ChevronRight, Clock3, Coffee, Copy, Info, Star } from 'lucide-react'
import {
  getWeekDates,
  getDraftTasksForDate,
  saveDraftTask,
  updateDraftTask,
  deleteDraftTask,
  getPlanStatus,
  setPlanStatus,
  copyPreviousWeek,
  totalAcademicMinutes,
} from '../../../services/weeklyPlanService'
import { addDaysISO, getMondayOfWeek, todayISODate } from '../../../utils/time'
import Button from '../../ui/Button'
import LoadingState from '../../shared/LoadingState'
import WeeklyPlannerGrid from '../components/WeeklyPlannerGrid'
import AddTaskDrawer from '../components/AddTaskDrawer'

const currentWeekStart = getMondayOfWeek(todayISODate())

const SUMMARY_ITEMS = {
  study: {
    icon: Clock3,
    label: 'Toplam çalışma süresi',
    iconClassName: 'bg-panel-blue-soft text-panel-blue',
  },
  break: {
    icon: Coffee,
    label: 'Planlanan mola',
    iconClassName: 'bg-panel-accent-soft text-panel-warm',
  },
  free: {
    icon: Star,
    label: 'Serbest zaman',
    iconClassName: 'bg-emerald-50 text-emerald-600',
  },
}

function formatSummaryDuration(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours > 0 && minutes > 0) return `${hours}sa ${minutes}dk`
  if (hours > 0) return `${hours}sa`
  return `${minutes}dk`
}

function getWeekSummary(tasks) {
  const breakCount = tasks.filter((task) => ['mola', 'dinlenme'].includes(task.taskType)).length
  const freeMinutes = tasks
    .filter((task) => task.taskType === 'serbest-zaman')
    .reduce((sum, task) => sum + (task.durationMinutes || 0), 0)

  return {
    studyDuration: formatSummaryDuration(totalAcademicMinutes(tasks)),
    breakCount: `${breakCount} mola`,
    freeDuration: formatSummaryDuration(freeMinutes),
  }
}

function SummaryItem({ type, value }) {
  const item = SUMMARY_ITEMS[type]
  const Icon = item.icon

  return (
    <div className="flex min-w-0 items-center gap-4">
      <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${item.iconClassName}`}>
        <Icon size={28} strokeWidth={2.1} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-panel-blue">{item.label}</span>
        <span className="mt-1 block break-words text-2xl font-bold text-panel-text">{value}</span>
      </span>
    </div>
  )
}

export default function WeeklyPlanPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [weekOffset, setWeekOffset] = useState(0)
  const weekStart = addDaysISO(currentWeekStart, weekOffset * 7)
  const weekDates = getWeekDates(weekStart)

  const [tasksByDate, setTasksByDate] = useState({})
  const [status, setStatus] = useState('taslak')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [drawerState, setDrawerState] = useState(null)
  const [banner, setBanner] = useState('')

  const refresh = async (nextWeekStart = weekStart) => {
    const days = getWeekDates(nextWeekStart)
    const lists = await Promise.all(days.map((date) => getDraftTasksForDate(date)))
    setTasksByDate(Object.fromEntries(days.map((date, index) => [date, lists[index]])))
    setStatus(await getPlanStatus(nextWeekStart))
  }

  useEffect(() => {
    let ignore = false
    setLoading(true)
    refresh(weekStart)
      .catch((err) => {
        if (!ignore) setLoadError(err.message)
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset])

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

  const markUpdatedIfPublished = async () => {
    if (status === 'yayinlandi') {
      await setPlanStatus(weekStart, 'guncellendi')
      setStatus('guncellendi')
    }
  }

  const handleSaveDrawerTask = async (taskData) => {
    const initialTask = drawerState?.initialTask
    if (initialTask && taskData.date === initialTask.date) {
      await updateDraftTask(initialTask.date, initialTask.id, taskData)
    } else if (initialTask) {
      await deleteDraftTask(initialTask.date, initialTask.id)
      await saveDraftTask(taskData.date, taskData)
    } else {
      await saveDraftTask(taskData.date, taskData)
    }
    await refresh()
    await markUpdatedIfPublished()
    setDrawerState(null)
    showBanner('Görev taslağa kaydedildi.')
  }

  const allTasks = weekDates.flatMap((date) => tasksByDate[date] || [])
  const weekSummary = getWeekSummary(allTasks)

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex min-w-0 items-start gap-4">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-panel-blue-soft text-panel-blue shadow-sm">
          <CalendarCheck size={34} strokeWidth={2.1} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h1 className="break-words text-3xl font-bold leading-tight text-panel-text">
            Aylin'in Haftasını Planla
          </h1>
          <p className="mt-1 text-base font-medium text-panel-blue">
            Dersleri, ödevleri, molaları ve serbest zamanı dengeli şekilde planla.
          </p>
        </div>
      </div>

      {banner ? (
        <div className="rounded-xl bg-panel-sage-soft px-4 py-3 text-base text-panel-text" role="status">
          {banner}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={() => setWeekOffset((current) => current - 1)}
          className="h-11 border-panel-blue-soft px-4 text-sm font-semibold text-panel-text shadow-sm hover:bg-panel-blue-soft/50"
        >
          <ChevronLeft size={18} aria-hidden="true" />
          Önceki Hafta
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setWeekOffset(0)}
          className="h-11 border-panel-blue-soft px-4 text-sm font-semibold text-panel-text shadow-sm hover:bg-panel-blue-soft/50"
        >
          <CalendarDays size={18} aria-hidden="true" />
          Bu Hafta
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setWeekOffset((current) => current + 1)}
          className="h-11 border-panel-blue-soft px-4 text-sm font-semibold text-panel-text shadow-sm hover:bg-panel-blue-soft/50"
        >
          Sonraki Hafta
          <ChevronRight size={18} aria-hidden="true" />
        </Button>

        <span className="mx-1 hidden h-9 w-px bg-panel-border sm:block" aria-hidden="true" />

        <Button
          type="button"
          variant="secondary"
          onClick={async () => {
            await copyPreviousWeek(weekStart)
            await refresh()
            showBanner('Geçen hafta bu haftanın taslağına kopyalandı.')
          }}
          className="h-11 border-panel-blue-soft px-4 text-sm font-semibold text-panel-text shadow-sm hover:bg-panel-blue-soft/50"
        >
          <Copy size={18} aria-hidden="true" />
          Geçen Haftayı Kopyala
        </Button>
      </div>

      {loadError ? (
        <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{loadError}</div>
      ) : null}

      {loading ? (
        <LoadingState label="Haftalık plan yükleniyor..." />
      ) : (
        <>
          <div className="grid gap-5 rounded-2xl border border-panel-border bg-panel-surface px-5 py-4 shadow-sm sm:grid-cols-3 lg:px-10">
            <SummaryItem type="study" value={weekSummary.studyDuration} />
            <SummaryItem type="break" value={weekSummary.breakCount} />
            <SummaryItem type="free" value={weekSummary.freeDuration} />
          </div>

          <WeeklyPlannerGrid
            weekDates={weekDates}
            tasksByDate={tasksByDate}
            onAddTask={(date) => setDrawerState({ defaultDate: date })}
            onEditTask={(task) => setDrawerState({ initialTask: task })}
          />

          <div className="flex items-center gap-3 rounded-2xl bg-panel-blue-soft px-5 py-4 text-sm font-semibold text-panel-blue">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-panel-blue/30">
              <Info size={17} aria-hidden="true" />
            </span>
            <span>Görevler tamamlandıkça plan otomatik güncellenir.</span>
          </div>

          {drawerState ? (
            <AddTaskDrawer
              initialTask={drawerState.initialTask}
              defaultDate={drawerState.defaultDate}
              getExistingTasksForDate={(date) => tasksByDate[date] || getDraftTasksForDate(date)}
              onSave={handleSaveDrawerTask}
              onClose={() => setDrawerState(null)}
            />
          ) : null}
        </>
      )}
    </div>
  )
}
