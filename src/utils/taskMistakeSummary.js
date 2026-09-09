/** Bugün tamamlanan görevlerin yanlış/boş toplamı ve bu görevlere ait eksik görseller. */
export function getTaskMistakeSummary(tasks, photos) {
  let total = 0
  let missingPhotos = 0
  for (const task of tasks) {
    const results = Object.values(task.testResults || {}).filter(Boolean)
    const hasAggregate = [task.wrongCount, task.blankCount].some((value) => value != null)
    const mistakes = hasAggregate
      ? (Number(task.wrongCount) || 0) + (Number(task.blankCount) || 0)
      : results.reduce((sum, result) => sum + (Number(result.wrong) || 0) + (Number(result.blank) || 0), 0)
    total += mistakes
    if (photos) {
      const uploaded = new Set(photos
        .filter((photo) => photo.taskId === task.id && (photo.hasPhoto || photo.photoUrl))
        .map((photo) => `${photo.testId}:${photo.questionNumber}`)).size
      missingPhotos += Math.max(0, mistakes - uploaded)
    }
  }
  return { total, missingPhotos: photos ? missingPhotos : null }
}
