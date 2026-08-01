import { getTasksForDate, postTask, patchTask, removeTask } from './taskService'
import { getHomeworks } from './homeworkService'
import { authRequest } from './authClient'
import { addDaysISO, getMondayOfWeek, parseTimeToMinutes } from '../utils/time'

/**
 * @typedef {'taslak'|'yayinlandi'|'guncellendi'|'arsivlendi'} PlanStatus
 */

const MAX_DAILY_ACADEMIC_MINUTES = 240
const STUDY_TASK_TYPES = new Set(['ders-calisma', 'test-cozme', 'konu-tekrari', 'odev', 'kisa-akademik', 'deneme-sinavi', 'yanlis-tekrari'])

/** Pazartesi başlangıçlı 7 günlük tarih dizisi döner. */
export function getWeekDates(weekStartDateISO) {
  return Array.from({ length: 7 }, (_, index) => addDaysISO(weekStartDateISO, index))
}

export async function getPlanStatus(weekStartDateISO) {
  const data = await authRequest(`/api/panel/weekly-plan-status?weekStart=${weekStartDateISO}`, { method: 'GET' })
  return data.status
}

export async function setPlanStatus(weekStartDateISO, status) {
  const data = await authRequest('/api/panel/weekly-plan-status', {
    method: 'PUT',
    body: JSON.stringify({ weekStart: weekStartDateISO, status }),
  })
  return data.status
}

/** Taslak varsa taslağı, yoksa canlı planı (başlangıç noktası olarak) döner. */
export async function getDraftTasksForDate(date) {
  const draft = await getTasksForDate(date, { isDraft: true })
  if (draft.length > 0) return draft
  return getTasksForDate(date, { isDraft: false })
}

export async function saveDraftTask(date, taskData) {
  return postTask({
    status: 'bekliyor',
    createdBy: 'ebeveyn',
    priority: 'orta',
    ...taskData,
    date,
    isDraft: true,
  })
}

export async function updateDraftTask(date, taskId, updates) {
  await patchTask(taskId, updates)
  return getTasksForDate(date, { isDraft: true })
}

export async function deleteDraftTask(date, taskId) {
  await removeTask(taskId)
  return getTasksForDate(date, { isDraft: true })
}

/** Taslağı olan her günü canlıya yazar ve haftanın durumunu 'yayinlandi' yapar. */
export async function publishWeek(weekStartDateISO) {
  const weekDates = getWeekDates(weekStartDateISO)

  for (const date of weekDates) {
    const draftTasks = await getTasksForDate(date, { isDraft: true })
    if (draftTasks.length === 0) continue

    const liveTasks = await getTasksForDate(date, { isDraft: false })
    await Promise.all(liveTasks.map((task) => removeTask(task.id)))
    await Promise.all(draftTasks.map((task) => patchTask(task.id, { isDraft: false })))
  }

  return setPlanStatus(weekStartDateISO, 'yayinlandi')
}

/** Bir önceki haftanın canlı görevlerini 7 gün kaydırıp bu haftanın taslağına yazar. */
export async function copyPreviousWeek(weekStartDateISO) {
  const previousWeekStart = addDaysISO(weekStartDateISO, -7)
  const previousWeekDates = getWeekDates(previousWeekStart)
  const weekDates = getWeekDates(weekStartDateISO)

  for (let index = 0; index < previousWeekDates.length; index += 1) {
    const sourceDate = previousWeekDates[index]
    const targetDate = weekDates[index]
    const sourceTasks = await getTasksForDate(sourceDate, { isDraft: false })
    const existingDraft = await getTasksForDate(targetDate, { isDraft: true })

    await Promise.all(existingDraft.map((task) => removeTask(task.id)))
    await Promise.all(
      sourceTasks.map((task) =>
        postTask({
          ...task,
          id: undefined,
          date: targetDate,
          isDraft: true,
          status: 'bekliyor',
          completedAt: null,
          completedQuestionCount: task.targetQuestionCount ? 0 : undefined,
          rescheduledFrom: null,
          rescheduledTo: null,
          rescheduleReason: null,
        }),
      ),
    )
  }

  await setPlanStatus(weekStartDateISO, 'taslak')
  return Promise.all(weekDates.map((date) => getTasksForDate(date, { isDraft: true })))
}

/**
 * Basit, düzenlenebilir bir haftalık taslak önerisi üretir: bekleyen ödevleri
 * hafta içine dağıtır, günlük azami akademik süreyi aşmamaya çalışır, mola/serbest
 * zaman bloğu olmayan günlere ekler. Sonuç yalnızca taslağa yazılır, canlıyı etkilemez.
 */
export async function suggestWeekPlan(weekStartDateISO) {
  const weekDates = getWeekDates(weekStartDateISO)
  const homeworks = await getHomeworks()
  const pendingHomeworks = homeworks.filter((homework) => homework.status !== 'tamamlandi')

  const dayMinutes = Object.fromEntries(weekDates.map((date) => [date, 0]))

  for (const homework of pendingHomeworks) {
    const remainingQuestions = homework.totalQuestionCount - homework.completedQuestionCount
    if (remainingQuestions <= 0) continue

    const targetDate = weekDates.find((date) => dayMinutes[date] < MAX_DAILY_ACADEMIC_MINUTES) || weekDates[0]
    const durationMinutes = Math.min(60, Math.max(20, remainingQuestions))
    const startMinutes = 16 * 60
    const endMinutes = startMinutes + durationMinutes

    await saveDraftTask(targetDate, {
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
  }

  for (const date of weekDates) {
    const tasks = await getDraftTasksForDate(date)
    const hasRestBlock = tasks.some((task) => ['mola', 'dinlenme', 'serbest-zaman'].includes(task.taskType))
    if (!hasRestBlock) {
      await saveDraftTask(date, {
        title: 'Serbest Zaman',
        description: 'Dinlenmek ve keyif aldığın şeyleri yapmak da planının bir parçası.',
        taskType: 'serbest-zaman',
        startTime: '18:00',
        endTime: '19:00',
        durationMinutes: 60,
      })
    }
  }

  await setPlanStatus(weekStartDateISO, 'taslak')
  return Promise.all(weekDates.map((date) => getDraftTasksForDate(date)))
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
