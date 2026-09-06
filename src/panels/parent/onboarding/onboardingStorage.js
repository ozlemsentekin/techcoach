import { readJSON, writeJSON } from '../../../services/storage.js'

const KEY = 'parentOnboardingTour'
const LEGACY_KEY = 'parentWelcomeSeen'
const sessionStates = new Map()

export function hasSeenWelcome(parentId) {
  if (!parentId) return true
  return Boolean(sessionStates.has(parentId) || readJSON(KEY, {})?.[parentId] || readJSON(LEGACY_KEY, {})?.[parentId])
}

export function saveOnboardingState(parentId, status) {
  if (!parentId) return
  const value = { status, step: 1, updatedAt: new Date().toISOString() }
  sessionStates.set(parentId, value)
  // Private browsing / full storage must never block registration or closing the guide.
  try {
    writeJSON(KEY, { ...readJSON(KEY, {}), [parentId]: value })
  } catch { /* Keep the preference for this session when persistent storage is unavailable. */ }
}
