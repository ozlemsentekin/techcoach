import { authRequest, cachedGet, invalidateCache } from './authClient'

/**
 * @typedef {Object} MockExamSubject
 * @property {string} id
 * @property {string} [subjectId]
 * @property {string} subjectName
 * @property {number} totalQuestions
 * @property {number} correct
 * @property {number} wrong
 * @property {number} blank
 * @property {number} net
 * @property {number} successRate
 * @property {number} photoCount
 * @property {{ id: string, questionNumber?: string, hasPhoto: boolean }[]} [questions] Sadece detay yanıtında.
 * @property {number} [score] Sınav kurumu puanı (isteğe bağlı "Detay" girişi).
 * @property {number} [branchRank] Şube sırası.
 * @property {number} [schoolRank] Okul sırası.
 * @property {number} [overallRank] Genel sıra.
 * @property {number} [classAvgScore] Sınıf ortalaması.
 * @property {number} [schoolAvgScore] Okul ortalaması.
 * @property {number} [turkeyAvgScore] Türkiye ortalaması.
 */

/**
 * @typedef {Object} MockExam
 * @property {string} id
 * @property {'brans' | 'genel' | 'etut'} kind
 * @property {string | null} examDate
 * @property {string} [title]
 * @property {string} [classLabel] Sınıf etiketi (ör. "8D").
 * @property {string} [schoolLabel] Okul adı.
 * @property {string} [createdByName]
 * @property {string} createdAt
 * @property {MockExamSubject[]} subjects
 * @property {number} totalQuestions
 * @property {number} totalCorrect
 * @property {number} totalWrong
 * @property {number} totalBlank
 * @property {number} net
 * @property {number} successRate
 */

const withStudent = (path, studentId) =>
  studentId ? `${path}${path.includes('?') ? '&' : '?'}studentId=${encodeURIComponent(studentId)}` : path

/** @param {string} [studentId] @returns {Promise<MockExam[]>} */
export async function getMockExams(studentId) {
  const data = await cachedGet(withStudent('/api/panel/mock-exams', studentId))
  return data.mockExams || []
}

/** @param {string} [studentId] @returns {Promise<MockExam>} */
export async function getMockExam(id, studentId) {
  const data = await cachedGet(withStudent(`/api/panel/mock-exams/${id}`, studentId))
  return data.mockExam
}

/**
 * @param {{ kind, examDate?, title?, subjects: object[], studentId? }} payload
 * @returns {Promise<MockExam>}
 */
export async function createMockExam(payload) {
  const data = await authRequest('/api/panel/mock-exams', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  invalidateCache('/api/panel/mock-exams')
  return data.mockExam
}

/** @returns {Promise<MockExam>} */
export async function updateMockExam(id, updates, studentId) {
  const body = studentId ? { ...updates, studentId } : updates
  const data = await authRequest(`/api/panel/mock-exams/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  invalidateCache('/api/panel/mock-exams')
  return data.mockExam
}

export async function deleteMockExam(id, studentId) {
  const body = studentId ? { studentId } : {}
  await authRequest(`/api/panel/mock-exams/${id}`, { method: 'DELETE', body: JSON.stringify(body) })
  invalidateCache('/api/panel/mock-exams')
}

/** @returns {Promise<MockExam>} yeni foto eklendikten sonraki güncel deneme detayı */
export async function addMockExamPhoto(mockExamId, subjectRowId, photoDataUrl, studentId) {
  const body = studentId ? { photo: photoDataUrl, studentId } : { photo: photoDataUrl }
  const data = await authRequest(`/api/panel/mock-exams/${mockExamId}/subjects/${subjectRowId}/photos`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  invalidateCache('/api/panel/mock-exams')
  return data.mockExam
}

export async function deleteMockExamPhoto(wrongQuestionId, studentId) {
  const body = studentId ? { studentId } : {}
  await authRequest(`/api/panel/mock-exams/photos/${wrongQuestionId}`, {
    method: 'DELETE',
    body: JSON.stringify(body),
  })
  invalidateCache('/api/panel/mock-exams')
}

/** Soru bazlı modda: belirli bir soruya fotoğraf ekler. @returns {Promise<MockExam>} */
export async function addMockExamQuestionPhoto(mockExamId, subjectRowId, questionRowId, photoDataUrl, studentId) {
  const body = studentId ? { photo: photoDataUrl, studentId } : { photo: photoDataUrl }
  const data = await authRequest(
    `/api/panel/mock-exams/${mockExamId}/subjects/${subjectRowId}/questions/${questionRowId}/photo`,
    { method: 'POST', body: JSON.stringify(body) },
  )
  invalidateCache('/api/panel/mock-exams')
  return data.mockExam
}

/** Ders için önceden girilmiş konu adlarını (autocomplete) döner. @returns {Promise<string[]>} */
export async function getMockExamTopicSuggestions(subjectName, studentId) {
  const params = new URLSearchParams({ subjectName })
  if (studentId) params.set('studentId', studentId)
  const data = await cachedGet(`/api/panel/mock-exams/topics?${params.toString()}`)
  return data.topics || []
}

/**
 * @typedef {Object} MockExamTopicStat
 * @property {string} topic
 * @property {number} total
 * @property {number} correct
 * @property {number} wrong
 * @property {number} blank
 * @property {number} successRate
 */

/** Öğrencinin tüm denemelerindeki soruları ders altında konu bazında toplar. */
export async function getMockExamTopicStats(studentId) {
  const data = await cachedGet(withStudent('/api/panel/mock-exams/topic-stats', studentId))
  return data.subjects || []
}

/** Deneme hata görselini tembel çeker (WrongQuestions satırı öğrencinin kendisine ait). */
export async function getMockExamPhoto(wrongQuestionId, studentId) {
  const data = await authRequest(
    withStudent(`/api/panel/wrong-questions/${wrongQuestionId}/photo`, studentId),
    { method: 'GET' },
  )
  return data.photoUrl
}
