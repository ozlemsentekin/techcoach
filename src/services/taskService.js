import { authRequest } from './authClient'

function taskQuery(date, isDraft) {
  return `/api/panel/tasks?date=${date}&isDraft=${isDraft}`
}

/** @returns {Promise<object[]>} */
export async function getTasksForDate(date, { isDraft = false } = {}) {
  const data = await authRequest(taskQuery(date, isDraft), { method: 'GET' })
  return data.tasks
}

/** @returns {Promise<object>} */
export async function getTaskById(taskId) {
  const data = await authRequest(`/api/panel/tasks/${taskId}`, { method: 'GET' })
  return data.task
}

/** @returns {Promise<object>} */
export async function postTask(taskData) {
  const data = await authRequest('/api/panel/tasks', {
    method: 'POST',
    body: JSON.stringify(taskData),
  })
  return data.task
}

/** @returns {Promise<object>} */
export async function patchTask(taskId, updates) {
  const data = await authRequest(`/api/panel/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  })
  return data.task
}

export async function removeTask(taskId) {
  await authRequest(`/api/panel/tasks/${taskId}`, { method: 'DELETE' })
}

/** Öğrencinin görev üzerinde yaptığı sayaç, tamamlama ve ilerleme işlem kayıtları. */
export async function getTaskActivityLogs(date, { limit = 50 } = {}) {
  const data = await authRequest(`/api/panel/task-activity?date=${date}&limit=${limit}`, { method: 'GET' })
  return data.logs || []
}

/** Soru bankası görevinin dijital cevap kağıdı: testler, soru sayıları, kayıtlı cevaplar/sonuçlar. */
export async function getTaskAnswerSheet(taskId) {
  const data = await authRequest(`/api/panel/tasks/${taskId}/answer-sheet`, { method: 'GET' })
  return data.tests
}

/** Cevap kağıdındaki tek "Kaydet" butonu: görevdeki tüm testlerin o anki cevaplarını tek istekte gönderir. */
export async function saveTaskAnswers(taskId, tests) {
  const data = await authRequest(`/api/panel/tasks/${taskId}/answers`, {
    method: 'PATCH',
    body: JSON.stringify({ tests }),
  })
  return data.task
}

/** Ebeveyn panelinden yeni bir görev oluşturur (canlı plana doğrudan yazar). */
export async function createTask(date, taskData, { isDraft = false } = {}) {
  return postTask({
    status: 'bekliyor',
    createdBy: 'ebeveyn',
    priority: 'orta',
    ...taskData,
    date,
    isDraft,
  })
}

export async function updateTask(date, taskId, updates, { isDraft = false } = {}) {
  await patchTask(taskId, updates)
  return getTasksForDate(date, { isDraft })
}

export async function deleteTask(date, taskId, { isDraft = false } = {}) {
  await removeTask(taskId)
  return getTasksForDate(date, { isDraft })
}

export async function toggleSubGoal(date, taskId, subGoalIndex) {
  const task = await getTaskById(taskId)
  const completed = new Set(task.completedSubGoals || [])
  if (completed.has(subGoalIndex)) {
    completed.delete(subGoalIndex)
  } else {
    completed.add(subGoalIndex)
  }
  await patchTask(taskId, { completedSubGoals: Array.from(completed) })
  return getTasksForDate(date, { isDraft: task.isDraft })
}

/**
 * Görevi başka bir tarih/saate taşır: orijinal görev 'yeniden-planlandi' olarak işaretlenir,
 * hedef tarihte 'bekliyor' durumunda yeni bir görev oluşturulur (kaybolmaz).
 */
export async function rescheduleTask(date, taskId, { newDate, newTime, reason }) {
  const original = await getTaskById(taskId)
  const [hours, minutes] = newTime.split(':').map(Number)
  const endMinutes = hours * 60 + minutes + original.durationMinutes
  const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`

  await patchTask(taskId, {
    status: 'yeniden-planlandi',
    rescheduledTo: `${newDate} ${newTime}`,
    rescheduleReason: reason,
  })

  await postTask({
    ...original,
    id: undefined,
    date: newDate,
    startTime: newTime,
    endTime,
    status: 'bekliyor',
    rescheduledFrom: `${date} ${original.startTime}`,
    rescheduledTo: null,
    rescheduleReason: null,
    completedAt: null,
    completedQuestionCount: original.targetQuestionCount ? 0 : undefined,
    completedPageCount: original.targetPageCount ? 0 : undefined,
  })

  const sourceTasks = await getTasksForDate(date, { isDraft: original.isDraft })
  const targetTasks = newDate === date ? sourceTasks : await getTasksForDate(newDate, { isDraft: original.isDraft })
  return { sourceTasks, targetTasks }
}
