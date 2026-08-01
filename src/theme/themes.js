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
    swatches: ['#fff4f6', '#f8dfe5', '#a85d73', '#d98a4e'],
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
    swatches: ['#faf8ff', '#ece4fa', '#7c5cbf', '#d68a4a'],
  },
  {
    id: 'green',
    label: 'Yeşil Tema',
    description: 'Doğal ve dinlendirici, huzur veren yeşil tonlar.',
    swatches: ['#f7fbf7', '#e1f0e4', '#3f7a4f', '#d6a34a'],
  },
  {
    id: 'orange',
    label: 'Turuncu Tema',
    description: 'Sıcak ve motive edici, canlı turuncu tonlar.',
    swatches: ['#fffaf5', '#f8e3d0', '#b85f22', '#cf9a3a'],
  },
]

export const THEME_IDS = THEMES.map((theme) => theme.id)

export const DEFAULT_THEME = 'neutral'

export function isValidTheme(themeId) {
  return THEME_IDS.includes(themeId)
}
