// Ders kimlik renkleri. Panel teması (bkz. index.css --color-panel-*) dusty/soft tonlar
// kullanır; buradaki tonlar aynı doygunluk hissini korur ama kart başındaki ince çubukta
// dersler birbirinden net ayrışsın diye renk çemberine kasıtlı olarak yayılmıştır.
// (Kullanıcı geri bildirimi: panel tokenları ince çubukta hep "solgun kahve" gibi okunuyordu.)
const SUBJECT_TONE_KEYWORDS = [
  { tone: 'indigo', match: ['matematik', 'geometri'] },
  { tone: 'rose', match: ['türkçe', 'turkce', 'edebiyat', 'dil ve anlatım'] },
  { tone: 'emerald', match: ['fen', 'biyoloji', 'fizik', 'kimya'] },
  { tone: 'gold', match: ['inkılap', 'inkilap', 'tarih', 'atatürk', 'ataturk'] },
  { tone: 'cyan', match: ['ingilizce', 'i̇ngilizce', 'yabancı dil', 'almanca', 'fransızca'] },
  { tone: 'violet', match: ['din', 'ahlak'] },
  { tone: 'teal', match: ['sosyal', 'coğrafya', 'cografya', 'vatandaşlık'] },
  { tone: 'olive', match: ['bilişim', 'bilisim', 'teknoloji', 'kodlama', 'görsel', 'müzik', 'muzik', 'beden'] },
]

const FALLBACK_TONES = ['indigo', 'rose', 'emerald', 'gold', 'cyan', 'violet', 'teal', 'olive']

export const SUBJECT_TONE_CLASSES = {
  indigo: { text: 'text-[#3b4a99]', soft: 'bg-[#3f51a8]/12', bar: 'bg-[#3f51a8]' },
  rose: { text: 'text-[#a94873]', soft: 'bg-[#bd5a82]/12', bar: 'bg-[#bd5a82]' },
  emerald: { text: 'text-[#2f7d5c]', soft: 'bg-[#3a9b72]/14', bar: 'bg-[#3a9b72]' },
  gold: { text: 'text-[#9a6a1c]', soft: 'bg-[#d9942f]/16', bar: 'bg-[#d9942f]' },
  cyan: { text: 'text-[#2c6f8f]', soft: 'bg-[#3d8fb8]/14', bar: 'bg-[#3d8fb8]' },
  violet: { text: 'text-[#6b4c9c]', soft: 'bg-[#8360b8]/13', bar: 'bg-[#8360b8]' },
  teal: { text: 'text-[#237a77]', soft: 'bg-[#2f9591]/14', bar: 'bg-[#2f9591]' },
  olive: { text: 'text-[#6b7330]', soft: 'bg-[#86903f]/16', bar: 'bg-[#86903f]' },
  neutral: { text: 'text-panel-text-muted', soft: 'bg-panel-surface-soft', bar: 'bg-panel-text-muted' },
}

export function getSubjectTone(subject) {
  if (!subject) return 'neutral'
  const normalized = subject.toLocaleLowerCase('tr-TR')
  for (const { tone, match } of SUBJECT_TONE_KEYWORDS) {
    if (match.some((keyword) => normalized.includes(keyword))) return tone
  }
  let hash = 0
  for (let i = 0; i < subject.length; i += 1) {
    hash = (hash * 31 + subject.charCodeAt(i)) | 0
  }
  return FALLBACK_TONES[Math.abs(hash) % FALLBACK_TONES.length]
}

export function getSubjectStyle(subject) {
  return SUBJECT_TONE_CLASSES[getSubjectTone(subject)]
}

export function getSubjectBarClass(subject) {
  return SUBJECT_TONE_CLASSES[getSubjectTone(subject)].bar
}
