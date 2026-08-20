import { authRequest } from './authClient'

/**
 * @typedef {Object} WrongQuestion
 * @property {string} id
 * @property {string} [taskId]
 * @property {string} [testId]
 * @property {string} subject
 * @property {string} [topic]
 * @property {string} [testName]
 * @property {string} [bookName]
 * @property {string} [publisherName]
 * @property {string} [bookImageUrl]
 * @property {string} [questionNumber]
 * @property {string} errorType
 * @property {string} [studentNote]
 * @property {string} [mistakeReason]  // 'dikkat-hatasi' | 'bilgi-eksikligi'
 * @property {string} createdAt
 * @property {string} reviewStatus  // 'tekrar-bekliyor' | 'bugun-tekrar' | 'tekrar-edildi' | 'ogrenildi'
 * @property {string|null} [resolvedAt]
 * @property {boolean} hasPhoto
 * @property {string} [photoUrl] Sadece foto kaydeden akışların döndürdüğü nesnelerde dolu gelir;
 * liste uçları (getWrongQuestions) performans için bunu hiç seçmez, bkz. getWrongQuestionPhoto.
 */

/**
 * @typedef {Object} WrongQuestionTopicStats
 * @property {string} subject
 * @property {string} [topic]
 * @property {number} totalAnswered
 * @property {number|null} successRate
 */

/**
 * @param {string} [studentId] Veli oturumunda hangi çocuğun verisini isteyeceğini belirtir;
 * öğrenci kendi oturumunda görmezden gelinir. Backend zaten `?studentId=` ile sahiplik
 * kontrolü yapıp doğru öğrenciye yönlendiriyor (bkz. api/src/studentScope.js).
 * @returns {Promise<WrongQuestion[]>}
 */
export async function getWrongQuestions(studentId) {
  const query = studentId ? `?studentId=${studentId}` : ''
  const data = await authRequest(`/api/panel/wrong-questions${query}`, { method: 'GET' })
  return data.wrongQuestions
}

/** @param {string} [studentId] @returns {Promise<WrongQuestionTopicStats[]>} */
export async function getWrongQuestionTopicStats(studentId) {
  const query = studentId ? `?studentId=${studentId}` : ''
  const data = await authRequest(`/api/panel/wrong-question-topic-stats${query}`, { method: 'GET' })
  return data.topicStats
}

/**
 * Bir sorunun tam base64 fotoğrafını tembel (lazy) çeker — galeri sadece o an gösterilen
 * fotoğraf için bunu çağırır, tüm listeyi tek seferde çekmenin getirdiği yavaşlığı önler.
 * @param {string} [studentId] @returns {Promise<string>} photoUrl
 */
export async function getWrongQuestionPhoto(id, studentId) {
  const query = studentId ? `?studentId=${studentId}` : ''
  const data = await authRequest(`/api/panel/wrong-questions/${id}/photo${query}`, { method: 'GET' })
  return data.photoUrl
}

/** @returns {Promise<WrongQuestion>} */
export async function addWrongQuestion(entry) {
  const data = await authRequest('/api/panel/wrong-questions', {
    method: 'POST',
    body: JSON.stringify(entry),
  })
  return data.wrongQuestion
}

/** @param {string} [studentId] @returns {Promise<WrongQuestion>} */
export async function updateWrongQuestion(id, updates, studentId) {
  const body = studentId ? { ...updates, studentId } : updates
  const data = await authRequest(`/api/panel/wrong-questions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  return data.wrongQuestion
}
