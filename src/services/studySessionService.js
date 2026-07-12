import { readJSON, writeJSON, generateId } from './storage'

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

const KEY = 'studySessions'

export function getSessions() {
  return readJSON(KEY, [])
}

export function addSession(session) {
  const sessions = getSessions()
  const record = { id: generateId('session'), ...session }
  writeJSON(KEY, [...sessions, record])
  return record
}
