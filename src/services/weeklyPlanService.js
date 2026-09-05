import { getTasksForDateRange, postTask } from './taskService'
import { authRequest, cachedGet } from './authClient'
import { HOMEWORK_TASK_TYPES } from '../data/taskTypes'
import { addDaysISO, getMondayOfWeek, getWeekdayKey, parseTimeToMinutes } from '../utils/time'
import { isBacklogTask, isCompletedOnDate } from '../utils/backlogTasks'

const STUDY_TASK_TYPES = new Set([
  'ders-calisma',
  'test-cozme',
  'konu-tekrari',
  ...HOMEWORK_TASK_TYPES,
  'kisa-akademik',
  'deneme-sinavi',
  'yanlis-tekrari',
])

function durationBetween(startTime, endTime) {
  if (!startTime || !endTime) return 0
  const start = parseTimeToMinutes(startTime)
  const end = parseTimeToMinutes(endTime)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0
  return Math.max(0, end - start)
}

function normalizeTeacherLessonSchedule(teachers = []) {
  return teachers
    .filter((teacher) => teacher.type === 'ozel_ogretmen' && teacher.isActive !== false)
    .flatMap((teacher) =>
      (teacher.schedule || []).map((slot, index) => ({
        id: `teacher-lesson-${teacher.id}-${index}`,
        studentTeacherId: teacher.id,
        teacherFullName: teacher.fullName,
        subjectName: teacher.subjectName || null,
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        durationMinutes: durationBetween(slot.startTime, slot.endTime),
      })),
    )
}

/** Pazartesi başlangıçlı 7 günlük tarih dizisi döner. */
export function getWeekDates(weekStartDateISO) {
  return Array.from({ length: 7 }, (_, index) => addDaysISO(weekStartDateISO, index))
}

function groupTasksByDate(tasks, dates) {
  const tasksByDate = Object.fromEntries(dates.map((date) => [date, []]))
  tasks.forEach((task) => {
    if (tasksByDate[task.date]) tasksByDate[task.date].push(task)
  })
  return tasksByDate
}

export async function getWeekPlans(weekStartDateISO, { studentId } = {}) {
  const weekDates = getWeekDates(weekStartDateISO)
  const weekEndDateISO = weekDates[weekDates.length - 1]
  const tasks = await getTasksForDateRange(weekStartDateISO, weekEndDateISO, { studentId })
  return { tasksByDate: groupTasksByDate(tasks, weekDates) }
}

/**
 * Bugünden önceki (son `lookbackDays` gün içindeki) atandığı tarihte tamamlanmamış görevleri
 * döner — veli panelinin "Günün Akışı"nda "Biriken Görev" etiketiyle gösterilir.
 */
export async function getBacklogTasks(beforeDateISO, lookbackDays = 30, { studentId } = {}) {
  const fromDate = addDaysISO(beforeDateISO, -lookbackDays)
  const toDate = addDaysISO(beforeDateISO, -1)
  const tasks = await getTasksForDateRange(fromDate, toDate, { studentId })
  return tasks.filter(isBacklogTask)
}

/**
 * `onDateISO` gününden önce (son `lookbackDays` gün içinde) planlanmış ama o gün tamamlanmış
 * görevleri döner — "Günün Akışı"nın "Tamamlanan" sekmesinde, tarihi bugün olmayan ama bugün
 * kapatılan biriken görevleri de göstermek için kullanılır.
 */
export async function getTasksCompletedOn(onDateISO, lookbackDays = 30, { studentId } = {}) {
  const fromDate = addDaysISO(onDateISO, -lookbackDays)
  const toDate = addDaysISO(onDateISO, -1)
  const tasks = await getTasksForDateRange(fromDate, toDate, { studentId })
  return tasks.filter((task) => isCompletedOnDate(task, onDateISO))
}

/** Bir gün için yeni görev kaydeder — görev doğrudan canlı plana yazılır. */
export async function saveTaskForDay(date, taskData, { studentId } = {}) {
  return postTask(
    {
      status: 'bekliyor',
      priority: 'orta',
      // createdBy gönderilmez: sunucu oturumdan belirler (veli → ebeveyn, öğrenci → ogrenci).
      // taskData zaten bir createdBy taşıyorsa (kopyalama/yeniden planlama) o korunur.
      ...taskData,
      date,
    },
    studentId,
  )
}

/** Bir günün toplam akademik çalışma süresini (dakika) hesaplar. */
export function totalAcademicMinutes(tasks) {
  return tasks
    .filter((task) => STUDY_TASK_TYPES.has(task.taskType))
    .reduce((sum, task) => sum + (task.durationMinutes || 0), 0)
}

export function hasOverlap(tasks, startTime, endTime, excludeTaskId) {
  const start = parseTimeToMinutes(startTime)
  const end = parseTimeToMinutes(endTime)
  return tasks.some((task) => {
    if (task.id === excludeTaskId) return false
    if (!task.startTime || !task.endTime) return false
    const taskStart = parseTimeToMinutes(task.startTime)
    const taskEnd = parseTimeToMinutes(task.endTime)
    return start < taskEnd && end > taskStart
  })
}

/**
 * Öğrencinin okul ders programını döner. Okul + sınıf biliniyorsa saatler admin şablonundan
 * (SchoolClassSchedules) canlı türetilir; `holidays` okulun tatil/kapalı gün takvimidir
 * (SchoolCalendarEntries). Bu günlerde okul slotları planda gösterilmez ve o güne görev
 * eklenirken okul çakışması engeli uygulanmaz.
 * @returns {Promise<{ entries: any[], holidays: { startDate: string, endDate: string, name: string|null }[] }>}
 */
export async function getSchoolSchedule({ studentId } = {}) {
  const data = await cachedGet(studentId ? `/api/panel/school-schedule?studentId=${studentId}` : '/api/panel/school-schedule')
  return { entries: data.entries || [], holidays: data.holidays || [] }
}

/** Verilen tarih, okulun tatil takvimindeki bir aralığa (start/end dahil) denk geliyor mu? */
export function isSchoolHoliday(dateISO, holidays) {
  if (!dateISO || !holidays?.length) return false
  return holidays.some((entry) => dateISO >= entry.startDate && dateISO <= entry.endDate)
}

/** Öğrencinin özel öğretmenlerden gelen düzenli ders saatlerini döner (bkz. StudentTeachers.schedule_json). */
export async function getTeacherLessonSchedule({ studentId } = {}) {
  const data = await cachedGet(studentId ? `/api/panel/teachers?studentId=${studentId}` : '/api/panel/teachers')
  return normalizeTeacherLessonSchedule(data.teachers || [])
}

/** "Özel Ders" görev türü için Ders + Öğretmen seçimini besleyen, öğrencinin aktif özel öğretmenleri. */
export async function getPrivateLessonTeachers({ studentId } = {}) {
  const data = await cachedGet(studentId ? `/api/panel/teachers?studentId=${studentId}` : '/api/panel/teachers')
  return (data.teachers || []).filter((teacher) => teacher.type === 'ozel_ogretmen' && teacher.isActive !== false)
}

/**
 * Bir özel öğretmenin haftalık ders programındaki tek bir slotu (gün/saat/süre) değiştirir
 * ya da siler. Veli, StudentTeachers kaydının sahibidir (created_by_parent_id) — bu yüzden
 * mevcut PUT ucundan tüm schedule_json yeniden yazılır. Seri geneli etkiler (bu hafta / gelecek
 * haftalar hepsi). `removeSlot` true ise slot listeden çıkarılır.
 */
export async function updatePrivateLessonSlot(
  studentId,
  teacher,
  { originalDayOfWeek, originalStartTime, dayOfWeek, startTime, endTime, removeSlot = false },
) {
  const nextSchedule = (teacher.schedule || [])
    .map((slot) => {
      if (slot.dayOfWeek !== originalDayOfWeek || slot.startTime !== originalStartTime) return slot
      return removeSlot ? null : { dayOfWeek, startTime, endTime }
    })
    .filter(Boolean)

  const data = await authRequest(`/api/parent/students/${studentId}/teachers/${teacher.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      subjectId: teacher.subjectId,
      fullName: teacher.fullName,
      phone: teacher.phone,
      type: teacher.type,
      schedule: nextSchedule,
    }),
  })
  return data.teachers || []
}

/** Düzenli öğretmen derslerini öğrenci akışında gösterilecek salt okunur plan öğelerine çevirir. */
export function buildTeacherLessonTasksForDate(lessonSchedule, dateISO) {
  const dayOfWeek = getWeekdayKey(dateISO)

  return (lessonSchedule || [])
    .filter((slot) => slot.dayOfWeek === dayOfWeek && slot.startTime)
    .map((slot, index) => ({
      id: `${slot.id || 'teacher-lesson'}-${dateISO}-${index}`,
      date: dateISO,
      title: slot.subjectName ? `${slot.subjectName} Özel Ders` : 'Özel Ders',
      taskType: 'ders-calisma',
      subject: slot.subjectName || undefined,
      topic: slot.teacherFullName || undefined,
      startTime: slot.startTime,
      endTime: slot.endTime,
      durationMinutes: slot.durationMinutes || durationBetween(slot.startTime, slot.endTime),
      priority: 'orta',
      status: 'bekliyor',
      createdBy: 'ogretmen',
      isTeacherLessonSlot: true,
    }))
}

/**
 * Verilen tarih+saat aralığının, öğrencinin okul ders programındaki bir zaman dilimiyle
 * çakışıp çakışmadığını kontrol eder; çakışan girdiyi (varsa) döner. hasOverlap'ten farkı,
 * görev-görev çakışmasını değil görev-okul çakışmasını kontrol etmesi — bu haftalık planda
 * sert bir engel olarak kullanılır (bkz. AddTaskDrawer/AssignHomeworkModal).
 */
export function getSchoolScheduleConflict(schoolSchedule, dateISO, startTime, endTime, holidays) {
  if (!schoolSchedule?.length || !startTime || !endTime) return null
  if (isSchoolHoliday(dateISO, holidays)) return null

  const dayOfWeek = getWeekdayKey(dateISO)
  const start = parseTimeToMinutes(startTime)
  const end = parseTimeToMinutes(endTime)

  return (
    schoolSchedule.find((slot) => {
      if (slot.dayOfWeek !== dayOfWeek) return false
      if (slot.startDate && dateISO < slot.startDate) return false
      if (slot.endDate && dateISO > slot.endDate) return false
      const slotStart = parseTimeToMinutes(slot.startTime)
      const slotEnd = parseTimeToMinutes(slot.endTime)
      return start < slotEnd && end > slotStart
    }) || null
  )
}

export { getMondayOfWeek }
