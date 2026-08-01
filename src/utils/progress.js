export function calculateProgress(completed, total) {
  return total > 0 ? Math.round((completed / total) * 100) : 0
}

export function getProgressMessage(progress) {
  if (progress === 0) return 'Hazırsan ilk adımla başlayalım.'
  if (progress < 25) return 'Güzel bir başlangıç yaptın.'
  if (progress < 50) return 'Adım adım ilerliyorsun.'
  if (progress < 75) return 'Günün yarısından fazlası tamamlandı.'
  if (progress < 100) return 'Çok az kaldı, harika gidiyorsun.'
  return 'Bugünün planını tamamladın.'
}
