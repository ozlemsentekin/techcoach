// Sınıf Analizi (öğretmen, satır = öğrenci) ve Gelişim Analizi (veli, satır = ders)
// aynı grafik/tablo setini paylaşır. Buradaki SAF yardımcılar "entity" (öğrenci veya ders)
// üzerinden çalışır; JSX içermez, davranış progressAnalytics ile birebir uyumlu kalmalı.

import { aggregateBy, subjectKey, sumRecords, toDateKey } from './progressAnalytics'
import { successRateTone } from './rateTones'
import { calculateNet } from '../../utils/netCalculator'
import { isBacklogTask } from '../../utils/backlogTasks'

const COMPLETED_STATUSES = new Set(['tamamlandi', 'kismen-tamamlandi'])
const MIN_ANSWERED_FOR_RANK = 3
const MAX_RESOURCE_COLUMNS = 8
const MONTH_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']

// Eğitim yılı: içinde bulunduğumuz Ağustos'tan sonraki Haziran'a kadar (Ağu–Haz, 11 ay).
export function buildAcademicMonths(today) {
  const [year, month] = today.split('-').map(Number)
  const startYear = month >= 8 ? year : year - 1
  const months = []
  for (let m = 8; m <= 12; m += 1) months.push({ y: startYear, m })
  for (let m = 1; m <= 6; m += 1) months.push({ y: startYear + 1, m })
  return months.map(({ y, m }) => ({
    key: `${y}-${String(m).padStart(2, '0')}`,
    short: MONTH_SHORT[m - 1],
    label: `${MONTH_SHORT[m - 1]} ${y}`,
  }))
}

// "Yağmur Aydoğdu" → "Yağmur A." — grafik ekseninde her zaman sığsın diye.
export function shortName(full) {
  const parts = String(full || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '—'
  if (parts.length === 1) return parts[0]
  const initial = parts[parts.length - 1][0]?.toLocaleUpperCase('tr-TR') || ''
  return `${parts[0]} ${initial}.`
}

export function pct(value) {
  return Number.isFinite(value) ? `${Math.round(value)}%` : '—'
}

export function accuracyOf(correct, wrong) {
  const answered = correct + wrong
  return answered > 0 ? (correct / answered) * 100 : NaN
}

export function toneFor(accuracy) {
  return successRateTone(Number.isFinite(accuracy) ? accuracy / 100 : null)
}

export function safeAcc(accuracy) {
  return Number.isFinite(accuracy) ? accuracy : -1
}

export function mergeBuckets(buckets) {
  return buckets.reduce(
    (acc, bucket) => {
      if (!bucket) return acc
      acc.questions += bucket.questions
      acc.correct += bucket.correct
      acc.wrong += bucket.wrong
      acc.blank += bucket.blank
      return acc
    },
    { questions: 0, correct: 0, wrong: 0, blank: 0 },
  )
}

// Bir "entity" (öğrenci veya ders) için önceden süzülmüş kayıt/görev listesini tek-öğrenci
// analiz sayfasıyla aynı yardımcılarla özetler. records/tasks çağıran tarafça (öğrenci
// başına ya da ders başına) süzülür; subjectFilterKey verilirse kaynak kitap listesi de
// o derse daraltılır.
export function analyzeEntity({
  key,
  name,
  records,
  tasks = [],
  overview = {},
  subjectFilterKey = null,
  subjectName = null,
  lastActivityAt = null,
  shortLabel,
}) {
  const totals = sumRecords(records)
  const answered = totals.correct + totals.wrong

  // Aylık dağılım — tüm kayıtlar ay bazında toplanır.
  const monthly = new Map()
  for (const record of records) {
    const monthKey = (record.date || '').slice(0, 7)
    if (monthKey.length !== 7) continue
    const bucket = monthly.get(monthKey) || { questions: 0, correct: 0, wrong: 0, blank: 0 }
    bucket.questions += record.questions
    bucket.correct += record.correct
    bucket.wrong += record.wrong
    bucket.blank += record.blank
    monthly.set(monthKey, bucket)
  }

  const taskCounts = { total: tasks.length, onTime: 0, late: 0, backlog: 0, pending: 0 }
  for (const task of tasks) {
    if (COMPLETED_STATUSES.has(task.status)) {
      const doneDay = toDateKey(task.completedAt || task.date)
      if (doneDay && doneDay > toDateKey(task.date)) taskCounts.late += 1
      else taskCounts.onTime += 1
    } else if (isBacklogTask(task)) {
      taskCounts.backlog += 1
    } else {
      taskCounts.pending += 1
    }
  }

  const topicRows = aggregateBy(records, (record) => record.contentGroup || record.content)
  const resourceRows = aggregateBy(records, (record) => record.resource)
  const rankable = (rows) =>
    rows.filter((row) => row.correct + row.wrong >= MIN_ANSWERED_FOR_RANK).sort((a, b) => a.accuracy - b.accuracy)[0] || null

  const books = (overview.resourceBooks || []).filter(
    (book) => !subjectFilterKey || subjectKey(book.subjectName) === subjectFilterKey,
  )
  const bookIdSet = new Set(books.map((book) => book.id))

  // Kitap tamamlanma oranı: kitaptaki toplam test sayısına karşı öğrencinin sonuç
  // girdiği (manuel optik + görev/oturum test sonuçları) benzersiz test sayısı.
  const bookTestTotals = new Map()
  for (const test of overview.tests || []) {
    if (test.resourceBookId && bookIdSet.has(test.resourceBookId)) {
      bookTestTotals.set(test.resourceBookId, (bookTestTotals.get(test.resourceBookId) || 0) + 1)
    }
  }
  const completedTestIds = new Set()
  for (const completion of overview.manualTestCompletions || []) {
    if (completion.testId) completedTestIds.add(completion.testId)
  }
  for (const source of [...(overview.tasks || []), ...(overview.sessions || [])]) {
    for (const testId of Object.keys(source.testResults || {})) completedTestIds.add(testId)
  }
  const bookCompleted = new Map()
  for (const test of overview.tests || []) {
    if (test.resourceBookId && bookIdSet.has(test.resourceBookId) && completedTestIds.has(test.id)) {
      bookCompleted.set(test.resourceBookId, (bookCompleted.get(test.resourceBookId) || 0) + 1)
    }
  }
  const bookImages = overview.resourceBookImages || {}

  // Kaynak adı → { doğruluk, çözülen soru, tamamlanma, kapak, yayın evi }
  const resources = new Map()
  for (const row of resourceRows) {
    resources.set(row.key, {
      accuracy: row.accuracy,
      answered: row.correct + row.wrong,
      cover: row.resourceImageUrl || null,
      publisher: row.publishers?.[0] || '',
    })
  }
  for (const book of books) {
    const total = bookTestTotals.get(book.id) || 0
    const done = bookCompleted.get(book.id) || 0
    const existing = resources.get(book.name) || { answered: 0 }
    resources.set(book.name, {
      accuracy: existing.accuracy,
      answered: existing.answered || 0,
      completionRate: total > 0 ? done / total : NaN,
      completedTests: done,
      totalTests: total,
      cover: bookImages[book.id] || existing.cover || null,
      publisher: book.publisherName || existing.publisher || '',
    })
  }

  return {
    key,
    studentTeacherId: key,
    name,
    shortLabel: shortLabel ?? shortName(name),
    subjectName,
    totals,
    answered,
    accuracy: accuracyOf(totals.correct, totals.wrong),
    net: calculateNet(totals.correct, totals.wrong),
    taskCounts,
    resources,
    resourceRows,
    monthly,
    hardestTopic: rankable(topicRows),
    hardestBook: rankable(resourceRows),
    lastActivityAt: lastActivityAt || null,
  }
}

// entities listesini ısı haritası kaynakları + eğitim yılı ayları + özet metrikleriyle
// birlikte hazırlar. maxResources: ısı haritasındaki kaynak (satır) sayısı üst sınırı;
// hem Sınıf hem Gelişim Analizi Infinity geçiyor (kaynaklar satır olduğu için hepsi sığar),
// varsayılan MAX_RESOURCE_COLUMNS geriye dönük uyumluluk içindir.
export function buildAnalysis(entities, today, { maxResources = MAX_RESOURCE_COLUMNS } = {}) {
  const resourceMeta = new Map()
  for (const entity of entities) {
    for (const [name, info] of entity.resources) {
      const meta = resourceMeta.get(name) || { weight: 0, publisher: '', cover: null }
      meta.weight += (info.answered || 0) + (info.totalTests || 0)
      if (!meta.publisher && info.publisher) meta.publisher = info.publisher
      if (!meta.cover && info.cover) meta.cover = info.cover
      resourceMeta.set(name, meta)
    }
  }
  const resourceColumns = [...resourceMeta.entries()]
    .filter(([, meta]) => meta.weight > 0)
    .sort((a, b) => b[1].weight - a[1].weight)
    .slice(0, maxResources)
    .map(([key, meta]) => ({ key, label: key, publisher: meta.publisher, cover: meta.cover }))

  const months = buildAcademicMonths(today)

  const activeEntities = entities.filter((entity) => Number.isFinite(entity.accuracy))
  const avgAccuracy = activeEntities.length
    ? activeEntities.reduce((sum, entity) => sum + entity.accuracy, 0) / activeEntities.length
    : NaN
  const accuracyValues = activeEntities.map((entity) => entity.accuracy)
  const grand = entities.reduce(
    (acc, entity) => ({ correct: acc.correct + entity.totals.correct, wrong: acc.wrong + entity.totals.wrong }),
    { correct: 0, wrong: 0 },
  )
  const summary = {
    count: entities.length,
    activeCount: activeEntities.length,
    avgAccuracy,
    overallAccuracy: accuracyOf(grand.correct, grand.wrong),
    minAccuracy: accuracyValues.length ? Math.min(...accuracyValues) : NaN,
    maxAccuracy: accuracyValues.length ? Math.max(...accuracyValues) : NaN,
  }

  return { entities, resourceColumns, months, summary }
}

export const SORTS = {
  accuracyAsc: { label: 'Düşük başarı önce', fn: (a, b) => safeAcc(a.accuracy) - safeAcc(b.accuracy) },
  accuracyDesc: { label: 'Yüksek başarı önce', fn: (a, b) => safeAcc(b.accuracy) - safeAcc(a.accuracy) },
  answeredDesc: { label: 'En çok soru', fn: (a, b) => b.answered - a.answered },
  answeredAsc: { label: 'En az soru', fn: (a, b) => a.answered - b.answered },
  backlogDesc: { label: 'En çok biriken görev', fn: (a, b) => b.taskCounts.backlog - a.taskCounts.backlog },
}

export const TASK_LEGEND = [
  { key: 'onTime', label: 'Zamanında', className: 'bg-panel-green' },
  { key: 'late', label: 'Geç', className: 'bg-panel-yellow' },
  { key: 'backlog', label: 'Biriken', className: 'bg-panel-red' },
  { key: 'pending', label: 'Bekleyen', className: 'bg-panel-text-muted/40' },
]

export const COMPOSITION_LEGEND = [
  { label: 'Doğru', className: 'bg-panel-green' },
  { label: 'Yanlış', className: 'bg-panel-red' },
  { label: 'Boş', className: 'bg-panel-text-muted/40' },
]

export const DEFAULT_LABELS = {
  entityHeader: 'Öğrenci',
  monthlyPerfTitle: 'Aylara Göre Çalışma Performansı',
  monthlyPerfSubtitle: 'Öğrenci başına aylık çözülen soru ve o ayın başarı yüzdesi (Ağustos–Haziran)',
  monthlyResultTitle: 'Aylık Sonuç Analizi',
  monthlyResultSubtitle: 'Öğrenci başına aylık doğru / yanlış / boş dağılımı ve o ayın başarı yüzdesi',
  resourceTitle: 'Kaynaklara göre başarı',
  resourceSubtitle: 'Kaynak × öğrenci — her hücrede o kitaptaki doğruluk yüzdesi ve tamamlanma oranı',
  resourceEmpty: 'Bu aralıkta kaynak bazlı çözüm kaydı yok.',
  taskTitle: 'Görevleri zamanında çözme',
  taskSubtitle: 'Her öğrencinin görev tamamlama disiplini',
  hardestTitle: 'Öğrencilerin en zorlandığı konu ve kitap',
  hardestSubtitle: 'Her öğrenci için doğruluğu en düşük konu/kaynak',
  comparisonTitle: 'Öğrenci karşılaştırması',
  comparisonSubtitle: 'Öğrenciye dokununca detay analizine gidersiniz',
}
