import { readJSON, writeJSON, generateId } from './storage'

/**
 * @typedef {Object} HomeworkDayPlan
 * @property {string} date
 * @property {number} questionCount
 *
 * @typedef {Object} Homework
 * @property {string} id
 * @property {string} subject
 * @property {string} title
 * @property {string} [description]
 * @property {string} assignedDate
 * @property {string} dueDate
 * @property {number} [estimatedDurationMinutes]
 * @property {number} totalQuestionCount
 * @property {number} completedQuestionCount
 * @property {string} priority
 * @property {string} status  // 'bekliyor' | 'devam-ediyor' | 'tamamlandi'
 * @property {boolean} isSplit
 * @property {HomeworkDayPlan[]} [dayPlans]
 */

const KEY = 'homeworks'

export function getHomeworks() {
  return readJSON(KEY, [])
}

export function addHomework({ subject, title, description, assignedDate, dueDate, totalQuestionCount, priority, dayPlans }) {
  const homeworks = getHomeworks()
  const record = {
    id: generateId('hw'),
    subject,
    title,
    description: description || '',
    assignedDate,
    dueDate,
    totalQuestionCount: Number(totalQuestionCount) || 0,
    completedQuestionCount: 0,
    priority: priority || 'orta',
    status: 'bekliyor',
    isSplit: Boolean(dayPlans && dayPlans.length > 1),
    dayPlans: dayPlans || [],
  }
  writeJSON(KEY, [...homeworks, record])
  return record
}

export function updateHomework(id, updates) {
  const homeworks = getHomeworks()
  const next = homeworks.map((homework) => (homework.id === id ? { ...homework, ...updates } : homework))
  writeJSON(KEY, next)
  return next
}

/** Ödevi eşit parçalara bölerek günlere dağıtır (örn. 80 soru / 4 gün -> 20/20/20/20). */
export function splitQuestionsAcrossDays(totalQuestionCount, dates) {
  const perDay = Math.floor(totalQuestionCount / dates.length)
  const remainder = totalQuestionCount % dates.length
  return dates.map((date, index) => ({
    date,
    questionCount: perDay + (index < remainder ? 1 : 0),
  }))
}
