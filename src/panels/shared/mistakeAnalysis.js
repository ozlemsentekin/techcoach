// Hata Defteri'nde bir yanlış sorunun analizi artık rol başına TEK satır değil, serbest bir yorum
// akışıdır (thread): öğrenci, veli ve öğretmen aynı soruya istedikleri kadar yorum bırakabilir
// (bkz. api/sql/wrong-question-analyses-thread-schema.sql — UNIQUE(wrong_question_id, role) kaldırıldı).
// Bir sorunun `analysisComments` alanı kronolojik (eskiden yeniye) bir dizi:
// { id, role, mistakeReason, note, analyzedByName, createdAt }.
export const ANALYSIS_ROLES = ['ogrenci', 'ebeveyn', 'ogretmen']

export const ROLE_LABELS = {
  ogrenci: 'Öğrenci',
  ebeveyn: 'Veli',
  ogretmen: 'Öğretmen',
}

export const ROLE_SHORT_LABELS = {
  ogrenci: 'Öğr',
  ebeveyn: 'Vel',
  ogretmen: 'Öğrt',
}

export const MISTAKE_REASON_LABELS = {
  'dikkat-hatasi': 'Dikkat Hatası',
  'bilgi-eksikligi': 'Bilgi Eksikliği',
  'soruyu-anlamadim': 'Soruyu Anlamadım',
}

export function roleLabel(role) {
  return ROLE_LABELS[role] || role
}

export function formatAnalysisDate(value) {
  if (!value) return ''
  try {
    return new Date(value).toLocaleString('tr-TR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

// Bir sorunun yorum dizisinde belirtilen rolden en az bir yorum var mı (rozet/filtre için).
// "Analiz edilmiş" sayılmak için hata nedeni seçilmiş olmalıdır (not opsiyonel) — eski davranışla
// tutarlı.
export function hasRoleAnalysis(item, role) {
  return (item?.analysisComments || []).some((comment) => comment.role === role && comment.mistakeReason)
}

// Rol başına en son yorumu döner (rozet tooltip'i / özet görünümler için).
export function latestCommentByRole(comments, role) {
  const roleComments = (comments || []).filter((comment) => comment.role === role)
  return roleComments[roleComments.length - 1]
}

// Belirli bir izleyici rolü için henüz yorum bırakmadığı soru sayısı (öğretmenin sınıf
// analizindeki "eksik analiz" göstergesi — bkz. WrongQuestionsView.jsx).
export function pendingAnalysisCount(items, viewerRole) {
  if (!items?.length) return 0
  return items.reduce((sum, item) => (hasRoleAnalysis(item, viewerRole) ? sum : sum + 1), 0)
}

// Hata Defteri filtresi seçenekleri — izleyicinin kendi rolü öne alınır, diğer rollerin eksik
// analizi de ayrı seçenekler olarak sunulur.
export function analysisFilterOptions(viewerRole) {
  const options = [{ value: 'tumu', label: 'Tüm sorular' }]
  options.push({
    value: `eksik:${viewerRole}`,
    label: viewerRole === 'ogrenci' ? 'Analiz etmediklerim' : 'Benim analiz etmediklerim',
  })
  ANALYSIS_ROLES.filter((role) => role !== viewerRole).forEach((role) => {
    options.push({ value: `eksik:${role}`, label: `${roleLabel(role)} analizi eksik` })
  })
  return options
}

export function applyAnalysisFilter(items, analysisFilter) {
  if (!analysisFilter || !analysisFilter.startsWith('eksik:')) return items
  const role = analysisFilter.slice('eksik:'.length)
  return items.filter((item) => !hasRoleAnalysis(item, role))
}
