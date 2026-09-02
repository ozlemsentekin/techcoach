// Gelişim/analiz ham verisini (overview: tasks/sessions/homeworks/tests/manualTestCompletions/
// wrongQuestions) grafik ve kırılım satırlarına dönüştüren SAF yardımcılar. React/JSX içermez;
// hem tek-öğrenci görünümü (StudentProgressView.jsx) hem Sınıf Analizi (ClassAnalysisPage.jsx)
// aynı toplama mantığını buradan kullanır — davranış birebir aynı kalmalı.

import { calculateNet } from '../../utils/netCalculator'
import {
  addDaysISO,
  dateToISO,
  formatDateShort,
  getMondayOfWeek,
  getMonthDates,
} from '../../utils/time'

const collator = new Intl.Collator('tr-TR')
const numberFormatter = new Intl.NumberFormat('tr-TR')
const HIDDEN_SUBJECT_TAB_KEYS = new Set(['genel', 'online fen bilimleri'])

export function asNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

export function formatNumber(value) {
  return numberFormatter.format(Math.round(asNumber(value)))
}

export function formatNet(value) {
  const rounded = Math.round(asNumber(value) * 10) / 10
  return numberFormatter.format(rounded)
}

export function formatPercent(value) {
  if (!Number.isFinite(value)) return 'Veri yok'
  return `${Math.round(value)}%`
}

export function toDateKey(value) {
  if (!value) return ''
  // Salt tarih ("2026-08-19") olduğu gibi; zaman damgası ("...T22:14:36.846Z") ise
  // yerel güne çevrilir — aksi halde UTC'de gece geç işaretlenen kayıtlar bir gün
  // geriye kayıyordu (bkz. Aylin'in 5/8 Ağustos manuel test tamamlamaları).
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : dateToISO(date)
}

export function subjectLabel(item) {
  return item?.subjectName || item?.subject || 'Genel'
}

export function subjectKey(label) {
  return (label || 'Genel').trim().toLocaleLowerCase('tr-TR')
}

export function resourceLabel(item) {
  if (item?.resourceBookName) return item.resourceBookName
  if (item?.publisherName) return `${item.publisherName} kaynağı`
  return 'Kaynaksız çalışma'
}

export function publisherLabel(item) {
  return item?.publisherName || ''
}

// Kapak fotoğrafları artık her task/session/homework/manualTestCompletion satırında değil,
// resourceBookId'ye göre tek bir haritada (overview.resourceBookImages) geliyor — bkz.
// api/src/progress.js'deki fetchResourceBookImagesByIds yorumu (aynı görselin onlarca satırda
// tekrarlanmasını önlemek için, WrongQuestionsView'daki bookImages deseniyle aynı fikir).
export function resourceImageUrl(item, bookImages) {
  return (item?.resourceBookId && bookImages?.[item.resourceBookId]) || undefined
}

export function contentLabel(item) {
  return item?.topic || item?.taskTitle || item?.title || item?.description || 'Genel çalışma'
}

export function testTopicLabel(test, item) {
  return test?.topicName || item?.topic || contentLabel(item)
}

export function dateInRange(dateKey, rangeId, today) {
  if (!dateKey) return false
  if (rangeId === 'all') return true
  if (dateKey > today) return false
  if (rangeId === 'today') return dateKey === today
  if (rangeId === 'week') {
    const weekStart = getMondayOfWeek(today)
    return dateKey >= weekStart && dateKey <= today
  }
  if (rangeId === 'month') return dateKey.slice(0, 7) === today.slice(0, 7)
  return true
}

export function splitTestResults(item, testsById, bookImages, { idPrefix, minutes, source }) {
  const entries = Object.entries(item.testResults || {})
    .map(([testId, result]) => {
      const test = testsById.get(testId)
      const correct = asNumber(result?.correct)
      const wrong = asNumber(result?.wrong)
      const blank = asNumber(result?.blank)
      const questions = correct + wrong
      const topic = testTopicLabel(test, item)
      const testName = test?.name
      return {
        id: `${idPrefix}-${testId}`,
        taskId: item.taskId || item.id,
        sessionId: item.sessionId,
        homeworkId: item.homeworkId,
        date: toDateKey(item.startedAt || item.completedAt || item.date),
        subject: subjectLabel(item),
        content: testName ? `${topic} · ${testName}` : topic,
        contentGroup: topic,
        resource: resourceLabel(item),
        resourceImageUrl: resourceImageUrl(item, bookImages),
        publisher: publisherLabel(item),
        questions,
        correct,
        wrong,
        blank,
        weight: questions + blank || asNumber(test?.questionCount) || 1,
        source,
      }
    })
    .filter((record) => record.questions > 0 || record.blank > 0)

  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0)
  return entries.map(({ weight, ...entry }) => ({
    ...entry,
    minutes: totalWeight > 0 ? (asNumber(minutes) * weight) / totalWeight : 0,
  }))
}

export function buildActivityRecords(overview, testsById) {
  const records = []
  const taskIdsWithSessions = new Set()
  const bookImages = overview.resourceBookImages || {}

  ;(overview.sessions || []).forEach((session) => {
    if (session.taskId) taskIdsWithSessions.add(session.taskId)

    const detailedRecords = splitTestResults(
      { ...session, sessionId: session.id },
      testsById,
      bookImages,
      {
        idPrefix: `session-test-${session.id}`,
        minutes: asNumber(session.durationMinutes) || asNumber(session.taskDurationMinutes),
        source: 'session',
      },
    )
    if (detailedRecords.length) {
      records.push(...detailedRecords)
      return
    }

    records.push({
      id: `session-${session.id}`,
      sessionId: session.id,
      taskId: session.taskId,
      homeworkId: session.homeworkId,
      date: toDateKey(session.startedAt),
      subject: subjectLabel(session),
      content: contentLabel(session),
      contentGroup: contentLabel(session),
      resource: resourceLabel(session),
      resourceImageUrl: resourceImageUrl(session, bookImages),
      publisher: publisherLabel(session),
      questions: asNumber(session.completedQuestionCount),
      correct: asNumber(session.correctCount),
      wrong: asNumber(session.wrongCount),
      blank: asNumber(session.blankCount),
      minutes: asNumber(session.durationMinutes) || asNumber(session.taskDurationMinutes),
      source: 'session',
    })
  })

  ;(overview.tasks || []).forEach((task) => {
    if (taskIdsWithSessions.has(task.id)) return

    const detailedRecords = splitTestResults(task, testsById, bookImages, {
      idPrefix: `task-test-${task.id}`,
      minutes: task.durationMinutes,
      source: 'task',
    })
    if (detailedRecords.length) {
      records.push(...detailedRecords)
      return
    }

    const questions = asNumber(task.completedQuestionCount)
    const pages = asNumber(task.completedPageCount)
    const hasRecordedWork =
      questions > 0 ||
      pages > 0 ||
      asNumber(task.correctCount) > 0 ||
      asNumber(task.wrongCount) > 0

    if (!hasRecordedWork) return

    records.push({
      id: `task-${task.id}`,
      taskId: task.id,
      homeworkId: task.homeworkId,
      date: toDateKey(task.completedAt || task.date),
      subject: subjectLabel(task),
      content: contentLabel(task),
      contentGroup: contentLabel(task),
      resource: resourceLabel(task),
      resourceImageUrl: resourceImageUrl(task, bookImages),
      publisher: publisherLabel(task),
      questions,
      correct: asNumber(task.correctCount),
      wrong: asNumber(task.wrongCount),
      blank: asNumber(task.blankCount),
      minutes: asNumber(task.durationMinutes),
      source: 'task',
    })
  })

  ;(overview.manualTestCompletions || []).forEach((completion) => {
    const correct = asNumber(completion.correctCount)
    const wrong = asNumber(completion.wrongCount)
    const blank = asNumber(completion.blankCount)
    if (correct + wrong + blank <= 0) return

    const topic = completion.topicName || completion.testName || 'Genel çalışma'
    records.push({
      id: `manual-${completion.testId}`,
      date: toDateKey(completion.markedAt),
      subject: subjectLabel(completion),
      content: completion.testName ? `${topic} · ${completion.testName}` : topic,
      contentGroup: topic,
      resource: resourceLabel(completion),
      resourceImageUrl: resourceImageUrl(completion, bookImages),
      publisher: publisherLabel(completion),
      questions: correct + wrong,
      correct,
      wrong,
      blank,
      minutes: 0,
      source: 'manual',
    })
  })

  const homeworkIdsWithActivity = new Set(records.map((record) => record.homeworkId).filter(Boolean))
  ;(overview.homeworks || []).forEach((homework) => {
    if (homeworkIdsWithActivity.has(homework.id)) return

    const questions = asNumber(homework.completedQuestionCount)
    if (questions <= 0) return

    records.push({
      id: `homework-${homework.id}`,
      homeworkId: homework.id,
      date: toDateKey(homework.updatedAt || homework.dueDate || homework.assignedDate),
      subject: subjectLabel(homework),
      content: homework.title || contentLabel(homework),
      contentGroup: homework.title || contentLabel(homework),
      resource: resourceLabel(homework),
      resourceImageUrl: resourceImageUrl(homework, bookImages),
      publisher: publisherLabel(homework),
      questions,
      correct: 0,
      wrong: 0,
      blank: 0,
      minutes: 0,
      source: 'homework',
    })
  })

  return records
}

export function buildSubjectTabs(overview) {
  const subjects = new Map()
  const addSubject = (label) => {
    const cleanLabel = (label || '').trim()
    if (!cleanLabel) return
    const key = subjectKey(cleanLabel)
    if (HIDDEN_SUBJECT_TAB_KEYS.has(key)) return
    if (!subjects.has(key)) subjects.set(key, { key, label: cleanLabel })
  }

  ;(overview.resourceBooks || []).forEach((book) => addSubject(book.subjectName))
  ;(overview.tasks || []).forEach((task) => addSubject(subjectLabel(task)))
  ;(overview.sessions || []).forEach((session) => addSubject(subjectLabel(session)))
  ;(overview.homeworks || []).forEach((homework) => addSubject(homework.subject))
  ;(overview.wrongQuestions || []).forEach((item) => addSubject(item.subject))
  ;(overview.manualTestCompletions || []).forEach((item) => addSubject(item.subjectName))

  return Array.from(subjects.values()).sort((a, b) => collator.compare(a.label, b.label))
}

export function aggregateBy(records, keyReader) {
  const groups = new Map()

  records.forEach((record) => {
    const key = keyReader(record)
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: key,
        questions: 0,
        correct: 0,
        wrong: 0,
        blank: 0,
        minutes: 0,
        sessions: 0,
        publishers: new Set(),
        resourceImageUrl: undefined,
      })
    }

    const group = groups.get(key)
    group.questions += record.questions
    group.correct += record.correct
    group.wrong += record.wrong
    group.blank += record.blank
    group.minutes += record.minutes
    if (record.source === 'session') group.sessions += 1
    if (record.publisher) group.publishers.add(record.publisher)
    if (!group.resourceImageUrl && record.resourceImageUrl) group.resourceImageUrl = record.resourceImageUrl
  })

  return Array.from(groups.values())
    .map(({ publishers, ...group }) => ({
      ...group,
      publishers: Array.from(publishers),
      accuracy: group.correct + group.wrong > 0 ? (group.correct / (group.correct + group.wrong)) * 100 : NaN,
      net: calculateNet(group.correct, group.wrong),
    }))
    .sort((a, b) => b.questions - a.questions || b.minutes - a.minutes || collator.compare(a.label, b.label))
}

export function sumRecords(records) {
  return records.reduce(
    (total, record) => ({
      questions: total.questions + record.questions,
      correct: total.correct + record.correct,
      wrong: total.wrong + record.wrong,
      blank: total.blank + record.blank,
      minutes: total.minutes + record.minutes,
    }),
    { questions: 0, correct: 0, wrong: 0, blank: 0, minutes: 0 },
  )
}

export function rangeDayWindow(rangeId, today) {
  if (rangeId === 'today') return [today]
  if (rangeId === 'week') {
    const days = []
    for (let day = getMondayOfWeek(today); day <= today; day = addDaysISO(day, 1)) days.push(day)
    return days
  }
  if (rangeId === 'month') return getMonthDates(today).filter((day) => day <= today)
  return Array.from({ length: 30 }, (_, index) => addDaysISO(today, index - 29))
}

export function buildDailyActivity(records, rangeId, today) {
  const byDate = new Map()
  records.forEach((record) => {
    if (!record.date) return
    const current = byDate.get(record.date) || { questions: 0, correct: 0, wrong: 0 }
    current.questions += record.questions
    current.correct += record.correct
    current.wrong += record.wrong
    byDate.set(record.date, current)
  })

  return rangeDayWindow(rangeId, today).map((date) => ({
    date,
    label: formatDateShort(date),
    ...(byDate.get(date) || { questions: 0, correct: 0, wrong: 0 }),
  }))
}
