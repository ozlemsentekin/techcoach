import { authRequest } from './authClient'

/**
 * @typedef {Object} ParentMessage
 * @property {string} id
 * @property {string} from  // 'ebeveyn' | 'ogrenci'
 * @property {string} text
 * @property {string} createdAt
 * @property {string|null} readAt
 */

/** @returns {Promise<ParentMessage[]>} */
export async function getMessages() {
  const data = await authRequest('/api/panel/messages', { method: 'GET' })
  return data.messages
}

/** @returns {Promise<ParentMessage>} */
export async function sendMessage({ from, text, studentId }) {
  const data = await authRequest('/api/panel/messages', {
    method: 'POST',
    body: JSON.stringify({ from, text, studentId }),
  })
  return data.message
}

export async function addCoachNote(text) {
  const data = await authRequest('/api/panel/coach-notes', {
    method: 'POST',
    body: JSON.stringify({ text }),
  })
  return data.note
}

/** @returns {Promise<ParentMessage[]>} */
export async function markAllRead(from) {
  await authRequest('/api/panel/messages/mark-read', {
    method: 'POST',
    body: JSON.stringify({ from }),
  })
  return getMessages()
}
