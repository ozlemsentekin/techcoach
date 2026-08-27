import { getTasksForDate, getTasksForDateRange, postTask, patchTask, removeTask } from './taskService'
import { getHomeworks } from './homeworkService'
import { authRequest, cachedGet } from './authClient'
import { HOMEWORK_TASK_TYPES } from '../data/taskTypes'
import { addDaysISO, getMondayOfWeek, getWeekdayKey, parseTimeToMinutes } from '../utils/time'
import { isBacklogTask } from '../utils/backlogTasks'

/**
 * @typedef {'taslak'|'yayinlandi'|'guncellendi'|'arsivlendi'} PlanStatus
 */

const MAX_DAILY_ACADEMIC_MINUTES = 240
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

export async function getPlanStatus(weekStartDateISO) {
  const data = await authRequest(`/api/panel/weekly-plan-status?weekStart=${weekStartDateISO}`, { method: 'GET' })
  return data.status
}

export async function setPlanStatus(weekStartDateISO, status) {
  const data = await authRequest('/api/panel/weekly-plan-status', {
    method: 'PUT',
    body: JSON.stringify({ weekStart: weekStartDateISO, status }),
  })
  return data.status
}

async function fetchDayTasks(date) {
  const [draftTasks, liveTasks] = await Promise.all([
    getTasksForDate(date, { isDraft: true }),
    getTasksForDate(date, { isDraft: false }),
  ])
  return { draftTasks, liveTasks }
}

function groupTasksByDate(tasks, dates) {
  const tasksByDate = Object.fromEntries(dates.map((date) => [date, []]))
  tasks.forEach((task) => {
    if (tasksByDate[task.date]) tasksByDate[task.date].push(task)
  })
  return tasksByDate
}

async function fetchWeekTaskLists(weekStartDateISO) {
  const weekDates = getWeekDates(weekStartDateISO)
  const weekEndDateISO = weekDates[weekDates.length - 1]
  const [draftTasks, liveTasks] = await Promise.all([
    getTasksForDateRange(weekStartDateISO, weekEndDateISO, { isDraft: true }),
    getTasksForDateRange(weekStartDateISO, weekEndDateISO, { isDraft: false }),
  ])

  return {
    weekDates,
    draftTasks,
    liveTasks,
    draftTasksByDate: groupTasksByDate(draftTasks, weekDates),
    liveTasksByDate: groupTasksByDate(liveTasks, weekDates),
  }
}

export async function getWeekPlans(weekStartDateISO) {
  const { weekDates, draftTasksByDate, liveTasksByDate } = await fetchWeekTaskLists(weekStartDateISO)
  const tasksByDate = {}
  const dayStatusByDate = {}

  weekDates.forEach((date) => {
    const draftTasks = draftTasksByDate[date] || []
    const liveTasks = liveTasksByDate[date] || []
    tasksByDate[date] = [...liveTasks, ...draftTasks]
    dayStatusByDate[date] = draftTasks.length > 0 ? 'taslak' : liveTasks.length > 0 ? 'yayinlandi' : 'bos'
  })

  return { tasksByDate, dayStatusByDate }
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

/** Bir günün canlı görevlerini, varsa bekleyen taslak eklemeleriyle birlikte döner (taslak canlıyı gizlemez). */
export async function getDraftTasksForDate(date) {
  const { draftTasks, liveTasks } = await fetchDayTasks(date)
  return [...liveTasks, ...draftTasks]
}

/**
 * Bir günün gösterilecek görevlerini (canlı + bekleyen taslak) ve yayın durumunu döner:
 * 'taslak' (yayınlanmamış bekleyen ekleme/değişiklik var), 'yayinlandi' (tüm görevler canlı),
 * 'bos' (o gün için hiç görev yok).
 */
export async function getDayPlan(date) {
  const { draftTasks, liveTasks } = await fetchDayTasks(date)
  const status = draftTasks.length > 0 ? 'taslak' : liveTasks.length > 0 ? 'yayinlandi' : 'bos'
  return { tasks: [...liveTasks, ...draftTasks], status }
}

export async function cleanupUnlinkedHomeworkTasksForWeek(weekStartDateISO) {
  const { draftTasks, liveTasks } = await fetchWeekTaskLists(weekStartDateISO)
  const unlinkedHomeworkTasks = [...draftTasks, ...liveTasks].filter((task) => task.taskType === 'odev' && !task.homeworkId)

  await Promise.all(unlinkedHomeworkTasks.map((task) => removeTask(task.id)))
}

/**
 * Bir günün taslak görevlerini canlıya taşır. Var olan canlı görevlere DOKUNMAZ, silmez —
 * sadece taslakları canlıya ekleyerek senkronize eder (taslak yoksa hiçbir şey yapmaz).
 */
async function publishDayTasks(date) {
  const draftTasks = await getTasksForDate(date, { isDraft: true })
  if (draftTasks.length === 0) return
  await Promise.all(draftTasks.map((task) => patchTask(task.id, { isDraft: false })))
}

/** Tek bir günü yayınlar ve o günün güncel (canlı) halini döner. */
export async function publishDay(date) {
  await publishDayTasks(date)
  return getDayPlan(date)
}

/**
 * Bir gün için yeni görev kaydeder: gün zaten yayındaysa doğrudan canlıya yazar
 * (yayınlanmış bir günde yapılan değişiklik anında plana yansır), aksi halde taslağa yazar.
 */
export async function saveTaskForDay(date, taskData, dayStatus) {
  if (dayStatus === 'yayinlandi') {
    return postTask({
      status: 'bekliyor',
      createdBy: 'ebeveyn',
      priority: 'orta',
      ...taskData,
      date,
      isDraft: false,
    })
  }
  return saveDraftTask(date, taskData)
}

export async function saveDraftTask(date, taskData) {
  return postTask({
    status: 'bekliyor',
    createdBy: 'ebeveyn',
    priority: 'orta',
    ...taskData,
    date,
    isDraft: true,
  })
}

export async function updateDraftTask(date, taskId, updates) {
  await patchTask(taskId, updates)
  return getTasksForDate(date, { isDraft: true })
}

export async function deleteDraftTask(date, taskId) {
  await removeTask(taskId)
  return getTasksForDate(date, { isDraft: true })
}

/** Taslağı olan her günü canlıya yazar ve haftanın durumunu 'yayinlandi' yapar. */
export async function publishWeek(weekStartDateISO) {
  const { draftTasks } = await fetchWeekTaskLists(weekStartDateISO)
  await Promise.all(draftTasks.map((task) => patchTask(task.id, { isDraft: false })))

  return setPlanStatus(weekStartDateISO, 'yayinlandi')
}

/** Bir önceki haftanın canlı görevlerini 7 gün kaydırıp bu haftanın taslağına yazar. */
export async function copyPreviousWeek(weekStartDateISO) {
  const previousWeekStart = addDaysISO(weekStartDateISO, -7)
  const previousWeekDates = getWeekDates(previousWeekStart)
  const weekDates = getWeekDates(weekStartDateISO)
  const previousWeekEnd = previousWeekDates[previousWeekDates.length - 1]
  const weekEnd = weekDates[weekDates.length - 1]

  const [sourceTasks, existingDraftTasks] = await Promise.all([
    getTasksForDateRange(previousWeekStart, previousWeekEnd, { isDraft: false }),
    getTasksForDateRange(weekStartDateISO, weekEnd, { isDraft: true }),
  ])
  const sourceTasksByDate = groupTasksByDate(sourceTasks, previousWeekDates)

  await Promise.all(existingDraftTasks.map((task) => removeTask(task.id)))
  await Promise.all(
    previousWeekDates.flatMap((sourceDate, index) => {
      const targetDate = weekDates[index]
      return (sourceTasksByDate[sourceDate] || []).map((task) =>
        postTask({
          ...task,
          id: undefined,
          date: targetDate,
          isDraft: true,
          status: 'bekliyor',
          // Kopyalanan görev yeni bir haftanın taze kaydı: geçen haftaya ait tüm
          // ilerleme/teslim verisi (cevaplar, notlar, sonuçlar, eski ödev bağlantısı)
          // sıfırlanmalı — aksi halde soru bankası testleri "zaten değerlendirilmiş"
          // görünüp öğrenci bu haftaki testi bir daha çözemez (bkz. tasks.js
          // saveTaskAnswersHandler: `if (results[testId]) return`).
          homeworkId: undefined,
          completedAt: null,
          completedQuestionCount: task.targetQuestionCount ? 0 : undefined,
          completedPageCount: task.targetPageCount ? 0 : undefined,
          currentPageNumber: undefined,
          correctCount: undefined,
          wrongCount: undefined,
          blankCount: undefined,
          difficulty: undefined,
          emotion: undefined,
          notes: undefined,
          parentNote: undefined,
          reflectionAnswers: undefined,
          completedSubGoals: undefined,
          answers: undefined,
          testResults: undefined,
          rescheduledFrom: null,
          rescheduledTo: null,
          rescheduleReason: null,
        }),
      )
    }),
  )

  await setPlanStatus(weekStartDateISO, 'taslak')
  const copiedDraftTasks = await getTasksForDateRange(weekStartDateISO, weekEnd, { isDraft: true })
  const copiedDraftTasksByDate = groupTasksByDate(copiedDraftTasks, weekDates)
  return weekDates.map((date) => copiedDraftTasksByDate[date] || [])
}

/**
 * Basit, düzenlenebilir bir haftalık taslak önerisi üretir: bekleyen ödevleri
 * hafta içine dağıtır, günlük azami akademik süreyi aşmamaya çalışır, mola/serbest
 * zaman bloğu olmayan günlere ekler. Sonuç yalnızca taslağa yazılır, canlıyı etkilemez.
 */
export async function suggestWeekPlan(weekStartDateISO) {
  const weekDates = getWeekDates(weekStartDateISO)
  const homeworks = await getHomeworks()
  const pendingHomeworks = homeworks.filter((homework) => homework.status !== 'tamamlandi')

  const dayMinutes = Object.fromEntries(weekDates.map((date) => [date, 0]))

  for (const homework of pendingHomeworks) {
    const remainingQuestions = homework.totalQuestionCount - homework.completedQuestionCount
    if (remainingQuestions <= 0) continue

    const targetDate = weekDates.find((date) => dayMinutes[date] < MAX_DAILY_ACADEMIC_MINUTES) || weekDates[0]
    const durationMinutes = Math.min(60, Math.max(20, remainingQuestions))
    const startMinutes = 16 * 60
    const endMinutes = startMinutes + durationMinutes

    await saveDraftTask(targetDate, {
      title: `${homework.subject} Ödevi`,
      description: homework.title,
      subject: homework.subject,
      taskType: 'odev',
      startTime: '16:00',
      endTime: `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`,
      durationMinutes,
      targetQuestionCount: remainingQuestions,
      completedQuestionCount: 0,
    })
    dayMinutes[targetDate] += durationMinutes
  }

  for (const date of weekDates) {
    const tasks = await getDraftTasksForDate(date)
    const hasRestBlock = tasks.some((task) => ['mola', 'dinlenme', 'serbest-zaman'].includes(task.taskType))
    if (!hasRestBlock) {
      await saveDraftTask(date, {
        title: 'Serbest Zaman',
        description: 'Dinlenmek ve keyif aldığın şeyleri yapmak da planının bir parçası.',
        taskType: 'serbest-zaman',
        startTime: '18:00',
        endTime: '19:00',
        durationMinutes: 60,
      })
    }
  }

  await setPlanStatus(weekStartDateISO, 'taslak')
  return Promise.all(weekDates.map((date) => getDraftTasksForDate(date)))
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
export async function getPrivateLessonTeachers() {
  const data = await cachedGet('/api/panel/teachers')
  return (data.teachers || []).filter((teacher) => teacher.type === 'ozel_ogretmen' && teacher.isActive !== false)
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
      isDraft: false,
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
