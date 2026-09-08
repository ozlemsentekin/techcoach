import { authRequest } from './authClient'

/**
 * @typedef {Object} StudyHistoryItem
 * @property {string} key
 * @property {'task' | 'manual'} source
 * @property {string | null} occurredAt
 * @property {string | null} taskId
 * @property {string} [taskTitle]
 * @property {string} testId
 * @property {string} [resourceBookId]
 * @property {string} [publisherName]
 * @property {string} [resourceBookName]
 * @property {string} [subjectName]
 * @property {string} testName
 * @property {string} [topicName]
 * @property {number} [pageStart]
 * @property {number} [pageEnd]
 * @property {number} questionCount
 * @property {number} correct
 * @property {number} wrong
 * @property {number} blank
 * @property {number} successRate
 * @property {boolean} canViewAnswers
 * @property {Record<string, string>} [manualAnswers]
 */

/**
 * Öğrencinin çözüp sonucu kaydedilmiş tüm testleri tarih-saat azalan sırada döner.
 * @param {string} [studentId] Veli oturumunda hangi çocuğun verisi; öğrenci oturumunda yok sayılır.
 * @returns {Promise<StudyHistoryItem[]>}
 */
export async function getStudyHistory(studentId) {
  const query = studentId ? `?studentId=${encodeURIComponent(studentId)}` : ''
  const data = await authRequest(`/api/panel/study-history${query}`, { method: 'GET' })
  return data.items
}
