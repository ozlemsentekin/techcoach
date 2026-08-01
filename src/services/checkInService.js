import { authRequest } from './authClient'

/**
 * @typedef {Object} DailyCheckIn
 * @property {string} date
 * @property {string} energyLevel
 * @property {string} [note]
 */

/** @returns {Promise<DailyCheckIn|null>} */
export async function getCheckIn(date) {
  const data = await authRequest(`/api/panel/check-in?date=${date}`, { method: 'GET' })
  return data.checkIn
}

/** @returns {Promise<DailyCheckIn>} */
export async function saveCheckIn(date, { energyLevel, note }) {
  const data = await authRequest('/api/panel/check-in', {
    method: 'PUT',
    body: JSON.stringify({ date, energyLevel, note: note || '' }),
  })
  return data.checkIn
}
