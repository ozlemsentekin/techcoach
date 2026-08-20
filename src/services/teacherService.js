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

/** Veliye ilk kez panel erişimi açar (henüz giriş yapamıyorsa). @returns {Promise<{temporaryPassword: string}>} */
export async function grantParentAccess(parentId) {
  return authRequest(`/api/panel-teacher/parents/${parentId}/grant-access`, { method: 'POST' })
}

/** Öğretmenin panel kotasını (durum + toplam/kalan koltuk) döner. */
export async function getTeacherEntitlement() {
  const data = await authRequest('/api/panel-teacher/entitlement', { method: 'GET' })
  return data.entitlement
}

/** Öğretmenin kendi panel kotasından doğrudan bir öğrenci eklemesini sağlar. */
export async function addTeacherStudent({ studentFullName, subjectId, teacherType, parentFullName, parentPhone }) {
  return authRequest('/api/panel-teacher/students', {
    method: 'POST',
    body: JSON.stringify({ studentFullName, subjectId, teacherType, parentFullName, parentPhone }),
  })
}

/** Kütüphanede gösterilen sınıflar (öğrencilerden otomatik + elle eklenenler). @returns {Promise<{grades: string[], manualGrades: string[]}>} */
export async function getTeacherLibraryGrades() {
  return authRequest('/api/panel-teacher/library-grades', { method: 'GET' })
}

/** Öğretmenin kütüphanesine, öğrenci eklemeden elle bir sınıf ekler. @returns {Promise<{grades: string[], manualGrades: string[]}>} */
export async function addTeacherLibraryGrade(grade) {
  return authRequest('/api/panel-teacher/library-grades', {
    method: 'POST',
    body: JSON.stringify({ grade }),
  })
}

/** Elle eklenmiş bir sınıfı kütüphaneden kaldırır. @returns {Promise<{grades: string[], manualGrades: string[]}>} */
export async function removeTeacherLibraryGrade(grade) {
  return authRequest(`/api/panel-teacher/library-grades/${grade}`, { method: 'DELETE' })
}

/** @returns {Promise<{recurringEntries: Array, oneTimeEntries: Array}>} */
export async function getTeacherLessonPlan(weekStartISO) {
  const data = await authRequest(`/api/panel-teacher/lesson-plan?weekStart=${weekStartISO}`, { method: 'GET' })
  return { recurringEntries: data.recurringEntries, oneTimeEntries: data.oneTimeEntries }
}

/** Öğretmenin ders planına her hafta tekrar eden bir slot ekler. @returns {Promise<Array>} güncel recurringEntries */
export async function addTeacherRecurringLesson(studentTeacherId, { dayOfWeek, startTime, durationMinutes }) {
  const data = await authRequest(`/api/panel-teacher/students/${studentTeacherId}/lesson-plan/recurring`, {
    method: 'POST',
    body: JSON.stringify({ dayOfWeek, startTime, durationMinutes }),
  })
  return data.recurringEntries
}

/** Öğretmenin ders planına belirli bir tarihe özel, tek seferlik ders ekler. @returns {Promise<Object>} */
export async function addTeacherOneTimeLesson(studentTeacherId, { date, startTime, durationMinutes }) {
  const data = await authRequest(`/api/panel-teacher/students/${studentTeacherId}/lesson-plan/one-time`, {
    method: 'POST',
    body: JSON.stringify({ date, startTime, durationMinutes }),
  })
  return data.lesson
}

/** Her hafta tekrar eden bir ders slotunu günceller. @returns {Promise<Array>} güncel recurringEntries */
export async function updateTeacherRecurringLesson(studentTeacherId, { originalDayOfWeek, originalStartTime, dayOfWeek, startTime, durationMinutes }) {
  const data = await authRequest(`/api/panel-teacher/students/${studentTeacherId}/lesson-plan/recurring`, {
    method: 'PUT',
    body: JSON.stringify({ originalDayOfWeek, originalStartTime, dayOfWeek, startTime, durationMinutes }),
  })
  return data.recurringEntries
}

/** Her hafta tekrar eden bir ders slotunu siler. @returns {Promise<Array>} güncel recurringEntries */
export async function deleteTeacherRecurringLesson(studentTeacherId, { dayOfWeek, startTime }) {
  const data = await authRequest(`/api/panel-teacher/students/${studentTeacherId}/lesson-plan/recurring`, {
    method: 'DELETE',
    body: JSON.stringify({ dayOfWeek, startTime }),
  })
  return data.recurringEntries
}

/** Tek seferlik bir dersi günceller. @returns {Promise<Array>} güncel oneTimeEntries */
export async function updateTeacherOneTimeLesson(studentTeacherId, lessonId, { date, startTime, durationMinutes }) {
  const data = await authRequest(`/api/panel-teacher/students/${studentTeacherId}/lesson-plan/one-time/${lessonId}`, {
    method: 'PUT',
    body: JSON.stringify({ date, startTime, durationMinutes }),
  })
  return data.oneTimeEntries
}

/** Tek seferlik bir dersi siler. */
export async function deleteTeacherOneTimeLesson(studentTeacherId, lessonId) {
  await authRequest(`/api/panel-teacher/students/${studentTeacherId}/lesson-plan/one-time/${lessonId}`, {
    method: 'DELETE',
  })
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

export async function markTeacherResourceBookTopicTestCompletion(studentTeacherId, testId, counts = {}) {
  return authRequest(`/api/panel-teacher/students/${studentTeacherId}/resource-book-topic-tests/${testId}/completion`, {
    method: 'PUT',
    body: JSON.stringify(counts),
  })
}

export async function unmarkTeacherResourceBookTopicTestCompletion(studentTeacherId, testId) {
  return authRequest(`/api/panel-teacher/students/${studentTeacherId}/resource-book-topic-tests/${testId}/completion`, {
    method: 'DELETE',
  })
}

export async function submitTeacherManualOpticalAnswers(studentTeacherId, testId, answers) {
  return authRequest(
    `/api/panel-teacher/students/${studentTeacherId}/resource-book-topic-tests/${testId}/optical-completion`,
    { method: 'PUT', body: JSON.stringify({ answers }) },
  )
}

export async function saveTeacherManualWrongQuestionPhoto(studentTeacherId, testId, orderNo, photoDataUrl) {
  return authRequest(`/api/panel-teacher/students/${studentTeacherId}/resource-book-topic-tests/${testId}/mistakes/${orderNo}`, {
    method: 'PUT',
    body: JSON.stringify({ photo: photoDataUrl }),
  })
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
export async function getTeacherTaskAnswerSheet(studentTeacherId, taskId) {
  return authRequest(`/api/panel-teacher/students/${studentTeacherId}/tasks/${taskId}/answer-sheet`, {
    method: 'GET',
  })
}

/** @returns {Promise<Object>} */
export async function getTeacherStudentProgressOverview(studentTeacherId) {
  return authRequest(`/api/panel-teacher/students/${studentTeacherId}/progress-overview`, { method: 'GET' })
}

/** @returns {Promise<import('./wrongQuestionService').WrongQuestion[]>} */
export async function getTeacherStudentWrongQuestions(studentTeacherId) {
  const data = await authRequest(`/api/panel-teacher/students/${studentTeacherId}/wrong-questions`, { method: 'GET' })
  return data.wrongQuestions
}

/** @returns {Promise<import('./wrongQuestionService').WrongQuestionTopicStats[]>} */
export async function getTeacherStudentWrongQuestionTopicStats(studentTeacherId) {
  const data = await authRequest(`/api/panel-teacher/students/${studentTeacherId}/wrong-question-topic-stats`, {
    method: 'GET',
  })
  return data.topicStats
}

/** @returns {Promise<string>} photoUrl */
export async function getTeacherStudentWrongQuestionPhoto(studentTeacherId, wrongQuestionId) {
  const data = await authRequest(`/api/panel-teacher/students/${studentTeacherId}/wrong-questions/${wrongQuestionId}/photo`, {
    method: 'GET',
  })
  return data.photoUrl
}

/** @returns {Promise<import('./wrongQuestionService').WrongQuestion>} */
export async function updateTeacherStudentWrongQuestion(studentTeacherId, wrongQuestionId, updates) {
  const data = await authRequest(`/api/panel-teacher/students/${studentTeacherId}/wrong-questions/${wrongQuestionId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  })
  return data.wrongQuestion
}
