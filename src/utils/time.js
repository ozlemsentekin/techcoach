export function todayISODate() {
  return dateToISO(new Date())
}

export function dateToISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function addDaysISO(dateISO, days) {
  const date = new Date(dateISO)
  date.setDate(date.getDate() + days)
  return dateToISO(date)
}

/** Verilen tarihin içinde bulunduğu haftanın Pazartesi'sini (ISO) döner. */
export function getMondayOfWeek(dateISO) {
  const date = new Date(dateISO)
  const day = date.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  return addDaysISO(dateISO, diffToMonday)
}

export function formatDateShort(dateISO) {
  return new Date(dateISO).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
}

export function formatDateLong(date = new Date()) {
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' })
}

export function formatTime(date = new Date()) {
  return new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' }).format(date)
}

/** Saate göre karşılama metni ve ikon anahtarı döner: 0-11 günaydın, 12-16 tünaydın, 17-23 iyi akşamlar. */
export function getGreetingByHour(hour) {
  if (hour < 12) return { text: 'Günaydın', icon: 'sunrise' }
  if (hour < 17) return { text: 'Tünaydın', icon: 'sun' }
  return { text: 'İyi akşamlar', icon: 'moon' }
}

/** Gün başlangıcına normalize ederek hedef tarihe kalan gün sayısını döner (0=bugün, negatif=geçti). */
export function getRemainingDays(currentDate, targetDate) {
  const startOfToday = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate())
  const startOfTarget = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate())
  const diffMs = startOfTarget.getTime() - startOfToday.getTime()
  return Math.round(diffMs / (1000 * 60 * 60 * 24))
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
