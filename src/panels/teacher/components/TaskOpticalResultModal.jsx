import { useEffect, useState } from 'react'
import { X, CheckCircle2, XCircle, MinusCircle, Camera } from 'lucide-react'
import {
  getTeacherStudentWrongQuestionPhoto,
  getTeacherTaskAnswerSheet,
  updateTeacherStudentWrongQuestion,
} from '../../../services/teacherService'
import LoadingState from '../../shared/LoadingState'
import TaskReviewControl from '../../shared/TaskReviewControl'
import WrongQuestionGalleryModal from '../../shared/WrongQuestionGalleryModal'

const OPTIONS = ['A', 'B', 'C', 'D']
// Backend'deki BLANK_ANSWER_LABEL ile eşleşmeli (api/src/tasks.js).
const BLANK_LABEL = '-'

function getPhotoEntry(photos, key) {
  const entry = photos?.[key]
  if (!entry) return null
  if (typeof entry === 'string') return { photoUrl: entry, hasPhoto: true }
  return entry
}

function hasViewablePhoto(entry) {
  return Boolean(entry?.photoUrl || entry?.id)
}

// Bir testin fotoğraflı yanlış/boş sorularını, WrongQuestionGalleryModal'ın beklediği item
// şekline çevirir. Konu alanı kayıtlı değilse testin içerik adıyla ön-dolu gelir.
function buildGalleryItems(test, photos) {
  const items = []
  for (let orderNo = 1; orderNo <= test.questionCount; orderNo += 1) {
    const entry = getPhotoEntry(photos, String(orderNo))
    if (!entry?.id) continue
    items.push({
      id: entry.id,
      questionNumber: orderNo,
      testName: test.name,
      topicName: test.topicName,
      topic: entry.topic || test.topicName || test.name || '',
      studentNote: entry.studentNote,
      mistakeReason: entry.mistakeReason,
    })
  }
  return items
}

function ResultBadge({ result }) {
  if (!result) return null
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-1 rounded-xl bg-panel-blue-soft/60 px-2 py-1.5 text-xs font-semibold">
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
function TestSection({ test, photos, onOpenGallery }) {
  const { result, answers } = test
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-2xl border border-panel-border p-2.5">
      <h3
        className="min-w-0 truncate text-xs font-semibold text-panel-text"
        title={test.topicName ? `${test.name} · ${test.topicName}` : test.name}
      >
        {test.name}
        {test.topicName ? <span className="font-normal text-panel-text-muted"> · {test.topicName}</span> : null}
      </h3>

      <ResultBadge result={result} />

      <div className="grid min-w-0 grid-cols-1 gap-y-0.5">
        {Array.from({ length: test.questionCount }, (_, index) => index + 1).map((orderNo) => {
          const key = String(orderNo)
          const selected = answers[key]
          const isBlankSelected = selected === BLANK_LABEL
          const correctLabel = result?.correctLabels?.[key]
          const isMismatch = Boolean(result) && Boolean(correctLabel) && selected !== correctLabel
          const isWrongSelection = isMismatch && Boolean(selected) && !isBlankSelected
          const isWrongOrBlank = isMismatch && Boolean(selected)
          const photoEntry = getPhotoEntry(photos, key)
          const hasPhoto = hasViewablePhoto(photoEntry)
          return (
            <div
              key={key}
              className={`flex min-w-0 items-center gap-1.5 rounded-lg px-1 py-0.5 ${isWrongOrBlank ? 'bg-panel-red-soft' : ''}`}
            >
              <span className="w-5 shrink-0 text-right text-sm font-bold text-panel-text-muted">{orderNo}.</span>
              <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-1 overflow-hidden">
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
                <div className="ml-auto flex shrink-0 items-center gap-1.5">
                  <span className="whitespace-nowrap text-[10px] italic leading-none text-panel-text-muted">
                    <span className="sm:hidden">Doğru: {correctLabel}</span>
                    <span className="hidden sm:inline">Doğru cevap: {correctLabel}</span>
                  </span>
                  {isWrongOrBlank && hasPhoto ? (
                    <button
                      type="button"
                      aria-label={`${orderNo}. soru fotoğrafını görüntüle`}
                      title="Fotoğrafı görüntüle ve hata analizi yap"
                      onClick={() => onOpenGallery(test, orderNo)}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-panel-blue bg-white text-panel-blue transition-colors hover:bg-panel-blue hover:text-white"
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

export default function TaskOpticalResultModal({ task, studentTeacherId, onToggleReview, onClose }) {
  const [tests, setTests] = useState(null)
  const [photosByTest, setPhotosByTest] = useState({})
  // { testId, items, index } — açılınca ilgili testin tüm fotoğraflı yanlışları gezilebilir.
  const [gallery, setGallery] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false

    getTeacherTaskAnswerSheet(studentTeacherId, task.id)
      .then(({ tests: fetchedTests, photos }) => {
        if (ignore) return
        setTests(fetchedTests)
        setPhotosByTest(photos || {})
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })

    return () => {
      ignore = true
    }
  }, [studentTeacherId, task.id])

  const openGallery = (test, orderNo) => {
    const items = buildGalleryItems(test, photosByTest[test.id])
    const index = Math.max(
      0,
      items.findIndex((entry) => entry.questionNumber === orderNo),
    )
    setGallery({ testId: test.id, items, index })
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
      for (const testId of Object.keys(next)) {
        const testPhotos = next[testId]
        for (const key of Object.keys(testPhotos)) {
          const entry = getPhotoEntry(testPhotos, key)
          if (entry?.id === wrongQuestionId) {
            next[testId] = { ...testPhotos, [key]: { ...entry, ...patch } }
          }
        }
      }
      return next
    })
  }

  const handleUpdateMistakeReason = async (wrongQuestionId, mistakeReason) => {
    const updated = await updateTeacherStudentWrongQuestion(studentTeacherId, wrongQuestionId, { mistakeReason })
    applyWrongQuestionUpdate(wrongQuestionId, { mistakeReason: updated.mistakeReason })
  }

  const handleUpdateMistakeMeta = async (wrongQuestionId, updates) => {
    const updated = await updateTeacherStudentWrongQuestion(studentTeacherId, wrongQuestionId, updates)
    const patch = {}
    if ('topic' in updates) patch.topic = updated.topic || ''
    if ('studentNote' in updates) patch.studentNote = updated.studentNote || undefined
    applyWrongQuestionUpdate(wrongQuestionId, patch)
    return updated
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-black/30 md:items-center md:p-4">
      <div className="flex max-h-[90vh] w-full min-w-0 max-w-full flex-col overflow-hidden rounded-t-3xl border border-panel-border bg-panel-surface md:max-h-[85vh] md:max-w-4xl md:rounded-2xl xl:max-w-6xl 2xl:max-w-7xl">
        <div className="flex items-center justify-between border-b border-panel-border p-5">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-panel-text">Optik Sonuç · Cevap Anahtarı</h2>
            <p className="truncate text-sm text-panel-text-muted">{task.description || task.title}</p>
          </div>
          <button type="button" aria-label="Kapat" onClick={onClose} className="text-panel-text-muted hover:text-panel-text">
            <X size={20} />
          </button>
        </div>

        {typeof onToggleReview === 'function' ? (
          <div className="border-b border-panel-border bg-panel-surface-soft/60 px-5 py-3">
            <TaskReviewControl
              reviewed={Boolean(task.reviewedAt)}
              reviewedAt={task.reviewedAt}
              reviewedByName={task.reviewedByName}
              onToggle={onToggleReview}
            />
          </div>
        ) : null}

        <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-3">
          {error ? <div className="mb-4 rounded-xl bg-panel-accent-soft px-4 py-3 text-sm text-panel-warm">{error}</div> : null}

          {tests === null ? (
            <LoadingState label="Cevap anahtarı yükleniyor..." />
          ) : tests.length === 0 ? (
            <p className="text-sm text-panel-text-muted">Bu göreve bağlı test bulunamadı.</p>
          ) : (
            <div className="grid min-w-0 grid-cols-1 gap-2 md:grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
              {tests.map((test) => (
                <TestSection
                  key={test.id}
                  test={test}
                  photos={photosByTest[test.id]}
                  onOpenGallery={openGallery}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {gallery && gallery.items.length > 0 ? (
        <WrongQuestionGalleryModal
          title={tests?.find((test) => test.id === gallery.testId)?.name || 'Soru'}
          items={gallery.items}
          initialIndex={gallery.index}
          fetchPhoto={(wrongQuestionId) => getTeacherStudentWrongQuestionPhoto(studentTeacherId, wrongQuestionId)}
          onUpdateMistakeReason={handleUpdateMistakeReason}
          onUpdateMistakeMeta={handleUpdateMistakeMeta}
          onClose={() => setGallery(null)}
        />
      ) : null}
    </div>
  )
}
