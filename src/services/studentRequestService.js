import { readJSON, writeJSON, hasKey, generateId } from './storage'

/**
 * @typedef {Object} StudentRequest
 * @property {string} id
 * @property {string} studentName
 * @property {string} type  // 'saat-degisikligi' | 'erteleme' | 'genel'
 * @property {string} message
 * @property {string} [proposedDate]
 * @property {string} [proposedTime]
 * @property {string} createdAt
 * @property {string} status  // 'bekliyor' | 'onaylandi' | 'reddedildi' | 'ertelendi'
 */

const KEY = 'studentRequests'

function seedIfEmpty() {
  if (hasKey(KEY)) return

  const now = new Date()
  now.setHours(now.getHours() - 2)

  writeJSON(KEY, [
    {
      id: generateId('req'),
      studentName: 'Aylin',
      type: 'saat-degisikligi',
      message: 'Salı günkü matematik testini 18.00’e almak istiyor.',
      proposedDate: null,
      proposedTime: '18:00',
      createdAt: now.toISOString(),
      status: 'bekliyor',
    },
  ])
}

export function getRequests() {
  seedIfEmpty()
  return readJSON(KEY, [])
}

export function updateRequestStatus(id, status) {
  const requests = getRequests()
  const next = requests.map((request) => (request.id === id ? { ...request, status } : request))
  writeJSON(KEY, next)
  return next
}
