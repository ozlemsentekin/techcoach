import { authRequest } from './authClient'

/** @returns {Promise<Array>} */
export async function getTeacherStudents() {
  const data = await authRequest('/api/panel-teacher/students', { method: 'GET' })
  return data.students
}

/** @returns {Promise<Array>} */
export async function getTeacherParents() {
  const data = await authRequest('/api/panel-teacher/parents', { method: 'GET' })
  return data.parents
}

/** @returns {Promise<Array>} */
export async function getTeacherLessonPlan() {
  const data = await authRequest('/api/panel-teacher/lesson-plan', { method: 'GET' })
  return data.entries
}

/** @returns {Promise<Array>} */
export async function getTeacherResourceBooks(studentTeacherId) {
  const data = await authRequest(`/api/panel-teacher/students/${studentTeacherId}/resource-books`, { method: 'GET' })
  return data.resourceBooks
}

/** @returns {Promise<Array>} */
export async function getTeacherResourceBookTopics(studentTeacherId, resourceBookId) {
  const data = await authRequest(
    `/api/panel-teacher/students/${studentTeacherId}/resource-book-topics?resourceBookId=${resourceBookId}`,
    { method: 'GET' },
  )
  return data.topics
}

/** @returns {Promise<Array>} */
export async function getTeacherStudentHomeworks(studentTeacherId) {
  const data = await authRequest(`/api/panel-teacher/students/${studentTeacherId}/homeworks`, { method: 'GET' })
  return data.homeworks
}

/** @returns {Promise<Object>} */
export async function addTeacherHomework(studentTeacherId, payload) {
  const data = await authRequest(`/api/panel-teacher/students/${studentTeacherId}/homeworks`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return data.homework
}

/** @returns {Promise<Object>} */
export async function assignTeacherHomeworkTask(studentTeacherId, homeworkId, { date, startTime, durationMinutes }) {
  const data = await authRequest(`/api/panel-teacher/students/${studentTeacherId}/homeworks/${homeworkId}/task`, {
    method: 'PUT',
    body: JSON.stringify({ date, startTime, durationMinutes }),
  })
  return data.homework
}

/** @returns {Promise<Array>} */
export async function getTeacherStudentTasksForDate(studentTeacherId, date) {
  const data = await authRequest(`/api/panel-teacher/students/${studentTeacherId}/tasks?date=${date}`, {
    method: 'GET',
  })
  return data.tasks
}

/** @returns {Promise<Object>} */
export async function getTeacherStudentProgressOverview(studentTeacherId) {
  return authRequest(`/api/panel-teacher/students/${studentTeacherId}/progress-overview`, { method: 'GET' })
}
