import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react'
import Button from '../../ui/Button'
import { authRequest } from '../../../services/authClient'
import { createPanelRequest } from '../../../services/panelRequestService'
import { BOOKSHELF_GRADE_OPTIONS } from '../bookshelf/bookshelfConstants'
import RequestPhotoField from './RequestPhotoField'

const STEPS = [
  { key: 'kapak', title: 'Kapak fotoğrafı' },
  { key: 'icindekiler', title: 'İçindekiler' },
  { key: 'cevapAnahtari', title: 'Cevap anahtarı' },
]

// "Kitap Ekleme Talebi Oluştur" sihirbazı. 3 adımda kapak + içindekiler + cevap anahtarı
// fotoğrafları toplar (+ opsiyonel kitap bilgisi), talebi API'ye gönderir. Sonuç
// "Taleplerim" menüsünden takip edilir. bkz. api/src/panelRequests.js
export default function BookAdditionRequestModal({ onClose, onGoToRequests, onSubmitted }) {
  const [step, setStep] = useState(0)
  const [subjects, setSubjects] = useState([])

  const [kapak, setKapak] = useState([])
  const [icindekiler, setIcindekiler] = useState([])
  const [cevapAnahtari, setCevapAnahtari] = useState([])

  const [bookName, setBookName] = useState('')
  const [publisherName, setPublisherName] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [grade, setGrade] = useState('')
  const [note, setNote] = useState('')

  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let ignore = false
    authRequest('/api/panel/subjects', { method: 'GET' })
      .then((data) => {
        if (!ignore) setSubjects(data.subjects || [])
      })
      .catch(() => {})
    return () => {
      ignore = true
    }
  }, [])

  const stepValid = useMemo(() => {
    if (step === 0) return kapak.length === 1
    if (step === 1) return icindekiler.length >= 1
    return true
  }, [step, kapak, icindekiler])

  const goNext = () => {
    setError('')
    if (step < STEPS.length - 1) setStep((s) => s + 1)
  }
  const goBack = () => {
    setError('')
    setStep((s) => Math.max(0, s - 1))
  }

  const handleSubmit = async () => {
    if (kapak.length !== 1) {
      setStep(0)
      return setError('Bir kapak fotoğrafı ekleyin.')
    }
    if (icindekiler.length < 1) {
      setStep(1)
      return setError('En az bir içindekiler fotoğrafı ekleyin.')
    }

    setError('')
    setSubmitting(true)
    try {
      await createPanelRequest({
        type: 'kitap-ekleme',
        book: {
          bookName: bookName.trim() || undefined,
          publisherName: publisherName.trim() || undefined,
          subjectId: subjectId || undefined,
          grade: grade || undefined,
          note: note.trim() || undefined,
        },
        photos: { kapak, icindekiler, cevapAnahtari },
      })
      setDone(true)
      onSubmitted?.()
    } catch (err) {
      setError(err.message || 'Talep gönderilemedi.')
    } finally {
      setSubmitting(false)
    }
  }

  const currentStep = STEPS[step]

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <div className="flex h-full w-full flex-col overflow-hidden border border-panel-border bg-panel-surface shadow-panel-1 sm:h-[88vh] sm:max-h-[760px] sm:max-w-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-panel-border p-4 sm:p-5">
          <div>
            <h2 className="text-lg font-bold text-panel-text">Kitap Ekleme Talebi</h2>
            <p className="mt-0.5 text-sm text-panel-text-muted">
              {done
                ? 'Talebiniz alındı.'
                : `Adım ${step + 1} / ${STEPS.length} · ${currentStep.title}`}
            </p>
          </div>
          <button type="button" aria-label="Kapat" onClick={onClose} className="shrink-0 text-panel-text-muted hover:text-panel-text">
            <X size={20} />
          </button>
        </div>

        {done ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-panel-sage-soft text-panel-sage">
              <Check size={28} aria-hidden="true" />
            </span>
            <div>
              <p className="text-base font-semibold text-panel-text">Talebiniz alındı</p>
              <p className="mx-auto mt-1.5 max-w-sm text-sm text-panel-text-muted">
                Kitabınız 1 iş günü içinde sistem yöneticilerimiz tarafından incelenip kütüphaneye
                eklenecek. Sonucu <strong>Taleplerim</strong> menüsünden takip edebilirsiniz.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="secondary" onClick={onClose}>
                Kapat
              </Button>
              {onGoToRequests ? (
                <Button onClick={onGoToRequests}>Taleplerim'e Git</Button>
              ) : null}
            </div>
          </div>
        ) : (
          <>
            <div className="flex gap-1.5 px-4 pt-3 sm:px-5">
              {STEPS.map((s, index) => (
                <div
                  key={s.key}
                  className={`h-1.5 flex-1 rounded-full ${index <= step ? 'bg-panel-blue' : 'bg-panel-border'}`}
                />
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              {error ? (
                <div className="mb-3 rounded-xl bg-panel-accent-soft px-3 py-2 text-sm text-panel-warm">{error}</div>
              ) : null}

              {step === 0 ? (
                <div className="flex flex-col gap-4">
                  <RequestPhotoField
                    label="Kitabın ön kapağı"
                    description="Kitap adı, yayınevi ve sınıf bilgisi kapakta net görünsün."
                    photos={kapak}
                    onChange={setKapak}
                    single
                  />

                  <div className="rounded-xl border border-panel-border p-3">
                    <p className="mb-2 text-sm font-semibold text-panel-text">
                      Kitap bilgileri <span className="font-normal text-panel-text-muted">(biliyorsanız — opsiyonel)</span>
                    </p>
                    <div className="flex flex-col gap-3">
                      <label className="flex flex-col gap-1.5">
                        <span className="text-sm font-medium text-panel-text-muted">Kitap adı</span>
                        <input
                          value={bookName}
                          onChange={(e) => setBookName(e.target.value)}
                          className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
                        />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-sm font-medium text-panel-text-muted">Yayınevi</span>
                        <input
                          value={publisherName}
                          onChange={(e) => setPublisherName(e.target.value)}
                          className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
                        />
                      </label>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label className="flex flex-col gap-1.5">
                          <span className="text-sm font-medium text-panel-text-muted">Ders</span>
                          <select
                            value={subjectId}
                            onChange={(e) => setSubjectId(e.target.value)}
                            className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
                          >
                            <option value="">Seçin</option>
                            {subjects.map((subject) => (
                              <option key={subject.id} value={subject.id}>
                                {subject.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="flex flex-col gap-1.5">
                          <span className="text-sm font-medium text-panel-text-muted">Sınıf</span>
                          <select
                            value={grade}
                            onChange={(e) => setGrade(e.target.value)}
                            className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
                          >
                            <option value="">Seçin</option>
                            {BOOKSHELF_GRADE_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option}. sınıf
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-sm font-medium text-panel-text-muted">Not</span>
                        <textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          rows={2}
                          maxLength={1000}
                          placeholder="Eklemek istediğiniz bir açıklama varsa yazın."
                          className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              ) : null}

              {step === 1 ? (
                <RequestPhotoField
                  label="İçindekiler sayfaları"
                  description="Kitabın içindekiler / konu listesi sayfalarının tamamını çekin (birden fazla sayfa olabilir)."
                  photos={icindekiler}
                  onChange={setIcindekiler}
                />
              ) : null}

              {step === 2 ? (
                <RequestPhotoField
                  label="Cevap anahtarı sayfaları"
                  description="Kitabın cevap anahtarı sayfaları. Kitapta cevap anahtarı yoksa bu adımı boş bırakabilirsiniz."
                  photos={cevapAnahtari}
                  onChange={setCevapAnahtari}
                />
              ) : null}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-panel-border p-4 sm:p-5">
              <Button variant="ghost" onClick={goBack} disabled={step === 0 || submitting}>
                <ChevronLeft size={16} aria-hidden="true" />
                Geri
              </Button>
              {step < STEPS.length - 1 ? (
                <Button onClick={goNext} disabled={!stepValid}>
                  İleri
                  <ChevronRight size={16} aria-hidden="true" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting ? 'Gönderiliyor...' : 'Talebi Gönder'}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
