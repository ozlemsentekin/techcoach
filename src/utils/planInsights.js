import { parseTimeToMinutes } from './time'

const STUDY_TASK_TYPES = new Set(['ders-calisma', 'test-cozme', 'konu-tekrari', 'odev', 'kisa-akademik', 'deneme-sinavi', 'yanlis-tekrari'])
const REST_TASK_TYPES = new Set(['mola', 'dinlenme', 'serbest-zaman', 'yemek', 'yemek-dinlenme'])
const TEST_TASK_TYPES = new Set(['test-cozme', 'deneme-sinavi'])

const MAX_ACADEMIC_MINUTES = 240
const MAX_TEST_COUNT = 3
const MAX_CONTINUOUS_STUDY_MINUTES = 90

/**
 * Brief'in haftalık plan yoğunluk uyarısı kurallarını (bölüm 10) bir güne uygular.
 * Sistem hiçbir zaman engellemez, yalnızca yapıcı bir dille öneri sunar.
 */
export function evaluateDayBalance(tasks) {
  const sorted = [...tasks].sort((a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime))
  const warnings = []

  const academicMinutes = sorted
    .filter((task) => STUDY_TASK_TYPES.has(task.taskType))
    .reduce((sum, task) => sum + (task.durationMinutes || 0), 0)

  if (academicMinutes > MAX_ACADEMIC_MINUTES) {
    warnings.push({
      title: 'Bu gün yoğun görünüyor',
      message: 'Toplam çalışma süresi 4 saati geçiyor. Bir görevi başka güne taşımak isteyebilirsiniz.',
      tone: 'warn',
    })
  }

  const testCount = sorted.filter((task) => TEST_TASK_TYPES.has(task.taskType)).length
  if (testCount > MAX_TEST_COUNT) {
    warnings.push({
      title: 'Test sayısı yüksek',
      message: `Bu günde ${testCount} test planlanmış. Birkaçını başka güne dağıtmak dengeyi koruyabilir.`,
      tone: 'warn',
    })
  }

  const hasRest = sorted.some((task) => REST_TASK_TYPES.has(task.taskType) && task.taskType !== 'yemek' && task.taskType !== 'yemek-dinlenme')
  if (sorted.length > 0 && !hasRest) {
    warnings.push({
      title: 'Mola eklenmemiş',
      message: 'Bu günde mola görünmüyor. Kısa bir dinlenme bloğu eklemeyi düşünebilirsiniz.',
      tone: 'warn',
    })
  }

  const hasFreeTime = sorted.some((task) => task.taskType === 'serbest-zaman')
  if (sorted.length > 0 && !hasFreeTime) {
    warnings.push({
      title: 'Serbest zaman yok',
      message: 'Bu günde serbest zaman planlanmamış. Dinlenme de planın bir parçasıdır.',
      tone: 'warn',
    })
  }

  let continuousMinutes = 0
  let previousEnd = null
  sorted.forEach((task) => {
    const isStudy = STUDY_TASK_TYPES.has(task.taskType)
    const start = parseTimeToMinutes(task.startTime)
    if (isStudy && previousEnd === start) {
      continuousMinutes += task.durationMinutes || 0
    } else if (isStudy) {
      continuousMinutes = task.durationMinutes || 0
    } else {
      continuousMinutes = 0
    }
    previousEnd = parseTimeToMinutes(task.endTime)
  })
  if (continuousMinutes > MAX_CONTINUOUS_STUDY_MINUTES) {
    warnings.push({
      title: 'Aralıksız çalışma uzun',
      message: 'Molasız 90 dakikadan uzun bir çalışma bloğu var. Arasına kısa bir mola eklemek iyi gelebilir.',
      tone: 'warn',
    })
  }

  if (warnings.length === 0 && sorted.length > 0) {
    warnings.push({
      title: 'Mola dengesi iyi',
      message: 'Harika! Dinlenme zamanları dengeli görünüyor.',
      tone: 'ok',
    })
  }

  return { warnings }
}
