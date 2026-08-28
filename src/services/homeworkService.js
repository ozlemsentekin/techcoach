import { authRequest } from './authClient'

/**
 * @typedef {Object} HomeworkDayPlan
 * @property {string} date
 * @property {number} questionCount
 *
 * @typedef {Object} Homework
 * @property {string} id
 * @property {string} subjectId
 * @property {string} subject
 * @property {string} [resourceBookId]
 * @property {string[]} [testIds]
 * @property {string} title
 * @property {string} [description]
 * @property {string} assignedDate
 * @property {string} dueDate
 * @property {number} totalQuestionCount
 * @property {number} completedQuestionCount
 * @property {number} [totalPageCount]
 * @property {string} priority
 * @property {string} status  // 'bekliyor' | 'devam-ediyor' | 'tamamlandi'
 * @property {boolean} isSplit
 * @property {HomeworkDayPlan[]} [dayPlans]
 * @property {boolean} hasTask
 * @property {string} [taskId]
 * @property {string} [taskDate]
 * @property {string} [taskStartTime]
 * @property {string} [taskEndTime]
 * @property {number} [taskDurationMinutes]
 */

/** @returns {Promise<Homework[]>} */
export async function getHomeworks() {
  const data = await authRequest('/api/panel/homeworks', { method: 'GET' })
  return data.homeworks
}

/** @returns {Promise<Homework>} */
export async function addHomework({
  subjectId,
  homeworkType,
  resourceBookId,
  schoolResourceId,
  testIds,
  title,
  description,
  assignedDate,
  dueDate,
  totalQuestionCount,
  totalPageCount,
  priority,
  taskDate,
  taskTime,
  taskDurationMinutes,
}) {
  const data = await authRequest('/api/panel/homeworks', {
    method: 'POST',
    body: JSON.stringify({
      subjectId,
      homeworkType,
      resourceBookId,
      schoolResourceId,
      testIds,
      title,
      description,
      assignedDate,
      dueDate,
      totalQuestionCount: Number(totalQuestionCount) || 0,
      totalPageCount: totalPageCount !== undefined ? Number(totalPageCount) || 0 : undefined,
      priority,
      taskDate,
      taskTime,
      taskDurationMinutes,
    }),
  })
  return data.homework
}

/** @returns {Promise<Homework>} */
export async function updateHomework(id, updates) {
  const data = await authRequest(`/api/panel/homeworks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  })
  return data.homework
}

/** @returns {Promise<Homework>} */
export async function assignHomeworkTask(id, { date, startTime, durationMinutes }) {
  const data = await authRequest(`/api/panel/homeworks/${id}/task`, {
    method: 'PUT',
    body: JSON.stringify({ date, startTime, durationMinutes }),
  })
  return data.homework
}

/** @returns {Promise<void>} */
export async function deleteHomework(id) {
  await authRequest(`/api/panel/homeworks/${id}`, { method: 'DELETE' })
}
