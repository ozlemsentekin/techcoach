export function todayISODate() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function formatDateLong(date = new Date()) {
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' })
}

export function parseTimeToMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

export function nowMinutes() {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}

export function formatMinutesAsClock(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${String(hours).padStart(2, '0')}.${String(minutes).padStart(2, '0')}`
}

export function formatSecondsAsTimer(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function minutesUntil(targetTime) {
  return parseTimeToMinutes(targetTime) - nowMinutes()
}

export function taskTimeState(task) {
  const start = parseTimeToMinutes(task.startTime)
  const end = parseTimeToMinutes(task.endTime)
  const current = nowMinutes()

  if (current < start) {
    return { phase: 'upcoming', minutesUntilStart: start - current }
  }
  if (current >= start && current < end) {
    return { phase: 'active', minutesUntilEnd: end - current }
  }
  return { phase: 'past', minutesPast: current - end }
}
