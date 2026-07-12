import { readJSON, writeJSON } from './storage'

/**
 * @typedef {Object} DailyCheckIn
 * @property {string} date
 * @property {string} energyLevel
 * @property {string} [note]
 */

function checkInKey(date) {
  return `checkin:${date}`
}

export function getCheckIn(date) {
  return readJSON(checkInKey(date), null)
}

export function saveCheckIn(date, { energyLevel, note }) {
  const checkIn = { date, energyLevel, note: note || '' }
  writeJSON(checkInKey(date), checkIn)
  return checkIn
}
