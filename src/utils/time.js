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

// Haftalık tekrar eden programlarda (öğretmen/okul ders saatleri) günü Türkçe slug olarak
// saklama kuralı zaten var (bkz. StudentTeachers.schedule_json); Pazartesi başlangıçlı.
export const WEEKDAY_KEYS = ['pazartesi', 'sali', 'carsamba', 'persembe', 'cuma', 'cumartesi', 'pazar']

/** Verilen tarihin haftanın hangi gününe denk geldiğini Türkçe slug olarak döner. */
export function getWeekdayKey(dateISO) {
  const jsDay = new Date(dateISO).getDay()
  return WEEKDAY_KEYS[(jsDay + 6) % 7]
}

/** Verilen tarihin içinde bulunduğu ayın tüm günlerini (ISO) döner. */
export function getMonthDates(dateISO) {
  const date = new Date(dateISO)
  const year = date.getFullYear()
  const month = date.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  return Array.from({ length: daysInMonth }, (_, index) => dateToISO(new Date(year, month, index + 1)))
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

const DEFAULT_GREETING_RULES = [
  { label: 'Günaydın', endHour: 12 },
  { label: 'Tünaydın', endHour: 17 },
  { label: 'İyi akşamlar', endHour: 24 },
]

/** Verilen kurallardan (end_hour artan sırada) saate uyan ilkini, yoksa son kuralı döner. */
export function pickGreeting(rules, hour) {
  const sorted = [...rules].sort((a, b) => a.endHour - b.endHour)
  const match = sorted.find((rule) => hour < rule.endHour)
  return match || sorted[sorted.length - 1] || null
}

/** Admin panelinden yönetilen selamlama kuralları yüklenene kadar kullanılacak varsayılan. */
export function getGreetingByHour(hour) {
  return pickGreeting(DEFAULT_GREETING_RULES, hour)
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

/** "HH:MM" formatındaki saate dakika ekler/çıkarır, sonucu yine "HH:MM" olarak döner (24 saati taşırmaz). */
export function addMinutesToTime(time, minutesToAdd) {
  const totalMinutes = Math.max(0, parseTimeToMinutes(time) + minutesToAdd) % (24 * 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
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

/** Bir tarihin bugüne göre kaç tam gün geride kaldığını döner (henüz geçmediyse 0). */
export function daysLate(dateISO) {
  const today = todayISODate()
  if (!dateISO || dateISO >= today) return 0
  return Math.round((new Date(today) - new Date(dateISO)) / (1000 * 60 * 60 * 24))
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
