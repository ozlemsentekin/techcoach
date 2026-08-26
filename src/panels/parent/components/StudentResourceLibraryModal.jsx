import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Check, ChevronDown, ChevronRight, ImageOff, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import Badge from '../../ui/Badge'
import Button from '../../ui/Button'
import LoadingState from '../../shared/LoadingState'
import ConfirmationDialog from '../../shared/ConfirmationDialog'
import { ImagePreviewLightbox, ResourceBookAvatar, ResourceBookRates } from '../../shared/ResourceBookCard'
import { authRequest } from '../../../services/authClient'
import { verifyMistakePhotoQuestionNumber } from '../../../services/mistakePhotoService'
import StudentResourceAssignModal from './StudentResourceAssignModal'
import ManualOpticalAnswerModal from '../../shared/ManualOpticalAnswerModal'
import { filterTopicsBySearch } from '../../shared/homework/topicSearch'

function groupResourceBooksBySubject(resourceBooks) {
  const groups = new Map()

  resourceBooks.forEach((book) => {
    const key = book.subjectId || 'no-subject'
    if (!groups.has(key)) {
      groups.set(key, {
        id: key,
        name: book.subjectName || 'Derssiz Kaynaklar',
        books: [],
      })
    }
    groups.get(key).books.push(book)
  })

  return Array.from(groups.values())
}

function ManualResultForm({ test, onCancel, onSave, onSaveWithoutResults, saving, error }) {
  const [correctCount, setCorrectCount] = useState(test.correctCount ?? '')
  const [wrongCount, setWrongCount] = useState(test.wrongCount ?? '')
  const [blankCount, setBlankCount] = useState(test.blankCount ?? '')

  return (
    <div className="ml-0 mt-1 flex min-w-0 flex-col gap-2 rounded-lg border border-panel-border bg-panel-surface-soft p-2.5 sm:ml-5.5">
      <p className="text-[11px] text-panel-text-muted">{test.questionCount} soru · isteğe bağlı sonuç girebilirsiniz</p>
      <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-3">
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

function BookTopics({ student, book }) {
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

  useEffect(() => {
    let ignore = false

    authRequest(`/api/panel/resource-book-topics?resourceBookId=${book.id}&studentId=${student.id}`)
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
  }, [student.id, book.id])

  // Hata defterine hangi testlerden en az bir soru fotoğrafı eklenmiş, hangilerinden hiç
  // eklenmemiş olduğunu bilmek için tek seferde çekilir (liste ekranındaki uyarı ikonu ve optik
  // form açıldığında kamera rozetleri buradan beslenir — testi her açışta ayrıca istek atmayız).
  useEffect(() => {
    let ignore = false

    authRequest(`/api/panel/wrong-questions?studentId=${student.id}&resourceBookId=${book.id}`)
      .then((data) => {
        if (!ignore) setWrongQuestions(data.wrongQuestions || [])
      })
      .catch(() => {
        // Sessizce yok say: uyarı ikonu gösterilmez ama liste yine çalışır.
      })

    return () => {
      ignore = true
    }
  }, [student.id, book.id])

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

    // Optimistic update: kullanıcı isteğin sonucunu beklemeden anında tepki görsün.
    applyCompletionSource(test.id, null)

    try {
      await authRequest(`/api/panel/resource-book-topic-tests/${test.id}/completion?studentId=${student.id}`, {
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
      await authRequest(`/api/panel/resource-book-topic-tests/${test.id}/completion?studentId=${student.id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      })
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
      : 'Çözülmemiş test yok.'
    : 'Aramayla eşleşen içerik yok.'

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
      <p className="break-words text-xs text-panel-text-muted">
        Bir testin kutusuna tıklayınca, cevap anahtarı girilmiş testler için optik form açılır (şıkları
        işaretleyin, doğru/yanlış/boş otomatik hesaplanır); diğerlerinde sayıyı elle girersiniz. Elle işaretlenmiş
        bir testin kutusuna tekrar tıklamak işareti kaldırır; sonuçları değiştirmek için kalem simgesini kullanın.
      </p>
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
              `/api/panel/resource-book-topic-tests/${opticalTest.id}/optical-completion?studentId=${student.id}`,
              { method: 'PUT', body: JSON.stringify({ answers }) },
            )
          }
          submitPhoto={(orderNo, dataUrl) =>
            authRequest(`/api/panel/resource-book-topic-tests/${opticalTest.id}/mistakes/${orderNo}?studentId=${student.id}`, {
              method: 'PUT',
              body: JSON.stringify({ photo: dataUrl }),
            }).then((data) => {
              applyWrongQuestionPhoto(data.wrongQuestion)
              return data
            })
          }
          verifyQuestionNumber={(orderNo, dataUrl) =>
            verifyMistakePhotoQuestionNumber(dataUrl, Number(orderNo))
          }
          // Hangi sorulara zaten fotoğraf eklenmiş bilgisi BookTopics'te tek seferde çekilen
          // wrongQuestions listesinden geliyor; modal her açıldığında ayrıca istek atmıyoruz.
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
                  <div className="ml-0 flex min-w-0 flex-col pl-4 sm:ml-6 sm:pl-0">
                    {topic.tests.map((test) => {
                      const isGraded = test.completionSource === 'graded'
                      const isManual = test.completionSource === 'manual'
                      const isSaving = savingTestIds.has(test.id)
                      const hasResults =
                        test.correctCount !== undefined || test.wrongCount !== undefined || test.blankCount !== undefined
                      const needsMistakePhotos =
                        isManual &&
                        test.hasAnswerKey &&
                        (Number(test.wrongCount) > 0 || Number(test.blankCount) > 0) &&
                        !testIdsWithMistakePhotos.has(test.id)
                      return (
                        <div key={test.id} className="relative min-w-0 rounded-lg px-1.5 py-1 sm:px-2">
                          <div className="grid min-w-0 grid-cols-[1.625rem_minmax(0,1fr)] items-start gap-1.5 text-xs sm:gap-2">
                            {isGraded ? (
                              <span
                                className="mt-1 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm bg-panel-blue text-white"
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
                                className="flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-sm p-1.5 disabled:opacity-50"
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
                            <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-panel-text-muted">
                              {test.topicName ? (
                                <Badge tone="slate" className="max-w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap sm:max-w-[18rem]">
                                  {test.topicName}
                                </Badge>
                              ) : null}
                              <span className="min-w-0 flex-[1_1_12rem] truncate">
                                {test.name} · s.{test.pageStart}-{test.pageEnd} · {test.questionCount} soru
                              </span>
                              {isManual ? (
                                <Badge tone="lilac" className="shrink-0">
                                  Elle işaretlendi
                                </Badge>
                              ) : null}
                              {isManual && hasResults ? (
                                <span className="flex flex-wrap items-center gap-1">
                                  <Badge tone="sage">D:{test.correctCount ?? 0}</Badge>
                                  <Badge tone="red">Y:{test.wrongCount ?? 0}</Badge>
                                  <Badge tone="yellow">B:{test.blankCount ?? 0}</Badge>
                                </span>
                              ) : null}
                              {needsMistakePhotos ? (
                                <span
                                  title="Hata defterine bu testten hiç soru fotoğrafı eklenmemiş"
                                  className="flex shrink-0 items-center justify-center text-panel-warm"
                                >
                                  <ImageOff size={13} aria-hidden="true" />
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
                            <span className="absolute left-0 right-0 top-full z-10 rounded-md border border-panel-border bg-white px-2 py-1 text-[11px] text-panel-warm shadow-sm">
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
          })
        )}
      </div>
    </div>
  )
}

export default function StudentResourceLibraryModal({ student, onClose }) {
  const [resourceBooks, setResourceBooks] = useState(null)
  const [error, setError] = useState('')
  const [activeSubjectId, setActiveSubjectId] = useState(null)
  const [selectedBook, setSelectedBook] = useState(null)
  const [removingBook, setRemovingBook] = useState(null)
  const [removeError, setRemoveError] = useState('')
  const [removing, setRemoving] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [previewImage, setPreviewImage] = useState(null)

  useEffect(() => {
    let ignore = false

    authRequest(`/api/parent/students/${student.id}/resource-books`)
      .then((data) => {
        if (!ignore) setResourceBooks(data.resourceBooks.filter((book) => book.assigned))
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })

    return () => {
      ignore = true
    }
  }, [student.id])

  const subjectGroups = resourceBooks ? groupResourceBooksBySubject(resourceBooks) : []

  useEffect(() => {
    if (activeSubjectId || subjectGroups.length === 0) return
    setActiveSubjectId(subjectGroups[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectGroups.length])

  const activeSubject = subjectGroups.find((group) => group.id === activeSubjectId) || null

  const title = selectedBook ? selectedBook.name : 'Kaynaklar'

  const handleRemoveBook = async () => {
    if (!removingBook) return
    setRemoving(true)
    setRemoveError('')
    try {
      const remainingIds = resourceBooks.filter((book) => book.id !== removingBook.id).map((book) => book.id)
      await authRequest(`/api/parent/students/${student.id}/resource-books`, {
        method: 'PUT',
        body: JSON.stringify({ resourceBookIds: remainingIds }),
      })
      setResourceBooks((current) => current.filter((book) => book.id !== removingBook.id))
      setActiveSubjectId((current) => {
        const stillHasBooks = resourceBooks.some(
          (book) => book.id !== removingBook.id && (book.subjectId || 'no-subject') === current,
        )
        if (stillHasBooks) return current
        const nextGroup = subjectGroups.find((group) => group.id !== current)
        return nextGroup ? nextGroup.id : current
      })
      setRemovingBook(null)
    } catch (err) {
      setRemoveError(err.message)
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center overflow-hidden bg-black/30 p-0 sm:items-center sm:p-4">
      <div className="flex h-full w-full max-w-4xl min-w-0 flex-col overflow-hidden border border-panel-border bg-panel-surface p-4 shadow-panel-1 sm:h-[88vh] sm:max-h-[92vh] sm:rounded-2xl sm:p-6">
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
              <h2 className="truncate text-base font-semibold text-panel-text">{title}</h2>
              {selectedBook ? (
                selectedBook.publisherName ? (
                  <p className="text-xs text-panel-text-muted">{selectedBook.publisherName}</p>
                ) : null
              ) : (
                <p className="text-xs text-panel-text-muted">{student.fullName}</p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!selectedBook ? (
              <Button type="button" size="sm" onClick={() => setShowAssignModal(true)} className="gap-1.5">
                <Plus size={15} aria-hidden="true" />
                Kaynak Ata
              </Button>
            ) : null}
            <button type="button" aria-label="Kapat" onClick={onClose} className="shrink-0">
              <X size={20} />
            </button>
          </div>
        </div>

        {!selectedBook && subjectGroups.length > 1 ? (
          <div className="mb-4 flex gap-1 overflow-x-auto border-b border-panel-border">
            {subjectGroups.map((subject) => (
              <button
                key={subject.id}
                type="button"
                onClick={() => setActiveSubjectId(subject.id)}
                className={`shrink-0 whitespace-nowrap border-b-2 px-3 pb-2.5 text-sm font-semibold transition-colors ${
                  activeSubjectId === subject.id
                    ? 'border-panel-blue text-panel-blue'
                    : 'border-transparent text-panel-text-muted hover:text-panel-text'
                }`}
              >
                {subject.name}
                <span className="ml-1.5 text-xs font-medium text-panel-text-muted">({subject.books.length})</span>
              </button>
            ))}
          </div>
        ) : null}

        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
          {selectedBook ? (
            <BookTopics key={selectedBook.id} student={student} book={selectedBook} />
          ) : error ? (
            <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-sm text-panel-warm">{error}</div>
          ) : resourceBooks === null ? (
            <LoadingState label="Kaynaklar yükleniyor..." />
          ) : resourceBooks.length === 0 ? (
            <p className="p-2 text-sm text-panel-text-muted">Bu öğrenci için atanmış kaynak yok.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(activeSubject?.books || []).map((book) => (
                <div
                  key={book.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedBook(book)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setSelectedBook(book)
                    }
                  }}
                  className="group relative grid cursor-pointer grid-cols-[3.5rem_minmax(0,1fr)] items-start gap-3 rounded-xl border border-panel-border bg-white p-3 pr-10 text-left shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-panel-blue hover:shadow-md sm:grid-cols-[4rem_minmax(0,1fr)]"
                >
                  <button
                    type="button"
                    aria-label={`${book.name} kaynağını kaldır`}
                    onClick={(event) => {
                      event.stopPropagation()
                      setRemoveError('')
                      setRemovingBook(book)
                    }}
                    className="absolute right-2 top-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-panel-text-muted hover:bg-panel-accent-soft hover:text-panel-warm"
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                  <ResourceBookAvatar
                    book={book}
                    size="row"
                    onClick={book.imageUrl ? () => setPreviewImage({ url: book.imageUrl, name: book.name }) : undefined}
                  />
                  <div className="min-w-0 flex-1">
                    {book.publisherName ? (
                      <Badge tone="lilac" className="mb-1 max-w-full overflow-hidden text-ellipsis whitespace-nowrap">
                        {book.publisherName}
                      </Badge>
                    ) : null}
                    <p className="line-clamp-2 text-sm font-semibold leading-snug text-panel-text group-hover:text-panel-blue">
                      {book.name}
                    </p>
                    <ResourceBookRates
                      completionRate={book.completionRate}
                      successRate={book.successRate}
                      className="grid-cols-2"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {removingBook ? (
        <ConfirmationDialog
          title="Kaynağı kaldır"
          description={
            removeError ||
            `"${removingBook.name}" adlı kaynağı ${student.fullName} için kaldırmak istediğinize emin misiniz?`
          }
          confirmLabel={removing ? 'Kaldırılıyor...' : 'Kaldır'}
          cancelLabel="Vazgeç"
          onCancel={() => {
            if (removing) return
            setRemovingBook(null)
            setRemoveError('')
          }}
          onConfirm={handleRemoveBook}
        />
      ) : null}

      {showAssignModal ? (
        <StudentResourceAssignModal
          student={student}
          onSaved={(_studentId, _resourceCount, updatedResourceBooks) => {
            setResourceBooks(updatedResourceBooks.filter((book) => book.assigned))
            setShowAssignModal(false)
          }}
          onClose={() => setShowAssignModal(false)}
        />
      ) : null}

      <ImagePreviewLightbox preview={previewImage} onClose={() => setPreviewImage(null)} />
    </div>
  )
}
