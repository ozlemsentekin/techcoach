import { dateToISO } from './time.js'
import { calculateProgress } from './progress.js'

/** Akıştaki görevleri plan tarihinden bağımsız olarak tamamlanma gününe göre özetler. */
export function getDailyTaskSummary(tasks, dateISO) {
  const completedTasks = tasks.filter((task) => {
    if (task.status !== 'tamamlandi' || !task.completedAt) return false
    const completedAt = new Date(task.completedAt)
    return !Number.isNaN(completedAt.getTime()) && dateToISO(completedAt) === dateISO
  })
  const pendingTasks = tasks.filter((task) =>
    !task.isTeacherLessonSlot && !task.isScheduleSlot && !task.isSchoolSlot &&
    !['tamamlandi', 'yeniden-planlandi'].includes(task.status),
  )
  const completed = completedTasks.length
  const total = completed + pendingTasks.length
  return { pendingTasks, completedTasks, completed, total, progress: calculateProgress(completed, total) }
}
