import { useEffect, useMemo, useState } from 'react'
import { X, CheckCircle2, XCircle, MinusCircle } from 'lucide-react'
import { getTaskAnswerSheet, saveTaskAnswers } from '../../../services/taskService'
import LoadingState from '../../shared/LoadingState'

const OPTIONS = ['A', 'B', 'C', 'D']

function buildInitialAnswers(tests) {
  const initial = {}
  tests.forEach((test) => {
    initial[test.id] = { ...(test.answers || {}) }
  })
  return initial
}

function ResultBadge({ result }) {
  if (!result) return null
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl bg-student-theme-soft px-3 py-2 text-sm font-semibold">
      <span className="flex items-center gap-1.5 text-panel-sage">
        <CheckCircle2 size={16} aria-hidden="true" /> {result.correct} Doğru
      </span>
      <span className="flex items-center gap-1.5 text-panel-red">
        <XCircle size={16} aria-hidden="true" /> {result.wrong} Yanlış
      </span>
      <span className="flex items-center gap-1.5 text-panel-text-muted">
        <MinusCircle size={16} aria-hidden="true" /> {result.blank} Boş
      </span>
    </div>
  )
}

function TestSection({ test, answers, result, onSelect }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-panel-border p-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-bold text-panel-text">{test.name}</h3>
        {test.topicName ? <p className="text-xs text-panel-text-muted">{test.topicName}</p> : null}
      </div>

      <ResultBadge result={result} />

      <div className="grid grid-cols-1 gap-y-2">
        {Array.from({ length: test.questionCount }, (_, index) => index + 1).map((orderNo) => {
          const key = String(orderNo)
          const selected = answers[key]
          const correctLabel = result?.correctLabels?.[key]
          const isWrong = Boolean(result) && Boolean(selected) && Boolean(correctLabel) && selected !== correctLabel
          return (
            <div
              key={key}
              className={`flex items-center gap-2 rounded-lg px-2 py-1 transition-colors ${
                isWrong ? 'bg-panel-red-soft' : ''
              }`}
            >
              <span className="w-6 shrink-0 text-right text-sm font-bold text-panel-text-muted">{orderNo}.</span>
              <div className="flex gap-1.5">
                {OPTIONS.map((option) => {
                  const isSelected = selected === option
                  const isCorrectReveal = isWrong && !isSelected && option === correctLabel
                  return (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={isSelected}
                      aria-label={`${orderNo}. soru için ${option} şıkkı`}
                      onClick={() => onSelect(orderNo, isSelected ? null : option)}
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-student-theme-primary ${
                        isSelected
                          ? isWrong
                            ? 'border-panel-red bg-panel-red text-white'
                            : 'border-student-theme-primary bg-student-theme-primary text-student-theme-button-text'
                          : isCorrectReveal
                            ? 'border-panel-yellow bg-panel-yellow text-white'
                            : 'border-panel-border text-panel-text-muted hover:border-student-theme-primary hover:text-student-theme-text'
                      }`}
                    >
                      {option}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function TaskAnswerSheetModal({ task, lessonLabel, onClose, onSaved }) {
  const [tests, setTests] = useState(null)
  const [error, setError] = useState('')
  const [answersByTest, setAnswersByTest] = useState({})
  const [resultsByTest, setResultsByTest] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let ignore = false

    getTaskAnswerSheet(task.id)
      .then((data) => {
        if (ignore) return
        setTests(data)
        setAnswersByTest(buildInitialAnswers(data))
        setResultsByTest(Object.fromEntries(data.map((test) => [test.id, test.result])))
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })

    return () => {
      ignore = true
    }
  }, [task.id])

  const totalQuestions = useMemo(() => (tests || []).reduce((sum, test) => sum + test.questionCount, 0), [tests])

  const handleSelect = (testId, orderNo, label) => {
    setAnswersByTest((prev) => {
      const next = { ...prev, [testId]: { ...prev[testId] } }
      if (label) next[testId][orderNo] = label
      else delete next[testId][orderNo]
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const payload = (tests || []).map((test) => ({ testId: test.id, answers: answersByTest[test.id] || {} }))
      const updatedTask = await saveTaskAnswers(task.id, payload)
      setResultsByTest(updatedTask.testResults || {})
      onSaved(updatedTask)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 md:items-center">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-t-3xl border border-panel-border bg-panel-surface md:max-h-[85vh] md:max-w-4xl md:rounded-2xl xl:max-w-6xl">
        <div className="flex items-center justify-between border-b border-panel-border p-5">
          <div>
            <h2 className="text-lg font-semibold text-panel-text">Cevap Kağıdı</h2>
            <p className="text-sm text-panel-text-muted">
              {lessonLabel} · {task.title}
            </p>
          </div>
          <button type="button" aria-label="Kapat" onClick={onClose} className="text-panel-text-muted hover:text-panel-text">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {error ? <div className="mb-4 rounded-xl bg-panel-accent-soft px-4 py-3 text-sm text-panel-warm">{error}</div> : null}

          {tests === null ? (
            <LoadingState label="Testler yükleniyor..." />
          ) : tests.length === 0 ? (
            <p className="text-sm text-panel-text-muted">Bu göreve bağlı test bulunamadı.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {tests.map((test) => (
                <TestSection
                  key={test.id}
                  test={test}
                  answers={answersByTest[test.id] || {}}
                  result={resultsByTest[test.id]}
                  onSelect={(orderNo, label) => handleSelect(test.id, orderNo, label)}
                />
              ))}
            </div>
          )}
        </div>

        {tests?.length ? (
          <div className="border-t border-panel-border p-5">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="w-full rounded-xl bg-student-theme-primary px-4 py-3 text-sm font-semibold text-student-theme-button-text hover:bg-student-theme-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-student-theme-primary disabled:opacity-60"
            >
              {saving ? 'Kaydediliyor...' : `Kaydet (${totalQuestions} soru)`}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
