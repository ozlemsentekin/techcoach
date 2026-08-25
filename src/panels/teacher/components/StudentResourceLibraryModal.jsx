import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Check, ChevronDown, ChevronRight, ImageOff, Pencil, X } from 'lucide-react'
import Badge from '../../ui/Badge'
import Button from '../../ui/Button'
import LoadingState from '../../shared/LoadingState'
import { ResourceBookCover, ResourceBookRates } from '../../shared/ResourceBookCard'
import ResourceSourceBadge from '../../shared/library/ResourceSourceBadge'
import ManualOpticalAnswerModal from '../../shared/ManualOpticalAnswerModal'
import {
  getTeacherResourceBooks,
  getTeacherResourceBookTopics,
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
        if (!ignore) setWrongQuestions(data || [])
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

  const publisherGroups = useMemo(() => (resourceBooks ? groupResourceBooksByPublisher(resourceBooks) : []), [resourceBooks])

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

        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-3">
          {selectedBook ? (
            <BookTopics key={selectedBook.id} studentTeacherId={student.studentTeacherId} book={selectedBook} />
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
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-3">
                    {publisherGroup.books.map((book) => (
                      <button
                        key={book.id}
                        type="button"
                        onClick={() => setSelectedBook(book)}
                        className="flex min-w-0 flex-col items-stretch gap-1.5 rounded-xl border border-panel-border p-2 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-panel-blue hover:shadow-panel-2"
                      >
                        <ResourceBookCover book={book} />
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <div className="flex flex-wrap items-center gap-1">
                            <ResourceSourceBadge source={book.resourceSource} />
                          </div>
                          <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-panel-text">{book.name}</p>
                          {book.subjectName ? (
                            <p className="truncate text-[11px] text-panel-text-muted">{book.subjectName}</p>
                          ) : null}
                        </div>
                        <ResourceBookRates completionRate={book.completionRate} successRate={book.successRate} />
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
