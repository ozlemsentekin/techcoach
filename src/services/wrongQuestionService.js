import { readJSON, writeJSON, generateId } from './storage'

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

const KEY = 'wrongQuestions'

export function getWrongQuestions() {
  return readJSON(KEY, [])
}

export function addWrongQuestion(entry) {
  const items = getWrongQuestions()
  const record = {
    id: generateId('wrong'),
    createdAt: new Date().toISOString(),
    reviewStatus: 'tekrar-bekliyor',
    resolvedAt: null,
    ...entry,
  }
  writeJSON(KEY, [...items, record])
  return record
}

export function updateWrongQuestion(id, updates) {
  const items = getWrongQuestions()
  const next = items.map((item) => (item.id === id ? { ...item, ...updates } : item))
  writeJSON(KEY, next)
  return next
}
