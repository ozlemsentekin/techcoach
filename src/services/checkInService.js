import { authRequest, cachedGet, invalidateCache } from './authClient'

/**
 * @typedef {Object} DailyCheckIn
 * @property {string} date
 * @property {string} energyLevel
 * @property {string} [note]
 */

/** @returns {Promise<DailyCheckIn|null>} */
export async function getCheckIn(date) {
  const data = await cachedGet(`/api/panel/check-in?date=${date}`)
  return data.checkIn
}

/** @returns {Promise<DailyCheckIn>} */
export async function saveCheckIn(date, { energyLevel, note }) {
  const data = await authRequest('/api/panel/check-in', {
    method: 'PUT',
    body: JSON.stringify({ date, energyLevel, note: note || '' }),
  })
  invalidateCache(`/api/panel/check-in?date=${date}`)
  return data.checkIn
}
