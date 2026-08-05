import { useEffect, useState } from 'react'
import { X, CheckCircle2, XCircle, MinusCircle } from 'lucide-react'
import { getTeacherTaskAnswerSheet } from '../../../services/teacherService'
import LoadingState from '../../shared/LoadingState'

const OPTIONS = ['A', 'B', 'C', 'D']
// Backend'deki BLANK_ANSWER_LABEL ile eşleşmeli (api/src/tasks.js).
const BLANK_LABEL = '-'

function ResultBadge({ result }) {
  if (!result) return null
  return (
    <div className="flex flex-nowrap items-center justify-between gap-1 rounded-xl bg-panel-blue-soft/60 px-2 py-1.5 text-xs font-semibold">
      <span className="flex shrink-0 items-center gap-1 text-emerald-600">
        <CheckCircle2 size={13} aria-hidden="true" /> {result.correct} Doğru
      </span>
      <span className="flex shrink-0 items-center gap-1 text-panel-red">
        <XCircle size={13} aria-hidden="true" /> {result.wrong} Yanlış
      </span>
      <span className="flex shrink-0 items-center gap-1 text-panel-text-muted">
        <MinusCircle size={13} aria-hidden="true" /> {result.blank} Boş
      </span>
    </div>
  )
}

// Öğretmen görünümü salt okunur: öğrencinin kaydettiği cevaplar ve doğru/yanlış/boş
// durumu gösterilir ama düzenlenemez, testler kaldırılamaz.
function TestSection({ test }) {
  const { result, answers } = test
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-panel-border p-2.5">
      <h3
        className="min-w-0 truncate text-xs font-semibold text-panel-text"
        title={test.topicName ? `${test.name} · ${test.topicName}` : test.name}
      >
        {test.name}
        {test.topicName ? <span className="font-normal text-panel-text-muted"> · {test.topicName}</span> : null}
      </h3>

      <ResultBadge result={result} />

      <div className="grid grid-cols-1 gap-y-0.5">
        {Array.from({ length: test.questionCount }, (_, index) => index + 1).map((orderNo) => {
          const key = String(orderNo)
          const selected = answers[key]
          const isBlankSelected = selected === BLANK_LABEL
          const correctLabel = result?.correctLabels?.[key]
          const isMismatch = Boolean(result) && Boolean(correctLabel) && selected !== correctLabel
          const isWrongSelection = isMismatch && Boolean(selected) && !isBlankSelected
          return (
            <div
              key={key}
              className={`flex items-center gap-1.5 rounded-lg px-1 py-0.5 ${isWrongSelection ? 'bg-panel-red-soft' : ''}`}
            >
              <span className="w-5 shrink-0 text-right text-sm font-bold text-panel-text-muted">{orderNo}.</span>
              <div className="flex shrink-0 gap-1">
                {OPTIONS.map((option) => {
                  const isSelected = selected === option
                  const isCorrectReveal = isMismatch && !isSelected && option === correctLabel
                  return (
                    <span
                      key={option}
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                        isSelected
                          ? isWrongSelection
                            ? 'border-panel-red bg-panel-red text-white'
                            : 'border-panel-blue bg-panel-blue text-white'
                          : isCorrectReveal
                            ? 'border-panel-yellow bg-panel-yellow text-white'
                            : 'border-panel-border text-panel-text-muted'
                      }`}
                    >
                      {option}
                    </span>
                  )
                })}
                {isBlankSelected ? (
                  <span className="flex h-6 shrink-0 items-center justify-center rounded-full border border-panel-text-muted bg-panel-text-muted px-1.5 text-[10px] font-semibold text-white">
                    Boş
                  </span>
                ) : null}
              </div>
              {isMismatch && correctLabel ? (
                <span className="min-w-0 truncate text-[10px] italic leading-none text-panel-text-muted">
                  Doğru cevap: {correctLabel}
                </span>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function TaskOpticalResultModal({ task, studentTeacherId, onClose }) {
  const [tests, setTests] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false

    getTeacherTaskAnswerSheet(studentTeacherId, task.id)
      .then(({ tests: fetchedTests }) => {
        if (!ignore) setTests(fetchedTests)
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })

    return () => {
      ignore = true
    }
  }, [studentTeacherId, task.id])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 md:items-center">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-t-3xl border border-panel-border bg-panel-surface md:max-h-[85vh] md:max-w-4xl md:rounded-2xl xl:max-w-6xl 2xl:max-w-7xl">
        <div className="flex items-center justify-between border-b border-panel-border p-5">
          <div>
            <h2 className="text-lg font-semibold text-panel-text">Optik Sonuç · Cevap Anahtarı</h2>
            <p className="text-sm text-panel-text-muted">{task.description || task.title}</p>
          </div>
          <button type="button" aria-label="Kapat" onClick={onClose} className="text-panel-text-muted hover:text-panel-text">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {error ? <div className="mb-4 rounded-xl bg-panel-accent-soft px-4 py-3 text-sm text-panel-warm">{error}</div> : null}

          {tests === null ? (
            <LoadingState label="Cevap anahtarı yükleniyor..." />
          ) : tests.length === 0 ? (
            <p className="text-sm text-panel-text-muted">Bu göreve bağlı test bulunamadı.</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
              {tests.map((test) => (
                <TestSection key={test.id} test={test} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
