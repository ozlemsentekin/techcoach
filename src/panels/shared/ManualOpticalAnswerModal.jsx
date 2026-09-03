import { useEffect, useRef, useState } from 'react'
import { X, CheckCircle2, XCircle, MinusCircle, Camera, Check } from 'lucide-react'
import Badge from '../ui/Badge'
import ConfirmationDialog from './ConfirmationDialog'
import SuccessCelebration from './SuccessCelebration'
import MistakePhotoCaptureModal from '../student/components/MistakePhotoCaptureModal'

const OPTIONS = ['A', 'B', 'C', 'D']
// Backend'deki BLANK_ANSWER_LABEL ile eşleşmeli (api/src/testGrading.js).
const BLANK_LABEL = '-'

function ResultBadge({ result }) {
  if (!result) return null
  return (
    <div className="flex flex-nowrap items-center gap-3 rounded-xl bg-panel-blue-soft px-3 py-2 text-xs font-semibold">
      <span className="flex shrink-0 items-center gap-1 text-panel-sage">
        <CheckCircle2 size={13} aria-hidden="true" /> {result.correctCount} Doğru
      </span>
      <span className="flex shrink-0 items-center gap-1 text-panel-red">
        <XCircle size={13} aria-hidden="true" /> {result.wrongCount} Yanlış
      </span>
      <span className="flex shrink-0 items-center gap-1 text-panel-text-muted">
        <MinusCircle size={13} aria-hidden="true" /> {result.blankCount} Boş
      </span>
    </div>
  )
}

// Veli ve öğretmen panelinde ortak kullanılan optik cevap formu. Öğrencinin kendi cevap kağıdı
// akışının (TaskAnswerSheetModal) aksine kilitlenmez — veli/öğretmen fiziksel kitaptaki sonucu
// aktarırken bir yanlışı fark edip istediği an düzeltebilmeli. Panel'e özgü kısımlar (API yolları,
// yetkilendirme) submitAnswers/submitPhoto callback'leri ve initialPhotos ile dışarıdan verilir.
export default function ManualOpticalAnswerModal({
  test,
  onClose,
  onSaved,
  submitAnswers,
  submitPhoto,
  verifyQuestionNumber,
  initialPhotos,
}) {
  const initialAnswers = test.manualAnswers || {}
  const wasAlreadyGraded = test.completionSource === 'manual' && test.correctCount !== undefined

  const [answers, setAnswers] = useState(() => ({ ...initialAnswers }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(
    wasAlreadyGraded
      ? { correctCount: test.correctCount, wrongCount: test.wrongCount, blankCount: test.blankCount }
      : null,
  )
  const [correctLabels, setCorrectLabels] = useState(null)
  const [photosByQuestion, setPhotosByQuestion] = useState(() => ({ ...(initialPhotos || {}) }))
  const [capturingOrderNo, setCapturingOrderNo] = useState(null)
  const [photoReminderOpen, setPhotoReminderOpen] = useState(false)
  // null | 'stay' (sadece kutla) | 'close' (kutlama kapanınca formu da kapat)
  const [celebrate, setCelebrate] = useState(null)
  const submitSeqRef = useRef(0)

  const questionNumbers = Array.from({ length: test.questionCount }, (_, index) => index + 1)
  const answeredCount = Object.keys(answers).length
  const allAnswered = answeredCount === test.questionCount

  // Aynı anda birden fazla submit isteği yarışabilir (bkz. aşağıdaki mount-time sessiz yeniden
  // notlama). Sıra numarasıyla, ekrana her zaman en SON atılan isteğin sonucu yansır; geç dönen
  // eski bir yanıt taze bir kaydı ezmesin diye yok sayılır.
  const submit = async (submittedAnswers, { celebrateMode = null } = {}) => {
    const seq = ++submitSeqRef.current
    setSaving(true)
    setError('')
    try {
      const data = await submitAnswers(submittedAnswers)
      if (seq !== submitSeqRef.current) return false
      setResult({ correctCount: data.correctCount, wrongCount: data.wrongCount, blankCount: data.blankCount })
      setCorrectLabels(data.correctLabels || null)
      // Tam puan (%100) ise konfeti + motivasyon kutlaması — sadece kullanıcının kaydında.
      if (celebrateMode && Number(data.wrongCount) === 0 && Number(data.blankCount) === 0) {
        setCelebrate(celebrateMode)
      }
      onSaved(test.id, {
        completionSource: 'manual',
        correctCount: data.correctCount,
        wrongCount: data.wrongCount,
        blankCount: data.blankCount,
        manualAnswers: data.answers,
      })
      return data
    } catch (err) {
      if (seq !== submitSeqRef.current) return false
      setError(err.message || 'Cevaplar kaydedilemedi.')
      return false
    } finally {
      if (seq === submitSeqRef.current) setSaving(false)
    }
  }

  // Daha önce notlanmış bir test tekrar açıldığında, doğru cevap anahtarını (correctLabels)
  // göstermek için aynı cevaplarla sessizce yeniden notlama isteği atılır.
  useEffect(() => {
    if (wasAlreadyGraded && Object.keys(initialAnswers).length === test.questionCount) {
      submit(initialAnswers)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSelect = (orderNo, label) => {
    setAnswers((prev) => {
      const next = { ...prev }
      const key = String(orderNo)
      if (prev[key] === label) delete next[key]
      else next[key] = label
      return next
    })
  }

  const handleSave = () => submit(answers, { celebrateMode: 'stay' })

  const hasMissingMistakePhotos = (savedData) => {
    if (!savedData || (Number(savedData.wrongCount) <= 0 && Number(savedData.blankCount) <= 0)) return false

    return Object.entries(savedData.correctLabels || {}).some(([key, correctLabel]) => {
      const selected = savedData.answers?.[key] ?? answers[key]
      return Boolean(correctLabel) && Boolean(selected) && selected !== correctLabel && !photosByQuestion[key]
    })
  }

  const handleSaveAndClose = async () => {
    const savedData = await submit(answers, { celebrateMode: 'close' })
    if (!savedData) return

    // Tam puan: kutlama gösterildi; kullanıcı "Tamam"a basınca form da kapanır.
    if (Number(savedData.wrongCount) === 0 && Number(savedData.blankCount) === 0) return

    if (hasMissingMistakePhotos(savedData)) {
      setPhotoReminderOpen(true)
      return
    }

    onClose()
  }

  const handleSavePhoto = async (dataUrl) => {
    if (!capturingOrderNo) return
    const key = String(capturingOrderNo)
    const data = await submitPhoto(key, dataUrl)
    setPhotosByQuestion((prev) => ({ ...prev, [key]: data.wrongQuestion?.photoUrl || dataUrl }))
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center overflow-hidden bg-black/30 md:items-center md:p-4">
      <div className="flex max-h-[90vh] w-full min-w-0 max-w-full flex-col overflow-hidden rounded-t-3xl border border-panel-border bg-panel-surface md:max-h-[85vh] md:max-w-2xl md:rounded-2xl">
        <div className="flex items-center justify-between border-b border-panel-border p-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-panel-text">Optik Form · {test.name}</h2>
            {test.topicName ? <p className="truncate text-xs text-panel-text-muted">{test.topicName}</p> : null}
          </div>
          <button type="button" aria-label="Kapat" onClick={onClose} className="shrink-0 text-panel-text-muted hover:text-panel-text">
            <X size={20} />
          </button>
        </div>

        <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge tone="slate">{test.questionCount} soru</Badge>
            <span className="text-xs text-panel-text-muted">{answeredCount}/{test.questionCount} işaretlendi</span>
            <ResultBadge result={result} />
          </div>

          {result ? (
            <p className="mb-3 text-xs text-panel-text-muted">
              Yanlış işaretlenen sorularda doğru cevap sarıyla gösterilir; fotoğraf eklemek için kamera ikonuna
              dokunun. Cevapları değiştirdikçe sonuç güncel kalması için "Kaydet ve Notla"ya tekrar basın.
            </p>
          ) : null}

          {error ? <div className="mb-3 rounded-xl bg-panel-accent-soft px-3 py-2 text-sm text-panel-warm">{error}</div> : null}

          <div className="flex min-w-0 flex-col gap-y-0.5">
            {questionNumbers.map((orderNo) => {
              const key = String(orderNo)
              const selected = answers[key]
              const isBlankSelected = selected === BLANK_LABEL
              const correctLabel = correctLabels?.[key]
              const isMismatch = Boolean(correctLabel) && selected !== correctLabel
              const isWrongSelection = isMismatch && Boolean(selected) && !isBlankSelected
              const isMistake = isMismatch && Boolean(selected)
              const hasPhoto = Boolean(photosByQuestion[key])
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
                          aria-pressed={isSelected}
                          aria-label={`${orderNo}. soru için ${option} şıkkı`}
                          onClick={(event) => {
                            event.stopPropagation()
                            handleSelect(orderNo, option)
                          }}
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors ${
                            isSelected
                              ? isWrongSelection
                                ? 'border-panel-red bg-panel-red text-white'
                                : 'border-panel-blue bg-panel-blue text-white'
                              : isCorrectReveal
                                ? 'border-panel-yellow bg-panel-yellow text-white'
                                : 'border-panel-border text-panel-text-muted hover:border-panel-blue'
                          }`}
                        >
                          {option}
                        </button>
                      )
                    })}
                    <button
                      type="button"
                      aria-pressed={isBlankSelected}
                      aria-label={`${orderNo}. soruyu boş bırak`}
                      title="Boş bırak"
                      onClick={(event) => {
                        event.stopPropagation()
                        handleSelect(orderNo, BLANK_LABEL)
                      }}
                      className={`flex h-7 shrink-0 items-center justify-center rounded-full border px-1.5 text-[10px] font-semibold transition-colors ${
                        isBlankSelected
                          ? isMistake
                            ? 'border-panel-red bg-panel-red text-white'
                            : 'border-panel-text-muted bg-panel-text-muted text-white'
                          : 'border-panel-border text-panel-text-muted hover:border-panel-text-muted'
                      }`}
                    >
                      Boş
                    </button>
                  </div>
                  {isMismatch && correctLabel ? (
                    <div className="ml-auto flex shrink-0 items-center gap-1.5">
                      <span className="whitespace-nowrap text-[11px] italic leading-none text-panel-text-muted">
                        <span className="sm:hidden">Doğru: {correctLabel}</span>
                        <span className="hidden sm:inline">Doğru cevap: {correctLabel}</span>
                      </span>
                      {isMistake ? (
                        <button
                          type="button"
                          aria-label={
                            hasPhoto
                              ? `${orderNo}. soru fotoğrafını değiştir`
                              : `${orderNo}. soru için fotoğraf ekle`
                          }
                          title={hasPhoto ? 'Fotoğraf eklendi · değiştirmek için dokun' : 'Fotoğraf eksik · eklemek için dokun'}
                          onClick={() => setCapturingOrderNo(orderNo)}
                          className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors ${
                            hasPhoto
                              ? 'border-panel-sage bg-panel-sage text-white'
                              : 'border-panel-warm bg-white text-panel-warm hover:bg-panel-warm hover:text-white'
                          }`}
                        >
                          <Camera size={14} aria-hidden="true" />
                          {hasPhoto ? (
                            <Check
                              size={11}
                              strokeWidth={3}
                              aria-hidden="true"
                              className="absolute -right-0.5 -top-0.5 rounded-full bg-white text-panel-sage"
                            />
                          ) : null}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>

        <div className="border-t border-panel-border p-4">
          {!allAnswered ? (
            <p className="mb-2 text-center text-xs font-semibold text-panel-text-muted">
              Tüm soruları işaretleyin ({answeredCount}/{test.questionCount})
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !allAnswered}
              className="min-h-12 rounded-xl border border-panel-blue px-3 py-3 text-sm font-semibold text-panel-blue hover:bg-panel-blue-soft disabled:border-panel-border disabled:text-panel-text-muted disabled:opacity-60"
            >
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
            <button
              type="button"
              onClick={handleSaveAndClose}
              disabled={saving || !allAnswered}
              className="min-h-12 rounded-xl bg-panel-blue px-3 py-3 text-sm font-semibold text-white hover:bg-panel-blue/90 disabled:opacity-60"
            >
              {saving ? 'Kaydediliyor...' : 'Kaydet Kapat'}
            </button>
          </div>
        </div>
      </div>

      {celebrate ? (
        <SuccessCelebration
          onClose={() => {
            const shouldCloseForm = celebrate === 'close'
            setCelebrate(null)
            if (shouldCloseForm) onClose()
          }}
        />
      ) : null}

      {capturingOrderNo ? (
        <MistakePhotoCaptureModal
          questionLabel={capturingOrderNo}
          existingPhotoUrl={photosByQuestion[String(capturingOrderNo)]}
          onVerifyQuestionNumber={
            verifyQuestionNumber
              ? (dataUrl) => verifyQuestionNumber(String(capturingOrderNo), dataUrl)
              : undefined
          }
          onClose={() => setCapturingOrderNo(null)}
          onSave={handleSavePhoto}
        />
      ) : null}

      {photoReminderOpen ? (
        <ConfirmationDialog
          title="Fotoğraf eklemek ister misiniz?"
          description="Yanlış / boş sorularınız için fotoğraf eklemek ister misiniz?"
          confirmLabel="Evet"
          cancelLabel="Hayır, kapat"
          onConfirm={() => setPhotoReminderOpen(false)}
          onCancel={() => {
            setPhotoReminderOpen(false)
            onClose()
          }}
        />
      ) : null}
    </div>
  )
}
