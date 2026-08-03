/**
 * Öğrenci paneli tema kayıt defteri. Yeni bir tema eklemek için buraya bir
 * kayıt eklemek ve src/index.css içinde eşleşen [data-theme="..."] blok
 * tanımlamak yeterlidir — başka hiçbir bileşenin değişmesi gerekmez.
 */
export const THEMES = [
  {
    id: 'pink',
    label: 'Pembe Tema',
    description: 'Yumuşak, sıcak ve ilham veren pastel pembeler.',
    swatches: ['#f6f3ee', '#f6e6e9', '#c98a9c', '#b98f6a'],
  },
  {
    id: 'blue',
    label: 'Mavi Tema',
    description: 'Ferah, sakin ve odaklanmayı destekleyen açık mavi tonlar.',
    swatches: ['#eef6ff', '#dfeeff', '#4f78a8', '#d68a4a'],
  },
  {
    id: 'neutral',
    label: 'Soft Nötr Tema',
    description: 'Sade, dengeli ve göz yormayan yumuşak nötr renkler.',
    swatches: ['#f7f3ee', '#ece4da', '#7a6758', '#b8894f'],
  },
  {
    id: 'purple',
    label: 'Mor Tema',
    description: 'Enerjik ve odaklanmayı destekleyen mor tonlar.',
    swatches: ['#faf8ff', '#f1eefa', '#6f63a8', '#d68a4a'],
  },
  {
    id: 'green',
    label: 'Yeşil Tema',
    description: 'Doğal ve dinlendirici, huzur veren yeşil tonlar.',
    swatches: ['#f3f1e6', '#e7e9d9', '#71815c', '#b3924a'],
  },
  {
    id: 'orange',
    label: 'Turuncu Tema',
    description: 'Sıcak ve motive edici, canlı turuncu tonlar.',
    swatches: ['#fffaf5', '#f8e3d0', '#b85f22', '#cf9a3a'],
  },
  {
    id: 'black',
    label: 'Siyah Tema',
    description: 'Net, modern ve yüksek kontrastlı nötr tonlar.',
    swatches: ['#f6f7f8', '#e5e7eb', '#222831', '#6b7280'],
  },
]

export const THEME_IDS = THEMES.map((theme) => theme.id)

export const DEFAULT_THEME = 'neutral'

export function isValidTheme(themeId) {
  return THEME_IDS.includes(themeId)
}
