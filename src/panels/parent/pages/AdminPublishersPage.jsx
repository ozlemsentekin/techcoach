import { useEffect, useMemo, useState } from 'react'
import { MotionDiv } from '../../ui/motion'
import { BookOpen, Building2, CheckCircle2, ChevronDown, ChevronRight, Dot, FileText, HelpCircle, ImagePlus, KeyRound, ListTree, Pencil, Search, Trash2, X } from 'lucide-react'
import { authRequest } from '../../../services/authClient'
import PageHeader from '../../layout/PageHeader'
import LoadingState from '../../shared/LoadingState'
import EmptyState from '../../shared/EmptyState'
import Button from '../../ui/Button'
import ConfirmationDialog from '../../shared/ConfirmationDialog'
import ResourceImageField from '../components/ResourceImageField'

const RESOURCE_BOOK_TYPES = [
  { value: 'konu_anlatimi', label: 'Konu Anlatımı' },
  { value: 'soru_bankasi', label: 'Soru Bankası' },
  { value: 'okuma_kitabi', label: 'Okuma Kitabı' },
]

const RESOURCE_BOOK_TYPE_LABELS = Object.fromEntries(RESOURCE_BOOK_TYPES.map((item) => [item.value, item.label]))

function AddPublisherModal({ onCreated, onClose }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (name.trim().length < 2) {
      setError('Yayın evi adı en az 2 karakter olmalı.')
      return
    }

    setError('')
    setLoading(true)
    try {
      const data = await authRequest('/api/panel-admin/publishers', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim() }),
      })
      onCreated(data.publisher)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md panel-card p-5"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-panel-text">Yayın Evi Ekle</h2>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {error ? (
          <div className="mb-3 rounded-xl bg-panel-accent-soft px-3 py-1.5 text-sm text-panel-warm">{error}</div>
        ) : null}

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">Yayın Evi Adı</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
            />
          </label>

          <Button type="submit" disabled={loading} size="md" className="w-full">
            {loading ? 'Oluşturuluyor...' : 'Yayın Evi Oluştur'}
          </Button>
        </div>
      </form>
    </div>
  )
}

function ResourceBookModal({ publisher, book, subjects, onSaved, onClose }) {
  const isEdit = Boolean(book)
  const effectivePublisherId = book?.publisherId || publisher?.id
  const [name, setName] = useState(book?.name || '')
  const [pageCount, setPageCount] = useState(book ? String(book.pageCount) : '')
  const [subjectId, setSubjectId] = useState(book?.subjectId || '')
  const [type, setType] = useState(book?.type || '')
  const [isActive, setIsActive] = useState(book ? book.isActive : true)
  const [hasAnswerKey, setHasAnswerKey] = useState(book ? book.hasAnswerKey : true)
  const [imageUrl, setImageUrl] = useState(book?.imageUrl || '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (name.trim().length < 2) {
      setError('Kaynak kitap adı en az 2 karakter olmalı.')
      return
    }
    const pageCountNumber = Number(pageCount)
    if (!Number.isInteger(pageCountNumber) || pageCountNumber <= 0) {
      setError('Sayfa sayısı pozitif bir tam sayı olmalı.')
      return
    }
    if (!subjectId) {
      setError('Ders seçilmeli.')
      return
    }
    if (!type) {
      setError('Kaynak tipi seçilmeli.')
      return
    }

    setError('')
    setLoading(true)
    try {
      const payload = {
        publisherId: effectivePublisherId,
        subjectId,
        name: name.trim(),
        pageCount: pageCountNumber,
        isActive,
        type,
        hasAnswerKey: type === 'soru_bankasi' ? hasAnswerKey : true,
        imageUrl: imageUrl.trim() || null,
      }
      const data = isEdit
        ? await authRequest(`/api/panel-admin/resource-books/${book.id}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          })
        : await authRequest('/api/panel-admin/resource-books', {
            method: 'POST',
            body: JSON.stringify(payload),
          })
      onSaved(data.resourceBook)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md panel-card p-5"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-panel-text">{isEdit ? 'Kaynağı Düzenle' : 'Kaynak Kitap Ekle'}</h2>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {publisher ? (
          <p className="mb-3 text-sm text-panel-text-muted">
            Yayın evi: <span className="font-medium text-panel-text">{publisher.name}</span>
          </p>
        ) : null}

        {error ? (
          <div className="mb-3 rounded-xl bg-panel-accent-soft px-3 py-1.5 text-sm text-panel-warm">{error}</div>
        ) : null}

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">Kitap Adı</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">Ders</span>
            <select
              value={subjectId}
              onChange={(event) => setSubjectId(event.target.value)}
              className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
            >
              <option value="" disabled>
                Ders seçin
              </option>
              {subjects?.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">Tip</span>
            <select
              value={type}
              onChange={(event) => setType(event.target.value)}
              className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
            >
              <option value="" disabled>
                Tip seçin
              </option>
              {RESOURCE_BOOK_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">Sayfa Sayısı</span>
            <input
              type="number"
              min="1"
              value={pageCount}
              onChange={(event) => setPageCount(event.target.value)}
              className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
            />
          </label>

          <ResourceImageField value={imageUrl} onChange={setImageUrl} />

          <label className="flex items-center gap-2.5">
            <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} className="h-4 w-4" />
            <span className="text-sm font-medium text-panel-text">Aktif</span>
          </label>

          {type === 'soru_bankasi' ? (
            <label className="flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={hasAnswerKey}
                onChange={(event) => setHasAnswerKey(event.target.checked)}
                className="h-4 w-4"
              />
              <span className="text-sm font-medium text-panel-text">Cevap Anahtarı Var</span>
            </label>
          ) : null}

          <Button type="submit" disabled={loading} size="md" className="w-full">
            {loading ? 'Kaydediliyor...' : isEdit ? 'Kaydet' : 'Kaynak Kitap Oluştur'}
          </Button>
        </div>
      </form>
    </div>
  )
}

function TopicModal({ book, topic, onSaved, onClose }) {
  const isEdit = Boolean(topic)
  const [name, setName] = useState(topic?.name || '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (name.trim().length < 2) {
      setError('İçerik adı en az 2 karakter olmalı.')
      return
    }

    setError('')
    setLoading(true)
    try {
      const data = isEdit
        ? await authRequest(`/api/panel-admin/resource-book-topics/${topic.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ name: name.trim() }),
          })
        : await authRequest('/api/panel-admin/resource-book-topics', {
            method: 'POST',
            body: JSON.stringify({
              resourceBookId: book.id,
              name: name.trim(),
            }),
          })
      onSaved(data.topic)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md panel-card p-5"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-panel-text">{isEdit ? 'İçerik Düzenle' : 'İçerik Ekle'}</h2>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {book ? (
          <p className="mb-3 text-sm text-panel-text-muted">
            Kitap: <span className="font-medium text-panel-text">{book.name}</span>
          </p>
        ) : null}

        {error ? (
          <div className="mb-3 rounded-xl bg-panel-accent-soft px-3 py-1.5 text-sm text-panel-warm">{error}</div>
        ) : null}

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">İçerik Adı</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Örn. Paragrafın Anlamı ve Yorumu"
              className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
            />
          </label>

          <Button type="submit" disabled={loading} size="md" className="w-full">
            {loading ? 'Kaydediliyor...' : isEdit ? 'Kaydet' : 'İçerik Oluştur'}
          </Button>
        </div>
      </form>
    </div>
  )
}

function TestModal({ topic, test, onSaved, onClose }) {
  const isEdit = Boolean(test)
  const [topicName, setTopicName] = useState(test?.topicName || '')
  const [name, setName] = useState(test?.name || '')
  const [pageStart, setPageStart] = useState(test?.pageStart ? String(test.pageStart) : '')
  const [pageEnd, setPageEnd] = useState(test?.pageEnd ? String(test.pageEnd) : '')
  const [questionCount, setQuestionCount] = useState(test ? String(test.questionCount) : '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (topicName.trim().length < 2) {
      setError('Konu adı en az 2 karakter olmalı.')
      return
    }
    if (name.trim().length < 2) {
      setError('Test adı en az 2 karakter olmalı.')
      return
    }
    const pageStartNumber = Number(pageStart)
    if (!Number.isInteger(pageStartNumber) || pageStartNumber <= 0) {
      setError('Başlangıç sayfası pozitif bir tam sayı olmalı.')
      return
    }
    const pageEndNumber = Number(pageEnd)
    if (!Number.isInteger(pageEndNumber) || pageEndNumber < pageStartNumber) {
      setError('Bitiş sayfası başlangıç sayfasından küçük olamaz.')
      return
    }
    const questionCountNumber = Number(questionCount)
    if (!Number.isInteger(questionCountNumber) || questionCountNumber <= 0) {
      setError('Soru sayısı pozitif bir tam sayı olmalı.')
      return
    }

    setError('')
    setLoading(true)
    try {
      const data = isEdit
        ? await authRequest(`/api/panel-admin/resource-book-topic-tests/${test.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              topicName: topicName.trim(),
              name: name.trim(),
              pageStart: pageStartNumber,
              pageEnd: pageEndNumber,
              questionCount: questionCountNumber,
            }),
          })
        : await authRequest('/api/panel-admin/resource-book-topic-tests', {
            method: 'POST',
            body: JSON.stringify({
              topicId: topic.id,
              topicName: topicName.trim(),
              name: name.trim(),
              pageStart: pageStartNumber,
              pageEnd: pageEndNumber,
              questionCount: questionCountNumber,
            }),
          })
      onSaved(data.test)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md panel-card p-5"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-panel-text">{isEdit ? 'Test Düzenle' : 'Test Ekle'}</h2>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {topic ? (
          <p className="mb-3 text-sm text-panel-text-muted">
            İçerik: <span className="font-medium text-panel-text">{topic.name}</span>
          </p>
        ) : null}

        {error ? (
          <div className="mb-3 rounded-xl bg-panel-accent-soft px-3 py-1.5 text-sm text-panel-warm">{error}</div>
        ) : null}

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">Konu Adı</span>
            <input
              value={topicName}
              onChange={(event) => setTopicName(event.target.value)}
              placeholder="Örn. Paragrafın Konusu"
              className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">Test Adı</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Örn. 1. Test"
              className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
            />
          </label>

          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-sm font-medium text-panel-text-muted">Başlangıç Sayfası</span>
              <input
                type="number"
                min="1"
                value={pageStart}
                onChange={(event) => setPageStart(event.target.value)}
                placeholder="Örn. 8"
                className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
              />
            </label>

            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-sm font-medium text-panel-text-muted">Bitiş Sayfası</span>
              <input
                type="number"
                min="1"
                value={pageEnd}
                onChange={(event) => setPageEnd(event.target.value)}
                placeholder="Örn. 11"
                className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">Soru Sayısı</span>
            <input
              type="number"
              min="1"
              value={questionCount}
              onChange={(event) => setQuestionCount(event.target.value)}
              className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
            />
          </label>

          <Button type="submit" disabled={loading} size="md" className="w-full">
            {loading ? 'Kaydediliyor...' : isEdit ? 'Kaydet' : 'Test Oluştur'}
          </Button>
        </div>
      </form>
    </div>
  )
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      const base64 = String(result).split(',')[1] || ''
      resolve(base64)
    }
    reader.onerror = () => reject(reader.error || new Error('Dosya okunamadı.'))
    reader.readAsDataURL(file)
  })
}

function AddQuestionsFromImageModal({ test, onClose, onQuestionsSaved }) {
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [extracting, setExtracting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [draftQuestions, setDraftQuestions] = useState(null)

  const handleFileChange = (event) => {
    const selected = event.target.files?.[0] || null
    setFile(selected)
    setDraftQuestions(null)
    setError('')
    setPreviewUrl(selected ? URL.createObjectURL(selected) : null)
  }

  const handleExtract = async () => {
    if (!file) return
    setExtracting(true)
    setError('')
    try {
      const imageBase64 = await readFileAsBase64(file)
      const data = await authRequest(`/api/panel-admin/resource-book-topic-tests/${test.id}/questions/extract`, {
        method: 'POST',
        body: JSON.stringify({ imageBase64, mediaType: file.type || 'image/jpeg' }),
      })
      setDraftQuestions(data.questions)
    } catch (err) {
      setError(err.message)
    } finally {
      setExtracting(false)
    }
  }

  const updateQuestion = (index, patch) => {
    setDraftQuestions((current) => current.map((question, i) => (i === index ? { ...question, ...patch } : question)))
  }

  const updateOption = (questionIndex, optionIndex, patch) => {
    setDraftQuestions((current) =>
      current.map((question, i) =>
        i === questionIndex
          ? {
              ...question,
              options: question.options.map((option, j) => (j === optionIndex ? { ...option, ...patch } : option)),
            }
          : question,
      ),
    )
  }

  const setCorrectOption = (questionIndex, optionIndex) => {
    setDraftQuestions((current) =>
      current.map((question, i) =>
        i === questionIndex
          ? {
              ...question,
              options: question.options.map((option, j) => ({ ...option, isCorrect: j === optionIndex })),
            }
          : question,
      ),
    )
  }

  const removeQuestion = (index) => {
    setDraftQuestions((current) => current.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    if (!draftQuestions || draftQuestions.length === 0) return
    setSaving(true)
    setError('')
    try {
      for (const question of draftQuestions) {
        await authRequest(`/api/panel-admin/resource-book-topic-tests/${test.id}/questions`, {
          method: 'POST',
          body: JSON.stringify({
            orderNo: Number(question.orderNo),
            passageText: question.passageText,
            questionText: question.questionText,
            options: question.options,
          }),
        })
      }
      onQuestionsSaved()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white">
        <div className="flex items-center justify-between border-b border-[#edf0f1] px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-panel-text">Fotoğraftan Soru Ekle</h2>
            <p className="text-xs text-[#667475]">{test.name} · {test.topicName}</p>
          </div>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error ? (
            <div className="mb-3 rounded-xl bg-panel-accent-soft px-3 py-1.5 text-sm text-panel-warm">{error}</div>
          ) : null}

          {!draftQuestions ? (
            <div className="flex flex-col gap-3">
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-[#dfe4e5] px-4 py-8 text-center hover:bg-[#f8f7fb]">
                <ImagePlus size={24} className="text-[#87a3a5]" aria-hidden="true" />
                <span className="text-sm font-medium text-[#253d3e]">
                  {file ? file.name : 'Sayfa fotoğrafını seçmek için tıkla'}
                </span>
                <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              </label>

              {previewUrl ? (
                <img src={previewUrl} alt="Önizleme" className="max-h-80 w-full rounded-xl border border-[#e5e8e9] object-contain" />
              ) : null}

              <Button type="button" disabled={!file || extracting} size="md" className="w-full" onClick={handleExtract}>
                {extracting ? 'Sorular okunuyor...' : 'Soruları Çıkar'}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {draftQuestions.length === 0 ? (
                <p className="text-sm text-[#667475]">Görselde soru tespit edilemedi.</p>
              ) : (
                draftQuestions.map((question, questionIndex) => (
                  <div key={questionIndex} className="flex flex-col gap-2.5 rounded-xl border border-[#e5e8e9] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2 text-sm font-semibold text-[#655e94]">
                        Soru No
                        <input
                          type="number"
                          min="1"
                          value={question.orderNo}
                          onChange={(event) => updateQuestion(questionIndex, { orderNo: event.target.value })}
                          className="w-16 rounded-lg border border-panel-border p-1 text-sm text-panel-text"
                        />
                      </label>
                      <div className="flex items-center gap-2">
                        {!question.hasAnswerKeyMatch ? (
                          <span className="rounded-full bg-panel-accent-soft px-2 py-0.5 text-[11px] font-medium text-panel-warm">
                            Cevap anahtarı bulunamadı, doğru şıkkı seç
                          </span>
                        ) : null}
                        <button
                          type="button"
                          aria-label="Soruyu kaldır"
                          className="text-[#87a3a5] hover:text-panel-warm"
                          onClick={() => removeQuestion(questionIndex)}
                        >
                          <Trash2 size={15} aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    <textarea
                      value={question.passageText}
                      onChange={(event) => updateQuestion(questionIndex, { passageText: event.target.value })}
                      placeholder="Pasaj metni"
                      rows={4}
                      className="rounded-lg border border-panel-border p-2 text-sm text-panel-text"
                    />
                    <textarea
                      value={question.questionText}
                      onChange={(event) => updateQuestion(questionIndex, { questionText: event.target.value })}
                      placeholder="Soru kökü"
                      rows={2}
                      className="rounded-lg border border-panel-border p-2 text-sm text-panel-text"
                    />

                    <div className="flex flex-col gap-1.5">
                      {question.options.map((option, optionIndex) => (
                        <div key={optionIndex} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`correct-${questionIndex}`}
                            checked={option.isCorrect}
                            onChange={() => setCorrectOption(questionIndex, optionIndex)}
                            className="h-4 w-4"
                            aria-label={`${option.label} şıkkını doğru işaretle`}
                          />
                          <span className="w-5 text-sm font-semibold text-[#253d3e]">{option.label})</span>
                          <input
                            value={option.text}
                            onChange={(event) => updateOption(questionIndex, optionIndex, { text: event.target.value })}
                            className="flex-1 rounded-lg border border-panel-border p-1.5 text-sm text-panel-text"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  className="flex-1"
                  onClick={() => setDraftQuestions(null)}
                  disabled={saving}
                >
                  Başka Fotoğraf Seç
                </Button>
                <Button
                  type="button"
                  size="md"
                  className="flex-1"
                  onClick={handleSave}
                  disabled={saving || draftQuestions.length === 0}
                >
                  {saving ? 'Kaydediliyor...' : `${draftQuestions.length} Soruyu Kaydet`}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function AnswerKeyModal({ test, onClose }) {
  const [entries, setEntries] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    authRequest(`/api/panel-admin/resource-book-topic-tests/${test.id}/answer-key`, { method: 'GET' })
      .then((data) => {
        const labelByOrderNo = Object.fromEntries(data.entries.map((entry) => [entry.orderNo, entry.correctLabel]))
        setEntries(Array.from({ length: test.questionCount }, (_, i) => labelByOrderNo[i + 1] || ''))
      })
      .catch((err) => setError(err.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [test.id])

  const setLabel = (index, label) => {
    setEntries((current) => current.map((value, i) => (i === index ? label : value)))
  }

  const filledCount = entries ? entries.filter(Boolean).length : 0

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const payloadEntries = entries
        .map((correctLabel, index) => ({ orderNo: index + 1, correctLabel }))
        .filter((entry) => entry.correctLabel)
      await authRequest(`/api/panel-admin/resource-book-topic-tests/${test.id}/answer-key`, {
        method: 'PUT',
        body: JSON.stringify({ entries: payloadEntries }),
      })
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white">
        <div className="flex items-center justify-between border-b border-[#edf0f1] px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-panel-text">Cevap Anahtarı</h2>
            <p className="text-xs text-[#667475]">{test.name} · {test.topicName}</p>
          </div>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error ? (
            <div className="mb-3 rounded-xl bg-panel-accent-soft px-3 py-1.5 text-sm text-panel-warm">{error}</div>
          ) : null}

          {entries === null ? (
            <LoadingState label="Cevap anahtarı yükleniyor..." />
          ) : (
            <>
              <p className="mb-3 text-xs text-[#667475]">
                {filledCount}/{entries.length} sorunun cevabı girildi.
              </p>
              <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-6">
                {entries.map((label, index) => (
                  <label key={index} className="flex flex-col items-center gap-1">
                    <span className="text-xs font-semibold text-[#655e94]">{index + 1}</span>
                    <select
                      value={label}
                      onChange={(event) => setLabel(index, event.target.value)}
                      className="w-full rounded-lg border border-panel-border p-1.5 text-center text-sm text-panel-text"
                    >
                      <option value="">—</option>
                      {['A', 'B', 'C', 'D'].map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="border-t border-[#edf0f1] px-5 py-4">
          <Button type="button" disabled={saving || entries === null} size="md" className="w-full" onClick={handleSave}>
            {saving ? 'Kaydediliyor...' : 'Cevap Anahtarını Kaydet'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function TestQuestionsModal({ test, resourceBookType, onClose }) {
  const [questions, setQuestions] = useState(null)
  const [error, setError] = useState('')
  const [showAddFromImage, setShowAddFromImage] = useState(false)
  const [showAnswerKey, setShowAnswerKey] = useState(false)

  const loadQuestions = () => {
    authRequest(`/api/panel-admin/resource-book-topic-tests/${test.id}/questions`, { method: 'GET' })
      .then((data) => setQuestions(data.questions))
      .catch((err) => setError(err.message))
  }

  useEffect(() => {
    loadQuestions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [test.id])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white">
        <div className="flex items-center justify-between border-b border-[#edf0f1] px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-panel-text">{test.name}</h2>
            <p className="text-xs text-[#667475]">
              {test.topicName} · {test.pageStart}–{test.pageEnd}. sayfalar · {test.questionCount} soru
            </p>
          </div>
          <div className="flex items-center gap-3">
            {resourceBookType === 'soru_bankasi' ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-[34px] rounded-[9px] border-[#dfe4e5] bg-white text-[#253d3e] hover:bg-[#f8f7fb]"
                onClick={() => setShowAnswerKey(true)}
              >
                <KeyRound size={14} className="mr-1.5 inline" aria-hidden="true" />
                Cevap Anahtarı
              </Button>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-[34px] rounded-[9px] border-[#dfe4e5] bg-white text-[#253d3e] hover:bg-[#f8f7fb]"
              onClick={() => setShowAddFromImage(true)}
            >
              <ImagePlus size={14} className="mr-1.5 inline" aria-hidden="true" />
              Fotoğraftan Ekle
            </Button>
            <button type="button" aria-label="Kapat" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error ? (
            <div className="rounded-xl bg-panel-accent-soft px-3 py-1.5 text-sm text-panel-warm">{error}</div>
          ) : questions === null ? (
            <LoadingState label="Sorular yükleniyor..." />
          ) : questions.length === 0 ? (
            <p className="text-sm text-[#667475]">Bu teste ait soru yok.</p>
          ) : (
            <div className="flex flex-col gap-6">
              {questions.map((question) => (
                <div key={question.id} className="flex flex-col gap-2.5">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold text-[#655e94]">{question.orderNo}.</span>
                    {question.passageText ? (
                      <p className="whitespace-pre-line text-sm leading-relaxed text-[#253d3e]">{question.passageText}</p>
                    ) : null}
                  </div>
                  <p className="text-sm font-medium text-[#253d3e]">{question.questionText}</p>
                  <div className="flex flex-col gap-1.5 pl-1">
                    {question.options.map((option) => (
                      <div
                        key={option.id}
                        className={`flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-sm ${
                          option.isCorrect ? 'bg-[#e8f3ee] text-[#2f7a57]' : 'text-[#253d3e]'
                        }`}
                      >
                        <span className="font-semibold">{option.label})</span>
                        <span className="flex-1">{option.text}</span>
                        {option.isCorrect ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden="true" /> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showAddFromImage ? (
        <AddQuestionsFromImageModal
          test={test}
          onClose={() => setShowAddFromImage(false)}
          onQuestionsSaved={loadQuestions}
        />
      ) : null}

      {showAnswerKey ? <AnswerKeyModal test={test} onClose={() => setShowAnswerKey(false)} /> : null}
    </div>
  )
}

function StatBadge({ icon, value }) {
  const Icon = icon
  return (
    <span className="inline-flex w-[76px] shrink-0 items-center justify-center gap-1 rounded-full bg-[#f8f7fb] px-2 py-0.5 text-[11px] font-medium text-[#655e94]">
      <Icon size={11} className="shrink-0" aria-hidden="true" />
      {value}
    </span>
  )
}

function TopicBlock({ topic, tests, expanded, onToggle, onAddTest, onEditTopic, onEditTest, onViewTest, onDeleteTest }) {
  const totalTests = tests.length
  const totalPages = tests.reduce((sum, test) => sum + test.pageCount, 0)
  const totalQuestions = tests.reduce((sum, test) => sum + test.questionCount, 0)

  return (
    <div className="px-4 py-2">
      <div
        className="flex cursor-pointer flex-wrap items-start justify-between gap-2"
        onClick={onToggle}
      >
        <div className="flex min-w-0 items-center gap-2">
          {expanded ? (
            <ChevronDown size={15} className="shrink-0 text-[#87a3a5]" aria-hidden="true" />
          ) : (
            <ChevronRight size={15} className="shrink-0 text-[#87a3a5]" aria-hidden="true" />
          )}
          <FileText size={15} className="shrink-0 text-[#655e94]" aria-hidden="true" />
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[#253d3e]">{topic.name}</span>
            <button
              type="button"
              aria-label="İçeriği düzenle"
              className="text-[#87a3a5] hover:text-[#253d3e]"
              onClick={(event) => {
                event.stopPropagation()
                onEditTopic(topic)
              }}
            >
              <Pencil size={13} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex items-center gap-1.5">
            <StatBadge icon={ListTree} value={`${totalTests} test`} />
            <StatBadge icon={FileText} value={`${totalPages} sayfa`} />
            <StatBadge icon={HelpCircle} value={`${totalQuestions} soru`} />
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="h-[34px] shrink-0 rounded-[9px] border-[#dfe4e5] bg-white text-[#253d3e] hover:bg-[#f8f7fb]"
            onClick={(event) => {
              event.stopPropagation()
              onAddTest(topic)
            }}
          >
            + Test Ekle
          </Button>
        </div>
      </div>

      {expanded ? (
        tests.length === 0 ? (
          <p className="py-2 text-xs text-[#667475]">Bu içeriğe ait test yok.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-[10px] border border-[#e5e8e9]">
            <table className="w-full min-w-[600px] text-left text-xs">
              <thead>
                <tr className="bg-[#f8f7fb] text-[12px] font-semibold text-[#655e94]">
                  <th className="px-3 py-1.5">Test Konusu</th>
                  <th className="px-3 py-1.5">Test Adı</th>
                  <th className="px-3 py-1.5">Sayfa Sayısı</th>
                  <th className="px-3 py-1.5">Soru Sayısı</th>
                  <th className="w-10 px-3 py-1.5">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {tests.map((test) => (
                  <tr
                    key={test.id}
                    className="cursor-pointer border-t border-[#edf0f1] hover:bg-[#f8f7fb]"
                    onClick={() => onViewTest(test)}
                  >
                    <td className="px-3 py-1.5 font-medium text-[#253d3e]">
                      <span className="flex items-center gap-1">
                        <Dot size={18} className="shrink-0 text-[#87a3a5]" aria-hidden="true" />
                        {test.topicName}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 font-medium text-[#253d3e]">{test.name}</td>
                    <td className="px-3 py-1.5 text-[#667475]">{test.pageStart}–{test.pageEnd}. sayfalar</td>
                    <td className="px-3 py-1.5 text-[#667475]">{test.questionCount} soru</td>
                    <td className="px-3 py-1.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          aria-label="Testi düzenle"
                          className="text-[#87a3a5] hover:text-[#253d3e]"
                          onClick={(event) => {
                            event.stopPropagation()
                            onEditTest(test)
                          }}
                        >
                          <Pencil size={13} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label="Testi sil"
                          className="text-[#87a3a5] hover:text-panel-warm"
                          onClick={(event) => {
                            event.stopPropagation()
                            onDeleteTest(test)
                          }}
                        >
                          <Trash2 size={13} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}
    </div>
  )
}

function BookBlock({ book, subjectsById, topics, tests, onAddTopic, onAddTest, onEditTopic, onEditTest, onViewTest, onDeleteTest, onEditBook, onToggleActive }) {
  const [expanded, setExpanded] = useState(false)
  const [expandedTopicId, setExpandedTopicId] = useState(null)

  return (
    <div className="overflow-hidden rounded-xl border border-[#e7e8ed] border-l-2 border-l-[#c9bfec] bg-white shadow-[0_1px_4px_rgba(20,25,40,0.03)]">
      <div
        className="flex min-h-[80px] flex-wrap items-center gap-3 px-[18px] py-4 cursor-pointer hover:bg-[#fbfaff]"
        onClick={() => setExpanded((value) => !value)}
      >
        <div className="flex min-w-0 flex-auto items-center gap-3">
          <button
            type="button"
            aria-label={expanded ? 'İçerikleri gizle' : 'İçerikleri göster'}
            className="shrink-0 text-[#b6aedb] hover:text-[#6f63a8]"
            onClick={(event) => {
              event.stopPropagation()
              setExpanded((value) => !value)
            }}
          >
            {expanded ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
          </button>
          {book.imageUrl ? (
            <img
              src={book.imageUrl}
              alt={`${book.name} görseli`}
              className="h-11 w-11 shrink-0 rounded-[10px] border border-[#e4e5ec] object-cover"
            />
          ) : (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#f5f2fb] text-[#6f63a8]">
              <BookOpen size={16} aria-hidden="true" />
            </span>
          )}
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-[15px] font-bold text-[#263a39]">{book.name}</span>
              <button
                type="button"
                aria-label="Kaynağı düzenle"
                className="shrink-0 rounded-full p-0.5 text-[#b6aedb] hover:bg-[#f5f2fb] hover:text-[#6f63a8]"
                onClick={(event) => {
                  event.stopPropagation()
                  onEditBook(book)
                }}
              >
                <Pencil size={12} aria-hidden="true" />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 text-xs text-[#667475]">
              <span>
                Ders: <span className="font-medium text-[#263a39]">{subjectsById[book.subjectId]?.name || '—'}</span>
              </span>
              {book.type ? (
                <span className="inline-flex items-center rounded-full bg-[#f5f2fb] px-2.5 py-1 text-[11px] font-medium text-[#6f63a8]">
                  {RESOURCE_BOOK_TYPE_LABELS[book.type] || book.type}
                </span>
              ) : null}
              {book.type === 'soru_bankasi' && !book.hasAnswerKey ? (
                <span className="inline-flex items-center rounded-full bg-panel-accent-soft px-2.5 py-1 text-[11px] font-medium text-panel-warm">
                  Cevap Anahtarı Yok
                </span>
              ) : null}
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onToggleActive(book)
                }}
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${
                  book.isActive ? 'bg-[#e5f3ea] text-[#34845a]' : 'bg-[#f1f1f3] text-[#8a8a92]'
                }`}
              >
                {book.isActive ? 'Aktif' : 'Pasif'}
              </button>
            </div>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="h-10 w-full shrink-0 rounded-[10px] border-[#e1e4ea] bg-white text-[#6f63a8] hover:bg-[#f5f2fb] sm:w-auto"
          onClick={(event) => {
            event.stopPropagation()
            onAddTopic(book)
          }}
        >
          + İçerik Ekle
        </Button>
      </div>
      {expanded ? (
        topics.length === 0 ? (
          <p className="border-t border-[#eeeff3] px-[18px] py-2 text-xs text-[#8a849d]">Bu kitaba ait içerik yok.</p>
        ) : (
          <div className="flex flex-col divide-y divide-[#eeeff3] border-t border-[#eeeff3] bg-white">
            {topics.map((topic) => (
              <TopicBlock
                key={topic.id}
                topic={topic}
                tests={tests.filter((test) => test.topicId === topic.id)}
                expanded={expandedTopicId === topic.id}
                onToggle={() =>
                  setExpandedTopicId((current) => (current === topic.id ? null : topic.id))
                }
                onAddTest={onAddTest}
                onEditTopic={onEditTopic}
                onEditTest={onEditTest}
                onViewTest={onViewTest}
                onDeleteTest={onDeleteTest}
              />
            ))}
          </div>
        )
      ) : null}
    </div>
  )
}

function PublisherRow({
  publisher,
  books,
  subjectsById,
  topics,
  tests,
  onAddBook,
  onAddTopic,
  onAddTest,
  onEditTopic,
  onEditTest,
  onViewTest,
  onDeleteTest,
  onEditBook,
  onToggleActive,
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="overflow-hidden rounded-[14px] border border-[#e7e9ee] bg-white shadow-[0_2px_8px_rgba(20,25,40,0.04)]">
      <div
        className="flex min-h-[74px] flex-wrap items-center gap-3 px-[22px] py-3 cursor-pointer hover:bg-[#fcfcfd] sm:px-6"
        onClick={() => setExpanded((value) => !value)}
      >
        <div className="flex min-w-0 flex-auto items-center gap-3">
          {expanded ? (
            <ChevronDown size={16} className="shrink-0 text-[#9aa1ab]" aria-hidden="true" />
          ) : (
            <ChevronRight size={16} className="shrink-0 text-[#9aa1ab]" aria-hidden="true" />
          )}
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f1eefa] text-[#6f63a8]">
            <Building2 size={19} aria-hidden="true" />
          </span>
          <span className="truncate text-[17px] font-bold text-[#263a39]">{publisher.name}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2.5" onClick={(event) => event.stopPropagation()}>
          <span className="inline-flex items-center rounded-full bg-[#f5f2fb] px-2.5 py-1 text-[11px] font-medium text-[#6f63a8]">
            {books.length} kitap
          </span>
          <Button
            variant="secondary"
            size="sm"
            className="h-[34px] rounded-[10px] border-[#e1e4ea] bg-white text-[#253d3e] hover:bg-[#f7f8fa]"
            onClick={() => onAddBook(publisher)}
          >
            + Kaynak Kitap
          </Button>
        </div>
      </div>
      {expanded ? (
        <div className="border-t border-[#eeeff3] bg-[#fafafc] pl-5 pr-5 pt-4 pb-[18px] md:pl-[72px]">
          {books.length === 0 ? (
            <p className="py-1 text-xs text-[#8a849d]">Bu yayın evine ait kaynak kitap yok.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {books.map((book) => (
                <BookBlock
                  key={book.id}
                  book={book}
                  subjectsById={subjectsById}
                  topics={topics.filter((topic) => topic.resourceBookId === book.id)}
                  tests={tests}
                  onAddTopic={onAddTopic}
                  onAddTest={onAddTest}
                  onEditTopic={onEditTopic}
                  onEditTest={onEditTest}
                  onViewTest={onViewTest}
                  onDeleteTest={onDeleteTest}
                  onEditBook={onEditBook}
                  onToggleActive={onToggleActive}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

export default function AdminPublishersPage() {
  const [publishers, setPublishers] = useState(null)
  const [resourceBooks, setResourceBooks] = useState(null)
  const [subjects, setSubjects] = useState(null)
  const [topics, setTopics] = useState(null)
  const [tests, setTests] = useState(null)
  const [error, setError] = useState('')
  const [showPublisherModal, setShowPublisherModal] = useState(false)
  const [bookModalPublisher, setBookModalPublisher] = useState(null)
  const [editingBook, setEditingBook] = useState(null)
  const [topicModalBook, setTopicModalBook] = useState(null)
  const [testModalTopic, setTestModalTopic] = useState(null)
  const [editingTopic, setEditingTopic] = useState(null)
  const [editingTest, setEditingTest] = useState(null)
  const [viewingTest, setViewingTest] = useState(null)
  const [deletingTest, setDeletingTest] = useState(null)
  const [deletingTestError, setDeletingTestError] = useState('')
  const [deletingTestLoading, setDeletingTestLoading] = useState(false)
  const [query, setQuery] = useState('')

  const loadData = () => {
    Promise.all([
      authRequest('/api/panel-admin/publishers', { method: 'GET' }),
      authRequest('/api/panel-admin/resource-books', { method: 'GET' }),
      authRequest('/api/panel-admin/subjects', { method: 'GET' }),
      authRequest('/api/panel-admin/resource-book-topics', { method: 'GET' }),
      authRequest('/api/panel-admin/resource-book-topic-tests', { method: 'GET' }),
    ])
      .then(([publishersData, booksData, subjectsData, topicsData, testsData]) => {
        setPublishers(publishersData.publishers)
        setResourceBooks(booksData.resourceBooks)
        setSubjects(subjectsData.subjects)
        setTopics(topicsData.topics)
        setTests(testsData.tests)
      })
      .catch((err) => setError(err.message))
  }

  useEffect(() => {
    loadData()
  }, [])

  const handlePublisherCreated = (publisher) => {
    setPublishers((current) => [...(current || []), publisher])
    setShowPublisherModal(false)
  }

  const handleBookSaved = (book) => {
    setResourceBooks((current) => {
      const exists = (current || []).some((item) => item.id === book.id)
      return exists ? current.map((item) => (item.id === book.id ? book : item)) : [...(current || []), book]
    })
    setBookModalPublisher(null)
    setEditingBook(null)
  }

  const handleToggleActive = async (book) => {
    try {
      const data = await authRequest(`/api/panel-admin/resource-books/${book.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          publisherId: book.publisherId,
          subjectId: book.subjectId,
          name: book.name,
          pageCount: book.pageCount,
          isActive: !book.isActive,
          type: book.type,
          hasAnswerKey: book.hasAnswerKey,
          imageUrl: book.imageUrl,
        }),
      })
      handleBookSaved(data.resourceBook)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleTopicCreated = (topic) => {
    setTopics((current) => [...(current || []), topic])
    setTopicModalBook(null)
  }

  const handleTestCreated = (test) => {
    setTests((current) => [...(current || []), test])
    setTestModalTopic(null)
  }

  const handleTopicUpdated = (topic) => {
    setTopics((current) => (current || []).map((item) => (item.id === topic.id ? topic : item)))
    setEditingTopic(null)
  }

  const handleTestUpdated = (test) => {
    setTests((current) => (current || []).map((item) => (item.id === test.id ? test : item)))
    setEditingTest(null)
  }

  const handleDeleteTest = async () => {
    if (!deletingTest) return
    setDeletingTestLoading(true)
    setDeletingTestError('')
    try {
      await authRequest(`/api/panel-admin/resource-book-topic-tests/${deletingTest.id}`, {
        method: 'DELETE',
      })
      setTests((current) => (current || []).filter((item) => item.id !== deletingTest.id))
      setDeletingTest(null)
    } catch (err) {
      setDeletingTestError(err.message)
    } finally {
      setDeletingTestLoading(false)
    }
  }

  const filteredPublishers = useMemo(() => {
    if (!publishers) return null
    const q = query.trim().toLowerCase()
    return q ? publishers.filter((publisher) => publisher.name.toLowerCase().includes(q)) : publishers
  }, [publishers, query])

  const subjectsById = useMemo(
    () => Object.fromEntries((subjects || []).map((subject) => [subject.id, subject])),
    [subjects],
  )

  const viewingTestResourceBookType = useMemo(() => {
    if (!viewingTest) return null
    const topic = topics?.find((item) => item.id === viewingTest.topicId)
    const book = topic ? resourceBooks?.find((item) => item.id === topic.resourceBookId) : null
    return book?.type || null
  }, [viewingTest, topics, resourceBooks])

  return (
    <div className="-mx-4 -mt-5 -mb-24 bg-[#F7F8FA] px-4 pb-24 pt-5 md:-mx-6 md:-mb-6 md:px-6 md:pb-6">
    <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
      <PageHeader
        title="Yayın Evleri"
        actions={
          <>
            {publishers && publishers.length > 0 ? (
              <div className="relative">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#87a3a5]"
                  aria-hidden="true"
                />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Yayın evi ara..."
                  className="w-48 rounded-lg border border-[#dfe4e5] bg-white py-1.5 pl-8 pr-3 text-sm text-[#253d3e] focus:outline-none focus:ring-2 focus:ring-[#655e94]/20 sm:w-56"
                />
              </div>
            ) : null}
            <Button
              onClick={() => setShowPublisherModal(true)}
              className="h-10 rounded-[10px] bg-[#655e94] px-4 text-sm font-medium text-white hover:opacity-90"
            >
              + Yayın Evi Ekle
            </Button>
          </>
        }
      />

      {error ? (
        <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{error}</div>
      ) : publishers === null || resourceBooks === null || subjects === null || topics === null || tests === null ? (
        <LoadingState label="Yayın evleri yükleniyor..." />
      ) : publishers.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Henüz yayın evi yok"
          description="Yukarıdaki butonla ilk yayın evini oluşturabilirsiniz."
        />
      ) : (
        <MotionDiv initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex flex-col gap-3">
            {filteredPublishers.length === 0 ? (
              <p className="px-1 py-6 text-sm text-[#667475]">Aramayla eşleşen yayın evi yok.</p>
            ) : (
              filteredPublishers.map((publisher) => (
                <PublisherRow
                  key={publisher.id}
                  publisher={publisher}
                  books={resourceBooks.filter((book) => book.publisherId === publisher.id)}
                  subjectsById={subjectsById}
                  topics={topics}
                  tests={tests}
                  onAddBook={setBookModalPublisher}
                  onAddTopic={setTopicModalBook}
                  onAddTest={setTestModalTopic}
                  onEditTopic={setEditingTopic}
                  onEditTest={setEditingTest}
                  onViewTest={setViewingTest}
                  onDeleteTest={setDeletingTest}
                  onEditBook={setEditingBook}
                  onToggleActive={handleToggleActive}
                />
              ))
            )}
          </div>
        </MotionDiv>
      )}

      {showPublisherModal ? (
        <AddPublisherModal onCreated={handlePublisherCreated} onClose={() => setShowPublisherModal(false)} />
      ) : null}

      {bookModalPublisher ? (
        <ResourceBookModal
          publisher={bookModalPublisher}
          subjects={subjects}
          onSaved={handleBookSaved}
          onClose={() => setBookModalPublisher(null)}
        />
      ) : null}

      {editingBook ? (
        <ResourceBookModal
          book={editingBook}
          publisher={publishers?.find((publisher) => publisher.id === editingBook.publisherId)}
          subjects={subjects}
          onSaved={handleBookSaved}
          onClose={() => setEditingBook(null)}
        />
      ) : null}

      {topicModalBook ? (
        <TopicModal
          book={topicModalBook}
          onSaved={handleTopicCreated}
          onClose={() => setTopicModalBook(null)}
        />
      ) : null}

      {testModalTopic ? (
        <TestModal
          topic={testModalTopic}
          onSaved={handleTestCreated}
          onClose={() => setTestModalTopic(null)}
        />
      ) : null}

      {editingTopic ? (
        <TopicModal
          topic={editingTopic}
          book={resourceBooks?.find((book) => book.id === editingTopic.resourceBookId)}
          onSaved={handleTopicUpdated}
          onClose={() => setEditingTopic(null)}
        />
      ) : null}

      {editingTest ? (
        <TestModal
          test={editingTest}
          topic={topics?.find((topic) => topic.id === editingTest.topicId)}
          onSaved={handleTestUpdated}
          onClose={() => setEditingTest(null)}
        />
      ) : null}

      {viewingTest ? (
        <TestQuestionsModal
          test={viewingTest}
          resourceBookType={viewingTestResourceBookType}
          onClose={() => setViewingTest(null)}
        />
      ) : null}

      {deletingTest ? (
        <ConfirmationDialog
          title="Testi Sil"
          description={
            deletingTestError ||
            `"${deletingTest.name}" testini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`
          }
          confirmLabel={deletingTestLoading ? 'Siliniyor...' : 'Sil'}
          cancelLabel="Vazgeç"
          onConfirm={handleDeleteTest}
          onCancel={() => {
            setDeletingTest(null)
            setDeletingTestError('')
          }}
        />
      ) : null}
    </div>
    </div>
  )
}
