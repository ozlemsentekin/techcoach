import { useEffect, useState } from 'react'
import { X, CheckCircle2, XCircle, MinusCircle, Camera } from 'lucide-react'
import Badge from '../ui/Badge'
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
// yetkilendirme) submitAnswers/submitPhoto/fetchExistingPhotos callback'leri üzerinden dışarıdan verilir.
export default function ManualOpticalAnswerModal({
  test,
  onClose,
  onSaved,
  submitAnswers,
  submitPhoto,
  fetchExistingPhotos,
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
  const [photosByQuestion, setPhotosByQuestion] = useState({})
  const [capturingOrderNo, setCapturingOrderNo] = useState(null)

  const questionNumbers = Array.from({ length: test.questionCount }, (_, index) => index + 1)
  const answeredCount = Object.keys(answers).length
  const allAnswered = answeredCount === test.questionCount

  const submit = async (submittedAnswers) => {
    setSaving(true)
    setError('')
    try {
      const data = await submitAnswers(submittedAnswers)
      setResult({ correctCount: data.correctCount, wrongCount: data.wrongCount, blankCount: data.blankCount })
      setCorrectLabels(data.correctLabels || null)
      onSaved(test.id, {
        completionSource: 'manual',
        correctCount: data.correctCount,
        wrongCount: data.wrongCount,
        blankCount: data.blankCount,
        manualAnswers: data.answers,
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
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

  // Daha önce bu test için eklenmiş Hata Defteri fotoğrafları varsa, kamera ikonunun "dolu"
  // görünmesi için önceden yükle (opsiyonel — panel bunu desteklemiyorsa atlanır).
  useEffect(() => {
    if (!fetchExistingPhotos) return undefined
    let ignore = false
    fetchExistingPhotos()
      .then((photos) => {
        if (!ignore && photos) setPhotosByQuestion((prev) => ({ ...photos, ...prev }))
      })
      .catch(() => {
        // Sessizce yok say: kamera ikonu boş görünür, fotoğraf yine de eklenebilir.
      })
    return () => {
      ignore = true
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

  const handleSave = () => submit(answers)

  const handleSavePhoto = async (dataUrl) => {
    if (!capturingOrderNo) return
    const key = String(capturingOrderNo)
    const data = await submitPhoto(key, dataUrl)
    setPhotosByQuestion((prev) => ({ ...prev, [key]: data.wrongQuestion?.photoUrl || dataUrl }))
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/30 md:items-center">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-t-3xl border border-panel-border bg-panel-surface md:max-h-[85vh] md:rounded-2xl">
        <div className="flex items-center justify-between border-b border-panel-border p-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-panel-text">Optik Form · {test.name}</h2>
            {test.topicName ? <p className="text-xs text-panel-text-muted">{test.topicName}</p> : null}
          </div>
          <button type="button" aria-label="Kapat" onClick={onClose} className="shrink-0 text-panel-text-muted hover:text-panel-text">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge tone="slate">{test.questionCount} soru</Badge>
            <span className="text-xs text-panel-text-muted">{answeredCount}/{test.questionCount} işaretlendi</span>
            <ResultBadge result={result} />
          </div>

          {result ? (
            <p className="mb-3 text-xs text-panel-text-muted">
              Yanlış işaretlenen sorularda doğru cevap sarıyla gösterilir; fotoğraf eklemek için ilgili satıra
              dokunun. Cevapları değiştirdikçe sonuç güncel kalması için "Kaydet ve Notla"ya tekrar basın.
            </p>
          ) : null}

          {error ? <div className="mb-3 rounded-xl bg-panel-accent-soft px-3 py-2 text-sm text-panel-warm">{error}</div> : null}

          <div className="flex flex-col gap-y-0.5">
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
                  role={isMistake ? 'button' : undefined}
                  tabIndex={isMistake ? 0 : undefined}
                  onClick={isMistake ? () => setCapturingOrderNo(orderNo) : undefined}
                  onKeyDown={
                    isMistake
                      ? (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            setCapturingOrderNo(orderNo)
                          }
                        }
                      : undefined
                  }
                  className={`flex items-center gap-1.5 rounded-lg px-1 py-1 transition-colors ${
                    isMistake ? 'cursor-pointer bg-panel-red-soft hover:bg-panel-red-soft/70' : ''
                  }`}
                >
                  <span className="w-5 shrink-0 text-right text-sm font-bold text-panel-text-muted">{orderNo}.</span>
                  <div className="flex shrink-0 gap-1">
                    {OPTIONS.map((option) => {
                      const isSelected = selected === option
                      const isCorrectReveal = isMismatch && !isSelected && option === correctLabel
                      return (
                        <button
                          key={option}
                          type="button"
                          aria-pressed={isSelected}
                          aria-label={`${orderNo}. soru için ${option} şıkkı`}
                          onClick={() => handleSelect(orderNo, option)}
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
                      onClick={() => handleSelect(orderNo, BLANK_LABEL)}
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
                    <span className="min-w-0 truncate text-[11px] italic leading-none text-panel-text-muted">
                      Doğru cevap: {correctLabel}
                    </span>
                  ) : null}
                  {isMistake ? (
                    <span
                      title={hasPhoto ? 'Fotoğraf eklendi' : 'Fotoğraf ekle'}
                      className={`ml-auto flex shrink-0 items-center justify-center rounded-full p-1 transition-colors ${
                        hasPhoto ? 'bg-panel-blue text-white' : 'text-panel-text-muted'
                      }`}
                    >
                      <Camera size={12} aria-hidden="true" />
                    </span>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>

        <div className="border-t border-panel-border p-4">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !allAnswered}
            className="w-full rounded-xl bg-panel-blue px-4 py-3 text-sm font-semibold text-white hover:bg-panel-blue/90 disabled:opacity-50"
          >
            {saving
              ? 'Kaydediliyor...'
              : allAnswered
                ? result
                  ? 'Yeniden Kaydet ve Notla'
                  : 'Kaydet ve Notla'
                : `Tüm soruları işaretleyin (${answeredCount}/${test.questionCount})`}
          </button>
        </div>
      </div>

      {capturingOrderNo ? (
        <MistakePhotoCaptureModal
          questionLabel={capturingOrderNo}
          existingPhotoUrl={photosByQuestion[String(capturingOrderNo)]}
          onClose={() => setCapturingOrderNo(null)}
          onSave={handleSavePhoto}
        />
      ) : null}
    </div>
  )
}
