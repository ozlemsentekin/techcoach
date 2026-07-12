import { taskTimeState } from '../utils/time'

const STUDY_TASK_TYPES = new Set([
  'ders-calisma',
  'test-cozme',
  'konu-tekrari',
  'odev',
  'odev-kontrolu',
  'kisa-akademik',
  'deneme-sinavi',
  'yanlis-tekrari',
  'sanat-hobi',
])

const REVIEW_TASK_TYPES = new Set(['odev-kontrolu', 'yanlis-tekrari'])

const REST_TASK_TYPES = new Set(['mola', 'dinlenme', 'serbest-zaman', 'yemek', 'yemek-dinlenme'])

const DONE_STATUSES = new Set(['tamamlandi', 'kismen-tamamlandi'])

/**
 * Brief bölüm 8'deki 5 kriteri gündün görevlerinden canlı olarak hesaplar.
 * Bir görevi kısmen tamamlamak da çabayı gösterdiği için kriterleri karşılayabilir.
 */
export function computeDailyStars(tasks, checkIn) {
  const startedPlan = Boolean(checkIn) || tasks.some((task) => task.status !== 'bekliyor')

  const completedFocusTime = tasks.some(
    (task) => STUDY_TASK_TYPES.has(task.taskType) && DONE_STATUSES.has(task.status),
  )

  const reviewedMistakes = tasks.some(
    (task) => REVIEW_TASK_TYPES.has(task.taskType) && DONE_STATUSES.has(task.status),
  )

  const restTasks = tasks.filter((task) => REST_TASK_TYPES.has(task.taskType))
  const protectedBreaks =
    restTasks.length === 0 ||
    restTasks.every((task) => {
      if (task.status !== 'bekliyor') return true
      const { phase } = taskTimeState(task)
      return phase !== 'past'
    })

  const plannedNextDay = tasks.some(
    (task) => task.taskType === 'gunluk-degerlendirme' && task.status === 'tamamlandi',
  )

  const criteria = [
    { label: 'Planına başladın', achieved: startedPlan },
    { label: 'Çalışma süreni tamamladın', achieved: completedFocusTime },
    { label: 'Yanlışlarını kontrol ettin', achieved: reviewedMistakes },
    { label: 'Molalarını ve dinlenme zamanını korudun', achieved: protectedBreaks },
    { label: 'Gününü değerlendirip yarını planladın', achieved: plannedNextDay },
  ]

  const count = criteria.filter((item) => item.achieved).length

  return { count, criteria }
}
