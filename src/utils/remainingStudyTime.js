// Union of lesson intervals prevents duplicate/overlapping lessons being deducted twice.
export function remainingStudyTime({ nowMinutes, schoolDay, schoolEndTime, lessons }) {
  const start = schoolDay ? (schoolEndTime && schoolEndTime <= '14:00' ? 14 * 60 : 17 * 60) : 12 * 60
  const end = 22 * 60
  const from = Math.min(end, Math.max(start, nowMinutes))
  const minute = (time) => /^\d{2}:\d{2}$/.test(time || '') ? Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) : NaN
  const intervals = lessons.filter((lesson) => !['iptal', 'iptal-edildi', 'yeniden-planlandi'].includes(lesson.status)).map((lesson) => {
    const a = minute(lesson.startTime)
    const b = lesson.endTime ? minute(lesson.endTime) : a + Number(lesson.durationMinutes || 0)
    return [Math.max(from, a), Math.min(end, b)]
  }).filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && b > a).sort((a, b) => a[0] - b[0])
  let privateMinutes = 0
  let cursor = from
  for (const [a, b] of intervals) {
    privateMinutes += Math.max(0, b - Math.max(cursor, a))
    cursor = Math.max(cursor, b)
  }
  return { minutes: end - from - privateMinutes, privateMinutes, start }
}
