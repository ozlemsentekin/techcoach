// Deneme Sınavları modülü — istemci tarafı sabitleri. Sunucu kopyası: api/src/mockExams.js.

export const MOCK_EXAM_KINDS = [
  {
    value: 'brans',
    label: 'Branş İzleme',
    description: 'Tek ders, 20 soru, sınav tarihi zorunlu.',
    dateRequired: true,
    fixedQuestionCount: 20,
  },
  {
    value: 'genel',
    label: 'Genel Deneme',
    description: '8. sınıf LGS derslerinin tümü, ders başına sabit soru sayısı.',
    dateRequired: true,
    fixedQuestionCount: null,
  },
  {
    value: 'etut',
    label: 'Etüt',
    description: 'Tek ders, toplam soru sayısını sen girersin, tarih opsiyonel.',
    dateRequired: false,
    fixedQuestionCount: null,
  },
]

export function mockExamKindLabel(kind) {
  return MOCK_EXAM_KINDS.find((k) => k.value === kind)?.label || kind
}

export const BRANS_QUESTION_COUNT = 20
export const MAX_ETUT_QUESTIONS = 200

// Genel Deneme (LGS) sabit ders şablonu — sıra ve soru sayıları sunucuyla birebir aynı olmalı.
export const GENEL_DENEME_TEMPLATE = [
  { name: 'Türkçe', total: 20 },
  { name: 'Matematik', total: 20 },
  { name: 'Fen Bilimleri', total: 20 },
  { name: 'T.C. İnkılap Tarihi ve Atatürkçülük', total: 10 },
  { name: 'Din Kültürü ve Ahlak Bilgisi', total: 10 },
  { name: 'İngilizce', total: 10 },
]

// Şablon ders adını panel ders listesindeki (dbo.Subjects) gerçek kayıtla eşleştirir; ufak
// yazım farklarını (büyük/küçük harf, boşluk, "T.C." vs "TC") tolere eder.
function normalizeName(value) {
  return String(value || '')
    .toLocaleLowerCase('tr')
    .replace(/t\.?c\.?/g, 'tc')
    .replace(/[^a-zçğıiöşü0-9]/gi, '')
}

export function matchSubjectId(subjects, templateName) {
  const target = normalizeName(templateName)
  const hit = (subjects || []).find((s) => normalizeName(s.name) === target)
  return hit?.id
}

// Branş İzleme / Etüt ders seçici: 8. sınıfa uygun aktif dersler (grades bilgisi yoksa hepsi).
export function gradeEightSubjects(subjects) {
  const list = (subjects || []).filter((s) => !s.grades || s.grades.length === 0 || s.grades.includes('8'))
  return list.length ? list : subjects || []
}

export function computeNet(correct, wrong) {
  return Math.round((correct - wrong / 3) * 100) / 100
}
