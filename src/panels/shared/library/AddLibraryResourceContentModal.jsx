import { useState } from 'react'
import { X } from 'lucide-react'
import { authRequest } from '../../../services/authClient'
import Button from '../../ui/Button'
import { libraryApiBase } from './libraryConstants'
import TocPhotoStep from './TocPhotoStep'
import TopicsEditor from './TopicsEditor'
import { applyExtractedTopics, useLocalId, useTopicsState, validateTopicsForSubmit, topicsToPayload } from './libraryTocFlow'

export default function AddLibraryResourceContentModal({ role, resourceBook, onClose, onSubmitted }) {
  const apiBase = libraryApiBase(role)
  const nextId = useLocalId()

  const [step, setStep] = useState(1)
  const { topics, setTopics, updateTopic, updateTest, addTopic, removeTopic, addTest, removeTest } =
    useTopicsState(nextId)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [tocImages, setTocImages] = useState([])
  const [tocExtracting, setTocExtracting] = useState(false)
  const [tocError, setTocError] = useState('')

  const goToStep2 = async () => {
    if (!tocImages.length) {
      setStep(2)
      return
    }

    setTocError('')
    setTocExtracting(true)
    try {
      const data = await authRequest(`${apiBase}/library/resource-books/extract-toc`, {
        method: 'POST',
        timeoutMs: 60000,
        body: JSON.stringify({
          images: tocImages.map((image) => ({
            imageBase64: image.dataUrl.split(',')[1] || '',
            mediaType: image.mediaType,
          })),
        }),
      })
      setTopics(applyExtractedTopics(data.topics, nextId))
      setStep(2)
    } catch (err) {
      setTocError(err.message)
    } finally {
      setTocExtracting(false)
    }
  }

  const handleSubmit = async () => {
    const validationError = validateTopicsForSubmit(topics)
    if (validationError) {
      setError(validationError)
      return
    }

    setError('')
    setSubmitting(true)
    try {
      const detail = await authRequest(`${apiBase}/library/resource-books/${resourceBook.id}/topics`, {
        method: 'POST',
        body: JSON.stringify({ topics: topicsToPayload(topics) }),
      })
      onSubmitted(detail)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const stepLabel = step === 1 ? 'İçindekiler Fotoğrafları' : 'İçerikler'

  return (
    <div className="fixed inset-0 z-[80] flex items-stretch justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <div className="flex h-full w-full max-w-4xl flex-col overflow-hidden border border-panel-border bg-panel-surface p-4 shadow-panel-1 sm:h-[85vh] sm:max-h-[95vh] sm:rounded-2xl sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-panel-text">Kaynak İçeriği Ekle</h2>
            <p className="truncate text-xs text-panel-text-muted">
              {resourceBook.name} · Adım {step}/2 — {stepLabel}
            </p>
          </div>
          <button type="button" aria-label="Kapat" onClick={onClose} className="shrink-0">
            <X size={20} />
          </button>
        </div>

        {error ? (
          <div className="mb-3 rounded-xl bg-panel-accent-soft px-3 py-2 text-sm text-panel-warm">{error}</div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {step === 1 ? (
            <TocPhotoStep
              tocImages={tocImages}
              setTocImages={setTocImages}
              extracting={tocExtracting}
              tocError={tocError}
              setTocError={setTocError}
            />
          ) : (
            <TopicsEditor
              topics={topics}
              updateTopic={updateTopic}
              updateTest={updateTest}
              addTopic={addTopic}
              removeTopic={removeTopic}
              addTest={addTest}
              removeTest={removeTest}
              showTocHint={tocImages.length > 0}
            />
          )}
        </div>

        <div className="mt-4 flex flex-col items-stretch gap-2 border-t border-panel-border pt-4 sm:flex-row sm:justify-end">
          {step === 1 ? (
            <>
              <Button type="button" variant="secondary" size="md" onClick={onClose} disabled={tocExtracting}>
                Vazgeç
              </Button>
              <Button type="button" size="md" onClick={goToStep2} disabled={tocExtracting}>
                {tocExtracting ? 'Okunuyor...' : 'Devam Et'}
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="secondary" size="md" onClick={() => setStep(1)} disabled={submitting}>
                Geri
              </Button>
              <Button type="button" size="md" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Kaydediliyor...' : 'Kaydet'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
