import { dateToISO } from './time.js'

export function matchesMissingPhotoHistory(item, { completedOn, taskIds }, photos) {
  if (item.source !== 'task' || !taskIds.includes(item.taskId)) return false
  const completedAt = new Date(item.completedAt || item.occurredAt)
  if (Number.isNaN(completedAt.getTime()) || dateToISO(completedAt) !== completedOn) return false
  const mistakes = (Number(item.wrong) || 0) + (Number(item.blank) || 0)
  const uploaded = new Set(photos.filter((photo) =>
    photo.taskId === item.taskId && photo.testId === item.testId && (photo.hasPhoto || photo.photoUrl),
  ).map((photo) => photo.questionNumber)).size
  return mistakes > uploaded
}
