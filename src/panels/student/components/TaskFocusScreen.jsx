import { useRef, useState } from 'react'
import { X, Camera } from 'lucide-react'
import StudyTimer from './StudyTimer'
import QuestionCounter from './QuestionCounter'

export default function TaskFocusScreen({
  task,
  onClose,
  onFinishSession,
  onToggleSubGoal,
  onSubmitReflection,
  onOpenHomeworkModal,
}) {
  const [questionCount, setQuestionCount] = useState(task.completedQuestionCount || 0)
  const [showStuckForm, setShowStuckForm] = useState(false)
  const [stuckNote, setStuckNote] = useState('')
  const [reflectionAnswers, setReflectionAnswers] = useState({})
  const elapsedRef = useRef(0)

  if (task.taskType === 'gunluk-degerlendirme') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-panel-bg p-4">
        <div className="w-full max-w-lg rounded-2xl border border-panel-border bg-panel-surface p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-panel-text">{task.title}</h2>
            <button type="button" aria-label="Kapat" onClick={onClose}>
              <X size={22} />
            </button>
          </div>
          <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
            {(task.reflectionQuestions || []).map((question, index) => (
              <label key={question} className="flex flex-col gap-1.5">
                <span className="text-base font-medium text-panel-text">{question}</span>
                <textarea
                  rows={2}
                  value={reflectionAnswers[index] || ''}
                  onChange={(event) =>
                    setReflectionAnswers((current) => ({ ...current, [index]: event.target.value }))
                  }
                  className="rounded-xl border border-panel-border p-3 text-base text-panel-text"
                />
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onSubmitReflection(reflectionAnswers)}
            className="mt-5 w-full rounded-xl bg-panel-blue px-4 py-3 text-base font-semibold text-white"
          >
            Değerlendirmeyi Tamamla
          </button>
        </div>
      </div>
    )
  }

  const isPlanningTask = task.taskType === 'planlama'

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-panel-bg">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 p-4 py-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-panel-text-muted">
              {task.subject || task.startTime + ' – ' + task.endTime}
            </p>
            <h2 className="text-xl font-semibold text-panel-text">{task.title}</h2>
          </div>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={22} />
          </button>
        </div>

        {task.focusMessage ? (
          <p className="rounded-xl bg-panel-blue-soft px-4 py-3 text-base text-panel-text">{task.focusMessage}</p>
        ) : (
          <p className="rounded-xl bg-panel-blue-soft px-4 py-3 text-base text-panel-text">
            Şu an yalnızca bu {task.durationMinutes} dakikaya odaklan. Geri kalanını TechCoach takip ediyor.
          </p>
        )}

        <StudyTimer onElapsedChange={(seconds) => (elapsedRef.current = seconds)} />

        {task.targetQuestionCount ? (
          <QuestionCounter value={questionCount} target={task.targetQuestionCount} onChange={setQuestionCount} />
        ) : null}

        {task.subGoals ? (
          <div className="rounded-2xl border border-panel-border bg-panel-surface p-5">
            <p className="mb-3 text-sm font-medium text-panel-text-muted">Alt hedefler</p>
            <ul className="flex flex-col gap-2">
              {task.subGoals.map((goal, index) => {
                const done = (task.completedSubGoals || []).includes(index)
                return (
                  <li key={goal}>
                    <label className="flex items-center gap-2 text-base text-panel-text">
                      <input
                        type="checkbox"
                        checked={done}
                        onChange={() => onToggleSubGoal(index)}
                        className="h-5 w-5 rounded border-panel-border"
                      />
                      <span className={done ? 'line-through text-panel-text-muted' : ''}>{goal}</span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}

        {isPlanningTask ? (
          <button
            type="button"
            onClick={onOpenHomeworkModal}
            className="rounded-xl border border-panel-lilac bg-panel-lilac-soft px-4 py-3 text-base font-semibold text-panel-lilac"
          >
            + Ödev Ekle
          </button>
        ) : null}

        {showStuckForm ? (
          <div className="rounded-2xl border border-panel-border bg-panel-surface p-4">
            <p className="mb-2 text-sm font-medium text-panel-text-muted">Takıldığım soru</p>
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-dashed border-panel-border p-3 text-sm text-panel-text-muted">
              <Camera size={18} aria-hidden="true" />
              Fotoğraf ekleme yakında burada olacak
            </div>
            <textarea
              rows={2}
              placeholder="Soru numarası, konu veya kısa notunu yaz"
              value={stuckNote}
              onChange={(event) => setStuckNote(event.target.value)}
              className="w-full rounded-xl border border-panel-border p-3 text-base text-panel-text"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowStuckForm(true)}
            className="rounded-xl border border-panel-border px-4 py-3 text-base font-medium text-panel-text"
          >
            Takıldığım soruyu kaydet
          </button>
        )}

        <div className="mt-auto flex gap-2 pt-4">
          <button
            type="button"
            onClick={() =>
              onFinishSession({
                elapsedSeconds: elapsedRef.current,
                completedQuestionCount: questionCount,
                stuckNote,
              })
            }
            className="flex-1 rounded-xl bg-panel-blue px-4 py-3 text-base font-semibold text-white"
          >
            Çalışmayı Bitir
          </button>
        </div>
      </div>
    </div>
  )
}
