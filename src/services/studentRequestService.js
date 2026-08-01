import { authRequest } from './authClient'

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
export async function getRequests() {
  const data = await authRequest('/api/panel/student-requests', { method: 'GET' })
  return data.requests
}

/** @returns {Promise<StudentRequest[]>} */
export async function updateRequestStatus(id, status) {
  await authRequest(`/api/panel/student-requests/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
  return getRequests()
}
