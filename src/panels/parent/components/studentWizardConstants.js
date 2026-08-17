export const GENDER_OPTIONS = [
  { value: 'kiz', label: 'Kız' },
  { value: 'erkek', label: 'Erkek' },
]

export const GRADE_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', '8']

export const WIZARD_STEPS = [
  { key: 1, label: 'Temel Bilgiler' },
  { key: 2, label: 'Okul Bilgileri' },
  { key: 3, label: 'Okul Ders Saatleri' },
  { key: 4, label: 'Dersler' },
  { key: 5, label: 'Panel ve Hobiler' },
]

// Bir sınıf seviyesindeki öğrencilerin tipik doğum yılı, o sınıfa göre ± 1 yıllık bir
// aralığa denk gelir (ör. bugün 7. sınıf öğrencisi genelde 12 yaşında olur).
export function getGradeBirthYearRange(grade) {
  const gradeNumber = Number(grade)
  if (!Number.isInteger(gradeNumber) || gradeNumber < 1 || gradeNumber > 8) {
    return null
  }
  const expectedBirthYear = new Date().getFullYear() - gradeNumber - 5
  return { min: expectedBirthYear - 1, max: expectedBirthYear + 1 }
}
