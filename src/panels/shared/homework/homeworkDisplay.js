import { Languages, FlaskConical, Sigma, Globe, Landmark, BookHeart, BookOpen } from 'lucide-react'

export const SUBJECT_ORDER = ['Türkçe', 'Matematik', 'Fen Bilimleri', 'T.C. İnkılap Tarihi', 'İngilizce', 'Din Kültürü']

export const SUBJECT_ICONS = {
  Türkçe: Languages,
  Matematik: Sigma,
  'Fen Bilimleri': FlaskConical,
  İngilizce: Globe,
  'T.C. İnkılap Tarihi': Landmark,
  'Din Kültürü': BookHeart,
}

export const DEFAULT_SUBJECT_ICON = BookOpen

export const SUBJECT_ICON_TONE_CLASSES = {
  blue: 'bg-student-theme-soft text-student-theme-text',
  lilac: 'bg-panel-lilac-soft text-panel-lilac',
  sage: 'bg-panel-sage-soft text-panel-sage',
  slate: 'bg-panel-slate-soft text-panel-slate',
  accent: 'bg-panel-accent-soft text-panel-accent',
  warm: 'bg-panel-warm-soft text-panel-warm',
  neutral: 'bg-panel-surface-soft text-panel-text-muted',
}

function getSubjectOrderIndex(subject) {
  const index = SUBJECT_ORDER.indexOf(subject)
  return index === -1 ? SUBJECT_ORDER.length : index
}

export function formatGroupDate(dueDate) {
  return new Date(dueDate).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    weekday: 'long',
  })
}

export function isHomeworkCompleted(homework) {
  if (homework.status === 'tamamlandi') return true
  if (homework.totalQuestionCount > 0) return homework.completedQuestionCount >= homework.totalQuestionCount
  return false
}

function buildDateGroup(dueDate, subjectGroups) {
  const subjects = Array.from(subjectGroups.entries())
    .map(([subject, items]) => ({ subject, items }))
    .sort((a, b) => getSubjectOrderIndex(a.subject) - getSubjectOrderIndex(b.subject))
  const totalHomeworkCount = subjects.reduce((total, subjectGroup) => total + subjectGroup.items.length, 0)
  const completedHomeworkCount = subjects.reduce(
    (total, subjectGroup) => total + subjectGroup.items.filter(isHomeworkCompleted).length,
    0,
  )
  const completionPercentage =
    totalHomeworkCount === 0 ? 0 : Math.round((completedHomeworkCount / totalHomeworkCount) * 100)
  return { dueDate, subjects, totalHomeworkCount, completedHomeworkCount, completionPercentage }
}

export function groupHomeworksByDate(homeworks) {
  if (!homeworks) return []
  const dateGroups = new Map()
  const unassignedSubjectGroups = new Map()
  homeworks.forEach((homework) => {
    const subjectGroups = homework.dueDate
      ? dateGroups.get(homework.dueDate) || dateGroups.set(homework.dueDate, new Map()).get(homework.dueDate)
      : unassignedSubjectGroups
    if (!subjectGroups.has(homework.subject)) subjectGroups.set(homework.subject, [])
    subjectGroups.get(homework.subject).push(homework)
  })
  const groups = Array.from(dateGroups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dueDate, subjectGroups]) => buildDateGroup(dueDate, subjectGroups))
  if (unassignedSubjectGroups.size) {
    groups.push(buildDateGroup(null, unassignedSubjectGroups))
  }
  return groups
}
