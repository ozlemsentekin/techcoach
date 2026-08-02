import { authRequest } from './authClient'
import { addDaysISO } from '../utils/time'
import { calculateProgress } from '../utils/progress'
import { getPublicMotivationMessagePool } from './contentService'

/**
 * @typedef {Object} ParentMotivationMessage
 * @property {string} id
 * @property {string} [title]
 * @property {string} body
 * @property {string} displayDate  // ISO date, mesajın gösterileceği gün
 * @property {string} [expiresAt]  // ISO datetime
 * @property {string} priority     // 'normal' | 'high'
 * @property {boolean} isActive
 * @property {string} createdAt
 * @property {string|null} readAt
 */

const MAX_MANUAL_SWITCHES = 3

// ---- Ebeveyn mesajları ----

/** @returns {Promise<ParentMotivationMessage[]>} */
export async function getParentMessages() {
  const data = await authRequest('/api/panel/parent-messages', { method: 'GET' })
  return data.messages
}

/** @returns {Promise<ParentMotivationMessage>} */
export async function saveParentMessage({ title, body, displayDate, priority = 'normal', expiresAt, linkedTaskId }) {
  const data = await authRequest('/api/panel/parent-messages', {
    method: 'POST',
    body: JSON.stringify({ title: title || '', body, displayDate, expiresAt, linkedTaskId, priority }),
  })
  return data.message
}

/** @returns {Promise<ParentMotivationMessage[]>} */
export async function deactivateParentMessage(id) {
  await authRequest(`/api/panel/parent-messages/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive: false }),
  })
  return getParentMessages()
}

/** @returns {Promise<ParentMotivationMessage|null>} */
export async function getActiveParentMessage(dateISO) {
  const now = new Date().toISOString()
  const messages = await getParentMessages()
  const candidates = messages.filter(
    (message) => message.isActive && message.displayDate === dateISO && (!message.expiresAt || message.expiresAt >= now),
  )
  if (candidates.length === 0) return null

  candidates.sort((a, b) => (a.priority === b.priority ? 0 : a.priority === 'high' ? -1 : 1))
  const chosen = candidates[0]

  if (!chosen.readAt) {
    await authRequest(`/api/panel/parent-messages/${chosen.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ readAt: now }),
    })
    return { ...chosen, readAt: now }
  }

  return chosen
}

// ---- Öğrenci durumu ve kategori belirleme ----

export function getMotivationContext({ tasks = [], checkIn }) {
  const completed = tasks.filter((task) => task.status === 'tamamlandi').length
  const total = tasks.length
  const progress = calculateProgress(completed, total)
  const startedAny = tasks.some((task) => task.status !== 'bekliyor')
  const hasPartial = tasks.some((task) => task.status === 'kismen-tamamlandi')
  const hasHelpRequest = tasks.some((task) => task.status === 'yardim-bekliyor')

  const completedWithTime = tasks
    .filter((task) => task.completedAt)
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
  const lastSessionEmotion = completedWithTime[0]?.emotion || null

  return {
    energyLevel: checkIn?.energyLevel || null,
    completed,
    total,
    progress,
    startedAny,
    hasPartial,
    hasHelpRequest,
    lastSessionEmotion,
  }
}

export function determineMessageCategory(context) {
  const { energyLevel, progress, startedAny, hasPartial, hasHelpRequest, lastSessionEmotion } = context

  if (hasHelpRequest || lastSessionEmotion === 'Yardıma ihtiyacım var' || lastSessionEmotion === 'Kaygılandım') {
    return 'high_stress'
  }
  if (energyLevel === 'cok-yorgun' || energyLevel === 'biraz-yorgun') {
    return 'low_energy'
  }
  if (!startedAny) {
    return 'start_easy'
  }
  if (progress === 100) {
    return 'completed_day'
  }
  if (progress >= 75) {
    return 'strong_progress'
  }
  if (hasPartial) {
    return 'partial_completion'
  }
  if (startedAny) {
    return 'task_started'
  }
  return 'general'
}

async function pickRandomMessage(category, excludeId) {
  const messagePool = await getPublicMotivationMessagePool()
  const eligible = messagePool.filter((message) => message.category === category)
  const pool = eligible.length > 1 ? eligible.filter((message) => message.id !== excludeId) : eligible
  const source = pool.length > 0 ? pool : eligible
  return source[Math.floor(Math.random() * source.length)] || null
}

function toDisplayedSystemMessage(message) {
  return {
    id: message.id,
    source: 'system',
    label: 'Günün Mesajı',
    title: message.title,
    body: message.body,
    iconType: 'sparkle',
    isDismissible: false,
    createdAt: new Date().toISOString(),
    category: message.category,
  }
}

function toDisplayedParentMessage(message) {
  return {
    id: message.id,
    source: 'parent',
    label: 'Ebeveyninden bir mesaj 💛',
    title: message.title || undefined,
    body: message.body,
    iconType: 'heart',
    isDismissible: false,
    createdAt: message.createdAt,
  }
}

// ---- Günlük seçim kalıcılığı ----

async function getDailySelection(dateISO) {
  const data = await authRequest(`/api/panel/motivation-daily-selection?date=${dateISO}`, { method: 'GET' })
  return data.selection
}

async function saveDailySelection(dateISO, selection) {
  const data = await authRequest('/api/panel/motivation-daily-selection', {
    method: 'PUT',
    body: JSON.stringify({ date: dateISO, ...selection }),
  })
  return data.selection
}

/**
 * Ebeveyn mesajı varsa onu, yoksa öğrencinin güncel durumuna göre seçilmiş sistem
 * mesajını döndürür. Aynı gün içinde kategori değişmediği sürece aynı mesajı korur.
 */
export async function resolveDisplayedMotivationMessage(dateISO, { tasks, checkIn }) {
  const parentMessage = await getActiveParentMessage(dateISO)
  if (parentMessage) {
    return toDisplayedParentMessage(parentMessage)
  }

  const context = getMotivationContext({ tasks, checkIn })
  const category = determineMessageCategory(context)

  const cached = await getDailySelection(dateISO)
  if (cached && cached.category === category) {
    const messagePool = await getPublicMotivationMessagePool()
    const cachedMessage = messagePool.find((message) => message.id === cached.messageId)
    if (cachedMessage) {
      return toDisplayedSystemMessage(cachedMessage)
    }
  }

  const previousSelection = await getDailySelection(addDaysISO(dateISO, -1))
  const picked = await pickRandomMessage(category, previousSelection?.messageId)
  if (!picked) return null

  await saveDailySelection(dateISO, { messageId: picked.id, category, source: 'system' })
  return toDisplayedSystemMessage(picked)
}

export async function requestAnotherMessage(dateISO, { tasks, checkIn }) {
  const cached = await getDailySelection(dateISO)
  const usedCount = cached?.switchCount || 0
  if (usedCount >= MAX_MANUAL_SWITCHES) {
    return { message: null, switchesLeft: 0 }
  }

  const context = getMotivationContext({ tasks, checkIn })
  const category = determineMessageCategory(context)
  const picked = await pickRandomMessage(category, cached?.messageId)
  if (!picked) {
    return { message: null, switchesLeft: MAX_MANUAL_SWITCHES - usedCount }
  }

  await saveDailySelection(dateISO, { messageId: picked.id, category, source: 'system' })
  const data = await authRequest('/api/panel/motivation-daily-selection/switch', {
    method: 'POST',
    body: JSON.stringify({ date: dateISO }),
  })

  return { message: toDisplayedSystemMessage(picked), switchesLeft: MAX_MANUAL_SWITCHES - data.selection.switchCount }
}

export async function getSwitchesLeft(dateISO) {
  const selection = await getDailySelection(dateISO)
  return Math.max(0, MAX_MANUAL_SWITCHES - (selection?.switchCount || 0))
}

// ---- Öğrenci geri bildirimi ----

export async function recordMotivationFeedback(messageId, reaction) {
  await authRequest('/api/panel/motivation-feedback', {
    method: 'POST',
    body: JSON.stringify({ messageId, reaction }),
  })
}
