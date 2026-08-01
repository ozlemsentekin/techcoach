import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  getWeekDates,
  getDraftTasksForDate,
  saveDraftTask,
  updateDraftTask,
  deleteDraftTask,
  getPlanStatus,
  setPlanStatus,
  copyPreviousWeek,
  suggestWeekPlan,
  publishWeek,
} from '../../../services/weeklyPlanService'
import { evaluateDayBalance } from '../../../utils/planInsights'
import { addDaysISO, getMondayOfWeek, todayISODate } from '../../../utils/time'
import PageHeader from '../../layout/PageHeader'
import LoadingState from '../../shared/LoadingState'
import PlanBalanceCard from '../components/PlanBalanceCard'
import WeeklyPlannerGrid from '../components/WeeklyPlannerGrid'
import AddTaskDrawer from '../components/AddTaskDrawer'

const STATUS_LABELS = {
  taslak: 'Taslak',
  yayinlandi: 'Yayınlandı',
  guncellendi: 'Güncellendi',
  arsivlendi: 'Arşivlendi',
}

const STATUS_CLASSES = {
  taslak: 'bg-panel-lilac-soft text-panel-lilac',
  yayinlandi: 'bg-panel-sage-soft text-panel-sage',
  guncellendi: 'bg-panel-accent-soft text-panel-warm',
  arsivlendi: 'bg-panel-blue-soft text-panel-blue',
}

const currentWeekStart = getMondayOfWeek(todayISODate())

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
  const todaysBalance = evaluateDayBalance(tasksByDate[todayISODate()] || [])

  return (
    <div className="flex w-full flex-col gap-5">
      <PageHeader
        title="Aylin'in Haftasını Planla"
        subtitle="Dersleri, ödevleri, molaları ve serbest zamanı dengeli şekilde planla."
        actions={
          <span className={`rounded-full px-3 py-1.5 text-sm font-medium ${STATUS_CLASSES[status]}`}>
            {STATUS_LABELS[status]}
          </span>
        }
      />

      {banner ? (
        <div className="rounded-xl bg-panel-sage-soft px-4 py-3 text-base text-panel-text" role="status">
          {banner}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setWeekOffset((current) => current - 1)}
          className="rounded-xl border border-panel-border px-3 py-2 text-sm font-medium text-panel-text"
        >
          Önceki Hafta
        </button>
        <button
          type="button"
          onClick={() => setWeekOffset(0)}
          className="rounded-xl border border-panel-border px-3 py-2 text-sm font-medium text-panel-text"
        >
          Bu Hafta
        </button>
        <button
          type="button"
          onClick={() => setWeekOffset((current) => current + 1)}
          className="rounded-xl border border-panel-border px-3 py-2 text-sm font-medium text-panel-text"
        >
          Sonraki Hafta
        </button>

        <span className="mx-2 h-6 w-px bg-panel-border" aria-hidden="true" />

        <button
          type="button"
          onClick={async () => {
            await copyPreviousWeek(weekStart)
            await refresh()
            showBanner('Geçen hafta bu haftanın taslağına kopyalandı.')
          }}
          className="rounded-xl border border-panel-border px-3 py-2 text-sm font-medium text-panel-text"
        >
          Geçen Haftayı Kopyala
        </button>
        <button
          type="button"
          onClick={async () => {
            await suggestWeekPlan(weekStart)
            await refresh()
            showBanner('Basit bir plan önerisi oluşturuldu, dilediğin gibi düzenleyebilirsin.')
          }}
          className="rounded-xl border border-panel-border px-3 py-2 text-sm font-medium text-panel-text"
        >
          Otomatik Plan Öner
        </button>
        <button
          type="button"
          onClick={() => showBanner('Taslak kaydedildi.')}
          className="rounded-xl border border-panel-border px-3 py-2 text-sm font-medium text-panel-text"
        >
          Taslağı Kaydet
        </button>
        <button
          type="button"
          onClick={async () => {
            await publishWeek(weekStart)
            await refresh()
            showBanner('Plan yayınlandı. Aylin\'in ekranında yeni haftalık planın hazır.')
          }}
          className="rounded-xl bg-panel-blue px-3 py-2 text-sm font-semibold text-white"
        >
          Planı Yayınla
        </button>
      </div>

      {loadError ? (
        <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{loadError}</div>
      ) : null}

      {loading ? (
        <LoadingState label="Haftalık plan yükleniyor..." />
      ) : (
        <>
      <WeeklyPlannerGrid
        weekDates={weekDates}
        tasksByDate={tasksByDate}
        onAddTask={(date) => setDrawerState({ defaultDate: date })}
        onEditTask={(task) => setDrawerState({ initialTask: task })}
      />

      {allTasks.length > 0 ? <PlanBalanceCard warnings={todaysBalance.warnings} /> : null}

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
