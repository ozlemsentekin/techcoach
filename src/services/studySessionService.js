import { authRequest } from './authClient'

/**
 * @typedef {Object} StudySession
 * @property {string} id
 * @property {string} taskId
 * @property {string} startedAt
 * @property {string} endedAt
 * @property {number} durationMinutes
 * @property {number} completedQuestionCount
 * @property {number} [correctCount]
 * @property {number} [wrongCount]
 * @property {number} [blankCount]
 * @property {string} [difficultyRating]
 * @property {string} [emotion]
 * @property {string} [note]
 */

/** @returns {Promise<StudySession[]>} */
export async function getSessions() {
  const data = await authRequest('/api/panel/study-sessions', { method: 'GET' })
  return data.sessions
}

/** @returns {Promise<StudySession>} */
export async function addSession(session) {
  const data = await authRequest('/api/panel/study-sessions', {
    method: 'POST',
    body: JSON.stringify(session),
  })
  return data.session
}
