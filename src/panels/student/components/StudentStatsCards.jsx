import { useEffect, useId, useState } from 'react'
import { HelpCircle, Target, ListChecks, ChevronDown, Camera, CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getWrongQuestions } from '../../../services/wrongQuestionService'
import { getTaskMistakeSummary } from '../../../utils/taskMistakeSummary'
import { TASK_TYPES } from '../../../data/taskTypes'
import { cn } from '../../ui/utils'
import { getDailyTaskSummary } from '../../../utils/dailyTaskSummary'
import { todayISODate } from '../../../utils/time'
import { RATE_TONES, successRateTone } from '../../shared/rateTones'

import { SUBJECT_STYLES, DEFAULT_SUBJECT_STYLE } from './subjectStyles'

function getSubjectLabel(task) {
  return task.subject || TASK_TYPES[task.taskType]?.label || 'Genel'
}

/** Bir görevin optik/manuel sonucundan doğru ve cevaplanan (doğru+yanlış+boş) soru sayısını çıkarır. */
function getTaskResultTotals(task) {
  const testResults = Object.values(task.testResults || {}).filter(Boolean)
  const hasAggregate = [task.correctCount, task.wrongCount, task.blankCount].some(
    (value) => value !== undefined && value !== null,
  )

  const fromTests = testResults.reduce(
    (totals, result) => ({
      correct: totals.correct + (Number(result.correct) || 0),
      wrong: totals.wrong + (Number(result.wrong) || 0),
      blank: totals.blank + (Number(result.blank) || 0),
    }),
    { correct: 0, wrong: 0, blank: 0 },
  )

  const correct = hasAggregate ? Number(task.correctCount) || 0 : fromTests.correct
  const wrong = hasAggregate ? Number(task.wrongCount) || 0 : fromTests.wrong
  const blank = hasAggregate ? Number(task.blankCount) || 0 : fromTests.blank

  return { correct, answered: correct + wrong + blank }
}

/** Görevlerin sonuçlarını ders bazında toplar; başarı oranına göre azalan sıralı döner. */
function aggregateResultsBySubject(tasks) {
  const totals = new Map()
  for (const task of tasks) {
    const { correct, answered } = getTaskResultTotals(task)
    if (answered <= 0) continue
    const subject = getSubjectLabel(task)
    const entry = totals.get(subject) || { correct: 0, answered: 0 }
    entry.correct += correct
    entry.answered += answered
    totals.set(subject, entry)
  }
  return Array.from(totals.entries())
    .map(([subject, entry]) => ({
      subject,
      correct: entry.correct,
      answered: entry.answered,
      successRate: entry.correct / entry.answered,
    }))
    .sort((a, b) => b.successRate - a.successRate)
}

/** Görevlerden ders bazlı toplamlar çıkarır; sadece pozitif değeri olan dersler döner. */
function aggregateBySubject(tasks, valueSelector) {
  const totals = new Map()
  for (const task of tasks) {
    const value = valueSelector(task)
    if (!value || value <= 0) continue
    const subject = getSubjectLabel(task)
    totals.set(subject, (totals.get(subject) || 0) + value)
  }
  return Array.from(totals.entries())
    .map(([subject, value]) => ({ subject, value }))
    .sort((a, b) => b.value - a.value)
}

function StatCard({ iconClassName, icon, title, mainValue, mainValueClassName, supportingContent, children }) {
  return (
    <div className="flex min-h-[92px] min-w-0 items-start gap-3 rounded-2xl border border-panel-border bg-panel-surface p-4">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${iconClassName}`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <p className={cn('text-2xl font-bold leading-none tracking-tight tabular-nums text-panel-text', mainValueClassName)}>{mainValue}</p>
          <p className="text-xs font-medium text-panel-text-muted">{title}</p>
        </div>
        <div className="mt-2 min-h-4">{supportingContent}</div>
        <div className="mt-2">{children}</div>
      </div>
    </div>
  )
}

function SubjectInlineBreakdown({ items, formatValue, expanded, onToggle, label = 'Derslere göre', emptyMessage = 'İlk çalışmanla birlikte güncellenecek' }) {
  const contentId = useId()
  if (items.length === 0) {
    return <p className="text-xs text-panel-text-muted">{emptyMessage}</p>
  }

  return (
    <div>
      <button type="button" onClick={onToggle} aria-expanded={expanded} aria-controls={contentId} className="flex w-fit cursor-pointer items-center gap-1 text-xs font-medium text-panel-text-muted transition-colors hover:text-panel-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-student-theme-primary">
        {label}
        <ChevronDown size={13} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      <ul id={contentId} hidden={!expanded} className="mt-3 space-y-2 border-t border-panel-border pt-3">
        {items.map((item) => (
          <li key={item.subject} className="flex items-baseline gap-2 text-xs text-panel-text-muted">
            <span className={`h-1.5 w-1.5 shrink-0 self-center rounded-full ${(SUBJECT_STYLES[item.subject] || DEFAULT_SUBJECT_STYLE).dot}`} aria-hidden="true" />
            <span className="min-w-0 flex-1">{item.subject}</span>
            <span className="shrink-0 font-semibold tabular-nums text-panel-text">{formatValue(item.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function StudentStatsCards({ tasks = [] }) {
  const [expanded, setExpanded] = useState(false)
  const [mistakeDetailsOpen, setMistakeDetailsOpen] = useState(false)
  const [photos, setPhotos] = useState(null)
  const [photoError, setPhotoError] = useState(false)
  const mistakeDetailsId = useId()
  useEffect(() => {
    let ignore = false
    const refresh = () => getWrongQuestions().then(({ wrongQuestions }) => {
      if (!ignore) { setPhotos(wrongQuestions); setPhotoError(false) }
    }).catch(() => { if (!ignore) { setPhotos(null); setPhotoError(true) } })
    refresh()
    window.addEventListener('student-mistake-photo-updated', refresh)
    return () => { ignore = true; window.removeEventListener('student-mistake-photo-updated', refresh) }
  }, [tasks])
  const toggleBreakdowns = () => setExpanded((value) => !value)
  const { pendingTasks, completedTasks, completed, total, progress } = getDailyTaskSummary(tasks, todayISODate())
  const mistakes = getTaskMistakeSummary(completedTasks, photos)
  const allMistakePhotosUploaded = mistakes.total > 0 && mistakes.missingPhotos === 0
  const pendingBySubject = aggregateBySubject(pendingTasks, () => 1)
  const questionsBySubject = aggregateBySubject(completedTasks, (task) => task.completedQuestionCount)
  const totalQuestions = questionsBySubject.reduce((sum, item) => sum + item.value, 0)

  const successBySubject = aggregateResultsBySubject(completedTasks)
  const totalAnswered = successBySubject.reduce((sum, item) => sum + item.answered, 0)
  const successRate = totalAnswered > 0 ? successBySubject.reduce((sum, item) => sum + item.correct, 0) / totalAnswered : null
  const successPercent = successRate != null ? Math.round(successRate * 100) : null
  const successColors = RATE_TONES[successRateTone(successRate)]

  return (
    <div className="grid grid-cols-1 items-stretch gap-3 md:grid-cols-2 xl:grid-cols-4">
      <StatCard iconClassName="bg-student-theme-soft text-student-theme-text"
        icon={<ListChecks size={16} aria-hidden="true" />}
        title="görev tamamlandı" mainValue={`${completed}/${total}`}
        supportingContent={
        <div className="flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-border" role="progressbar"
            aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label="Bugünkü görev ilerlemesi">
            <div className="h-full rounded-full bg-student-theme-primary" style={{ width: `${progress}%` }} />
          </div>
          <span className="shrink-0 text-xs text-panel-text-muted">%{progress}</span>
        </div>
        }
      >
          <SubjectInlineBreakdown
            expanded={expanded}
            onToggle={toggleBreakdowns}
            items={pendingBySubject}
            label="Derslere göre bekleyenler"
            emptyMessage="Bekleyen görev yok"
            formatValue={(value) => `${value} görev`}
          />
      </StatCard>
      <StatCard
        iconClassName="bg-panel-sage-soft text-panel-sage"
        icon={<HelpCircle size={16} aria-hidden="true" />}
        title="soru çözüldü"
        mainValue={totalQuestions}
      >
        <SubjectInlineBreakdown expanded={expanded} onToggle={toggleBreakdowns} items={questionsBySubject} formatValue={(value) => `${value}`} />
      </StatCard>

      <StatCard
        iconClassName={cn('bg-panel-blue-soft', successColors.text)}
        icon={<Target size={16} aria-hidden="true" />}
        title="başarı oranı"
        mainValue={successPercent != null ? `%${successPercent}` : '—'}
        mainValueClassName={successPercent != null ? successColors.text : undefined}
      >
        <SubjectInlineBreakdown
          expanded={expanded}
          onToggle={toggleBreakdowns}
          items={successBySubject.map((item) => ({ subject: item.subject, value: item.successRate }))}
          formatValue={(value) => `%${Math.round(value * 100)}`}
        />
      </StatCard>
      <StatCard
        iconClassName={allMistakePhotosUploaded ? 'bg-panel-sage-soft text-panel-sage' : 'bg-panel-red-soft text-panel-red'}
        icon={allMistakePhotosUploaded ? <CheckCircle2 size={16} aria-hidden="true" /> : <Camera size={16} aria-hidden="true" />}
        title="yanlış / boş soru"
        mainValue={mistakes.total}
        supportingContent={
          <p className={cn('text-xs leading-relaxed', allMistakePhotosUploaded ? 'font-medium text-panel-sage' : 'text-panel-text-muted')} role="status">
            {allMistakePhotosUploaded
              ? 'Tüm görseller tamam, eline sağlık! Tekrar için hazırsın.'
              : mistakes.missingPhotos == null
                ? photoError ? 'Görsel bilgisi alınamadı' : 'Görseller kontrol ediliyor…'
                : `${mistakes.missingPhotos} sorunun görseli eksik`}
          </p>
        }
      >
        <button type="button" onClick={() => setMistakeDetailsOpen((value) => !value)}
          aria-expanded={mistakeDetailsOpen} aria-controls={mistakeDetailsId}
          className="flex items-center gap-1 text-xs font-medium text-panel-text-muted hover:text-panel-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-student-theme-primary">
          Detay
          <ChevronDown size={13} className={`transition-transform ${mistakeDetailsOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
        <div id={mistakeDetailsId} hidden={!mistakeDetailsOpen} className="mt-3 border-t border-panel-border pt-3 text-xs leading-relaxed text-panel-text-muted">
          <p>Bugün tamamladığın görevlerdeki yanlış ve boş soruların toplamı.</p>
          <p className="mt-2">Bu soruların fotoğraflarını optik formdaki kamera simgesinden yükle. Hata Defterim’den PDF olarak indirip konular ilerledikçe tekrar çöz, hatalarından öğren.</p>
          <Link to="/student/mistakes" className="mt-2 inline-flex font-semibold text-student-theme-text underline underline-offset-4">Hata Defterim’e git</Link>
        </div>
      </StatCard>
    </div>
  )
}
