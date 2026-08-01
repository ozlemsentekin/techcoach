import { authRequest } from './authClient'

/**
 * @typedef {Object} WrongQuestion
 * @property {string} id
 * @property {string} [taskId]
 * @property {string} subject
 * @property {string} [topic]
 * @property {string} [questionNumber]
 * @property {string} errorType
 * @property {string} [studentNote]
 * @property {string} createdAt
 * @property {string} reviewStatus  // 'tekrar-bekliyor' | 'bugun-tekrar' | 'tekrar-edildi' | 'ogrenildi'
 * @property {string|null} [resolvedAt]
 */

/** @returns {Promise<WrongQuestion[]>} */
export async function getWrongQuestions() {
  const data = await authRequest('/api/panel/wrong-questions', { method: 'GET' })
  return data.wrongQuestions
}

/** @returns {Promise<WrongQuestion>} */
export async function addWrongQuestion(entry) {
  const data = await authRequest('/api/panel/wrong-questions', {
    method: 'POST',
    body: JSON.stringify(entry),
  })
  return data.wrongQuestion
}

/** @returns {Promise<WrongQuestion>} */
export async function updateWrongQuestion(id, updates) {
  const data = await authRequest(`/api/panel/wrong-questions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  })
  return data.wrongQuestion
}
