import { authRequest } from './authClient'

export const MOTIVATION_CATEGORIES = [
  'general',
  'low_energy',
  'high_stress',
  'start_easy',
  'task_started',
  'partial_completion',
  'strong_progress',
  'completed_day',
]

// ---- Admin: motivasyon mesajı havuzu ----

export async function getMotivationMessagePool() {
  const data = await authRequest('/api/panel-admin/motivation-messages', { method: 'GET' })
  return data.messages
}

export async function createMotivationMessage({ category, title, body }) {
  const data = await authRequest('/api/panel-admin/motivation-messages', {
    method: 'POST',
    body: JSON.stringify({ category, title, body }),
  })
  return data.message
}

export async function updateMotivationMessage(id, { category, title, body, isActive }) {
  const data = await authRequest(`/api/panel-admin/motivation-messages/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ category, title, body, isActive }),
  })
  return data.message
}

// ---- Admin: selamlama kuralları ----

export async function getGreetingRules() {
  const data = await authRequest('/api/panel-admin/greeting-rules', { method: 'GET' })
  return data.rules
}

export async function createGreetingRule({ label, endHour }) {
  const data = await authRequest('/api/panel-admin/greeting-rules', {
    method: 'POST',
    body: JSON.stringify({ label, endHour }),
  })
  return data.rule
}

export async function updateGreetingRule(id, { label, endHour }) {
  const data = await authRequest(`/api/panel-admin/greeting-rules/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ label, endHour }),
  })
  return data.rule
}

export async function deleteGreetingRule(id) {
  await authRequest(`/api/panel-admin/greeting-rules/${id}`, { method: 'DELETE' })
}

// ---- Panel: salt-okunur, oturum sahibi herkes için ----
// Banner her render'ında bu içeriğe ihtiyaç duyduğundan, oturum başına bir kez
// çekilip modül seviyesinde cache'lenir.

let motivationMessagePoolPromise = null

export function getPublicMotivationMessagePool() {
  if (!motivationMessagePoolPromise) {
    motivationMessagePoolPromise = authRequest('/api/panel/motivation-message-pool', { method: 'GET' })
      .then((data) => data.messages)
      .catch((error) => {
        motivationMessagePoolPromise = null
        throw error
      })
  }
  return motivationMessagePoolPromise
}

let greetingRulesPromise = null

export function getPublicGreetingRules() {
  if (!greetingRulesPromise) {
    greetingRulesPromise = authRequest('/api/panel/greeting-rules', { method: 'GET' })
      .then((data) => data.rules)
      .catch((error) => {
        greetingRulesPromise = null
        throw error
      })
  }
  return greetingRulesPromise
}
