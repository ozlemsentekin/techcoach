import { TASK_TYPES } from '../data/taskTypes'
import { parseTimeToMinutes, taskTimeState } from './time'

const PENDING_STATUSES = new Set(['bekliyor', 'devam-ediyor', 'yardim-bekliyor'])

function compareByCreatedAt(a, b) {
  const createdA = a.createdAt || ''
  const createdB = b.createdAt || ''
  if (createdA === createdB) return 0
  return createdA < createdB ? -1 : 1
}

function getTaskTypeSortLabel(task) {
  return TASK_TYPES[task.taskType]?.label || task.taskType || ''
}

// Aynı saat diliminde (veya ikisi de saatsizse) görev tipine göre gruplu görünmesi için.
function compareByTaskType(a, b) {
  return getTaskTypeSortLabel(a).localeCompare(getTaskTypeSortLabel(b), 'tr-TR')
}

// Saati belirtilmemiş görevler, aynı gün içinde saati olan görevlerden önce gelir; kendi
// aralarında ve aynı saate sahip görevler arasında görev tipine göre gruplanır — bkz.
// AddTaskDrawer "saat isteğe bağlı".
export function compareTasksBySchedule(a, b) {
  const dateA = a.date || ''
  const dateB = b.date || ''
  if (dateA !== dateB) return dateA < dateB ? -1 : 1

  const hasTimeA = Boolean(a.startTime)
  const hasTimeB = Boolean(b.startTime)
  if (hasTimeA !== hasTimeB) return hasTimeA ? 1 : -1
  if (!hasTimeA) {
    const typeCompare = compareByTaskType(a, b)
    return typeCompare !== 0 ? typeCompare : compareByCreatedAt(a, b)
  }

  const timeDiff = parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime)
  return timeDiff !== 0 ? timeDiff : compareByTaskType(a, b)
}

export function isPendingTask(task) {
  return PENDING_STATUSES.has(task.status)
}

export function getSortedTasks(tasks) {
  return [...tasks].sort(compareTasksBySchedule)
}

export function getPendingTasks(tasks, { alreadySorted = false } = {}) {
  const pendingTasks = tasks.filter(isPendingTask)
  return alreadySorted ? pendingTasks : getSortedTasks(pendingTasks)
}

/** Sıradaki görev: henüz tamamlanmamış görevlerden kronolojik olarak ilki. */
export function getNextTask(tasks, options) {
  return getPendingTasks(tasks, options)[0] || null
}

/**
 * "Şu Anda" bandı: sıradaki görev henüz başlamadıysa, ama zaman dilimi şu an aktif olan
 * başka bekleyen bir görev varsa (örn. serbest zaman) onu döner.
 */
export function getCurrentTask(tasks, nextTask, options) {
  const pending = getPendingTasks(tasks, options)
  if (nextTask && taskTimeState(nextTask).phase === 'active') {
    return null
  }
  return pending.find((task) => task.id !== nextTask?.id && taskTimeState(task).phase === 'active') || null
}
