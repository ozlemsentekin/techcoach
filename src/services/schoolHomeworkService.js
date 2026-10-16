import { authRequest, cachedGet } from './authClient'

/**
 * @typedef {Object} SchoolHomeworkItem
 * @property {string} id
 * @property {string} subjectName
 * @property {string} title
 * @property {string} description
 * @property {string | null} resourceName
 * @property {string | null} publisherName
 * @property {string | null} assignedDate Veriliş tarihi (YYYY-MM-DD).
 * @property {string | null} dueDate Planlandığı gün (YYYY-MM-DD); atanmamışsa null.
 * @property {string | null} completedAt
 * @property {string} status
 */

/**
 * Okul Ödevleri menüsü görünür mü? Veli için okul ödevi olan çocukların kimlikleri de döner.
 * @param {string} [userId] Önbellek anahtarını kullanıcıya bağlar (impersonate geçişleri).
 * @returns {Promise<{ enabled: boolean, studentIds: string[] }>}
 */
export function getSchoolHomeworkAccess(userId) {
  return cachedGet(`/api/panel/school-homeworks?access=1&user=${encodeURIComponent(userId || '')}`)
}

/**
 * Öğrencinin okul ödevi görevleri, veriliş tarihi azalan sırada.
 * @param {string} [studentId] Veli oturumunda hangi çocuğun verisi; öğrenci oturumunda yok sayılır.
 * @returns {Promise<SchoolHomeworkItem[]>}
 */
export async function getSchoolHomeworks(studentId) {
  const query = studentId ? `?studentId=${encodeURIComponent(studentId)}` : ''
  const data = await authRequest(`/api/panel/school-homeworks${query}`, { method: 'GET' })
  return data.items
}
