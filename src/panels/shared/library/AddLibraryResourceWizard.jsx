import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { authRequest } from '../../../services/authClient'
import Button from '../../ui/Button'
import ResourceImageField from '../../parent/components/ResourceImageField'
import { libraryApiBase } from './libraryConstants'

function useLocalId() {
  const counter = useRef(0)
  return () => {
    counter.current += 1
    return `local-${counter.current}`
  }
}

function emptyTest(nextId) {
  return { id: nextId(), topicName: '', name: '', pageCount: '', questionCount: '' }
}

function emptyTopic(nextId) {
  return { id: nextId(), name: '', tests: [emptyTest(nextId)] }
}

export default function AddLibraryResourceWizard({ role, grade, subjectId, subjectName, onClose, onSubmitted }) {
  const apiBase = libraryApiBase(role)
  const nextId = useLocalId()

  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [publishers, setPublishers] = useState(null)
  const [publisherId, setPublisherId] = useState('')
  const [useNewPublisher, setUseNewPublisher] = useState(false)
  const [newPublisherName, setNewPublisherName] = useState('')
  const [topics, setTopics] = useState(() => [emptyTopic(nextId)])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    let ignore = false
    authRequest('/api/panel/publishers', { method: 'GET' })
      .then((data) => {
        if (!ignore) setPublishers(data.publishers)
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })
    return () => {
      ignore = true
    }
  }, [])

  const goToStep2 = () => {
    if (name.trim().length < 2) {
      setError('Kaynak adı en az 2 karakter olmalı.')
      return
    }
    if (useNewPublisher ? newPublisherName.trim().length < 2 : !publisherId) {
      setError('Yayınevi seçilmeli veya en az 2 karakterli bir isim girilmeli.')
      return
    }
    setError('')
    setStep(2)
  }

  const updateTopic = (topicId, changes) => {
    setTopics((current) => current.map((topic) => (topic.id === topicId ? { ...topic, ...changes } : topic)))
  }

  const updateTest = (topicId, testId, changes) => {
    setTopics((current) =>
      current.map((topic) =>
        topic.id !== topicId
          ? topic
          : { ...topic, tests: topic.tests.map((test) => (test.id === testId ? { ...test, ...changes } : test)) },
      ),
    )
  }

  const addTopic = () => setTopics((current) => [...current, emptyTopic(nextId)])
  const removeTopic = (topicId) => setTopics((current) => current.filter((topic) => topic.id !== topicId))
  const addTest = (topicId) =>
    setTopics((current) =>
      current.map((topic) => (topic.id === topicId ? { ...topic, tests: [...topic.tests, emptyTest(nextId)] } : topic)),
    )
  const removeTest = (topicId, testId) =>
    setTopics((current) =>
      current.map((topic) =>
        topic.id !== topicId ? topic : { ...topic, tests: topic.tests.filter((test) => test.id !== testId) },
      ),
    )

  const handleSubmit = async () => {
    for (const topic of topics) {
      if (topic.name.trim().length < 2) {
        setError('Her içeriğin adı en az 2 karakter olmalı.')
        return
      }
      if (!topic.tests.length) {
        setError(`"${topic.name}" içeriğine en az bir test eklenmeli.`)
        return
      }
      for (const test of topic.tests) {
        if (test.topicName.trim().length < 2 || test.name.trim().length < 2) {
          setError('Test konusu ve adı en az 2 karakter olmalı.')
          return
        }
        const pageCount = Number(test.pageCount)
        const questionCount = Number(test.questionCount)
        if (!Number.isInteger(pageCount) || pageCount <= 0) {
          setError('Sayfa sayısı pozitif bir tam sayı olmalı.')
          return
        }
        if (!Number.isInteger(questionCount) || questionCount <= 0) {
          setError('Soru sayısı pozitif bir tam sayı olmalı.')
          return
        }
      }
    }

    setError('')
    setSubmitting(true)
    try {
      await authRequest(`${apiBase}/library/resource-books`, {
        method: 'POST',
        body: JSON.stringify({
          grade,
          subjectId,
          name: name.trim(),
          imageUrl: imageUrl.trim() || null,
          publisherId: useNewPublisher ? null : publisherId,
          publisherName: useNewPublisher ? newPublisherName.trim() : null,
          topics: topics.map((topic) => ({
            name: topic.name.trim(),
            tests: topic.tests.map((test) => ({
              topicName: test.topicName.trim(),
              name: test.name.trim(),
              pageCount: Number(test.pageCount),
              questionCount: Number(test.questionCount),
            })),
          })),
        }),
      })
      setSubmitted(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 p-4">
        <div className="w-full max-w-md panel-card p-6 text-center">
          <h2 className="text-lg font-bold text-panel-text">Kaydınız alındı</h2>
          <p className="mt-2 text-sm text-panel-text-muted">
            Kaynağınız admin onayından sonra herkese görünür olacak. Onay beklerken bile öğrencinize/çocuğunuza
            hemen atayabilirsiniz.
          </p>
          <Button type="button" className="mt-4 w-full" onClick={onSubmitted}>
            Tamam
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 p-2 sm:p-4">
      <div className="flex h-full max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden panel-card p-4 sm:h-auto sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-panel-text">Kaynak Ekle</h2>
            <p className="text-xs text-panel-text-muted">
              {grade}. Sınıf · {subjectName} · Adım {step}/2 — {step === 1 ? 'Kapak' : 'İçindekiler'}
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
            <div className="flex flex-col gap-4">
              <div className="flex justify-center">
                <ResourceImageField value={imageUrl} onChange={setImageUrl} compact size={140} showUrlToggle />
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-panel-text-muted">Kitap Adı</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
                  placeholder="Örn. 8. Sınıf Matematik Soru Bankası"
                />
              </label>

              {!useNewPublisher ? (
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-panel-text-muted">Yayınevi</span>
                  <select
                    value={publisherId}
                    onChange={(event) => setPublisherId(event.target.value)}
                    className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
                  >
                    <option value="" disabled>
                      {publishers === null ? 'Yükleniyor...' : 'Yayınevi seçin'}
                    </option>
                    {publishers?.map((publisher) => (
                      <option key={publisher.id} value={publisher.id}>
                        {publisher.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setUseNewPublisher(true)}
                    className="w-fit text-xs font-medium text-panel-blue hover:underline"
                  >
                    Listede yok, yeni yayınevi ekle
                  </button>
                </label>
              ) : (
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-panel-text-muted">Yeni Yayınevi Adı</span>
                  <input
                    value={newPublisherName}
                    onChange={(event) => setNewPublisherName(event.target.value)}
                    className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
                    placeholder="Yayınevi adı"
                  />
                  <button
                    type="button"
                    onClick={() => setUseNewPublisher(false)}
                    className="w-fit text-xs font-medium text-panel-blue hover:underline"
                  >
                    Listeden seçmek istiyorum
                  </button>
                </label>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {topics.map((topic, topicIndex) => (
                <div key={topic.id} className="rounded-xl border border-panel-border p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <input
                      value={topic.name}
                      onChange={(event) => updateTopic(topic.id, { name: event.target.value })}
                      placeholder={`İçerik adı (örn. ${topicIndex + 1}. Ünite)`}
                      className="flex-1 rounded-xl border border-panel-border p-2 text-sm font-semibold text-panel-text"
                    />
                    {topics.length > 1 ? (
                      <button
                        type="button"
                        aria-label="İçeriği sil"
                        onClick={() => removeTopic(topic.id)}
                        className="shrink-0 rounded-full p-1.5 text-panel-text-muted hover:bg-panel-accent-soft hover:text-panel-warm"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-2">
                    {topic.tests.map((test) => (
                      <div key={test.id} className="grid grid-cols-2 gap-2 rounded-lg bg-panel-surface-soft p-2 sm:grid-cols-5">
                        <input
                          value={test.topicName}
                          onChange={(event) => updateTest(topic.id, test.id, { topicName: event.target.value })}
                          placeholder="Test konusu"
                          className="col-span-2 rounded-lg border border-panel-border p-1.5 text-xs text-panel-text sm:col-span-1"
                        />
                        <input
                          value={test.name}
                          onChange={(event) => updateTest(topic.id, test.id, { name: event.target.value })}
                          placeholder="Test adı"
                          className="col-span-2 rounded-lg border border-panel-border p-1.5 text-xs text-panel-text sm:col-span-1"
                        />
                        <input
                          type="number"
                          min="1"
                          value={test.pageCount}
                          onChange={(event) => updateTest(topic.id, test.id, { pageCount: event.target.value })}
                          placeholder="Sayfa sayısı"
                          className="rounded-lg border border-panel-border p-1.5 text-xs text-panel-text"
                        />
                        <input
                          type="number"
                          min="1"
                          value={test.questionCount}
                          onChange={(event) => updateTest(topic.id, test.id, { questionCount: event.target.value })}
                          placeholder="Soru sayısı"
                          className="rounded-lg border border-panel-border p-1.5 text-xs text-panel-text"
                        />
                        {topic.tests.length > 1 ? (
                          <button
                            type="button"
                            aria-label="Testi sil"
                            onClick={() => removeTest(topic.id, test.id)}
                            className="flex items-center justify-center rounded-lg text-panel-text-muted hover:text-panel-warm"
                          >
                            <Trash2 size={14} aria-hidden="true" />
                          </button>
                        ) : null}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addTest(topic.id)}
                      className="inline-flex w-fit items-center gap-1 text-xs font-medium text-panel-blue hover:underline"
                    >
                      <Plus size={12} aria-hidden="true" />
                      Test Ekle
                    </button>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={addTopic}
                className="inline-flex w-fit items-center gap-1.5 rounded-xl border border-dashed border-panel-border px-3 py-2 text-sm font-medium text-panel-text-muted hover:border-panel-blue hover:text-panel-blue"
              >
                <Plus size={14} aria-hidden="true" />
                İçerik Ekle
              </button>
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2 border-t border-panel-border pt-4">
          {step === 1 ? (
            <>
              <Button type="button" variant="secondary" size="md" onClick={onClose}>
                Vazgeç
              </Button>
              <Button type="button" size="md" onClick={goToStep2}>
                Devam Et
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="secondary" size="md" onClick={() => setStep(1)} disabled={submitting}>
                Geri
              </Button>
              <Button type="button" size="md" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Gönderiliyor...' : 'Gönder'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
