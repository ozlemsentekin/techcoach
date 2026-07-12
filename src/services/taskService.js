import { readJSON, writeJSON, hasKey, generateId } from './storage'
import { buildMondayDemoTasks } from '../data/mondayDemoData'
import { todayISODate } from '../utils/time'

function tasksKey(date) {
  return `tasks:${date}`
}

export function getTasksForDate(date) {
  const key = tasksKey(date)

  if (!hasKey(key) && date === todayISODate()) {
    const seeded = buildMondayDemoTasks()
    writeJSON(key, seeded)
    return seeded
  }

  return readJSON(key, [])
}

export function saveTasksForDate(date, tasks) {
  writeJSON(tasksKey(date), tasks)
  return tasks
}

export function updateTask(date, taskId, updates) {
  const tasks = getTasksForDate(date)
  const nextTasks = tasks.map((task) => (task.id === taskId ? { ...task, ...updates } : task))
  saveTasksForDate(date, nextTasks)
  return nextTasks
}

export function toggleSubGoal(date, taskId, subGoalIndex) {
  const tasks = getTasksForDate(date)
  const nextTasks = tasks.map((task) => {
    if (task.id !== taskId) return task
    const completed = new Set(task.completedSubGoals || [])
    if (completed.has(subGoalIndex)) {
      completed.delete(subGoalIndex)
    } else {
      completed.add(subGoalIndex)
    }
    return { ...task, completedSubGoals: Array.from(completed) }
  })
  saveTasksForDate(date, nextTasks)
  return nextTasks
}

/**
 * Görevi başka bir tarih/saate taşır: orijinal görev 'yeniden-planlandi' olarak işaretlenir,
 * hedef tarihte 'bekliyor' durumunda yeni bir görev oluşturulur (kaybolmaz).
 */
export function rescheduleTask(date, taskId, { newDate, newTime, reason }) {
  const tasks = getTasksForDate(date)
  const original = tasks.find((task) => task.id === taskId)
  if (!original) return { sourceTasks: tasks, targetTasks: getTasksForDate(newDate) }

  const durationMinutes = original.durationMinutes
  const [hours, minutes] = newTime.split(':').map(Number)
  const endMinutes = hours * 60 + minutes + durationMinutes
  const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`

  const rescheduledTask = {
    ...original,
    id: generateId('task'),
    date: newDate,
    startTime: newTime,
    endTime,
    status: 'bekliyor',
    rescheduledFrom: `${date} ${original.startTime}`,
    rescheduledTo: null,
    rescheduleReason: null,
    completedAt: null,
    completedQuestionCount: original.targetQuestionCount ? 0 : undefined,
  }

  const markedSourceTasks = tasks.map((task) =>
    task.id === taskId
      ? { ...task, status: 'yeniden-planlandi', rescheduledTo: `${newDate} ${newTime}`, rescheduleReason: reason }
      : task,
  )

  if (newDate === date) {
    const merged = [...markedSourceTasks, rescheduledTask]
    saveTasksForDate(date, merged)
    return { sourceTasks: merged, targetTasks: merged }
  }

  saveTasksForDate(date, markedSourceTasks)
  const targetTasks = [...getTasksForDate(newDate), rescheduledTask]
  saveTasksForDate(newDate, targetTasks)
  return { sourceTasks: markedSourceTasks, targetTasks }
}
