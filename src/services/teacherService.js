import { authRequest, cachedGet, invalidateCache } from './authClient'

/** @returns {Promise<Array>} */
export async function getTeacherStudents(status = 'active') {
  const query = status ? `?status=${encodeURIComponent(status)}` : ''
  const data = await cachedGet(`/api/panel-teacher/students${query}`)
  return data.students
}

/** @returns {Promise<Object>} */
export async function getTeacherStudent(studentTeacherId) {
  const data = await authRequest(`/api/panel-teacher/students/${studentTeacherId}`, { method: 'GET' })
  return data.student
}

/**
 * Öğrencinin profilini döner. `canEditBasics` true ise (öğrenci bizzat bu öğretmen tarafından
 * eklenmişse) Temel Bilgiler alanları updateTeacherStudentProfile ile düzenlenebilir; aksi halde
 * bu bilgiler veli tarafından doldurulur ve öğretmen panelinden salt okunurdur.
 * @returns {Promise<{profile: Object|null, canEditBasics: boolean}>}
 */
export async function getTeacherStudentProfile(studentTeacherId) {
  return authRequest(`/api/panel-teacher/students/${studentTeacherId}/profile`, { method: 'GET' })
}

/** Öğretmenin bizzat eklediği bir öğrencinin Temel Bilgiler/Okul Bilgileri alanlarını günceller. */
export async function updateTeacherStudentProfile(
  studentTeacherId,
  { firstName, lastName, grade, birthDate, gender, phone, photoUrl, provinceId, districtId, schoolId },
) {
  const result = await authRequest(`/api/panel-teacher/students/${studentTeacherId}/profile`, {
    method: 'PUT',
    body: JSON.stringify({
      firstName,
      lastName,
      grade,
      birthDate: birthDate || null,
      gender: gender || null,
      phone: phone || null,
      // photoUrl yalnızca Temel Bilgiler adımından gönderilir; undefined ise sunucu mevcut
      // fotoğrafı korur (bkz. updateTeacherStudentProfileHandler).
      ...(photoUrl === undefined ? {} : { photoUrl: photoUrl || null }),
      provinceId: provinceId || null,
      districtId: districtId || null,
      schoolId: schoolId || null,
    }),
  })
  invalidateCache('/api/panel-teacher/students')
  return result
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

/** Öğretmenin branşlarını (ders id listesi) günceller. @returns {Promise<Array>} güncel teacherSubjectIds */
export async function updateTeacherSubjects(subjectIds) {
  const data = await authRequest('/api/panel-teacher/profile', {
    method: 'PATCH',
    body: JSON.stringify({ subjectIds }),
  })
  return data.teacherSubjectIds
}

/** Öğretmenin kendi panel kotasından doğrudan bir öğrenci eklemesini sağlar. */
export async function addTeacherStudent({ studentFullName, subjectId, grade, studentPhone, parentFullName, parentPhone }) {
  const result = await authRequest('/api/panel-teacher/students', {
    method: 'POST',
    body: JSON.stringify({ studentFullName, subjectId, grade, studentPhone, parentFullName, parentPhone }),
  })
  invalidateCache('/api/panel-teacher/students')
  return result
}

/** Sınıfı eksik kalmış bir öğrencinin sınıfını sonradan tanımlar/günceller (ör. kaynak atamada görünmesi için). */
export async function updateTeacherStudentGrade(studentTeacherId, grade) {
  const result = await authRequest(`/api/panel-teacher/students/${studentTeacherId}/grade`, {
    method: 'PATCH',
    body: JSON.stringify({ grade }),
  })
  invalidateCache('/api/panel-teacher/students')
  return result
}

/** Öğretmenin öğrenci bağlantısını aktif/pasif yapar. */
export async function updateTeacherStudentStatus(studentTeacherId, isActive) {
  const result = await authRequest(`/api/panel-teacher/students/${studentTeacherId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  })
  invalidateCache('/api/panel-teacher/students')
  return result
}

/** Öğretmenin öğrenci bağlantısını kalıcı siler. */
export async function deleteTeacherStudent(studentTeacherId) {
  const result = await authRequest(`/api/panel-teacher/students/${studentTeacherId}`, { method: 'DELETE' })
  invalidateCache('/api/panel-teacher/students')
  return result
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

/** Tekrarlayan bir ders kuralının tek bir haftadaki oluşumunu, seriyi bozmadan başka tarih/saate taşır. */
export async function moveTeacherRecurringLessonOccurrence(
  studentTeacherId,
  { dayOfWeek, originalStartTime, originalDate, date, startTime, durationMinutes },
) {
  return authRequest(`/api/panel-teacher/students/${studentTeacherId}/lesson-plan/recurring/occurrence`, {
    method: 'PUT',
    body: JSON.stringify({ dayOfWeek, originalStartTime, originalDate, date, startTime, durationMinutes }),
  })
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

/** Öğretmenin bu öğrenciyle paylaştığı derse ait "özel" kaynakları listeler (Profil Kartı > Özel Kaynaklar). */
export async function getTeacherStudentPrivateResourceBooks(studentTeacherId) {
  return authRequest(`/api/panel-teacher/students/${studentTeacherId}/private-resource-books`, { method: 'GET' })
}

/** Bir kaynağı öğrenciye atar (idempotent). */
export async function assignTeacherLibraryResourceBook(studentTeacherId, resourceBookId) {
  return authRequest(`/api/panel-teacher/students/${studentTeacherId}/library/resource-books/${resourceBookId}`, {
    method: 'POST',
  })
}

/** Bir kaynağın öğrenciye atamasını geri alır (idempotent). */
export async function unassignTeacherLibraryResourceBook(studentTeacherId, resourceBookId) {
  return authRequest(`/api/panel-teacher/students/${studentTeacherId}/library/resource-books/${resourceBookId}`, {
    method: 'DELETE',
  })
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

/** @returns {Promise<Object>} */
export async function updateTeacherHomework(studentTeacherId, homeworkId, updates) {
  const data = await authRequest(`/api/panel-teacher/students/${studentTeacherId}/homeworks/${homeworkId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  })
  return data.homework
}

export async function deleteTeacherHomework(studentTeacherId, homeworkId) {
  await authRequest(`/api/panel-teacher/students/${studentTeacherId}/homeworks/${homeworkId}`, { method: 'DELETE' })
}

/** @returns {Promise<Array>} */
export async function getTeacherStudentTasksForDate(studentTeacherId, date) {
  const data = await authRequest(`/api/panel-teacher/students/${studentTeacherId}/tasks?date=${date}`, {
    method: 'GET',
  })
  return data.tasks
}

/** Öğrencinin okul ders saatleri + tatil takvimi — öğretmen takviminde "Okulda" kartları için. */
export async function getTeacherStudentSchoolSchedule(studentTeacherId) {
  const data = await authRequest(`/api/panel-teacher/students/${studentTeacherId}/school-schedule`, {
    method: 'GET',
  })
  return { entries: data.entries || [], holidays: data.holidays || [] }
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

/** @returns {Promise<import('./wrongQuestionService').WrongQuestionsResponse>} */
export async function getTeacherStudentWrongQuestions(studentTeacherId, resourceBookId) {
  const query = resourceBookId ? `?resourceBookId=${resourceBookId}` : ''
  const data = await authRequest(`/api/panel-teacher/students/${studentTeacherId}/wrong-questions${query}`, {
    method: 'GET',
  })
  return { wrongQuestions: data.wrongQuestions || [], bookImages: data.bookImages || {} }
}

/** @returns {Promise<import('./wrongQuestionService').WrongQuestionTopicStatsResponse>} */
export async function getTeacherStudentWrongQuestionTopicStats(studentTeacherId) {
  const data = await authRequest(`/api/panel-teacher/students/${studentTeacherId}/wrong-question-topic-stats`, {
    method: 'GET',
  })
  return { topicStats: data.topicStats || [], sourceTopicStats: data.sourceTopicStats || [] }
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
