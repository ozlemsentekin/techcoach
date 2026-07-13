import { readJSON, writeJSON, hasKey, generateId } from './storage'
import { getTasksForDate, saveTasksForDate } from './taskService'
import { getHomeworks } from './homeworkService'
import { addDaysISO, getMondayOfWeek, parseTimeToMinutes } from '../utils/time'

/**
 * @typedef {'taslak'|'yayinlandi'|'guncellendi'|'arsivlendi'} PlanStatus
 */

const MAX_DAILY_ACADEMIC_MINUTES = 240
const STUDY_TASK_TYPES = new Set(['ders-calisma', 'test-cozme', 'konu-tekrari', 'odev', 'kisa-akademik', 'deneme-sinavi', 'yanlis-tekrari'])

function draftKey(date) {
  return `draftTasks:${date}`
}

function statusKey(weekStart) {
  return `planStatus:${weekStart}`
}

/** Pazartesi başlangıçlı 7 günlük tarih dizisi döner. */
export function getWeekDates(weekStartDateISO) {
  return Array.from({ length: 7 }, (_, index) => addDaysISO(weekStartDateISO, index))
}

export function getPlanStatus(weekStartDateISO) {
  return readJSON(statusKey(weekStartDateISO), null) || (hasAnyLiveTasks(weekStartDateISO) ? 'yayinlandi' : 'taslak')
}

function hasAnyLiveTasks(weekStartDateISO) {
  return getWeekDates(weekStartDateISO).some((date) => getTasksForDate(date).length > 0)
}

export function setPlanStatus(weekStartDateISO, status) {
  writeJSON(statusKey(weekStartDateISO), status)
  return status
}

export function getDraftTasksForDate(date) {
  if (!hasKey(draftKey(date))) {
    return getTasksForDate(date)
  }
  return readJSON(draftKey(date), [])
}

export function saveDraftTasksForDate(date, tasks) {
  writeJSON(draftKey(date), tasks)
  return tasks
}

export function saveDraftTask(date, taskData) {
  const tasks = getDraftTasksForDate(date)
  const task = {
    id: generateId('task'),
    date,
    status: 'bekliyor',
    createdBy: 'ebeveyn',
    priority: 'orta',
    ...taskData,
  }
  saveDraftTasksForDate(date, [...tasks, task])
  return task
}

export function updateDraftTask(date, taskId, updates) {
  const tasks = getDraftTasksForDate(date)
  const nextTasks = tasks.map((task) => (task.id === taskId ? { ...task, ...updates } : task))
  saveDraftTasksForDate(date, nextTasks)
  return nextTasks
}

export function deleteDraftTask(date, taskId) {
  const tasks = getDraftTasksForDate(date)
  const nextTasks = tasks.filter((task) => task.id !== taskId)
  saveDraftTasksForDate(date, nextTasks)
  return nextTasks
}

/** Taslağı olan her günü canlıya yazar ve haftanın durumunu 'yayinlandi' yapar. */
export function publishWeek(weekStartDateISO) {
  getWeekDates(weekStartDateISO).forEach((date) => {
    if (hasKey(draftKey(date))) {
      saveTasksForDate(date, getDraftTasksForDate(date))
    }
  })
  return setPlanStatus(weekStartDateISO, 'yayinlandi')
}

/** Bir önceki haftanın canlı görevlerini 7 gün kaydırıp bu haftanın taslağına yazar. */
export function copyPreviousWeek(weekStartDateISO) {
  const previousWeekStart = addDaysISO(weekStartDateISO, -7)
  getWeekDates(previousWeekStart).forEach((sourceDate, index) => {
    const targetDate = getWeekDates(weekStartDateISO)[index]
    const sourceTasks = getTasksForDate(sourceDate)
    const copiedTasks = sourceTasks.map((task) => ({
      ...task,
      id: generateId('task'),
      date: targetDate,
      status: 'bekliyor',
      completedAt: null,
      completedQuestionCount: task.targetQuestionCount ? 0 : undefined,
      rescheduledFrom: null,
      rescheduledTo: null,
      rescheduleReason: null,
    }))
    saveDraftTasksForDate(targetDate, copiedTasks)
  })
  setPlanStatus(weekStartDateISO, 'taslak')
  return getWeekDates(weekStartDateISO).map((date) => getDraftTasksForDate(date))
}

/**
 * Basit, düzenlenebilir bir haftalık taslak önerisi üretir: bekleyen ödevleri
 * hafta içine dağıtır, günlük azami akademik süreyi aşmamaya çalışır, mola/serbest
 * zaman bloğu olmayan günlere ekler. Sonuç yalnızca taslağa yazılır, canlıyı etkilemez.
 */
export function suggestWeekPlan(weekStartDateISO) {
  const weekDates = getWeekDates(weekStartDateISO)
  const pendingHomeworks = getHomeworks().filter((homework) => homework.status !== 'tamamlandi')

  const dayMinutes = Object.fromEntries(weekDates.map((date) => [date, 0]))

  pendingHomeworks.forEach((homework) => {
    const remainingQuestions = homework.totalQuestionCount - homework.completedQuestionCount
    if (remainingQuestions <= 0) return

    const targetDate = weekDates.find((date) => dayMinutes[date] < MAX_DAILY_ACADEMIC_MINUTES) || weekDates[0]
    const durationMinutes = Math.min(60, Math.max(20, remainingQuestions))
    const startMinutes = 16 * 60
    const endMinutes = startMinutes + durationMinutes

    saveDraftTask(targetDate, {
      title: `${homework.subject} Ödevi`,
      description: homework.title,
      subject: homework.subject,
      taskType: 'odev',
      startTime: '16:00',
      endTime: `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`,
      durationMinutes,
      targetQuestionCount: remainingQuestions,
      completedQuestionCount: 0,
    })
    dayMinutes[targetDate] += durationMinutes
  })

  weekDates.forEach((date) => {
    const tasks = getDraftTasksForDate(date)
    const hasRestBlock = tasks.some((task) => ['mola', 'dinlenme', 'serbest-zaman'].includes(task.taskType))
    if (!hasRestBlock) {
      saveDraftTask(date, {
        title: 'Serbest Zaman',
        description: 'Dinlenmek ve keyif aldığın şeyleri yapmak da planının bir parçası.',
        taskType: 'serbest-zaman',
        startTime: '18:00',
        endTime: '19:00',
        durationMinutes: 60,
      })
    }
  })

  setPlanStatus(weekStartDateISO, 'taslak')
  return weekDates.map((date) => getDraftTasksForDate(date))
}

/** Bir günün toplam akademik çalışma süresini (dakika) hesaplar. */
export function totalAcademicMinutes(tasks) {
  return tasks
    .filter((task) => STUDY_TASK_TYPES.has(task.taskType))
    .reduce((sum, task) => sum + (task.durationMinutes || 0), 0)
}

export function hasOverlap(tasks, startTime, endTime, excludeTaskId) {
  const start = parseTimeToMinutes(startTime)
  const end = parseTimeToMinutes(endTime)
  return tasks.some((task) => {
    if (task.id === excludeTaskId) return false
    const taskStart = parseTimeToMinutes(task.startTime)
    const taskEnd = parseTimeToMinutes(task.endTime)
    return start < taskEnd && end > taskStart
  })
}

export { getMondayOfWeek }
