import { authRequest } from './authClient'

export async function addCoachNote(text) {
  const data = await authRequest('/api/panel/coach-notes', {
    method: 'POST',
    body: JSON.stringify({ text }),
  })
  return data.note
}
