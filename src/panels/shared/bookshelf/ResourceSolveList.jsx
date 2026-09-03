import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, ChevronRight, ImageOff, Pencil, RotateCcw, Search, X } from 'lucide-react'
import Badge from '../../ui/Badge'
import Button from '../../ui/Button'
import LoadingState from '../LoadingState'
import SuccessCelebration from '../SuccessCelebration'
import { authRequest } from '../../../services/authClient'
import { verifyMistakePhotoQuestionNumber } from '../../../services/mistakePhotoService'
import ManualOpticalAnswerModal from '../ManualOpticalAnswerModal'
import { filterTopicsBySearch } from '../homework/topicSearch'

// Bir kaynağın konularını + testlerini listeleyip, her testin sonucunu girmeyi sağlar.
// Cevap anahtarı olan testte optik form (ManualOpticalAnswerModal), olmayanlarda elle
// doğru/yanlış/boş girişi açılır. Veli "Çocuklarım → Kaynaklar" ve "Kitaplık" ekranlarında
// ortak kullanılır — panel'e özgü hiçbir şey yok, sadece studentId + book yeterli.
function ManualResultForm({ test, onCancel, onSave, onSaveWithoutResults, saving, error }) {
  const [correctCount, setCorrectCount] = useState(test.correctCount ?? '')
  const [wrongCount, setWrongCount] = useState(test.wrongCount ?? '')
  const [blankCount, setBlankCount] = useState(test.blankCount ?? '')

  return (
    <div className="mt-1.5 flex min-w-0 flex-col gap-2 rounded-lg border border-panel-border bg-panel-surface-soft p-2.5">
      <p className="text-[11px] text-panel-text-muted">{test.questionCount} soru</p>
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
        <Button
          type="button"
          size="sm"
          disabled={saving}
          onClick={() => onSave({ correctCount, wrongCount, blankCount })}
        >
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

function ResultChips({ test }) {
  const hasResults =
    test.correctCount !== undefined || test.wrongCount !== undefined || test.blankCount !== undefined
  if (!hasResults) return null
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-semibold">
      <span className="text-panel-sage">D {test.correctCount ?? 0}</span>
      <span className="text-panel-red">Y {test.wrongCount ?? 0}</span>
      <span className="text-panel-text-muted">B {test.blankCount ?? 0}</span>
    </span>
  )
}

export default function ResourceSolveList({ studentId, book }) {
  const [topics, setTopics] = useState(null)
  const [error, setError] = useState('')
  const [collapsedTopicIds, setCollapsedTopicIds] = useState(new Set())
  const [savingTestIds, setSavingTestIds] = useState(new Set())
  const [rowErrors, setRowErrors] = useState({})
  const [editingTestId, setEditingTestId] = useState(null)
  const [editError, setEditError] = useState('')
  const [opticalTest, setOpticalTest] = useState(null)
  const [wrongQuestions, setWrongQuestions] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showUnsolvedOnly, setShowUnsolvedOnly] = useState(false)
  const [celebrate, setCelebrate] = useState(false)

  useEffect(() => {
    let ignore = false

    authRequest(`/api/panel/resource-book-topics?resourceBookId=${book.id}&studentId=${studentId}`)
      .then((data) => {
        if (!ignore) {
          setTopics(data.topics)
          setCollapsedTopicIds(new Set(data.topics.map((topic) => topic.id)))
        }
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })

    return () => {
      ignore = true
    }
  }, [studentId, book.id])

  // Hata defterine hangi testlerden en az bir soru fotoğrafı eklenmiş bilmek için tek seferde çekilir.
  useEffect(() => {
    let ignore = false

    authRequest(`/api/panel/wrong-questions?studentId=${studentId}&resourceBookId=${book.id}`)
      .then((data) => {
        if (!ignore) setWrongQuestions(data.wrongQuestions || [])
      })
      .catch(() => {
        // Sessizce yok say: uyarı ikonu gösterilmez ama liste yine çalışır.
      })

    return () => {
      ignore = true
    }
  }, [studentId, book.id])

  const testIdsWithMistakePhotos = useMemo(
    () => new Set(wrongQuestions.filter((item) => item.hasPhoto && item.testId).map((item) => item.testId)),
    [wrongQuestions],
  )

  const applyWrongQuestionPhoto = (wrongQuestion) => {
    if (!wrongQuestion) return
    setWrongQuestions((prev) => {
      const index = prev.findIndex((item) => item.id === wrongQuestion.id)
      if (index === -1) return [...prev, wrongQuestion]
      const next = [...prev]
      next[index] = wrongQuestion
      return next
    })
  }

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

  const unmarkCompletion = async (test) => {
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
      await authRequest(`/api/panel/resource-book-topic-tests/${test.id}/completion?studentId=${studentId}`, {
        method: 'DELETE',
      })
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
      await authRequest(`/api/panel/resource-book-topic-tests/${test.id}/completion?studentId=${studentId}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      })
      applyCompletionSource(test.id, 'manual', body)
      setEditingTestId(null)
      // Tam puan (%100) girildiyse küçük bir konfeti kutlaması.
      if (body.wrongCount === 0 && body.blankCount === 0 && body.correctCount === test.questionCount) {
        setCelebrate(true)
      }
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

  const hasSearchQuery = searchQuery.trim().length > 0
  const filteredTopics = useMemo(() => {
    if (!topics) return topics

    const matchingTopics = filterTopicsBySearch(topics, searchQuery)
    if (!showUnsolvedOnly) return matchingTopics

    return matchingTopics
      .map((topic) => ({
        ...topic,
        tests: topic.tests.filter((test) => !test.completed),
      }))
      .filter((topic) => topic.tests.length > 0)
  }, [topics, searchQuery, showUnsolvedOnly])
  const emptyFilteredMessage = showUnsolvedOnly
    ? hasSearchQuery
      ? 'Arama ve çözülmemiş filtresiyle eşleşen içerik yok.'
      : 'Tüm testler çözülmüş.'
    : 'Aramayla eşleşen içerik yok.'

  const openResultEntry = (test) => {
    setRowErrors((prev) => {
      const next = { ...prev }
      delete next[test.id]
      return next
    })
    if (test.hasAnswerKey) {
      setOpticalTest(test)
    } else {
      setEditError('')
      setEditingTestId(test.id)
    }
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
    <div className="flex min-w-0 flex-col gap-2">
      {celebrate ? <SuccessCelebration onClose={() => setCelebrate(false)} /> : null}
      <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="relative min-w-0">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-panel-text-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Konu, test veya sayfa ara..."
            className="w-full rounded-xl border border-panel-border bg-white py-2 pl-9 pr-10 text-sm text-panel-text outline-none focus:border-panel-blue focus:ring-2 focus:ring-panel-blue/10"
          />
          {searchQuery ? (
            <button
              type="button"
              aria-label="Aramayı temizle"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-panel-text-muted hover:bg-panel-surface-soft hover:text-panel-text"
            >
              <X size={14} aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <label className="inline-flex h-10 min-w-0 items-center gap-2 rounded-xl border border-panel-border bg-white px-3 text-sm font-medium text-panel-text hover:bg-panel-surface-soft">
          <input
            type="checkbox"
            checked={showUnsolvedOnly}
            onChange={(event) => setShowUnsolvedOnly(event.target.checked)}
            className="h-4 w-4 shrink-0 rounded border-panel-border accent-panel-blue"
          />
          <span className="truncate">Çözülmemiş testler</span>
        </label>
      </div>

      {opticalTest ? (
        <ManualOpticalAnswerModal
          test={opticalTest}
          onClose={() => setOpticalTest(null)}
          onSaved={(testId, updates) => {
            applyOpticalResult(testId, updates)
          }}
          submitAnswers={(answers) =>
            authRequest(
              `/api/panel/resource-book-topic-tests/${opticalTest.id}/optical-completion?studentId=${studentId}`,
              { method: 'PUT', body: JSON.stringify({ answers }) },
            )
          }
          submitPhoto={(orderNo, dataUrl) =>
            authRequest(`/api/panel/resource-book-topic-tests/${opticalTest.id}/mistakes/${orderNo}?studentId=${studentId}`, {
              method: 'PUT',
              body: JSON.stringify({ photo: dataUrl }),
            }).then((data) => {
              applyWrongQuestionPhoto(data.wrongQuestion)
              return data
            })
          }
          verifyQuestionNumber={(orderNo, dataUrl) => verifyMistakePhotoQuestionNumber(dataUrl, Number(orderNo))}
          initialPhotos={wrongQuestions
            .filter((item) => item.testId === opticalTest.id && item.hasPhoto)
            .reduce((acc, item) => {
              acc[item.questionNumber] = true
              return acc
            }, {})}
        />
      ) : null}

      <div className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-panel-border p-1.5 sm:p-2">
        {filteredTopics.length === 0 ? (
          <p className="p-2 text-xs text-panel-text-muted">{emptyFilteredMessage}</p>
        ) : (
          filteredTopics.map((topic) => {
            const isCollapsed = !hasSearchQuery && !showUnsolvedOnly && collapsedTopicIds.has(topic.id)
            const totalTests = topic.tests.length
            const completedTests = topic.tests.filter((test) => test.completed).length
            const completionPercentage = totalTests > 0 ? Math.round((completedTests / totalTests) * 100) : 0
            return (
              <div key={topic.id} className="py-0.5">
                <button
                  type="button"
                  onClick={() => toggleTopicCollapsed(topic.id)}
                  className="flex w-full min-w-0 items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-left text-sm hover:bg-panel-blue-soft sm:gap-2 sm:px-2"
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

                {topic.tests.length > 0 && !isCollapsed ? (
                  <div className="ml-0 flex min-w-0 flex-col gap-1 pl-4 sm:ml-6 sm:pl-0">
                    {topic.tests.map((test) => {
                      const isGraded = test.completionSource === 'graded'
                      const isManual = test.completionSource === 'manual'
                      const isSaving = savingTestIds.has(test.id)
                      const needsMistakePhotos =
                        isManual &&
                        test.hasAnswerKey &&
                        (Number(test.wrongCount) > 0 || Number(test.blankCount) > 0) &&
                        !testIdsWithMistakePhotos.has(test.id)
                      return (
                        <div key={test.id} className="min-w-0 rounded-lg px-1.5 py-1 sm:px-2">
                          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                            {isGraded || isManual ? (
                              <span
                                className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-panel-sage text-white"
                                title={isGraded ? 'Dijital olarak değerlendirildi' : 'Sonuç girildi'}
                              >
                                <Check size={11} strokeWidth={3} />
                              </span>
                            ) : (
                              <span className="h-4 w-4 shrink-0 rounded-full border border-panel-border" aria-hidden="true" />
                            )}

                            <span className="min-w-0 flex-1 truncate text-panel-text-muted">
                              {test.topicName ? `${test.topicName} · ` : ''}
                              {test.name} · s.{test.pageStart}
                              {test.pageEnd && test.pageEnd !== test.pageStart ? `-${test.pageEnd}` : ''} ·{' '}
                              {test.questionCount} soru
                            </span>

                            {test.completed ? (
                              <>
                                <ResultChips test={test} />
                                {needsMistakePhotos ? (
                                  <span
                                    title="Hata defterine bu testten hiç soru fotoğrafı eklenmemiş"
                                    className="flex shrink-0 items-center text-panel-warm"
                                  >
                                    <ImageOff size={13} aria-hidden="true" />
                                  </span>
                                ) : null}
                                {!isGraded ? (
                                  <span className="flex shrink-0 items-center gap-1">
                                    <button
                                      type="button"
                                      title="Sonucu düzenle"
                                      onClick={() => openResultEntry(test)}
                                      className="flex h-7 items-center gap-1 rounded-lg border border-panel-border px-2 text-[11px] font-semibold text-panel-text-muted hover:border-panel-blue hover:text-panel-blue"
                                    >
                                      <Pencil size={12} aria-hidden="true" />
                                      Düzenle
                                    </button>
                                    <button
                                      type="button"
                                      title="İşareti kaldır"
                                      disabled={isSaving}
                                      onClick={() => unmarkCompletion(test)}
                                      className="flex h-7 w-7 items-center justify-center rounded-lg text-panel-text-muted hover:bg-panel-accent-soft hover:text-panel-warm disabled:opacity-50"
                                    >
                                      <RotateCcw size={13} aria-hidden="true" />
                                    </button>
                                  </span>
                                ) : (
                                  <Badge tone="slate" className="shrink-0">
                                    Değerlendirildi
                                  </Badge>
                                )}
                              </>
                            ) : (
                              <button
                                type="button"
                                disabled={isSaving}
                                onClick={() => openResultEntry(test)}
                                className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-panel-blue px-3 text-[11px] font-semibold text-white transition-colors hover:bg-panel-blue/90 disabled:opacity-50"
                              >
                                Test sonuçlarını gir
                              </button>
                            )}
                          </div>

                          {rowErrors[test.id] ? (
                            <p className="mt-1 text-[11px] text-panel-warm">{rowErrors[test.id]}</p>
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
          })
        )}
      </div>
    </div>
  )
}
