import { cachedGet } from './authClient'

export async function getProgressOverview(studentId) {
  const query = studentId ? `?studentId=${encodeURIComponent(studentId)}` : ''
  return cachedGet(`/api/panel/progress-overview${query}`)
}
