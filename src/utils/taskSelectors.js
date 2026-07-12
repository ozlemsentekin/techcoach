import { parseTimeToMinutes, taskTimeState } from './time'

const PENDING_STATUSES = new Set(['bekliyor', 'devam-ediyor', 'yardim-bekliyor'])

export function getSortedTasks(tasks) {
  return [...tasks].sort((a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime))
}

export function getPendingTasks(tasks) {
  return getSortedTasks(tasks.filter((task) => PENDING_STATUSES.has(task.status)))
}

/** Sıradaki görev: henüz tamamlanmamış görevlerden kronolojik olarak ilki. */
export function getNextTask(tasks) {
  return getPendingTasks(tasks)[0] || null
}

/**
 * "Şu Anda" bandı: sıradaki görev henüz başlamadıysa, ama zaman dilimi şu an aktif olan
 * başka bekleyen bir görev varsa (örn. serbest zaman) onu döner.
 */
export function getCurrentTask(tasks, nextTask) {
  const pending = getPendingTasks(tasks)
  if (nextTask && taskTimeState(nextTask).phase === 'active') {
    return null
  }
  return pending.find((task) => task.id !== nextTask?.id && taskTimeState(task).phase === 'active') || null
}
