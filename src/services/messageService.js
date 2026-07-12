import { readJSON, writeJSON, generateId } from './storage'

/**
 * @typedef {Object} ParentMessage
 * @property {string} id
 * @property {string} from  // 'ebeveyn' | 'ogrenci'
 * @property {string} text
 * @property {string} createdAt
 * @property {string|null} readAt
 */

const KEY = 'messages'

export function getMessages() {
  return readJSON(KEY, [])
}

export function sendMessage({ from, text }) {
  const messages = getMessages()
  const record = {
    id: generateId('msg'),
    from,
    text,
    createdAt: new Date().toISOString(),
    readAt: null,
  }
  writeJSON(KEY, [...messages, record])
  return record
}

const COACH_NOTES_KEY = 'coachNotes'

export function getCoachNotes() {
  return readJSON(COACH_NOTES_KEY, [])
}

export function addCoachNote(text) {
  const notes = getCoachNotes()
  const record = { id: generateId('note'), text, createdAt: new Date().toISOString() }
  writeJSON(COACH_NOTES_KEY, [...notes, record])
  return record
}

export function markAllRead(from) {
  const messages = getMessages()
  const next = messages.map((message) =>
    message.from !== from && !message.readAt ? { ...message, readAt: new Date().toISOString() } : message,
  )
  writeJSON(KEY, next)
  return next
}
