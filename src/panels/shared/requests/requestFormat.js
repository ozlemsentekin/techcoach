export const STATUS_TONE = {
  beklemede: 'yellow',
  tamamlandi: 'sage',
  iptal: 'red',
}

const ROLE_LABELS = {
  ebeveyn: 'Veli',
  ogretmen: 'Öğretmen',
  ogrenci: 'Öğrenci',
  admin: 'Yönetici',
}

export function roleLabel(role) {
  return ROLE_LABELS[role] || role || ''
}

export function formatRequestDate(value) {
  if (!value) return ''
  try {
    return new Date(value).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return ''
  }
}
