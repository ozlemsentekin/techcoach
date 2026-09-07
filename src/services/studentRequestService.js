import { authRequest, cachedGet } from './authClient'

/**
 * @typedef {Object} StudentRequest
 * @property {string} id
 * @property {string} type  // 'saat-degisikligi' | 'erteleme' | 'genel'
 * @property {string} message
 * @property {string} [proposedDate]
 * @property {string} [proposedTime]
 * @property {string} createdAt
 * @property {string} status  // 'bekliyor' | 'onaylandi' | 'reddedildi' | 'ertelendi'
 */

/** @returns {Promise<StudentRequest[]>} */
export async function getRequests({ studentId } = {}) {
  const path = studentId ? `/api/panel/student-requests?studentId=${studentId}` : '/api/panel/student-requests'
  const data = await cachedGet(path, { ttlMs: 15000 })
  return data.requests
}

/** @returns {Promise<StudentRequest[]>} */
export async function updateRequestStatus(id, status, studentId) {
  const path = studentId ? `/api/panel/student-requests/${id}?studentId=${studentId}` : `/api/panel/student-requests/${id}`
  await authRequest(path, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
  return getRequests({ studentId })
}
