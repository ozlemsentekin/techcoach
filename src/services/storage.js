const NAMESPACE = 'techcoach_demo:v1'

function fullKey(key) {
  return `${NAMESPACE}:${key}`
}

export function readJSON(key, fallback) {
  try {
    const raw = window.localStorage.getItem(fullKey(key))
    if (raw === null) {
      return fallback
    }
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

export function writeJSON(key, value) {
  window.localStorage.setItem(fullKey(key), JSON.stringify(value))
}
