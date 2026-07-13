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

  const [tasksByDate, setTasksByDate] = useState(() =>
    Object.fromEntries(weekDates.map((date) => [date, getDraftTasksForDate(date)])),
  )
  const [status, setStatus] = useState(() => getPlanStatus(weekStart))
  const [drawerState, setDrawerState] = useState(null)
  const [banner, setBanner] = useState('')

  const refresh = (nextWeekStart = weekStart) => {
    setTasksByDate(
      Object.fromEntries(getWeekDates(nextWeekStart).map((date) => [date, getDraftTasksForDate(date)])),
    )
    setStatus(getPlanStatus(nextWeekStart))
  }

  useEffect(() => {
    refresh(weekStart)
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

  const markUpdatedIfPublished = () => {
    if (status === 'yayinlandi') {
      setPlanStatus(weekStart, 'guncellendi')
      setStatus('guncellendi')
    }
  }

  const handleSaveDrawerTask = (taskData) => {
    const initialTask = drawerState?.initialTask
    if (initialTask && taskData.date === initialTask.date) {
      updateDraftTask(initialTask.date, initialTask.id, taskData)
    } else if (initialTask) {
      deleteDraftTask(initialTask.date, initialTask.id)
      saveDraftTask(taskData.date, taskData)
    } else {
      saveDraftTask(taskData.date, taskData)
    }
    refresh()
    markUpdatedIfPublished()
    setDrawerState(null)
    showBanner('Görev taslağa kaydedildi.')
  }

  const allTasks = weekDates.flatMap((date) => tasksByDate[date] || [])
  const todaysBalance = evaluateDayBalance(tasksByDate[todayISODate()] || [])

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
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
          onClick={() => {
            copyPreviousWeek(weekStart)
            refresh()
            showBanner('Geçen hafta bu haftanın taslağına kopyalandı.')
          }}
          className="rounded-xl border border-panel-border px-3 py-2 text-sm font-medium text-panel-text"
        >
          Geçen Haftayı Kopyala
        </button>
        <button
          type="button"
          onClick={() => {
            suggestWeekPlan(weekStart)
            refresh()
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
          onClick={() => {
            publishWeek(weekStart)
            refresh()
            showBanner('Plan yayınlandı. Aylin\'in ekranında yeni haftalık planın hazır.')
          }}
          className="rounded-xl bg-panel-blue px-3 py-2 text-sm font-semibold text-white"
        >
          Planı Yayınla
        </button>
      </div>

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
    </div>
  )
}
