const SUBJECT_TONES = {
  Matematik: 'blue',
  Türkçe: 'lilac',
  'Fen Bilimleri': 'sage',
  'T.C. İnkılap Tarihi': 'slate',
  İngilizce: 'warm',
  'Din Kültürü': 'accent',
}

const FALLBACK_TONES = ['blue', 'lilac', 'sage', 'slate', 'accent', 'warm']

export const SUBJECT_TONE_CLASSES = {
  blue: { text: 'text-panel-blue', soft: 'bg-panel-blue-soft' },
  lilac: { text: 'text-panel-lilac', soft: 'bg-panel-lilac-soft' },
  sage: { text: 'text-panel-sage', soft: 'bg-panel-sage-soft' },
  slate: { text: 'text-panel-slate', soft: 'bg-panel-slate-soft' },
  accent: { text: 'text-panel-accent', soft: 'bg-panel-accent-soft' },
  warm: { text: 'text-panel-warm', soft: 'bg-panel-warm-soft' },
  neutral: { text: 'text-panel-text-muted', soft: 'bg-panel-surface-soft' },
}

export function getSubjectTone(subject) {
  if (!subject) return 'neutral'
  if (SUBJECT_TONES[subject]) return SUBJECT_TONES[subject]
  let hash = 0
  for (let i = 0; i < subject.length; i += 1) {
    hash = (hash * 31 + subject.charCodeAt(i)) | 0
  }
  return FALLBACK_TONES[Math.abs(hash) % FALLBACK_TONES.length]
}

export function getSubjectStyle(subject) {
  return SUBJECT_TONE_CLASSES[getSubjectTone(subject)]
}
