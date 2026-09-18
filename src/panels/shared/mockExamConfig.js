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

// Ders adına göre kararlı, birbirinden ayrışan etiket rengi (bg + text token çifti).
const SUBJECT_TONES = [
  'bg-panel-blue-soft text-panel-blue',
  'bg-panel-sage-soft text-panel-sage',
  'bg-panel-warm-soft text-panel-warm',
  'bg-panel-lilac-soft text-panel-lilac',
  'bg-panel-yellow-soft text-panel-yellow',
  'bg-panel-red-soft text-panel-red',
  'bg-panel-slate-soft text-panel-slate',
  'bg-panel-green-soft text-panel-green',
  'bg-panel-accent-soft text-panel-warm',
]

export function subjectTone(name) {
  const key = normalizeName(name)
  let hash = 0
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  return SUBJECT_TONES[hash % SUBJECT_TONES.length]
}

// Sınav Deneyimi Analizi — istemci tarafı sabitleri. Sunucu kopyası: api/src/mockExams.js
// (EXPERIENCE_MOODS / EXPERIENCE_TAG_CODES). Yeni bir seçenek eklemek yalnızca bu iki listeyi
// (elle) senkron tutmak demektir, migration gerekmez.
export const EXAM_MOODS = [
  { value: 'rahat', emoji: '😌', label: 'Rahattım' },
  { value: 'iyi', emoji: '🙂', label: 'İyi hissediyordum' },
  { value: 'karisik', emoji: '😐', label: 'Karışıktı' },
  { value: 'zorlandim', emoji: '😟', label: 'Zorlandım' },
  { value: 'stresli', emoji: '😣', label: 'Çok stresliydim' },
]

const EXAM_MOODS_BY_VALUE = new Map(EXAM_MOODS.map((m) => [m.value, m]))

export function examMoodMeta(mood) {
  return EXAM_MOODS_BY_VALUE.get(mood)
}

export const EXPERIENCE_TAGS = [
  { value: 'sure_iyi_yonettim', label: 'Süreyi iyi yönettim' },
  { value: 'sure_yetismedi', label: 'Süre yetişmedi' },
  { value: 'fazla_zaman_harcadim', label: 'Bazı sorularda fazla zaman harcadım' },
  { value: 'dikkat_dagildi', label: 'Dikkatim dağıldı' },
  { value: 'acele_ettim', label: 'Acele ettim' },
  { value: 'yanlis_okudum', label: 'Soruları yanlış okuduğum oldu' },
  { value: 'optik_kaydirdim', label: 'Optik formda kaydırdım' },
  { value: 'optige_aktarirken_zorlandim', label: 'Cevapları optiğe aktarırken zorlandım' },
  { value: 'son_kontrol_yapabildim', label: 'Son kontrol için zamanım kaldı' },
  { value: 'son_kontrol_yapamadim', label: 'Son kontrol yapamadım' },
  { value: 'bir_derste_zorlandim', label: 'Bir derste beklediğimden fazla zorlandım' },
  { value: 'odagimi_koruyabildim', label: 'Sınav boyunca odağımı koruyabildim' },
]

const EXPERIENCE_TAGS_BY_VALUE = new Map(EXPERIENCE_TAGS.map((t) => [t.value, t]))

export function experienceTagLabel(tag) {
  return EXPERIENCE_TAGS_BY_VALUE.get(tag)?.label || tag
}

export const PREVIOUS_ACTION_REVIEW_OPTIONS = [
  { value: 'evet', label: 'Evet' },
  { value: 'kismen', label: 'Kısmen' },
  { value: 'hayir', label: 'Hayır' },
]

export function previousActionReviewLabel(value) {
  return PREVIOUS_ACTION_REVIEW_OPTIONS.find((o) => o.value === value)?.label || value
}

export const MOCK_EXAM_EXPERIENCE_LEARNING_NOTE_MAX = 500
export const MOCK_EXAM_EXPERIENCE_NEXT_ACTION_MAX = 300
