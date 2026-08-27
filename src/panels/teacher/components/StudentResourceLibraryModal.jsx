import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, BookOpen, Check, ChevronDown, ChevronRight, ImageOff, Pencil, Search, X } from 'lucide-react'
import Badge from '../../ui/Badge'
import Button from '../../ui/Button'
import LoadingState from '../../shared/LoadingState'
import EmptyState from '../../shared/EmptyState'
import { ImagePreviewLightbox, ResourceBookAvatar, ResourceBookRates } from '../../shared/ResourceBookCard'
import ManualOpticalAnswerModal from '../../shared/ManualOpticalAnswerModal'
import { RESOURCE_TYPE_LABELS } from '../../shared/library/libraryConstants'
import {
  assignTeacherLibraryResourceBook,
  getTeacherResourceBooks,
  getTeacherResourceBookTopics,
  getTeacherStudentPrivateResourceBooks,
  markTeacherResourceBookTopicTestCompletion,
  unmarkTeacherResourceBookTopicTestCompletion,
  submitTeacherManualOpticalAnswers,
  saveTeacherManualWrongQuestionPhoto,
  getTeacherStudentWrongQuestions,
} from '../../../services/teacherService'
import { verifyMistakePhotoQuestionNumber } from '../../../services/mistakePhotoService'

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
  const [wrongQuestions, setWrongQuestions] = useState([])

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

  // Hata defterine hangi testlerden en az bir soru fotoğrafı eklenmiş, hangilerinden hiç
  // eklenmemiş olduğunu bilmek için tek seferde çekilir (liste ekranındaki uyarı ikonu ve optik
  // form açıldığında kamera rozetleri buradan beslenir — testi her açışta ayrıca istek atmayız).
  useEffect(() => {
    let ignore = false

    getTeacherStudentWrongQuestions(studentTeacherId, book.id)
      .then((data) => {
        if (!ignore) setWrongQuestions(data?.wrongQuestions || [])
      })
      .catch(() => {
        // Sessizce yok say: uyarı ikonu gösterilmez ama liste yine çalışır.
      })

    return () => {
      ignore = true
    }
  }, [studentTeacherId, book.id])

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
    <div className="flex min-w-0 flex-col gap-2">
      <p className="break-words text-xs text-panel-text-muted">
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
            saveTeacherManualWrongQuestionPhoto(studentTeacherId, opticalTest.id, orderNo, dataUrl).then((data) => {
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
              {topic.tests.length && !isCollapsed ? (
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
                              {hasResults
                                ? ` (D:${test.correctCount ?? 0} Y:${test.wrongCount ?? 0} B:${test.blankCount ?? 0})`
                                : ''}
                            </span>
                            {isManual ? (
                              <Badge tone="lilac" className="shrink-0">
                                Elle işaretlendi
                              </Badge>
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
        })}
      </div>
    </div>
  )
}

const NO_PUBLISHER_GROUP_NAME = 'Yayın evi belirtilmemiş'

function groupResourceBooksByPublisher(resourceBooks) {
  const groups = new Map()

  resourceBooks.forEach((book) => {
    const publisherName = book.publisherName?.trim() || NO_PUBLISHER_GROUP_NAME
    const key = book.publisherId || publisherName.toLocaleLowerCase('tr')
    if (!groups.has(key)) {
      groups.set(key, {
        id: key,
        name: publisherName,
        books: [],
      })
    }
    groups.get(key).books.push(book)
  })

  return Array.from(groups.values())
    .sort((a, b) => {
      const aHasNoPublisher = a.name === NO_PUBLISHER_GROUP_NAME
      const bHasNoPublisher = b.name === NO_PUBLISHER_GROUP_NAME
      if (aHasNoPublisher !== bHasNoPublisher) return aHasNoPublisher ? 1 : -1
      return a.name.localeCompare(b.name, 'tr')
    })
    .map((group) => ({
      ...group,
      books: [...group.books].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'tr')),
    }))
}

export default function StudentResourceLibraryModal({ student, onClose, onAssigned }) {
  const [activeTab, setActiveTab] = useState('assigned')
  const [resourceBooks, setResourceBooks] = useState(null)
  const [error, setError] = useState('')
  const [selectedBook, setSelectedBook] = useState(null)
  const [previewImage, setPreviewImage] = useState(null)

  const [libraryBooks, setLibraryBooks] = useState(null)
  const [libraryGradeMissing, setLibraryGradeMissing] = useState(false)
  const [libraryError, setLibraryError] = useState('')
  const [libraryQuery, setLibraryQuery] = useState('')
  const [selectedLibraryIds, setSelectedLibraryIds] = useState(new Set())
  const [assigning, setAssigning] = useState(false)

  const loadAssignedBooks = () =>
    getTeacherResourceBooks(student.studentTeacherId)
      .then((data) => setResourceBooks(data))
      .catch((err) => setError(err.message))

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

  const loadLibraryBooks = () => {
    setLibraryError('')
    return getTeacherStudentPrivateResourceBooks(student.studentTeacherId)
      .then((data) => {
        setLibraryBooks(data.resourceBooks)
        setLibraryGradeMissing(Boolean(data.gradeMissing))
      })
      .catch((err) => setLibraryError(err.message))
  }

  useEffect(() => {
    if (activeTab !== 'library' || libraryBooks !== null) return
    loadLibraryBooks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, student.studentTeacherId])

  const publisherGroups = useMemo(() => (resourceBooks ? groupResourceBooksByPublisher(resourceBooks) : []), [resourceBooks])

  const filteredLibraryBooks = useMemo(() => {
    const source = libraryBooks || []
    const query = libraryQuery.trim().toLocaleLowerCase('tr-TR')
    if (!query) return source
    return source.filter((book) =>
      [book.name, book.publisherName].filter(Boolean).some((value) => value.toLocaleLowerCase('tr-TR').includes(query)),
    )
  }, [libraryBooks, libraryQuery])

  const libraryPublisherGroups = useMemo(
    () => groupResourceBooksByPublisher(filteredLibraryBooks),
    [filteredLibraryBooks],
  )

  const toggleLibrarySelection = (book) => {
    if (book.assigned) return
    setSelectedLibraryIds((current) => {
      const next = new Set(current)
      if (next.has(book.id)) next.delete(book.id)
      else next.add(book.id)
      return next
    })
  }

  const handleAssignSelected = async () => {
    if (!selectedLibraryIds.size) return
    setAssigning(true)
    setLibraryError('')
    try {
      await Promise.all(
        [...selectedLibraryIds].map((resourceBookId) =>
          assignTeacherLibraryResourceBook(student.studentTeacherId, resourceBookId),
        ),
      )
      setSelectedLibraryIds(new Set())
      await Promise.all([loadLibraryBooks(), loadAssignedBooks()])
      onAssigned?.()
    } catch (err) {
      setLibraryError(err.message)
    } finally {
      setAssigning(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-center overflow-hidden bg-black/40 sm:items-center sm:p-4">
      <div className="flex h-full w-full min-w-0 max-w-full flex-col overflow-hidden bg-panel-surface sm:h-auto sm:max-h-[94vh] sm:max-w-5xl sm:rounded-2xl sm:shadow-panel-2">
        <div className="flex shrink-0 items-center justify-between gap-3 bg-panel-blue px-4 py-3 text-white">
          <div className="flex min-w-0 items-center gap-1.5">
            {selectedBook ? (
              <button
                type="button"
                onClick={() => setSelectedBook(null)}
                aria-label="Kaynak listesine dön"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white"
              >
                <ArrowLeft size={18} aria-hidden="true" />
              </button>
            ) : null}
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold sm:text-base">
                {selectedBook ? selectedBook.name : `${student.studentFullName} · Kaynaklar`}
              </h2>
              {selectedBook?.publisherName ? (
                <p className="truncate text-[11px] text-white/70">{selectedBook.publisherName}</p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            aria-label="Kapat"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {selectedBook ? null : (
          <div className="flex shrink-0 gap-1 border-b border-panel-border bg-panel-surface px-4 pt-2">
            <button
              type="button"
              onClick={() => setActiveTab('assigned')}
              className={`shrink-0 whitespace-nowrap border-b-2 px-3 pb-2.5 text-sm font-semibold transition-colors ${
                activeTab === 'assigned'
                  ? 'border-panel-blue text-panel-blue'
                  : 'border-transparent text-panel-text-muted hover:text-panel-text'
              }`}
            >
              Kaynaklarım
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('library')}
              className={`shrink-0 whitespace-nowrap border-b-2 px-3 pb-2.5 text-sm font-semibold transition-colors ${
                activeTab === 'library'
                  ? 'border-panel-blue text-panel-blue'
                  : 'border-transparent text-panel-text-muted hover:text-panel-text'
              }`}
            >
              Kütüphane
            </button>
          </div>
        )}

        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-3">
          {selectedBook ? (
            <BookTopics key={selectedBook.id} studentTeacherId={student.studentTeacherId} book={selectedBook} />
          ) : activeTab === 'library' ? (
            <div className="flex min-w-0 flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative w-full sm:w-72">
                  <Search
                    size={14}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-panel-text-muted"
                    aria-hidden="true"
                  />
                  <input
                    value={libraryQuery}
                    onChange={(event) => setLibraryQuery(event.target.value)}
                    placeholder="Kaynak veya yayın evi ara..."
                    className="w-full rounded-xl border border-panel-border bg-white py-2 pl-9 pr-3 text-sm text-panel-text focus:outline-none focus:ring-2 focus:ring-[#1c2b5e]/20"
                  />
                </div>
                {selectedLibraryIds.size ? (
                  <span className="rounded-full bg-[#fbe9d7] px-3 py-1 text-xs font-semibold text-[#c96a1f]">
                    {selectedLibraryIds.size} kaynak seçili
                  </span>
                ) : null}
              </div>

              {libraryError ? (
                <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-sm text-panel-warm">{libraryError}</div>
              ) : null}

              {libraryBooks === null ? (
                <LoadingState label="Kütüphane yükleniyor..." />
              ) : libraryGradeMissing ? (
                <EmptyState
                  icon={BookOpen}
                  title="Sınıf seçilmedi"
                  description="Kütüphaneyi görüntülemek için önce Öğrencilerim listesinden bu öğrencinin sınıfını tanımlayın."
                />
              ) : libraryPublisherGroups.length === 0 ? (
                <p className="p-2 text-sm text-panel-text-muted">
                  {libraryQuery.trim() ? 'Aramayla eşleşen kaynak yok.' : 'Bu derse ait onaylı özel kaynak bulunamadı.'}
                </p>
              ) : (
                <div className="flex min-w-0 flex-col gap-5">
                  {libraryPublisherGroups.map((publisherGroup) => (
                    <section key={publisherGroup.id} className="min-w-0">
                      <div className="mb-2 flex min-w-0 items-center gap-2">
                        <h3 className="truncate text-sm font-bold text-panel-text">{publisherGroup.name}</h3>
                        <span className="shrink-0 rounded-full bg-panel-surface-soft px-2 py-0.5 text-[11px] font-semibold text-panel-text-muted">
                          {publisherGroup.books.length} kaynak
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        {publisherGroup.books.map((book) => {
                          const selected = selectedLibraryIds.has(book.id)
                          return (
                            <button
                              key={book.id}
                              type="button"
                              aria-pressed={book.assigned || selected}
                              onClick={() => toggleLibrarySelection(book)}
                              disabled={book.assigned}
                              className={`flex min-h-[96px] min-w-0 items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                                book.assigned
                                  ? 'cursor-default border-panel-blue bg-panel-blue-soft'
                                  : selected
                                    ? 'border-[#1c2b5e] bg-[#f8f7fb] shadow-[0_2px_10px_rgba(101,94,148,0.12)]'
                                    : 'border-panel-border bg-white hover:border-[#c1c8e0] hover:bg-[#f7f8fc]'
                              }`}
                            >
                              <ResourceBookAvatar
                                book={book}
                                size="row"
                                onClick={
                                  book.imageUrl
                                    ? () => setPreviewImage({ url: book.imageUrl, name: book.name })
                                    : undefined
                                }
                              />
                              <span className="flex min-w-0 flex-1 flex-col gap-1">
                                <span className="flex items-start justify-between gap-2">
                                  <span className="line-clamp-2 text-sm font-bold leading-snug text-panel-text">
                                    {book.name}
                                  </span>
                                  <span
                                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                                      book.assigned || selected
                                        ? 'border-[#1c2b5e] bg-[#1c2b5e] text-white'
                                        : 'border-panel-border bg-white'
                                    }`}
                                  >
                                    {book.assigned || selected ? <Check size={13} aria-hidden="true" /> : null}
                                  </span>
                                </span>
                                <span className="flex flex-wrap items-center gap-1.5 pt-1">
                                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-[#1c2b5e]">
                                    {RESOURCE_TYPE_LABELS[book.type] || book.type}
                                  </span>
                                  {book.assigned ? (
                                    <span className="rounded-full bg-panel-blue px-2 py-0.5 text-[11px] font-medium text-white">
                                      Atandı
                                    </span>
                                  ) : null}
                                </span>
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>
          ) : error ? (
            <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-sm text-panel-warm">{error}</div>
          ) : resourceBooks === null ? (
            <LoadingState label="Kaynaklar yükleniyor..." />
          ) : resourceBooks.length === 0 ? (
            <p className="p-2 text-sm text-panel-text-muted">Bu öğrenci için takip edilen kaynak yok.</p>
          ) : (
            <div className="flex min-w-0 flex-col gap-5">
              {publisherGroups.map((publisherGroup) => (
                <section key={publisherGroup.id} className="min-w-0">
                  <div className="mb-2 flex min-w-0 items-center gap-2">
                    <h3 className="truncate text-sm font-bold text-panel-text">{publisherGroup.name}</h3>
                    <span className="shrink-0 rounded-full bg-panel-surface-soft px-2 py-0.5 text-[11px] font-semibold text-panel-text-muted">
                      {publisherGroup.books.length} kaynak
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {publisherGroup.books.map((book) => (
                      <div
                        key={book.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedBook(book)}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter' && event.key !== ' ') return
                          event.preventDefault()
                          setSelectedBook(book)
                        }}
                        className="group grid min-w-0 cursor-pointer grid-cols-[3.5rem_minmax(0,1fr)] items-start gap-3 rounded-xl border border-panel-border bg-white p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-panel-blue hover:shadow-panel-2 sm:grid-cols-[4rem_minmax(0,1fr)]"
                      >
                        <ResourceBookAvatar
                          book={book}
                          size="row"
                          onClick={
                            book.imageUrl ? () => setPreviewImage({ url: book.imageUrl, name: book.name }) : undefined
                          }
                        />
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm font-semibold leading-snug text-panel-text group-hover:text-panel-blue">
                            {book.name}
                          </p>
                          {book.subjectName ? (
                            <p className="truncate text-[11px] text-panel-text-muted">{book.subjectName}</p>
                          ) : null}
                          <ResourceBookRates
                            completionRate={book.completionRate}
                            successRate={book.successRate}
                            className="grid-cols-2"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        {activeTab === 'library' && !selectedBook ? (
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-panel-border bg-panel-surface px-4 py-3">
            <Button
              type="button"
              size="md"
              onClick={handleAssignSelected}
              disabled={assigning || selectedLibraryIds.size === 0}
            >
              {assigning ? 'Atanıyor...' : `Seçilenleri Ata (${selectedLibraryIds.size})`}
            </Button>
          </div>
        ) : null}
      </div>
      <ImagePreviewLightbox preview={previewImage} onClose={() => setPreviewImage(null)} />
    </div>
  )
}
