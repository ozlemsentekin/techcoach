// Hata Defteri'nde bir yanlış sorunun analizi rol başına ayrı kulvarlarda tutulur
// (bkz. api/sql/create-wrong-question-analyses-schema.sql). Öğrenci, veli ve öğretmen
// birbirinden bağımsız analiz yapar; her biri karşı kulvarları salt-okunur görür.

export const ANALYSIS_LANES = [
  { role: 'ogrenci', short: 'Ö', label: 'Öğrenci' },
  { role: 'ebeveyn', short: 'V', label: 'Veli' },
  { role: 'ogretmen', short: 'Öğr', label: 'Öğretmen' },
]

export const MISTAKE_REASON_LABELS = {
  'dikkat-hatasi': 'Dikkat Hatası',
  'bilgi-eksikligi': 'Bilgi Eksikliği',
  'soruyu-anlamadim': 'Soruyu Anlamadım',
}

export function laneLabel(role) {
  return ANALYSIS_LANES.find((lane) => lane.role === role)?.label || role
}

// Bir kulvarın "analiz edildi" sayılması için hata nedeni seçilmiş olmalıdır (not opsiyonel).
export function isLaneAnalyzed(item, role) {
  return Boolean(item?.analyses?.[role]?.mistakeReason)
}

// Verilen sorular listesinde, izleyicinin kendi kulvarında henüz analiz edilmemiş soru sayısı.
export function pendingAnalysisCount(items, viewerRole) {
  if (!items?.length) return 0
  return items.reduce((sum, item) => (isLaneAnalyzed(item, viewerRole) ? sum : sum + 1), 0)
}

// Hata Defteri filtresi seçenekleri — izleyicinin rolüne göre "benim" kulvarı öne alınır.
export function analysisFilterOptions(viewerRole) {
  const options = [{ value: 'tumu', label: 'Tüm sorular' }]
  options.push({
    value: `eksik:${viewerRole}`,
    label: viewerRole === 'ogrenci' ? 'Analiz etmediklerim' : 'Benim analiz etmediklerim',
  })
  ANALYSIS_LANES.filter((lane) => lane.role !== viewerRole).forEach((lane) => {
    options.push({ value: `eksik:${lane.role}`, label: `${lane.label} analizi eksik` })
  })
  return options
}

export function applyAnalysisFilter(items, analysisFilter) {
  if (!analysisFilter || !analysisFilter.startsWith('eksik:')) return items
  const role = analysisFilter.slice('eksik:'.length)
  return items.filter((item) => !isLaneAnalyzed(item, role))
}
