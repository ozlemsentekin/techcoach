import { useEffect, useMemo, useState } from 'react'
import { X, CheckCircle2, XCircle, MinusCircle, Trash2, Camera } from 'lucide-react'
import {
  getTaskAnswerSheet,
  saveTaskAnswers,
  patchTask,
  removeTaskTest,
  saveWrongQuestionPhoto,
} from '../../../services/taskService'
import { verifyMistakePhotoQuestionNumber } from '../../../services/mistakePhotoService'
import { getWrongQuestionPhoto, updateWrongQuestion } from '../../../services/wrongQuestionService'
import LoadingState from '../../shared/LoadingState'
import ConfirmationDialog from '../../shared/ConfirmationDialog'
import WrongQuestionGalleryModal from '../../shared/WrongQuestionGalleryModal'
import MistakePhotoCaptureModal from './MistakePhotoCaptureModal'

// Bir testin fotoğraflı yanlış/boş sorularını WrongQuestionGalleryModal item şekline çevirir.
function buildGalleryItems(test, photosMap) {
  const testPhotos = photosMap?.[test.id] || {}
  const items = []
  for (let orderNo = 1; orderNo <= test.questionCount; orderNo += 1) {
    const entry = getPhotoEntry(testPhotos[String(orderNo)])
    if (!entry?.photoUrl && !entry?.id) continue
    items.push({
      id: entry.id,
      questionNumber: orderNo,
      testName: test.name,
      topicName: test.topicName,
      topic: entry.topic || test.topicName || test.name || '',
      studentNote: entry.studentNote,
      mistakeReason: entry.mistakeReason,
      photoUrl: entry.photoUrl,
    })
  }
  return items
}

const OPTIONS = ['A', 'B', 'C', 'D']
// Backend'deki BLANK_ANSWER_LABEL ile eşleşmeli (api/src/tasks.js).
const BLANK_LABEL = '-'

function getPhotoEntry(entry) {
  if (!entry) return null
  if (typeof entry === 'string') return { photoUrl: entry, hasPhoto: true }
  if (entry === true) return { hasPhoto: true }
  return entry
}

function hasPhotoEntry(entry) {
  const photoEntry = getPhotoEntry(entry)
  return Boolean(photoEntry?.hasPhoto || photoEntry?.photoUrl || photoEntry?.id)
}

function hasViewablePhoto(entry) {
  const photoEntry = getPhotoEntry(entry)
  return Boolean(photoEntry?.photoUrl || photoEntry?.id)
}

function getPhotoUrl(entry) {
  return getPhotoEntry(entry)?.photoUrl || ''
}

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
    <div className="flex flex-wrap items-center justify-between gap-1 rounded-xl bg-student-theme-soft px-2 py-1.5 text-xs font-semibold">
      <span className="flex shrink-0 items-center gap-1 text-panel-sage">
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

function TestSection({ test, answers, result, photos, photoMode, canRegrade, onSelect, onRemove, onCapture, onOpenGallery }) {
  // Öğrenci akışında değerlendirilen test kilitlenir; veli (canRegrade) yanlış aktarılmış
  // bir optiği düzeltebilsin diye kilit açık kalır.
  const locked = Boolean(result) && !canRegrade
  return (
    <div className="min-w-0 rounded-2xl border border-panel-border p-2.5">
      <div className="flex items-start justify-between gap-1.5">
        <h3
          className="min-w-0 truncate text-xs font-semibold text-panel-text"
          title={test.topicName ? `${test.name} · ${test.topicName}` : test.name}
        >
          {test.name}
          {test.topicName ? <span className="font-normal text-panel-text-muted"> · {test.topicName}</span> : null}
        </h3>
        <button
          type="button"
          onClick={() => onRemove(test)}
          aria-label={`${test.name} testini görevden kaldır`}
          title="Testi görevden kaldır"
          className="shrink-0 rounded-lg p-1 text-panel-text-muted hover:bg-panel-red-soft hover:text-panel-red"
        >
          <Trash2 size={14} aria-hidden="true" />
        </button>
      </div>

      <div className="mt-1.5">
        <ResultBadge result={result} />
      </div>

      <div className="mt-1.5 grid min-w-0 grid-cols-1 gap-y-1">
        {Array.from({ length: test.questionCount }, (_, index) => index + 1).map((orderNo) => {
          const key = String(orderNo)
          const selected = answers[key]
          const isBlankSelected = selected === BLANK_LABEL
          const correctLabel = result?.correctLabels?.[key]
          const isMismatch = Boolean(result) && Boolean(correctLabel) && selected !== correctLabel
          const isWrongSelection = isMismatch && Boolean(selected) && !isBlankSelected
          const isMistake = isMismatch && Boolean(selected)
          const photoEntry = getPhotoEntry(photos?.[key])
          const hasPhoto = hasPhotoEntry(photoEntry)
          const canViewPhoto = hasViewablePhoto(photoEntry)
          // Yanlış her soruda foto butonu görünür: fotoğrafı olan açar, olmayan
          // (veli "view" modu dahil) yeni fotoğraf ekleyebilir.
          const shouldShowPhotoButton = isMistake
          return (
            <div
              key={key}
              className={`flex min-w-0 items-center gap-1.5 rounded-lg px-1 py-1 transition-colors ${
                isMistake ? 'bg-panel-red-soft' : ''
              }`}
            >
              <span className="w-5 shrink-0 text-right text-sm font-bold text-panel-text-muted">{orderNo}.</span>
              <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-1 overflow-hidden">
                {OPTIONS.map((option) => {
                  const isSelected = selected === option
                  const isCorrectReveal = isMismatch && !isSelected && option === correctLabel
                  return (
                    <button
                      key={option}
                      type="button"
                      disabled={locked}
                      aria-pressed={isSelected}
                      aria-label={`${orderNo}. soru için ${option} şıkkı`}
                      onClick={(event) => {
                        event.stopPropagation()
                        onSelect(orderNo, isSelected ? null : option)
                      }}
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-student-theme-primary ${
                        locked ? 'cursor-not-allowed' : ''
                      } ${
                        isSelected
                          ? isWrongSelection
                            ? 'border-panel-red bg-panel-red text-white'
                            : 'border-student-theme-primary bg-student-theme-primary text-student-theme-button-text'
                          : isCorrectReveal
                            ? 'border-panel-yellow bg-panel-yellow text-white'
                            : `border-panel-border text-panel-text-muted ${locked ? '' : 'hover:border-student-theme-primary hover:text-student-theme-text'}`
                      }`}
                    >
                      {option}
                    </button>
                  )
                })}
                {!locked || isBlankSelected ? (
                  <button
                    type="button"
                    disabled={locked}
                    aria-pressed={isBlankSelected}
                    aria-label={`${orderNo}. soruyu boş bırak`}
                    title="Boş bırak"
                    onClick={(event) => {
                      event.stopPropagation()
                      onSelect(orderNo, isBlankSelected ? null : BLANK_LABEL)
                    }}
                    className={`flex h-6 shrink-0 items-center justify-center rounded-full border px-1.5 text-[10px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-student-theme-primary ${
                      locked ? 'cursor-not-allowed' : ''
                    } ${
                      isBlankSelected
                        ? isMistake
                          ? 'border-panel-red bg-panel-red text-white'
                          : 'border-panel-text-muted bg-panel-text-muted text-white'
                        : `border-panel-border text-panel-text-muted ${locked ? '' : 'hover:border-panel-text-muted hover:text-panel-text'}`
                    }`}
                  >
                    Boş
                  </button>
                ) : null}
              </div>
              {isMismatch && correctLabel ? (
                <div className="ml-auto flex shrink-0 items-center gap-1.5">
                  <span className="whitespace-nowrap text-[10px] italic leading-none text-panel-text-muted">
                    <span className="sm:hidden">Doğru: {correctLabel}</span>
                    <span className="hidden sm:inline">Doğru cevap: {correctLabel}</span>
                  </span>
                  {shouldShowPhotoButton ? (
                    <button
                      type="button"
                      aria-label={
                        canViewPhoto
                          ? `${orderNo}. soru fotoğrafını aç ve hata analizi yap`
                          : `${orderNo}. soru için fotoğraf ekle`
                      }
                      title={canViewPhoto ? 'Fotoğrafı aç ve hata analizi yap' : 'Fotoğraf ekle'}
                      onClick={() => (canViewPhoto ? onOpenGallery(orderNo) : onCapture(orderNo))}
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors ${
                        hasPhoto
                          ? photoMode === 'view'
                            ? 'border border-panel-blue bg-white text-panel-blue hover:bg-panel-blue hover:text-white'
                            : 'bg-student-theme-primary text-student-theme-button-text'
                          : 'bg-white text-panel-text-muted hover:bg-student-theme-soft hover:text-student-theme-text'
                      }`}
                    >
                      <Camera size={13} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function TaskAnswerSheetModal({ task, lessonLabel, photoMode = 'edit', studentId, canRegrade = false, onClose, onSaved }) {
  const [tests, setTests] = useState(null)
  const [error, setError] = useState('')
  const [answersByTest, setAnswersByTest] = useState({})
  const [resultsByTest, setResultsByTest] = useState({})
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState(task.notes || '')
  const [noteDirty, setNoteDirty] = useState(false)
  const [noteSaving, setNoteSaving] = useState(false)
  const [removingTest, setRemovingTest] = useState(null)
  const [removeError, setRemoveError] = useState('')
  const [removeSaving, setRemoveSaving] = useState(false)
  const [photosByTest, setPhotosByTest] = useState({})
  const [capturingQuestion, setCapturingQuestion] = useState(null)
  // { testId, items, index } — bir testin fotoğraflı yanlışları arasında gezinilen hata analizi galerisi.
  const [gallery, setGallery] = useState(null)

  useEffect(() => {
    let ignore = false

    getTaskAnswerSheet(task.id, studentId)
      .then(({ tests: fetchedTests, photos }) => {
        if (ignore) return
        setTests(fetchedTests)
        setAnswersByTest(buildInitialAnswers(fetchedTests))
        setResultsByTest(Object.fromEntries(fetchedTests.map((test) => [test.id, test.result])))
        setPhotosByTest(photos || {})
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })

    return () => {
      ignore = true
    }
  }, [task.id, studentId])

  const totalQuestions = useMemo(() => (tests || []).reduce((sum, test) => sum + test.questionCount, 0), [tests])
  const allGraded = useMemo(
    () => Boolean(tests?.length) && tests.every((test) => Boolean(resultsByTest[test.id])),
    [tests, resultsByTest],
  )
  const allLocked = allGraded && !canRegrade

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
      const updatedTask = await saveTaskAnswers(task.id, payload, studentId)
      setResultsByTest(updatedTask.testResults || {})
      onSaved(updatedTask)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmRemoveTest = async () => {
    if (!removingTest) return
    setRemoveSaving(true)
    setRemoveError('')
    try {
      const updatedTask = await removeTaskTest(task.id, removingTest.id, studentId)
      setTests((prev) => (prev || []).filter((test) => test.id !== removingTest.id))
      setAnswersByTest((prev) => {
        const next = { ...prev }
        delete next[removingTest.id]
        return next
      })
      setResultsByTest((prev) => {
        const next = { ...prev }
        delete next[removingTest.id]
        return next
      })
      setRemovingTest(null)
      onSaved(updatedTask)
    } catch (err) {
      setRemoveError(err.message)
    } finally {
      setRemoveSaving(false)
    }
  }

  const openGallery = (test, orderNo, photosMap) => {
    const items = buildGalleryItems(test, photosMap || photosByTest)
    if (!items.length) return
    const idx = items.findIndex((entry) => entry.questionNumber === orderNo)
    setGallery({ testId: test.id, items, index: idx < 0 ? 0 : idx })
  }

  // Modaldaki güncellemeyi hem galeri item'larına hem de cevap kağıdı foto haritasına yansıt.
  const applyWrongQuestionUpdate = (wrongQuestionId, patch) => {
    setGallery((prev) =>
      prev
        ? { ...prev, items: prev.items.map((entry) => (entry.id === wrongQuestionId ? { ...entry, ...patch } : entry)) }
        : prev,
    )
    setPhotosByTest((prev) => {
      const next = { ...prev }
      for (const tId of Object.keys(next)) {
        const testPhotos = next[tId]
        for (const key of Object.keys(testPhotos)) {
          const entry = getPhotoEntry(testPhotos[key])
          if (entry?.id === wrongQuestionId) {
            next[tId] = { ...testPhotos, [key]: { ...entry, ...patch } }
          }
        }
      }
      return next
    })
  }

  const handleUpdateMistakeReason = async (wrongQuestionId, mistakeReason) => {
    const updated = await updateWrongQuestion(wrongQuestionId, { mistakeReason }, studentId)
    applyWrongQuestionUpdate(wrongQuestionId, { mistakeReason: updated.mistakeReason })
  }

  const handleUpdateMistakeMeta = async (wrongQuestionId, updates) => {
    const updated = await updateWrongQuestion(wrongQuestionId, updates, studentId)
    const patch = {}
    if ('topic' in updates) patch.topic = updated.topic || ''
    if ('studentNote' in updates) patch.studentNote = updated.studentNote || undefined
    applyWrongQuestionUpdate(wrongQuestionId, patch)
    return updated
  }

  const handleSavePhoto = async (dataUrl) => {
    if (!capturingQuestion) return
    const { testId, orderNo, reopenGallery } = capturingQuestion
    const key = String(orderNo)
    const wrongQuestion = await saveWrongQuestionPhoto(task.id, testId, key, dataUrl, studentId)
    const photoUrl = wrongQuestion.photoUrl || dataUrl
    const nextPhotos = {
      ...photosByTest,
      [testId]: {
        ...photosByTest[testId],
        [key]: {
          ...(getPhotoEntry(photosByTest[testId]?.[key]) || {}),
          id: wrongQuestion.id,
          hasPhoto: true,
          photoUrl,
        },
      },
    }
    setPhotosByTest(nextPhotos)
    setGallery((prev) =>
      prev && prev.testId === testId
        ? {
            ...prev,
            items: prev.items.map((entry) =>
              entry.questionNumber === orderNo ? { ...entry, id: wrongQuestion.id, photoUrl } : entry,
            ),
          }
        : prev,
    )
    if (reopenGallery) {
      const test = tests?.find((item) => item.id === testId)
      if (test) openGallery(test, orderNo, nextPhotos)
    }
  }

  const handleSaveNote = async () => {
    setNoteSaving(true)
    setError('')
    try {
      const updatedTask = await patchTask(task.id, { notes: note }, studentId)
      setNoteDirty(false)
      onSaved(updatedTask)
    } catch (err) {
      setError(err.message)
    } finally {
      setNoteSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center overflow-hidden bg-black/30 p-0 md:items-center md:p-4">
      <div className="flex h-full w-full min-w-0 max-w-full flex-col overflow-hidden border border-panel-border bg-panel-surface md:h-auto md:max-h-[85vh] md:max-w-4xl md:rounded-2xl xl:max-w-6xl 2xl:max-w-7xl">
        <div className="flex items-start justify-between gap-3 border-b border-panel-border p-4 sm:p-5">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-panel-text">Cevap Kağıdı</h2>
            <p className="text-sm text-panel-text-muted">
              {lessonLabel} · {task.title}
            </p>
          </div>
          <button type="button" aria-label="Kapat" onClick={onClose} className="text-panel-text-muted hover:text-panel-text">
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-3">
          {error ? <div className="mb-4 rounded-xl bg-panel-accent-soft px-4 py-3 text-sm text-panel-warm">{error}</div> : null}

          {canRegrade && allGraded ? (
            <div className="mb-3 rounded-xl bg-panel-blue-soft px-4 py-3 text-sm text-panel-blue">
              Öğrencinin işaretlediği cevapları düzeltip <strong>Yeniden Değerlendir</strong> ile sonucu güncelleyebilirsiniz.
            </div>
          ) : null}

          {tests === null ? (
            <LoadingState label="Testler yükleniyor..." />
          ) : tests.length === 0 ? (
            <p className="text-sm text-panel-text-muted">Bu göreve bağlı test bulunamadı.</p>
          ) : (
            <div className="grid min-w-0 grid-cols-1 gap-2 md:grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
              {tests.map((test) => (
                <TestSection
                  key={test.id}
                  test={test}
                  answers={answersByTest[test.id] || {}}
                  result={resultsByTest[test.id]}
                  photos={photosByTest[test.id]}
                  photoMode={photoMode}
                  canRegrade={canRegrade}
                  onSelect={(orderNo, label) => handleSelect(test.id, orderNo, label)}
                  onRemove={setRemovingTest}
                  onCapture={(orderNo) => setCapturingQuestion({ testId: test.id, orderNo, reopenGallery: true })}
                  onOpenGallery={(orderNo) => openGallery(test, orderNo)}
                />
              ))}
            </div>
          )}

          {tests?.length ? (
            <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-panel-border p-4">
              <label htmlFor="answer-sheet-note" className="text-sm font-semibold text-panel-text">
                Notun (opsiyonel)
              </label>
              <textarea
                id="answer-sheet-note"
                rows={2}
                value={note}
                onChange={(event) => {
                  setNote(event.target.value)
                  setNoteDirty(true)
                }}
                placeholder="Örn: 6. soruyu yanlış yuvarlamışım, aslında B yapmıştım."
                className="w-full resize-none rounded-xl border border-panel-border bg-panel-surface px-3 py-2 text-sm text-panel-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-student-theme-primary"
              />
              <button
                type="button"
                onClick={handleSaveNote}
                disabled={noteSaving || !noteDirty}
                className="self-end rounded-lg border border-student-theme-primary px-3 py-1.5 text-xs font-semibold text-student-theme-text hover:bg-student-theme-soft disabled:opacity-50"
              >
                {noteSaving ? 'Kaydediliyor...' : 'Notu Kaydet'}
              </button>
            </div>
          ) : null}
        </div>

        {tests?.length ? (
          <div className="border-t border-panel-border p-4 sm:p-5">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || allLocked}
              className="w-full rounded-xl bg-student-theme-primary px-4 py-3 text-sm font-semibold text-student-theme-button-text hover:bg-student-theme-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-student-theme-primary disabled:opacity-60"
            >
              {saving
                ? 'Kaydediliyor...'
                : allLocked
                  ? 'Tüm testler değerlendirildi'
                  : canRegrade && allGraded
                    ? 'Yeniden Değerlendir'
                    : `Kaydet (${totalQuestions} soru)`}
            </button>
          </div>
        ) : null}
      </div>

      {removingTest ? (
        <ConfirmationDialog
          title={`"${removingTest.name}" görevden kaldırılsın mı?`}
          description={`${removingTest.topicName ? `${removingTest.topicName} konulu ` : ''}bu testin cevapları da silinecek. Daha sonra ayrı bir görev olarak yeniden atanabilir.${removeError ? ` ${removeError}` : ''}`}
          confirmLabel={removeSaving ? 'Kaldırılıyor...' : 'Kaldır'}
          onConfirm={handleConfirmRemoveTest}
          onCancel={() => {
            setRemovingTest(null)
            setRemoveError('')
          }}
        />
      ) : null}

      {capturingQuestion ? (
        <MistakePhotoCaptureModal
          questionLabel={capturingQuestion.orderNo}
          existingPhotoUrl={getPhotoUrl(photosByTest[capturingQuestion.testId]?.[String(capturingQuestion.orderNo)])}
          onVerifyQuestionNumber={(dataUrl) =>
            verifyMistakePhotoQuestionNumber(dataUrl, capturingQuestion.orderNo)
          }
          onClose={() => setCapturingQuestion(null)}
          onSave={handleSavePhoto}
        />
      ) : null}

      {gallery && !capturingQuestion && gallery.items.length > 0 ? (
        <WrongQuestionGalleryModal
          title={tests?.find((test) => test.id === gallery.testId)?.name || 'Soru'}
          items={gallery.items}
          initialIndex={gallery.index}
          fetchPhoto={(wrongQuestionId) => getWrongQuestionPhoto(wrongQuestionId, studentId)}
          onUpdateMistakeReason={handleUpdateMistakeReason}
          onUpdateMistakeMeta={handleUpdateMistakeMeta}
          onCapturePhoto={
            photoMode === 'view'
              ? undefined
              : (item) => setCapturingQuestion({ testId: gallery.testId, orderNo: item.questionNumber })
          }
          onIndexChange={(idx) => setGallery((prev) => (prev ? { ...prev, index: idx } : prev))}
          onClose={() => setGallery(null)}
        />
      ) : null}
    </div>
  )
}
