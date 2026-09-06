import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Circle, X } from 'lucide-react'
import { useAuth } from '../../../context/useAuth'
import { getTasksForDateRange } from '../../../services/taskService'
import { readJSON, writeJSON } from '../../../services/storage'
import { addDaysISO, todayISODate } from '../../../utils/time'

const DISMISS_KEY = 'parentOnboardingDismissed'

function isDismissed(parentId) {
  if (!parentId) return false
  const map = readJSON(DISMISS_KEY, {})
  return Boolean(map && map[parentId])
}

function markDismissed(parentId) {
  if (!parentId) return
  const map = readJSON(DISMISS_KEY, {}) || {}
  writeJSON(DISMISS_KEY, { ...map, [parentId]: true })
}

function firstName(fullName) {
  return String(fullName || '').trim().split(/\s+/)[0] || 'Çocuğunuz'
}

// "Bugün" ekranında yeni bir veliye kurulumun kalan adımlarını gösteren başlangıç
// rehberi. İlerleme seçili öğrencinin gerçek verisinden hesaplanır.
// Tamamlanınca günlük kullanım önerisi gösterilir; veli isterse rehberi gizler.
export default function OnboardingChecklist({ students, selectedStudentId }) {
  const navigate = useNavigate()
  const { authUser } = useAuth()
  const parentId = authUser?.id

  const student = useMemo(
    () => (students || []).find((item) => item.id === selectedStudentId) || (students || [])[0] || null,
    [students, selectedStudentId],
  )

  const [taskStatus, setTaskStatus] = useState(null)
  const hasPlannedTask = taskStatus?.studentId === student?.id ? taskStatus.hasTasks : null
  const [dismissed, setDismissed] = useState(() => isDismissed(parentId))

  useEffect(() => {
    setDismissed(isDismissed(parentId))
  }, [parentId])

  useEffect(() => {
    if (!student?.id || dismissed) return undefined
    let ignore = false
    const from = todayISODate()
    getTasksForDateRange(from, addDaysISO(from, 27), { studentId: student.id })
      .then((tasks) => {
        if (!ignore) setTaskStatus({ studentId: student.id, hasTasks: (tasks || []).length > 0 })
      })
      .catch(() => {
        if (!ignore) setTaskStatus({ studentId: student.id, hasTasks: null })
      })
    return () => {
      ignore = true
    }
  }, [student?.id, dismissed])

  const steps = useMemo(() => {
    if (!student) return []
    return [
      {
        key: 'profile',
        label: `${firstName(student.fullName)} için profil oluşturuldu`,
        done: true,
      },
      {
        key: 'resources',
        label: 'Kullandığı kitapları ekleyin',
        hint: 'Kitaplardan ödev vermek ve ilerlemeyi takip etmek için kullandığı kaynakları ekleyin.',
        done: (student.resourceCount || 0) > 0,
        action: () => navigate(`/parent/students?action=resources&studentId=${student.id}`),
        cta: 'Kaynak ata',
      },
      {
        key: 'plan',
        label: 'İlk çalışma görevini planlayın',
        hint: 'Haftalık Plan’da bir gün seçin ve görev ekleyin. Tek bir çalışmayla başlayabilirsiniz.',
        done: Boolean(hasPlannedTask),
        action: () => navigate(`/parent/weekly-plan?studentId=${student.id}`),
        cta: 'Görev planla',
      },
      {
        key: 'school',
        label: 'Okul bilgisini ekleyin',
        hint: 'Çocuğunuzun okulunu profil bilgilerine ekleyin.',
        done: Boolean(student.schoolName),
        action: () => navigate(`/parent/students?action=profile&studentId=${student.id}`),
        cta: 'Ekle',
      },
      {
        key: 'teacher',
        label: 'Öğretmen ekleyin',
        hint: 'Özel ders veya okul öğretmeni takibi için.',
        optional: true,
        done: (student.teacherCount || 0) > 0,
        action: () => navigate(`/parent/students?action=teachers&studentId=${student.id}`),
        cta: 'Ekle',
      },
    ].sort((a, b) => Number(Boolean(a.optional)) - Number(Boolean(b.optional)))
  }, [student, hasPlannedTask, navigate])

  const requiredSteps = steps.filter((step) => !step.optional)
  const requiredDone = requiredSteps.filter((step) => step.done).length
  const allRequiredDone = requiredSteps.length > 0 && requiredDone === requiredSteps.length

  if (!student || dismissed || authUser?.actingAdmin) return null
  if (hasPlannedTask === null) return null

  const handleHide = () => {
    markDismissed(parentId)
    setDismissed(true)
  }

  return (
    <section className="panel-card overflow-hidden border-t-4 border-t-panel-sage p-5" aria-label="Başlangıç rehberi">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-panel-text-muted">Başlangıç Rehberi</p>
          <h2 className="mt-1 text-lg font-bold text-panel-text">{allRequiredDone ? 'Günlük takibe hazırsınız' : `${firstName(student.fullName)} için sıradaki adım`}</h2>
          <p className="mt-2 text-sm leading-6 text-panel-text-muted">{allRequiredDone ? 'İlk göreviniz planlandı. Aşağıdaki günlük akıştan çalışmaları takip edin; sonuçlar biriktikçe Gelişim Analizi’ni inceleyin.' : 'Profil hazır. Şimdi küçük bir çalışma hedefi belirleyerek planı hayata geçirin.'}</p>
        </div>
        <button
          type="button"
          onClick={handleHide}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-panel-text-muted hover:bg-panel-surface-soft hover:text-panel-text"
        >
          <X size={13} aria-hidden="true" />
          Gizle
        </button>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div role="progressbar" aria-label="Başlangıç adımları" aria-valuemin={0} aria-valuemax={requiredSteps.length} aria-valuenow={requiredDone} className="h-2 flex-1 overflow-hidden rounded-full bg-panel-surface-soft">
          <div
            className="h-full rounded-full bg-panel-sage transition-all"
            style={{ width: `${(requiredDone / requiredSteps.length) * 100}%` }}
          />
        </div>
        <span className="shrink-0 text-xs font-semibold text-panel-text-muted">
          {requiredDone}/{requiredSteps.length} adım tamam
        </span>
      </div>

      <ul className="mt-4 flex flex-col divide-y divide-panel-border">
        {steps.filter((step) => !allRequiredDone || step.optional).map((step) => (
          <li key={step.key} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
            {step.done ? (
              <CheckCircle2 size={20} className="shrink-0 text-panel-sage" aria-hidden="true" />
            ) : (
              <Circle size={20} className="shrink-0 text-panel-border-strong" aria-hidden="true" />
            )}
            <div className="min-w-[140px] flex-1">
              <p
                className={`text-sm font-medium ${
                  step.done ? 'text-panel-text-muted line-through' : 'text-panel-text'
                }`}
              >
                {step.label}
                {step.optional ? (
                  <span className="ml-1.5 text-xs font-normal text-panel-text-muted">(isteğe bağlı)</span>
                ) : null}
              </p>
              {step.hint && !step.done ? (
                <p className="mt-0.5 text-xs leading-5 text-panel-text-muted">{step.hint}</p>
              ) : null}
            </div>
            {!step.done && step.action ? (
              <button
                type="button"
                onClick={step.action}
                className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-panel-border min-h-11 px-3 py-2 text-xs font-semibold text-panel-text hover:bg-panel-surface-soft"
              >
                {step.cta}
                <ArrowRight size={13} aria-hidden="true" />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
