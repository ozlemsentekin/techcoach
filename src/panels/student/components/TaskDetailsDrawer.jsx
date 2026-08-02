import { useEffect, useState } from 'react'
import { Coffee, Sun, Utensils, X } from 'lucide-react'
import { FOCUS_TASK_TYPES } from '../../../data/taskTypes'

const CREATED_BY_LABELS = {
  ebeveyn: 'Ebeveyn',
  ogrenci: 'Kendim',
  koc: 'Koç',
}

const ACTIVE_STATUSES = new Set(['bekliyor', 'devam-ediyor', 'yardim-bekliyor'])
const BREAK_TASK_TYPES = new Set(['mola', 'dinlenme', 'yemek', 'yemek-dinlenme'])

function BreakTypeIcon({ taskType, size = 19 }) {
  if (taskType === 'yemek' || taskType === 'yemek-dinlenme') {
    return <Utensils size={size} aria-hidden="true" />
  }

  return <Coffee size={size} aria-hidden="true" />
}

function FreeTimeIcon({ size = 19 }) {
  return <Sun size={size} aria-hidden="true" />
}

function DetailRow({ label, value }) {
  if (!value) return null
  return (
    <div className="flex flex-col gap-0.5 border-b border-panel-border py-3 first:pt-0 last:border-0">
      <span className="text-xs font-medium uppercase tracking-wide text-panel-text-muted">{label}</span>
      <span className="text-sm text-panel-text">{value}</span>
    </div>
  )
}

export default function TaskDetailsDrawer({
  task,
  lessonLabel,
  onClose,
  onComplete,
  onPartialComplete,
  onReschedule,
  onHelp,
  onSaveNotes,
}) {
  const isFocusType = FOCUS_TASK_TYPES.has(task.taskType) || task.taskType === 'gunluk-degerlendirme'
  const isActive = ACTIVE_STATUSES.has(task.status)
  const isBreakTask = BREAK_TASK_TYPES.has(task.taskType)
  const isFreeTimeTask = task.taskType === 'serbest-zaman'
  const [noteDraft, setNoteDraft] = useState(task.notes || '')
  const [savingNote, setSavingNote] = useState(false)
  const [noteStatus, setNoteStatus] = useState('')

  useEffect(() => {
    setNoteDraft(task.notes || '')
    setNoteStatus('')
  }, [task.id, task.notes])

  const handleSaveNotes = async () => {
    if (!onSaveNotes || savingNote) return

    setSavingNote(true)
    setNoteStatus('')
    try {
      await onSaveNotes(task, noteDraft)
      setNoteStatus('Not kaydedildi.')
    } catch (error) {
      setNoteStatus(error.message || 'Not kaydedilemedi.')
    } finally {
      setSavingNote(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 md:items-stretch md:justify-end">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-3xl border border-panel-border bg-panel-surface md:h-full md:max-h-none md:rounded-none md:rounded-l-2xl">
        <div className="flex items-center justify-between border-b border-panel-border p-5">
          <h2 className="text-lg font-semibold text-panel-text">
            {isFreeTimeTask ? 'Serbest Zaman Detayı' : isBreakTask ? 'Mola Detayı' : 'Görev Detayı'}
          </h2>
          <button type="button" aria-label="Kapat" onClick={onClose} className="text-panel-text-muted hover:text-panel-text">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="flex items-start gap-3">
            {isBreakTask || isFreeTimeTask ? (
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  isFreeTimeTask ? 'bg-panel-accent-soft text-panel-accent' : 'bg-panel-sage-soft text-panel-sage'
                }`}
              >
                {isFreeTimeTask ? <FreeTimeIcon size={19} /> : <BreakTypeIcon taskType={task.taskType} size={19} />}
              </span>
            ) : null}
            <h3 className="min-w-0 text-xl font-semibold text-panel-text">{task.title}</h3>
          </div>

          <div className="mt-2 flex flex-col">
            <DetailRow label={isBreakTask || isFreeTimeTask ? 'Tür' : 'Ders'} value={lessonLabel} />
            <DetailRow label="Konu" value={task.topic} />
            <DetailRow label="İçerik" value={task.description} />
            {!isBreakTask && !isFreeTimeTask ? (
              <DetailRow
                label="Soru Sayısı"
                value={task.targetQuestionCount ? `${task.completedQuestionCount || 0} / ${task.targetQuestionCount} soru` : null}
              />
            ) : null}
            <DetailRow label={isBreakTask || isFreeTimeTask ? 'Planlanan Süre' : 'Tahmini Süre'} value={task.durationMinutes ? `${task.durationMinutes} dakika` : null} />
            <DetailRow label={isBreakTask || isFreeTimeTask ? 'Bitiş Zamanı' : 'Son Teslim Zamanı'} value={task.endTime ? `Bugün ${task.endTime}` : null} />
            <DetailRow label={isFreeTimeTask ? 'Ekleyen' : 'Ödevi Atayan'} value={CREATED_BY_LABELS[task.createdBy] || task.createdBy} />
            <DetailRow label="Öğretmen / Ebeveyn Notu" value={task.parentNote} />
            {!isFreeTimeTask ? <DetailRow label="Kendi Notların" value={task.notes} /> : null}
          </div>

          {isFreeTimeTask ? (
            <label className="mt-5 flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-panel-text-muted">Not</span>
              <textarea
                rows={5}
                value={noteDraft}
                onChange={(event) => {
                  setNoteDraft(event.target.value)
                  setNoteStatus('')
                }}
                className="rounded-xl border border-panel-border bg-panel-surface p-3 text-sm text-panel-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panel-accent"
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSaveNotes}
                  disabled={savingNote}
                  className="rounded-lg bg-panel-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-panel-accent/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panel-accent disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {savingNote ? 'Kaydediliyor...' : 'Notu Kaydet'}
                </button>
                {noteStatus ? <span className="text-sm font-medium text-panel-text-muted">{noteStatus}</span> : null}
              </div>
            </label>
          ) : null}
        </div>

        {isActive && !isFreeTimeTask ? (
          <div className="flex flex-col gap-2 border-t border-panel-border p-5">
            {!isFocusType ? (
              <button
                type="button"
                onClick={() => onComplete(task)}
                aria-label={isBreakTask ? 'Molayı tamamladım olarak işaretle' : 'Görevi tamamladım olarak işaretle'}
                className={`rounded-lg px-4 py-2.5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                  isBreakTask
                    ? 'bg-panel-sage text-white hover:bg-panel-sage/90 focus-visible:outline-panel-sage'
                    : 'bg-student-theme-primary text-student-theme-button-text hover:bg-student-theme-hover focus-visible:outline-student-theme-primary'
                }`}
              >
                {isBreakTask ? 'Molayı tamamladım' : 'Tamamladım'}
              </button>
            ) : null}
            {!isBreakTask ? (
              <button
                type="button"
                onClick={() => onPartialComplete(task)}
                aria-label="Görevi kısmen tamamladım olarak işaretle"
                className="rounded-lg border border-panel-border px-4 py-2.5 text-sm font-medium text-panel-text hover:border-student-theme-primary hover:bg-student-theme-soft hover:text-student-theme-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-student-theme-primary"
              >
                Kısmen tamamladım
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onReschedule(task)}
              aria-label={isBreakTask ? 'Molayı başka bir güne veya saate taşı' : 'Görevi başka bir güne veya saate taşı'}
              className={`rounded-lg border border-panel-border px-4 py-2.5 text-sm font-medium text-panel-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                isBreakTask
                  ? 'hover:border-panel-sage hover:bg-panel-sage-soft hover:text-panel-sage focus-visible:outline-panel-sage'
                  : 'hover:border-student-theme-primary hover:bg-student-theme-soft hover:text-student-theme-text focus-visible:outline-student-theme-primary'
              }`}
            >
              {isBreakTask ? 'Molayı başka saate taşı' : 'Yarına / başka saate taşı'}
            </button>
            {!isBreakTask ? (
              <button
                type="button"
                onClick={() => onHelp(task)}
                aria-label="Bu görev için yardım iste"
                className="rounded-lg border border-panel-border px-4 py-2.5 text-sm font-medium text-panel-text hover:border-student-theme-primary hover:bg-student-theme-soft hover:text-student-theme-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-student-theme-primary"
              >
                Yardıma ihtiyacım var
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
