import { daysLate } from './time'

// Mola/serbest zaman gibi türlerde "tamamlanma" kavramı anlamlı olmadığından biriken
// görev sayılmazlar (bkz. WeeklyPlannerGrid.jsx getHomeworkStatusIcon ile aynı ayrım).
const NON_BACKLOG_TASK_TYPES = new Set(['mola', 'dinlenme', 'yemek', 'yemek-dinlenme', 'serbest-zaman'])

/**
 * Görev, atandığı tarihte tamamlanmadan geride kaldıysa ("biriken görev") true döner.
 * Öğrenci panelindeki "Gecikti" mantığıyla aynı kural: gün geçmiş + durum tamamlandı/yeniden
 * planlandı değil (bkz. src/panels/student/components/TaskListCard.jsx isOverdueIncomplete).
 */
export function isBacklogTask(task) {
  if (!task || task.isScheduleSlot || task.isSchoolSlot) return false
  if (NON_BACKLOG_TASK_TYPES.has(task.taskType)) return false
  return daysLate(task.date) > 0 && !['tamamlandi', 'yeniden-planlandi'].includes(task.status)
}
