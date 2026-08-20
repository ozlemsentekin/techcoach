import { useEffect, useState } from 'react'
import { ArrowLeft, Check, ChevronDown, ChevronRight, Pencil, X } from 'lucide-react'
import Badge from '../../ui/Badge'
import Button from '../../ui/Button'
import LoadingState from '../../shared/LoadingState'
import { ResourceBookAvatar, ResourceBookRates } from '../../shared/ResourceBookCard'
import ManualOpticalAnswerModal from '../../shared/ManualOpticalAnswerModal'
import {
  getTeacherResourceBooks,
  getTeacherResourceBookTopics,
  markTeacherResourceBookTopicTestCompletion,
  unmarkTeacherResourceBookTopicTestCompletion,
  submitTeacherManualOpticalAnswers,
  saveTeacherManualWrongQuestionPhoto,
} from '../../../services/teacherService'

function ManualResultForm({ test, onCancel, onSave, onSaveWithoutResults, saving, error }) {
  const [correctCount, setCorrectCount] = useState(test.correctCount ?? '')
  const [wrongCount, setWrongCount] = useState(test.wrongCount ?? '')
  const [blankCount, setBlankCount] = useState(test.blankCount ?? '')

  return (
    <div className="ml-5.5 mt-1 flex flex-col gap-2 rounded-lg border border-panel-border bg-panel-surface-soft p-2.5">
      <p className="text-[11px] text-panel-text-muted">{test.questionCount} soru · isteğe bağlı sonuç girebilirsiniz</p>
      <div className="grid grid-cols-3 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-panel-text-muted">Doğru</span>
          <input
            type="number"
            min="0"
            value={correctCount}
            onChange={(event) => setCorrectCount(event.target.value)}
            className="rounded-md border border-panel-border px-2 py-1 text-sm text-panel-text"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-panel-text-muted">Yanlış</span>
          <input
            type="number"
            min="0"
            value={wrongCount}
            onChange={(event) => setWrongCount(event.target.value)}
            className="rounded-md border border-panel-border px-2 py-1 text-sm text-panel-text"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-panel-text-muted">Boş</span>
          <input
            type="number"
            min="0"
            value={blankCount}
            onChange={(event) => setBlankCount(event.target.value)}
            className="rounded-md border border-panel-border px-2 py-1 text-sm text-panel-text"
          />
        </label>
      </div>
      {error ? <p className="text-[11px] text-panel-warm">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" disabled={saving} onClick={() => onSave({ correctCount, wrongCount, blankCount })}>
          {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </Button>
        <button
          type="button"
          disabled={saving}
          onClick={onSaveWithoutResults}
          className="text-xs font-medium text-panel-blue hover:underline disabled:opacity-50"
        >
          Sayı girmeden işaretle
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onCancel}
          className="ml-auto text-xs font-medium text-panel-text-muted hover:underline disabled:opacity-50"
        >
          Vazgeç
        </button>
      </div>
    </div>
  )
}

function BookTopics({ studentTeacherId, book }) {
  const [topics, setTopics] = useState(null)
  const [error, setError] = useState('')
  const [collapsedTopicIds, setCollapsedTopicIds] = useState(new Set())
  const [savingTestIds, setSavingTestIds] = useState(new Set())
  const [rowErrors, setRowErrors] = useState({})
  const [editingTestId, setEditingTestId] = useState(null)
  const [editError, setEditError] = useState('')
  const [opticalTest, setOpticalTest] = useState(null)

  useEffect(() => {
    let ignore = false

    getTeacherResourceBookTopics(studentTeacherId, book.id)
      .then((data) => {
        if (!ignore) {
          setTopics(data)
          setCollapsedTopicIds(new Set(data.map((topic) => topic.id)))
        }
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })

    return () => {
      ignore = true
    }
  }, [studentTeacherId, book.id])

  const toggleTopicCollapsed = (topicId) => {
    setCollapsedTopicIds((prev) => {
      const next = new Set(prev)
      if (next.has(topicId)) next.delete(topicId)
      else next.add(topicId)
      return next
    })
  }

  const applyCompletionSource = (testId, completionSource, resultCounts = {}) => {
    setTopics((current) =>
      current.map((topic) => ({
        ...topic,
        tests: topic.tests.map((test) =>
          test.id === testId
            ? {
                ...test,
                completed: Boolean(completionSource),
                completionSource,
                correctCount: resultCounts.correctCount,
                wrongCount: resultCounts.wrongCount,
                blankCount: resultCounts.blankCount,
              }
            : test,
        ),
      })),
    )
  }

  const unmarkManualCompletion = async (test) => {
    if (savingTestIds.has(test.id)) return

    const previousSource = test.completionSource
    const previousResults = { correctCount: test.correctCount, wrongCount: test.wrongCount, blankCount: test.blankCount }

    setSavingTestIds((prev) => new Set(prev).add(test.id))
    setRowErrors((prev) => {
      const next = { ...prev }
      delete next[test.id]
      return next
    })

    applyCompletionSource(test.id, null)

    try {
      await unmarkTeacherResourceBookTopicTestCompletion(studentTeacherId, test.id)
    } catch (err) {
      applyCompletionSource(test.id, previousSource, previousResults)
      setRowErrors((prev) => ({ ...prev, [test.id]: err.message }))
    } finally {
      setSavingTestIds((prev) => {
        const next = new Set(prev)
        next.delete(test.id)
        return next
      })
    }
  }

  const saveManualCompletion = async (test, { correctCount, wrongCount, blankCount } = {}) => {
    setSavingTestIds((prev) => new Set(prev).add(test.id))
    setEditError('')

    const toNullableInt = (value) => {
      if (value === '' || value === undefined || value === null) return undefined
      const parsed = Number(value)
      return Number.isFinite(parsed) ? parsed : undefined
    }

    const body = {
      correctCount: toNullableInt(correctCount),
      wrongCount: toNullableInt(wrongCount),
      blankCount: toNullableInt(blankCount),
    }

    try {
      await markTeacherResourceBookTopicTestCompletion(studentTeacherId, test.id, body)
      applyCompletionSource(test.id, 'manual', body)
      setEditingTestId(null)
    } catch (err) {
      setEditError(err.message)
    } finally {
      setSavingTestIds((prev) => {
        const next = new Set(prev)
        next.delete(test.id)
        return next
      })
    }
  }

  const applyOpticalResult = (testId, updates) => {
    setTopics((current) =>
      current.map((topic) => ({
        ...topic,
        tests: topic.tests.map((test) => (test.id === testId ? { ...test, completed: true, ...updates } : test)),
      })),
    )
  }

  if (error) {
    return <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-sm text-panel-warm">{error}</div>
  }

  if (topics === null) {
    return <LoadingState label="İçerikler yükleniyor..." />
  }

  if (topics.length === 0) {
    return <p className="p-2 text-sm text-panel-text-muted">Bu kaynağa ait içerik yok.</p>
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-panel-text-muted">
        Bir testin kutusuna tıklayınca, cevap anahtarı girilmiş testler için optik form açılır (şıkları
        işaretleyin, doğru/yanlış/boş otomatik hesaplanır); diğerlerinde sayıyı elle girersiniz. Elle işaretlenmiş
        bir testin kutusuna tekrar tıklamak işareti kaldırır; sonuçları değiştirmek için kalem simgesini kullanın.
      </p>
      {opticalTest ? (
        <ManualOpticalAnswerModal
          test={opticalTest}
          onClose={() => setOpticalTest(null)}
          onSaved={(testId, updates) => {
            applyOpticalResult(testId, updates)
          }}
          submitAnswers={(answers) => submitTeacherManualOpticalAnswers(studentTeacherId, opticalTest.id, answers)}
          submitPhoto={(orderNo, dataUrl) =>
            saveTeacherManualWrongQuestionPhoto(studentTeacherId, opticalTest.id, orderNo, dataUrl)
          }
        />
      ) : null}
      <div className="flex flex-col rounded-xl border border-panel-border p-2">
        {topics.map((topic) => {
          const isCollapsed = collapsedTopicIds.has(topic.id)
          const totalTests = topic.tests.length
          const completedTests = topic.tests.filter((test) => test.completed).length
          const completionPercentage = totalTests > 0 ? Math.round((completedTests / totalTests) * 100) : 0
          return (
            <div key={topic.id} className="py-0.5">
              <button
                type="button"
                onClick={() => toggleTopicCollapsed(topic.id)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-panel-blue-soft"
              >
                {isCollapsed ? (
                  <ChevronRight size={14} className="shrink-0 text-panel-text-muted" />
                ) : (
                  <ChevronDown size={14} className="shrink-0 text-panel-text-muted" />
                )}
                <span className="min-w-0 flex-1 truncate font-medium text-panel-text">{topic.name}</span>
                {totalTests > 0 ? (
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-panel-surface-soft sm:block">
                      <span
                        className="block h-full rounded-full bg-panel-blue transition-all"
                        style={{ width: `${completionPercentage}%` }}
                      />
                    </span>
                    <span className="text-[11px] font-medium tabular-nums text-panel-text-muted">
                      {completedTests}/{totalTests} · %{completionPercentage}
                    </span>
                  </span>
                ) : null}
              </button>
              {topic.tests.length && !isCollapsed ? (
                <div className="ml-6 flex flex-col">
                  {topic.tests.map((test) => {
                    const isGraded = test.completionSource === 'graded'
                    const isManual = test.completionSource === 'manual'
                    const isSaving = savingTestIds.has(test.id)
                    const hasResults =
                      test.correctCount !== undefined || test.wrongCount !== undefined || test.blankCount !== undefined
                    return (
                      <div key={test.id} className="relative rounded-lg px-2 py-1">
                        <div className="flex items-center gap-2 text-xs">
                          {isGraded ? (
                            <span
                              className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm bg-panel-blue text-white"
                              title="Dijital olarak değerlendirilmiş"
                            >
                              <Check size={10} strokeWidth={3} />
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => {
                                if (isManual) {
                                  unmarkManualCompletion(test)
                                } else if (test.hasAnswerKey) {
                                  setOpticalTest(test)
                                } else {
                                  setEditError('')
                                  setEditingTestId(test.id)
                                }
                              }}
                              title={
                                rowErrors[test.id]
                                  ? rowErrors[test.id]
                                  : isManual
                                    ? 'İşareti kaldır'
                                    : 'Tamamlandı olarak işaretle'
                              }
                              className="-m-1.5 flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-sm p-1.5 disabled:opacity-50"
                            >
                              <span
                                className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border transition-colors ${
                                  rowErrors[test.id]
                                    ? 'border-panel-warm'
                                    : isManual
                                      ? 'border-panel-blue bg-panel-blue text-white'
                                      : 'border-panel-border bg-white hover:border-panel-blue'
                                }`}
                              >
                                {isManual ? <Check size={10} strokeWidth={3} /> : null}
                              </span>
                            </button>
                          )}
                          <span className="flex min-w-0 items-center gap-1.5 text-panel-text-muted">
                            {test.topicName ? (
                              <Badge tone="slate" className="shrink-0">
                                {test.topicName}
                              </Badge>
                            ) : null}
                            <span className="truncate">
                              {test.name} · s.{test.pageStart}-{test.pageEnd} · {test.questionCount} soru
                            </span>
                            {isManual ? (
                              <Badge tone="lilac" className="shrink-0">
                                Elle işaretlendi
                              </Badge>
                            ) : null}
                            {isManual && hasResults ? (
                              <span className="flex shrink-0 items-center gap-1">
                                <Badge tone="sage">D:{test.correctCount ?? 0}</Badge>
                                <Badge tone="red">Y:{test.wrongCount ?? 0}</Badge>
                                <Badge tone="yellow">B:{test.blankCount ?? 0}</Badge>
                              </span>
                            ) : null}
                            {isManual ? (
                              <button
                                type="button"
                                title="Sonuçları düzenle"
                                onClick={() => {
                                  if (test.hasAnswerKey) {
                                    setOpticalTest(test)
                                  } else {
                                    setEditError('')
                                    setEditingTestId(test.id)
                                  }
                                }}
                                className="shrink-0 text-panel-text-muted hover:text-panel-blue"
                              >
                                <Pencil size={12} aria-hidden="true" />
                              </button>
                            ) : null}
                          </span>
                        </div>
                        {rowErrors[test.id] ? (
                          <span className="absolute left-5.5 top-full z-10 whitespace-nowrap rounded-md border border-panel-border bg-white px-2 py-1 text-[11px] text-panel-warm shadow-sm">
                            {rowErrors[test.id]}
                          </span>
                        ) : null}
                        {editingTestId === test.id ? (
                          <ManualResultForm
                            test={test}
                            saving={isSaving}
                            error={editError}
                            onCancel={() => {
                              setEditingTestId(null)
                              setEditError('')
                            }}
                            onSave={(counts) => saveManualCompletion(test, counts)}
                            onSaveWithoutResults={() =>
                              saveManualCompletion(test, { correctCount: '', wrongCount: '', blankCount: '' })
                            }
                          />
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function StudentResourceLibraryModal({ student, onClose }) {
  const [resourceBooks, setResourceBooks] = useState(null)
  const [error, setError] = useState('')
  const [selectedBook, setSelectedBook] = useState(null)

  useEffect(() => {
    let ignore = false

    getTeacherResourceBooks(student.studentTeacherId)
      .then((data) => {
        if (!ignore) setResourceBooks(data)
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })

    return () => {
      ignore = true
    }
  }, [student.studentTeacherId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col panel-card p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {selectedBook ? (
              <button
                type="button"
                onClick={() => setSelectedBook(null)}
                aria-label="Kaynak listesine dön"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-panel-text-muted hover:bg-panel-surface-soft"
              >
                <ArrowLeft size={18} aria-hidden="true" />
              </button>
            ) : null}
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-panel-text">
                {selectedBook ? selectedBook.name : `${student.studentFullName} · Kaynaklar`}
              </h2>
              {selectedBook?.publisherName ? (
                <p className="text-xs text-panel-text-muted">{selectedBook.publisherName}</p>
              ) : null}
            </div>
          </div>
          <button type="button" aria-label="Kapat" onClick={onClose} className="shrink-0">
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {selectedBook ? (
            <BookTopics key={selectedBook.id} studentTeacherId={student.studentTeacherId} book={selectedBook} />
          ) : error ? (
            <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-sm text-panel-warm">{error}</div>
          ) : resourceBooks === null ? (
            <LoadingState label="Kaynaklar yükleniyor..." />
          ) : resourceBooks.length === 0 ? (
            <p className="p-2 text-sm text-panel-text-muted">Bu öğrenci için takip edilen kaynak yok.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {resourceBooks.map((book) => (
                <button
                  key={book.id}
                  type="button"
                  onClick={() => setSelectedBook(book)}
                  className="group flex items-start gap-3.5 rounded-2xl border border-panel-border bg-white p-3.5 text-left shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-panel-blue hover:shadow-md"
                >
                  <ResourceBookAvatar book={book} size="lg" />
                  <div className="min-w-0 flex-1">
                    {book.publisherName ? (
                      <Badge tone="lilac" className="mb-1 w-fit">
                        {book.publisherName}
                      </Badge>
                    ) : null}
                    <p className="truncate text-sm font-semibold text-panel-text group-hover:text-panel-blue">{book.name}</p>
                    {book.subjectName ? <p className="truncate text-xs text-panel-text-muted">{book.subjectName}</p> : null}
                    <ResourceBookRates completionRate={book.completionRate} successRate={book.successRate} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
