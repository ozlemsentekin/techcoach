import { authRequest } from './authClient'

export async function getProgressOverview() {
  return authRequest('/api/panel/progress-overview', { method: 'GET' })
}
