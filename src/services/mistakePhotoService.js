import { authRequest } from './authClient'

export async function verifyMistakePhotoQuestionNumber(photoDataUrl, expectedQuestionNumber) {
  const data = await authRequest('/api/panel/mistake-photo/question-number-check', {
    method: 'POST',
    timeoutMs: 60000,
    body: JSON.stringify({ photo: photoDataUrl, expectedQuestionNumber }),
  })
  return data.verification
}
