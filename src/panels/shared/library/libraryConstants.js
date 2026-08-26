// Kütüphane özelliği ortaokul (5-8) ve lise (9-12) kademelerini kapsıyor — bkz. api/src/catalog.js LIBRARY_GRADES.
export const LIBRARY_GRADES = ['5', '6', '7', '8', '9', '10', '11', '12']

export function libraryApiBase(role) {
  return role === 'teacher' ? '/api/panel-teacher' : '/api/parent'
}

export const RESOURCE_SOURCE_LABELS = { okul: 'Okul Kaynağı', ozel: 'Özel Kaynak' }

export const RESOURCE_TYPE_LABELS = { soru_bankasi: 'Soru Bankası', konu_anlatimi: 'Konu Anlatımlı Soru Bankası' }

export const RESOURCE_WIZARD_STEPS = [
  { key: 1, label: 'Kapak' },
  { key: 2, label: 'Temel Bilgiler' },
  { key: 3, label: 'İçindekiler' },
  { key: 4, label: 'Kontrol ve Cevap Anahtarı' },
]
