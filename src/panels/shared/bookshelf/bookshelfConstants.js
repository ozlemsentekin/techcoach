export const BOOKSHELF_RESOURCE_TYPES = [
  { value: 'konu_anlatimi', label: 'Konu Anlatımı' },
  { value: 'soru_bankasi', label: 'Soru Bankası' },
  { value: 'okuma_kitabi', label: 'Okuma Kitabı' },
  { value: 'etkinlik', label: 'Etkinlik & Soru Bankası' },
]

export const BOOKSHELF_RESOURCE_TYPE_LABELS = Object.fromEntries(
  BOOKSHELF_RESOURCE_TYPES.map((item) => [item.value, item.label]),
)

export const BOOKSHELF_GRADE_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
