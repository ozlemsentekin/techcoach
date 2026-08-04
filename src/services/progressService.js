import { authRequest } from './authClient'

export async function getProgressOverview(studentId) {
  const query = studentId ? `?studentId=${encodeURIComponent(studentId)}` : ''
  return authRequest(`/api/panel/progress-overview${query}`, { method: 'GET' })
}
