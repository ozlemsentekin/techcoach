import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BookOpen, Building2, ChevronDown, ChevronRight, Copy, Dot, FileText, HelpCircle, KeyRound, ListTree, Pencil, Search, Trash2, X } from 'lucide-react'
import { authRequest } from '../../../services/authClient'
import { useAuth } from '../../../context/useAuth'
import PageHeader from '../../layout/PageHeader'
import LoadingState from '../LoadingState'
import EmptyState from '../EmptyState'
import Button from '../../ui/Button'
import ConfirmationDialog from '../ConfirmationDialog'
import ResourceImageField from '../../parent/components/ResourceImageField'
import { ImagePreviewLightbox } from '../ResourceBookCard'
import { GRADE_OPTIONS } from '../../parent/components/studentWizardConstants'

const RESOURCE_BOOK_TYPES = [
  { value: 'konu_anlatimi', label: 'Konu Anlatımı' },
  { value: 'soru_bankasi', label: 'Soru Bankası' },
  { value: 'okuma_kitabi', label: 'Okuma Kitabı' },
  { value: 'etkinlik', label: 'Etkinlik & Soru Bankası' },
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-t-3xl border border-panel-border bg-panel-surface p-5 shadow-panel-1 sm:rounded-2xl"
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

function RejectResourceBookModal({ book, onConfirm, onClose }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (reason.trim().length < 2) {
      setError('Red gerekçesi en az 2 karakter olmalı.')
      return
    }

    setError('')
    setLoading(true)
    try {
      await onConfirm(reason.trim())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-t-3xl border border-panel-border bg-panel-surface p-5 shadow-panel-1 sm:rounded-2xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-panel-text">Kaynağı Reddet</h2>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <p className="mb-3 text-sm text-panel-text-muted">
          <span className="font-medium text-panel-text">{book.name}</span> kaynağını reddetme gerekçenizi yazın; bu
          gerekçe sadece kaynağı ekleyen kişiye gösterilir.
        </p>

        {error ? (
          <div className="mb-3 rounded-xl bg-panel-accent-soft px-3 py-2 text-sm text-panel-warm">{error}</div>
        ) : null}

        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          className="w-full rounded-xl border border-panel-border p-2.5 text-sm text-panel-text"
          placeholder="Örn. Görsel eksik, konu isimleri kitaba uymuyor..."
        />

        <Button type="submit" disabled={loading} size="md" className="mt-3 w-full">
          {loading ? 'Kaydediliyor...' : 'Reddet'}
        </Button>
      </form>
    </div>
  )
}

function ResourceBookModal({ publisher, book, subjects, presetSubjectId, onSaved, onClose }) {
  const isEdit = Boolean(book)
  const effectivePublisherId = book?.publisherId || publisher?.id
  const [name, setName] = useState(book?.name || '')
  const [pageCount, setPageCount] = useState(book ? String(book.pageCount) : '')
  const [subjectId, setSubjectId] = useState(book?.subjectId || presetSubjectId || '')
  const [grade, setGrade] = useState(book?.grade || '')
  const [type, setType] = useState(book?.type || '')
  const [publishMonthYear, setPublishMonthYear] = useState(book?.publishMonthYear || '')
  const [barcode, setBarcode] = useState(book?.barcode || '')
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
    if (!grade) {
      setError('Sınıf seçilmeli.')
      return
    }
    if (barcode.trim() && !/^\d{4,50}$/.test(barcode.trim())) {
      setError('Barkod kodu sadece rakamlardan oluşmalı ve 4-50 karakter olmalı.')
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
        grade,
        publishMonthYear: publishMonthYear.trim() || null,
        hasAnswerKey: type === 'soru_bankasi' ? hasAnswerKey : true,
        imageUrl: imageUrl.trim() || null,
        barcode: barcode.trim() || null,
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
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="h-full w-full overflow-y-auto border border-panel-border bg-panel-surface p-4 shadow-panel-1 sm:h-auto sm:max-h-[92vh] sm:max-w-2xl sm:rounded-2xl sm:p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-[#12142a]">
              {publisher?.name || (isEdit ? 'Kaynağı Düzenle' : 'Kaynak Kitap Ekle')}
            </h2>
            <p className="mt-0.5 text-sm text-panel-text-muted">
              {isEdit ? 'Kaynak kitabı düzenle' : 'Bu yayın evine kaynak kitap ekle'}
            </p>
          </div>
          <button
            type="button"
            aria-label="Kapat"
            onClick={onClose}
            className="shrink-0 rounded-full p-1 text-panel-text-muted hover:bg-[#faf3ec] hover:text-[#b85f22]"
          >
            <X size={20} />
          </button>
        </div>

        {error ? (
          <div className="mb-3 rounded-xl bg-panel-accent-soft px-3 py-1.5 text-sm text-panel-warm">{error}</div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-[200px_1fr] sm:gap-5">
          <div className="flex justify-center sm:justify-start">
            <ResourceImageField
              value={imageUrl}
              onChange={setImageUrl}
              compact
              size={200}
              showUrlToggle
              accent="#b85f22"
              accentSoft="#f8e3d0"
            />
          </div>

          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-panel-text-muted">Kitap Adı</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
              />
            </label>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                <span className="text-sm font-medium text-panel-text-muted">Sınıf</span>
                <select
                  value={grade}
                  onChange={(event) => setGrade(event.target.value)}
                  className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
                >
                  <option value="" disabled>
                    Sınıf seçin
                  </option>
                  {GRADE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}. Sınıf
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-panel-text-muted">Basım Ay/Yıl</span>
                <input
                  value={publishMonthYear}
                  onChange={(event) => setPublishMonthYear(event.target.value)}
                  placeholder="Örn. Eylül 2024"
                  className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
                />
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
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-panel-text-muted">Kaynak Tipi</span>
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
              <span className="text-sm font-medium text-panel-text-muted">Barkod Kodu</span>
              <input
                value={barcode}
                onChange={(event) => setBarcode(event.target.value)}
                placeholder="Örn. 9789750000000"
                inputMode="numeric"
                className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
              />
            </label>

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
          </div>
        </div>

        <Button type="submit" disabled={loading} size="md" className="mt-5 w-full">
          {loading ? 'Kaydediliyor...' : isEdit ? 'Kaydet' : 'Kaynak Kitap Oluştur'}
        </Button>
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
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="h-full w-full overflow-y-auto border border-panel-border bg-panel-surface p-4 shadow-panel-1 sm:h-auto sm:max-h-[90vh] sm:max-w-md sm:rounded-2xl sm:p-5"
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

function EditTestModal({ topic, test, onSaved, onClose }) {
  const [topicName, setTopicName] = useState(test.topicName || '')
  const [name, setName] = useState(test.name || '')
  const [pageStart, setPageStart] = useState(test.pageStart ? String(test.pageStart) : '')
  const [questionCount, setQuestionCount] = useState(test.questionCount ? String(test.questionCount) : '')
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
      setError('Sayfa numarası pozitif bir tam sayı olmalı.')
      return
    }
    const trimmedQuestionCount = questionCount.trim()
    const questionCountNumber = trimmedQuestionCount === '' ? null : Number(trimmedQuestionCount)
    if (questionCountNumber !== null && (!Number.isInteger(questionCountNumber) || questionCountNumber <= 0)) {
      setError('Soru sayısı pozitif bir tam sayı olmalı.')
      return
    }

    setError('')
    setLoading(true)
    try {
      const data = await authRequest(`/api/panel-admin/resource-book-topic-tests/${test.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          topicName: topicName.trim(),
          name: name.trim(),
          pageStart: pageStartNumber,
          pageEnd: pageStartNumber,
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
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="h-full w-full overflow-y-auto border border-panel-border bg-panel-surface p-4 shadow-panel-1 sm:h-auto sm:max-h-[90vh] sm:max-w-md sm:rounded-2xl sm:p-5"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-panel-text">Test Düzenle</h2>
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

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">Sayfa</span>
            <input
              type="number"
              min="1"
              value={pageStart}
              onChange={(event) => setPageStart(event.target.value)}
              placeholder="Örn. 8"
              className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">Soru Sayısı</span>
            <input
              type="number"
              min="1"
              value={questionCount}
              onChange={(event) => setQuestionCount(event.target.value)}
              placeholder="Örn. 10 (boş bırakılabilir)"
              className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
            />
            {test.hasAnswerKey ? (
              <span className="text-xs text-panel-text-muted">
                Soru sayısını değiştirirseniz cevap anahtarını yeniden kontrol etmeniz gerekebilir.
              </span>
            ) : null}
          </label>

          <Button type="submit" disabled={loading} size="md" className="w-full">
            {loading ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        </div>
      </form>
    </div>
  )
}

let testRowIdCounter = 0
function createEmptyTestRow() {
  testRowIdCounter += 1
  return { id: `row-${testRowIdCounter}`, topicName: '', name: '', pageStart: '' }
}

function AddTestsModal({ topic, onSaved, onClose }) {
  const [rows, setRows] = useState(() => [createEmptyTestRow()])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const updateRow = (id, patch) => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  const addRow = () => {
    setRows((current) => [...current, createEmptyTestRow()])
  }

  // Aynı konudan art arda birkaç test eklemek (Test 1, Test 2, ...) en sık yapılan işlem;
  // konu adını yeni satıra kopyalayarak her seferinde yeniden yazmayı önler.
  const duplicateRow = (id) => {
    setRows((current) => {
      const index = current.findIndex((row) => row.id === id)
      if (index === -1) return current
      const newRow = { ...createEmptyTestRow(), topicName: current[index].topicName }
      return [...current.slice(0, index + 1), newRow, ...current.slice(index + 1)]
    })
  }

  const removeRow = (id) => {
    setRows((current) => (current.length > 1 ? current.filter((row) => row.id !== id) : current))
  }

  const validateRows = () => {
    for (const row of rows) {
      if (row.topicName.trim().length < 2) return 'Konu adı en az 2 karakter olmalı.'
      if (row.name.trim().length < 2) return 'Test adı en az 2 karakter olmalı.'
      const pageStartNumber = Number(row.pageStart)
      if (!Number.isInteger(pageStartNumber) || pageStartNumber <= 0) {
        return 'Başlangıç sayfası pozitif bir tam sayı olmalı.'
      }
    }
    return ''
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const validationError = validateRows()
    if (validationError) {
      setError(validationError)
      return
    }

    setError('')
    setLoading(true)
    const createdTests = []
    let remainingRows = rows
    try {
      for (const row of rows) {
        const data = await authRequest('/api/panel-admin/resource-book-topic-tests', {
          method: 'POST',
          body: JSON.stringify({
            topicId: topic.id,
            topicName: row.topicName.trim(),
            name: row.name.trim(),
            pageStart: Number(row.pageStart),
            pageEnd: Number(row.pageStart),
          }),
        })
        createdTests.push(data.test)
        remainingRows = remainingRows.filter((item) => item.id !== row.id)
      }
      onSaved(createdTests)
    } catch (err) {
      setError(err.message)
      setRows(remainingRows.length > 0 ? remainingRows : [createEmptyTestRow()])
      if (createdTests.length > 0) onSaved(createdTests)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="h-full w-full overflow-y-auto border border-panel-border bg-panel-surface p-4 shadow-panel-1 sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:rounded-2xl sm:p-5"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-panel-text">Test Ekle</h2>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {topic ? (
          <p className="mb-3 text-sm text-panel-text-muted">
            İçerik: <span className="font-medium text-panel-text">{topic.name}</span>
          </p>
        ) : null}

        <p className="mb-3 text-xs text-panel-text-muted">
          Sadece başlangıç sayfasını girin, sayfa aralığını sonra "Test Düzenle" ile ayarlayabilirsiniz. Soru
          sayısını da şimdi girmenize gerek yok; test listesindeki cevap anahtarı ikonuna tıklayınca
          belirleyebilirsiniz.
        </p>

        {error ? (
          <div className="mb-3 rounded-xl bg-panel-accent-soft px-3 py-1.5 text-sm text-panel-warm">{error}</div>
        ) : null}

        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2.5 sm:hidden">
            {rows.map((row, index) => (
              <div key={row.id} className="rounded-xl border border-panel-border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-panel-text-muted">{index + 1}. Test</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Satırı çoğalt"
                      onClick={() => duplicateRow(row.id)}
                      className="text-panel-text-muted hover:text-panel-blue"
                    >
                      <Copy size={14} aria-hidden="true" />
                    </button>
                    {rows.length > 1 ? (
                      <button
                        type="button"
                        aria-label="Satırı sil"
                        onClick={() => removeRow(row.id)}
                        className="text-panel-text-muted hover:text-panel-warm"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    value={row.topicName}
                    onChange={(event) => updateRow(row.id, { topicName: event.target.value })}
                    placeholder="Konu adı"
                    className="rounded-lg border border-panel-border p-2 text-sm text-panel-text"
                  />
                  <input
                    value={row.name}
                    onChange={(event) => updateRow(row.id, { name: event.target.value })}
                    placeholder="Test adı"
                    className="rounded-lg border border-panel-border p-2 text-sm text-panel-text"
                  />
                  <input
                    type="number"
                    min="1"
                    value={row.pageStart}
                    onChange={(event) => updateRow(row.id, { pageStart: event.target.value })}
                    placeholder="Başlangıç sayfası"
                    className="rounded-lg border border-panel-border p-2 text-sm text-panel-text"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-xl border border-panel-border sm:block">
            <table className="w-full min-w-[460px] text-left text-sm">
              <thead>
                <tr className="bg-panel-surface-soft text-xs font-semibold text-panel-text-muted">
                  <th className="px-3 py-2">Konu Adı</th>
                  <th className="px-3 py-2">Test Adı</th>
                  <th className="w-32 px-3 py-2">Başl. Sayfa</th>
                  <th className="w-16 px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-panel-border">
                    <td className="p-1.5">
                      <input
                        value={row.topicName}
                        onChange={(event) => updateRow(row.id, { topicName: event.target.value })}
                        placeholder="Örn. Paragrafın Konusu"
                        className="w-full rounded-lg border border-panel-border p-1.5 text-sm text-panel-text"
                      />
                    </td>
                    <td className="p-1.5">
                      <input
                        value={row.name}
                        onChange={(event) => updateRow(row.id, { name: event.target.value })}
                        placeholder="Örn. 1. Test"
                        className="w-full rounded-lg border border-panel-border p-1.5 text-sm text-panel-text"
                      />
                    </td>
                    <td className="p-1.5">
                      <input
                        type="number"
                        min="1"
                        value={row.pageStart}
                        onChange={(event) => updateRow(row.id, { pageStart: event.target.value })}
                        placeholder="8"
                        className="w-full rounded-lg border border-panel-border p-1.5 text-sm text-panel-text"
                      />
                    </td>
                    <td className="p-1.5">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          aria-label="Satırı çoğalt"
                          onClick={() => duplicateRow(row.id)}
                          className="text-panel-text-muted hover:text-panel-blue"
                        >
                          <Copy size={14} aria-hidden="true" />
                        </button>
                        {rows.length > 1 ? (
                          <button
                            type="button"
                            aria-label="Satırı sil"
                            onClick={() => removeRow(row.id)}
                            className="text-panel-text-muted hover:text-panel-warm"
                          >
                            <Trash2 size={14} aria-hidden="true" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={addRow}
            className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-panel-blue hover:underline"
          >
            + Satır Ekle
          </button>

          <Button type="submit" disabled={loading} size="md" className="mt-2 w-full">
            {loading ? 'Kaydediliyor...' : rows.length > 1 ? `${rows.length} Test Oluştur` : 'Test Oluştur'}
          </Button>
        </div>
      </form>
    </div>
  )
}

function TestModal({ topic, test, onSaved, onClose }) {
  if (test) {
    return <EditTestModal test={test} topic={topic} onSaved={onSaved} onClose={onClose} />
  }
  return <AddTestsModal topic={topic} onSaved={onSaved} onClose={onClose} />
}

function SetQuestionCountModal({ test, onSaved, onClose }) {
  const [questionCount, setQuestionCount] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    const questionCountNumber = Number(questionCount)
    if (!Number.isInteger(questionCountNumber) || questionCountNumber <= 0) {
      setError('Soru sayısı pozitif bir tam sayı olmalı.')
      return
    }

    setError('')
    setLoading(true)
    try {
      const data = await authRequest(`/api/panel-admin/resource-book-topic-tests/${test.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          topicName: test.topicName,
          name: test.name,
          pageStart: test.pageStart,
          pageEnd: test.pageEnd,
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
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="h-full w-full overflow-y-auto border border-panel-border bg-panel-surface p-4 shadow-panel-1 sm:h-auto sm:max-w-sm sm:rounded-2xl sm:p-5"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-panel-text">Soru Sayısı</h2>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <p className="mb-3 text-sm text-panel-text-muted">
          Cevap anahtarını girebilmek için önce <span className="font-medium text-panel-text">{test.name}</span>{' '}
          testinin soru sayısını belirleyin.
        </p>

        {error ? (
          <div className="mb-3 rounded-xl bg-panel-accent-soft px-3 py-1.5 text-sm text-panel-warm">{error}</div>
        ) : null}

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-panel-text-muted">Soru Sayısı</span>
          <input
            type="number"
            min="1"
            autoFocus
            value={questionCount}
            onChange={(event) => setQuestionCount(event.target.value)}
            className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
          />
        </label>

        <Button type="submit" disabled={loading} size="md" className="mt-3 w-full">
          {loading ? 'Kaydediliyor...' : 'Devam Et'}
        </Button>
      </form>
    </div>
  )
}

function AnswerKeyFlow({ test, onTestUpdated, onClose }) {
  if (!test.questionCount) {
    return <SetQuestionCountModal test={test} onSaved={onTestUpdated} onClose={onClose} />
  }
  return <AnswerKeyModal test={test} onClose={onClose} />
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
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <div className="flex h-full w-full flex-col bg-white sm:h-auto sm:max-h-[85vh] sm:max-w-lg sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-[#edf0f1] px-4 py-3 sm:px-5 sm:py-4">
          <div>
            <h2 className="text-lg font-semibold text-panel-text">Cevap Anahtarı</h2>
            <p className="text-xs text-[#667475]">{test.name} · {test.topicName}</p>
          </div>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
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
              <div className="flex flex-col gap-1.5">
                {entries.map((label, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 rounded-xl border border-panel-border px-3 py-2"
                  >
                    <span className="w-5 shrink-0 text-center text-sm font-semibold text-[#b85f22]">
                      {index + 1}
                    </span>
                    <div className="flex flex-1 justify-start gap-2">
                      {['A', 'B', 'C', 'D'].map((option) => {
                        const selected = label === option
                        return (
                          <button
                            key={option}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => setLabel(index, selected ? '' : option)}
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors ${
                              selected
                                ? 'border-panel-warm bg-panel-warm text-white'
                                : 'border-panel-border text-panel-text hover:border-panel-warm'
                            }`}
                          >
                            {option}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="border-t border-[#edf0f1] px-4 py-3 sm:px-5 sm:py-4">
          <Button type="button" disabled={saving || entries === null} size="md" className="w-full" onClick={handleSave}>
            {saving ? 'Kaydediliyor...' : 'Cevap Anahtarını Kaydet'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function StatBadge({ icon, value }) {
  const Icon = icon
  return (
    <span className="inline-flex w-[76px] shrink-0 items-center justify-center gap-1 rounded-full bg-[#faf3ec] px-2 py-0.5 text-[11px] font-medium text-[#b85f22]">
      <Icon size={11} className="shrink-0" aria-hidden="true" />
      {value}
    </span>
  )
}

function TopicBlock({
  topic,
  tests,
  resourceBookType,
  expanded,
  canEdit,
  onToggle,
  onAddTest,
  onEditTopic,
  onEditTest,
  onDeleteTest,
  onManageAnswerKey,
  onlyMissingAnswerKey,
}) {
  const totalTests = tests.length
  const totalPages = tests.reduce((sum, test) => sum + test.pageCount, 0)
  const totalQuestions = tests.reduce((sum, test) => sum + (test.questionCount || 0), 0)
  const showAnswerKeyAction = resourceBookType === 'soru_bankasi'
  const visibleTests = onlyMissingAnswerKey && showAnswerKeyAction ? tests.filter((test) => !test.hasAnswerKey) : tests

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
          <FileText size={15} className="shrink-0 text-[#b85f22]" aria-hidden="true" />
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[#253d3e]">{topic.name}</span>
            {canEdit ? (
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
            ) : null}
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatBadge icon={ListTree} value={`${totalTests} test`} />
            <StatBadge icon={FileText} value={`${totalPages} sayfa`} />
            <StatBadge icon={HelpCircle} value={`${totalQuestions} soru`} />
          </div>
          {canEdit ? (
            <Button
              variant="secondary"
              size="sm"
              className="h-[34px] shrink-0 rounded-[9px] border-[#dfe4e5] bg-white text-[#253d3e] hover:bg-[#faf3ec]"
              onClick={(event) => {
                event.stopPropagation()
                onAddTest(topic)
              }}
            >
              + Test Ekle
            </Button>
          ) : null}
        </div>
      </div>

      {expanded ? (
        visibleTests.length === 0 ? (
          <p className="py-2 text-xs text-[#667475]">
            {onlyMissingAnswerKey ? 'Bu içerikte eksik cevap anahtarı yok.' : 'Bu içeriğe ait test yok.'}
          </p>
        ) : (
          <>
            <div className="mt-3 grid gap-2 sm:hidden">
              {visibleTests.map((test) => (
                <article
                  key={test.id}
                  className="rounded-[10px] border border-[#e5e8e9] bg-white p-3 text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="line-clamp-1 text-sm font-semibold text-[#253d3e]">{test.name}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-[#667475]">{test.topicName}</p>
                    </div>
                    {canEdit ? (
                      <div className="flex shrink-0 items-center gap-2">
                        {showAnswerKeyAction ? (
                          <button
                            type="button"
                            aria-label="Cevap anahtarı"
                            title={test.hasAnswerKey ? 'Cevap anahtarı tam' : 'Cevap anahtarı eksik'}
                            className={`hover:text-[#253d3e] ${test.hasAnswerKey ? 'text-[#87a3a5]' : 'text-panel-warm'}`}
                            onClick={(event) => {
                              event.stopPropagation()
                              onManageAnswerKey(test)
                            }}
                          >
                            <KeyRound size={14} aria-hidden="true" />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          aria-label="Testi düzenle"
                          className="text-[#87a3a5] hover:text-[#253d3e]"
                          onClick={(event) => {
                            event.stopPropagation()
                            onEditTest(test)
                          }}
                        >
                          <Pencil size={14} aria-hidden="true" />
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
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#667475]">
                    <span className="rounded-full bg-[#faf3ec] px-2 py-1">{test.pageStart}. sayfa</span>
                    <span className="rounded-full bg-[#faf3ec] px-2 py-1">
                      {test.questionCount ? `${test.questionCount} soru` : 'Soru sayısı yok'}
                    </span>
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-3 hidden overflow-x-auto rounded-[10px] border border-[#e5e8e9] sm:block">
            <table className="w-full min-w-[600px] text-left text-xs">
              <thead>
                <tr className="bg-[#faf3ec] text-[12px] font-semibold text-[#b85f22]">
                  <th className="px-3 py-1.5">Test Konusu</th>
                  <th className="px-3 py-1.5">Test Adı</th>
                  <th className="px-3 py-1.5">Sayfa Sayısı</th>
                  <th className="px-3 py-1.5">Soru Sayısı</th>
                  {canEdit ? <th className="w-20 px-3 py-1.5">İşlem</th> : null}
                </tr>
              </thead>
              <tbody>
                {visibleTests.map((test) => (
                  <tr
                    key={test.id}
                    className="border-t border-[#edf0f1] hover:bg-[#faf3ec]"
                  >
                    <td className="px-3 py-1.5 font-medium text-[#253d3e]">
                      <span className="flex items-center gap-1">
                        <Dot size={18} className="shrink-0 text-[#87a3a5]" aria-hidden="true" />
                        {test.topicName}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 font-medium text-[#253d3e]">{test.name}</td>
                    <td className="px-3 py-1.5 text-[#667475]">{test.pageStart}. sayfa</td>
                    <td className="px-3 py-1.5 text-[#667475]">
                      {test.questionCount ? `${test.questionCount} soru` : 'Soru sayısı yok'}
                    </td>
                    {canEdit ? (
                      <td className="px-3 py-1.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {showAnswerKeyAction ? (
                            <button
                              type="button"
                              aria-label="Cevap anahtarı"
                              title={test.hasAnswerKey ? 'Cevap anahtarı tam' : 'Cevap anahtarı eksik'}
                              className={`hover:text-[#253d3e] ${test.hasAnswerKey ? 'text-[#87a3a5]' : 'text-panel-warm'}`}
                              onClick={(event) => {
                                event.stopPropagation()
                                onManageAnswerKey(test)
                              }}
                            >
                              <KeyRound size={13} aria-hidden="true" />
                            </button>
                          ) : null}
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
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </>
        )
      ) : null}
    </div>
  )
}

const CREATED_BY_ROLE_LABELS = {
  ogretmen: 'Öğretmen',
  ebeveyn: 'Veli',
}

function BookBlock({
  book,
  subjectsById,
  topics,
  tests,
  isFocused,
  canEdit,
  missingAnswerKeyInfo,
  onlyMissingAnswerKey,
  onAddTopic,
  onAddTest,
  onEditTopic,
  onEditTest,
  onDeleteTest,
  onManageAnswerKey,
  onEditBook,
  onToggleActive,
  onApproveBook,
  onRejectBook,
  onPreviewImage,
}) {
  const [expanded, setExpanded] = useState(isFocused)
  const [expandedTopicId, setExpandedTopicId] = useState(null)
  const blockRef = useRef(null)
  const isExpanded = onlyMissingAnswerKey || expanded

  // Content entry can create several topic rows with the same name under one book (e.g. one per
  // "İçerik Ekle" click). Merge those into a single group by name so the panel shows one section
  // per topic instead of repeating the same heading.
  const groupedTopics = useMemo(() => {
    const groups = new Map()
    topics.forEach((topic) => {
      const existing = groups.get(topic.name)
      if (existing) {
        existing.topicIds.push(topic.id)
      } else {
        groups.set(topic.name, { representative: topic, topicIds: [topic.id] })
      }
    })
    return Array.from(groups.values())
  }, [topics])

  const visibleGroupedTopics = onlyMissingAnswerKey
    ? groupedTopics.filter(({ topicIds }) =>
        tests.some((test) => topicIds.includes(test.topicId) && !test.hasAnswerKey),
      )
    : groupedTopics

  useEffect(() => {
    if (isFocused && blockRef.current) {
      blockRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      ref={blockRef}
      className={`overflow-hidden rounded-xl border border-[#e7e8ed] border-l-2 border-l-[#c1c8e0] bg-white shadow-[0_1px_4px_rgba(20,25,40,0.03)] ${
        isFocused ? 'ring-2 ring-[#b85f22] ring-offset-2' : ''
      }`}
    >
      <div
        className="flex min-h-[80px] flex-wrap items-center gap-3 px-[18px] py-4 cursor-pointer hover:bg-[#f7f8fc]"
        onClick={() => setExpanded((value) => !value)}
      >
        <div className="flex min-w-0 flex-auto items-center gap-3">
          <button
            type="button"
            aria-label={isExpanded ? 'İçerikleri gizle' : 'İçerikleri göster'}
            className="shrink-0 text-[#e3b98a] hover:text-[#c9772f]"
            onClick={(event) => {
              event.stopPropagation()
              setExpanded((value) => !value)
            }}
          >
            {isExpanded ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
          </button>
          {book.imageUrl ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(event) => {
                event.stopPropagation()
                onPreviewImage({ url: book.imageUrl, name: book.name })
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                event.stopPropagation()
                onPreviewImage({ url: book.imageUrl, name: book.name })
              }}
              className="shrink-0 cursor-pointer rounded-[10px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c9772f]"
              aria-label={`${book.name} görselini büyüt`}
            >
              <img loading="lazy" decoding="async"
                src={book.imageUrl}
                alt={`${book.name} görseli`}
                className="h-11 w-11 shrink-0 rounded-[10px] border border-[#e4e5ec] object-cover"
              />
            </span>
          ) : (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#f8e3d0] text-[#c9772f]">
              <BookOpen size={16} aria-hidden="true" />
            </span>
          )}
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-[15px] font-bold text-[#263a39]">{book.name}</span>
              {canEdit ? (
                <button
                  type="button"
                  aria-label="Kaynağı düzenle"
                  className="shrink-0 rounded-full p-0.5 text-[#e3b98a] hover:bg-[#f8e3d0] hover:text-[#c9772f]"
                  onClick={(event) => {
                    event.stopPropagation()
                    onEditBook(book)
                  }}
                >
                  <Pencil size={12} aria-hidden="true" />
                </button>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2.5 text-xs text-[#667475]">
              <span>
                Ders: <span className="font-medium text-[#263a39]">{subjectsById[book.subjectId]?.name || '—'}</span>
              </span>
              {book.grade ? (
                <span className="inline-flex items-center rounded-full bg-[#eef1ff] px-2.5 py-1 text-[11px] font-medium text-[#3d4ba0]">
                  {book.grade}. Sınıf
                </span>
              ) : null}
              {book.type ? (
                <span className="inline-flex items-center rounded-full bg-[#f8e3d0] px-2.5 py-1 text-[11px] font-medium text-[#c9772f]">
                  {RESOURCE_BOOK_TYPE_LABELS[book.type] || book.type}
                </span>
              ) : null}
              {book.type === 'soru_bankasi' && !book.hasAnswerKey ? (
                <span className="inline-flex items-center rounded-full bg-panel-accent-soft px-2.5 py-1 text-[11px] font-medium text-panel-warm">
                  Cevap Anahtarı Yok
                </span>
              ) : null}
              {missingAnswerKeyInfo ? (
                <span className="inline-flex items-center rounded-full bg-panel-accent-soft px-2.5 py-1 text-[11px] font-medium text-panel-warm">
                  {missingAnswerKeyInfo.incompleteTestCount}/{missingAnswerKeyInfo.totalTestCount} Test Eksik
                </span>
              ) : null}
              {book.status === 'pending' ? (
                <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                  Onay Bekliyor{book.createdByName ? ` · ${book.createdByName} (${CREATED_BY_ROLE_LABELS[book.createdByRole] || book.createdByRole})` : ''}
                </span>
              ) : null}
              {book.status === 'rejected' ? (
                <span className="inline-flex items-center rounded-full bg-panel-accent-soft px-2.5 py-1 text-[11px] font-medium text-panel-warm">
                  Reddedildi
                </span>
              ) : null}
              {canEdit ? (
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
              ) : (
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    book.isActive ? 'bg-[#e5f3ea] text-[#34845a]' : 'bg-[#f1f1f3] text-[#8a8a92]'
                  }`}
                >
                  {book.isActive ? 'Aktif' : 'Pasif'}
                </span>
              )}
            </div>
          </div>
        </div>
        {!canEdit ? null : book.status === 'pending' ? (
          <div className="flex w-full shrink-0 gap-2 sm:w-auto" onClick={(event) => event.stopPropagation()}>
            <Button
              variant="secondary"
              size="sm"
              className="h-10 flex-1 rounded-[10px] border-[#e1e4ea] bg-white text-panel-warm hover:bg-panel-accent-soft sm:flex-none"
              onClick={() => onRejectBook(book)}
            >
              Reddet
            </Button>
            <Button
              size="sm"
              className="h-10 flex-1 rounded-[10px] sm:flex-none"
              onClick={() => onApproveBook(book)}
            >
              Onayla
            </Button>
          </div>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            className="h-10 w-full shrink-0 rounded-[10px] border-[#e1e4ea] bg-white text-[#c9772f] hover:bg-[#f8e3d0] sm:w-auto"
            onClick={(event) => {
              event.stopPropagation()
              onAddTopic(book)
            }}
          >
            + İçerik Ekle
          </Button>
        )}
      </div>
      {isExpanded ? (
        visibleGroupedTopics.length === 0 ? (
          <p className="border-t border-[#eeeff3] px-[18px] py-2 text-xs text-[#8a849d]">
            {onlyMissingAnswerKey ? 'Bu kaynakta eksik cevap anahtarı yok.' : 'Bu kitaba ait içerik yok.'}
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-[#eeeff3] border-t border-[#eeeff3] bg-white">
            {visibleGroupedTopics.map(({ representative, topicIds }) => (
              <TopicBlock
                key={representative.id}
                topic={representative}
                tests={tests.filter((test) => topicIds.includes(test.topicId))}
                resourceBookType={book.type}
                expanded={onlyMissingAnswerKey || expandedTopicId === representative.id}
                onToggle={() =>
                  setExpandedTopicId((current) => (current === representative.id ? null : representative.id))
                }
                canEdit={canEdit}
                onAddTest={onAddTest}
                onEditTopic={onEditTopic}
                onEditTest={onEditTest}
                onDeleteTest={onDeleteTest}
                onManageAnswerKey={onManageAnswerKey}
                onlyMissingAnswerKey={onlyMissingAnswerKey}
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
  focusBookId,
  isFocusPublisher,
  canEdit,
  missingAnswerKeyInfoById,
  onlyMissingAnswerKey,
  onAddBook,
  onAddTopic,
  onAddTest,
  onEditTopic,
  onEditTest,
  onDeleteTest,
  onManageAnswerKey,
  onEditBook,
  onToggleActive,
  onApproveBook,
  onRejectBook,
  onPreviewImage,
}) {
  const [expanded, setExpanded] = useState(isFocusPublisher)
  const isExpanded = onlyMissingAnswerKey || expanded

  return (
    <div className="overflow-hidden rounded-[14px] border border-[#e7e9ee] bg-white shadow-[0_2px_8px_rgba(20,25,40,0.04)]">
      <div
        className="flex min-h-[74px] flex-wrap items-center gap-3 px-[22px] py-3 cursor-pointer hover:bg-[#fcfcfd] sm:px-6"
        onClick={() => setExpanded((value) => !value)}
      >
        <div className="flex min-w-0 flex-auto items-center gap-3">
          {isExpanded ? (
            <ChevronDown size={16} className="shrink-0 text-[#9aa1ab]" aria-hidden="true" />
          ) : (
            <ChevronRight size={16} className="shrink-0 text-[#9aa1ab]" aria-hidden="true" />
          )}
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f8e3d0] text-[#c9772f]">
            <Building2 size={19} aria-hidden="true" />
          </span>
          <span className="truncate text-[17px] font-bold text-[#263a39]">{publisher.name}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2.5" onClick={(event) => event.stopPropagation()}>
          <span className="inline-flex items-center rounded-full bg-[#f8e3d0] px-2.5 py-1 text-[11px] font-medium text-[#c9772f]">
            {books.length} kitap
          </span>
          {canEdit ? (
            <Button
              variant="secondary"
              size="sm"
              className="h-[34px] rounded-[10px] border-[#e1e4ea] bg-white text-[#253d3e] hover:bg-[#f7f8fa]"
              onClick={() => onAddBook(publisher)}
            >
              + Kaynak Kitap
            </Button>
          ) : null}
        </div>
      </div>
      {isExpanded ? (
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
                  isFocused={book.id === focusBookId}
                  canEdit={canEdit}
                  missingAnswerKeyInfo={missingAnswerKeyInfoById[book.id]}
                  onlyMissingAnswerKey={onlyMissingAnswerKey}
                  onAddTopic={onAddTopic}
                  onAddTest={onAddTest}
                  onEditTopic={onEditTopic}
                  onEditTest={onEditTest}
                  onDeleteTest={onDeleteTest}
                  onManageAnswerKey={onManageAnswerKey}
                  onEditBook={onEditBook}
                  onToggleActive={onToggleActive}
                  onApproveBook={onApproveBook}
                  onRejectBook={onRejectBook}
                  onPreviewImage={onPreviewImage}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

export default function PublisherCatalogScreen({ subjectId } = {}) {
  const { authUser } = useAuth()
  // Kütüphane veri işlemleri (ekle/düzenle/sil) yalnızca admin veya "Kütüphane düzenleme
  // yetkisi" verilmiş kullanıcılara açık; diğerleri katalogu yalnızca görüntüler.
  const canEdit = Boolean(authUser?.isAdmin || authUser?.canManageLibrary)
  const [searchParams] = useSearchParams()
  const focusBookId = searchParams.get('resourceBookId')
  const [publishers, setPublishers] = useState(null)
  const [resourceBooks, setResourceBooks] = useState(null)
  const [subjects, setSubjects] = useState(null)
  const [topics, setTopics] = useState(null)
  const [tests, setTests] = useState(null)
  const [error, setError] = useState('')
  const [showPublisherModal, setShowPublisherModal] = useState(false)
  const [bookModalPublisher, setBookModalPublisher] = useState(null)
  const [editingBook, setEditingBook] = useState(null)
  const [rejectingBook, setRejectingBook] = useState(null)
  const [topicModalBook, setTopicModalBook] = useState(null)
  const [testModalTopic, setTestModalTopic] = useState(null)
  const [editingTopic, setEditingTopic] = useState(null)
  const [editingTest, setEditingTest] = useState(null)
  const [answerKeyTest, setAnswerKeyTest] = useState(null)
  const [deletingTest, setDeletingTest] = useState(null)
  const [deletingTestError, setDeletingTestError] = useState('')
  const [deletingTestLoading, setDeletingTestLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [onlyMissingAnswerKey, setOnlyMissingAnswerKey] = useState(false)
  const [missingAnswerKeyBooks, setMissingAnswerKeyBooks] = useState([])
  const [previewImage, setPreviewImage] = useState(null)

  const loadData = () => {
    Promise.all([
      authRequest('/api/panel-admin/publishers', { method: 'GET' }),
      authRequest('/api/panel-admin/resource-books', { method: 'GET' }),
      authRequest('/api/panel/subjects', { method: 'GET' }),
      authRequest('/api/panel-admin/resource-book-topics', { method: 'GET' }),
      authRequest('/api/panel-admin/resource-book-topic-tests', { method: 'GET' }),
      authRequest('/api/panel-admin/resource-books/missing-answer-key', { method: 'GET' }),
    ])
      .then(([publishersData, booksData, subjectsData, topicsData, testsData, missingAnswerKeyData]) => {
        setPublishers(publishersData.publishers)
        setResourceBooks(booksData.resourceBooks)
        setSubjects(subjectsData.subjects)
        setTopics(topicsData.topics)
        setTests(testsData.tests)
        setMissingAnswerKeyBooks(missingAnswerKeyData.resourceBooks)
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
          grade: book.grade,
          hasAnswerKey: book.hasAnswerKey,
          imageUrl: book.imageUrl,
        }),
      })
      handleBookSaved(data.resourceBook)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleApproveBook = async (book) => {
    try {
      const data = await authRequest(`/api/panel-admin/resource-books/${book.id}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'approve' }),
      })
      handleBookSaved(data.resourceBook)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleRejectBook = async (reason) => {
    if (!rejectingBook) return
    try {
      const data = await authRequest(`/api/panel-admin/resource-books/${rejectingBook.id}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'reject', reason }),
      })
      handleBookSaved(data.resourceBook)
      setRejectingBook(null)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleTopicCreated = (topic) => {
    setTopics((current) => [...(current || []), topic])
    setTopicModalBook(null)
  }

  const handleTestCreated = (testOrTests) => {
    const created = Array.isArray(testOrTests) ? testOrTests : [testOrTests]
    setTests((current) => [...(current || []), ...created])
    setTestModalTopic(null)
  }

  const handleTopicUpdated = (topic) => {
    setTopics((current) => (current || []).map((item) => (item.id === topic.id ? topic : item)))
    setEditingTopic(null)
  }

  // Testler listesini yerinde günceller; hangi diyaloğun açık olduğuna dokunmaz. Test Düzenle,
  // testler tablosundaki cevap anahtarı akışı ve soru detay modalı ortak olarak bunu kullanır.
  const applyTestUpdate = (test) => {
    setTests((current) => (current || []).map((item) => (item.id === test.id ? test : item)))
  }

  const handleTestUpdated = (test) => {
    applyTestUpdate(test)
    setEditingTest(null)
  }

  const handleAnswerKeyTestUpdated = (test) => {
    applyTestUpdate(test)
    setAnswerKeyTest(test)
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

  const missingAnswerKeyIds = useMemo(
    () => new Set(missingAnswerKeyBooks.map((book) => book.id)),
    [missingAnswerKeyBooks],
  )

  const missingAnswerKeyInfoById = useMemo(
    () => Object.fromEntries(missingAnswerKeyBooks.map((book) => [book.id, book])),
    [missingAnswerKeyBooks],
  )

  const refreshMissingAnswerKeyBooks = () => {
    authRequest('/api/panel-admin/resource-books/missing-answer-key', { method: 'GET' })
      .then((data) => setMissingAnswerKeyBooks(data.resourceBooks))
      .catch(() => {})
  }

  const handleAddTopic = (book) => {
    const missingInfo = missingAnswerKeyInfoById[book.id]
    if (missingInfo) {
      setError(
        `"${book.name}" kaynağına yeni içerik eklemeden önce mevcut testlerin cevap anahtarını tamamlayın (${missingInfo.incompleteTestCount}/${missingInfo.totalTestCount} test eksik).`,
      )
      return
    }
    setError('')
    setTopicModalBook(book)
  }

  const filteredPublishers = useMemo(() => {
    if (!publishers || !resourceBooks) return null
    const q = query.trim().toLowerCase()
    return publishers.filter((publisher) => {
      if (q && !publisher.name.toLowerCase().includes(q)) return false
      if (subjectId) {
        const hasSubjectBook = resourceBooks.some(
          (book) => book.publisherId === publisher.id && book.subjectId === subjectId && book.isActive,
        )
        if (!hasSubjectBook) return false
      }
      if (onlyMissingAnswerKey) {
        const hasMissingBook = resourceBooks.some(
          (book) =>
            book.publisherId === publisher.id &&
            (!subjectId || (book.subjectId === subjectId && book.isActive)) &&
            missingAnswerKeyIds.has(book.id),
        )
        if (!hasMissingBook) return false
      }
      return true
    })
  }, [publishers, resourceBooks, query, subjectId, onlyMissingAnswerKey, missingAnswerKeyIds])

  const subjectsById = useMemo(
    () => Object.fromEntries((subjects || []).map((subject) => [subject.id, subject])),
    [subjects],
  )

  const focusPublisherId = useMemo(() => {
    if (!focusBookId || !resourceBooks) return null
    return resourceBooks.find((book) => book.id === focusBookId)?.publisherId || null
  }, [focusBookId, resourceBooks])

  return (
    <div data-theme="orange" className="-mx-4 -mt-5 -mb-24 bg-[#F7F8FA] px-4 pb-24 pt-5 md:-mx-6 md:-mb-6 md:px-6 md:pb-6">
    <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
      {(() => {
        const actionsNode = (
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
                  className="w-48 rounded-lg border border-[#dfe4e5] bg-white py-1.5 pl-8 pr-3 text-sm text-[#253d3e] focus:outline-none focus:ring-2 focus:ring-[#b85f22]/20 sm:w-56"
                />
              </div>
            ) : null}
            <label className="flex h-10 shrink-0 items-center gap-2 rounded-lg border border-[#dfe4e5] bg-white px-3 text-sm text-[#253d3e]">
              <input
                type="checkbox"
                checked={onlyMissingAnswerKey}
                onChange={(event) => setOnlyMissingAnswerKey(event.target.checked)}
                className="h-4 w-4"
              />
              Eksik cevap anahtarı
            </label>
            {canEdit ? (
              <Button
                onClick={() => setShowPublisherModal(true)}
                className="h-10 rounded-[10px] bg-[#b85f22] px-4 text-sm font-medium text-white hover:opacity-90"
              >
                + Yayın Evi Ekle
              </Button>
            ) : null}
          </>
        )

        if (subjectId) {
          return <div className="flex flex-wrap items-center justify-end gap-2">{actionsNode}</div>
        }

        return <PageHeader title="Yayın Evleri" actions={actionsNode} />
      })()}

      {error ? (
        <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{error}</div>
      ) : publishers === null || resourceBooks === null || subjects === null || topics === null || tests === null ? (
        <LoadingState label="Yayın evleri yükleniyor..." />
      ) : publishers.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Henüz yayın evi yok"
          description={
            canEdit
              ? 'Yukarıdaki butonla ilk yayın evini oluşturabilirsiniz.'
              : 'Kütüphaneye henüz yayın evi eklenmemiş.'
          }
        />
      ) : (
        <div className="fade-slide-in">
          <div className="flex flex-col gap-3">
            {filteredPublishers.length === 0 ? (
              <p className="px-1 py-6 text-sm text-[#667475]">
                {onlyMissingAnswerKey
                  ? 'Cevap anahtarı eksik kaynak yok.'
                  : query.trim()
                    ? 'Aramayla eşleşen yayın evi yok.'
                    : subjectId
                      ? 'Bu derse ait kaynak yok.'
                      : 'Aramayla eşleşen yayın evi yok.'}
              </p>
            ) : (
              filteredPublishers.map((publisher) => (
                <PublisherRow
                  key={publisher.id}
                  publisher={publisher}
                  books={resourceBooks.filter(
                    (book) =>
                      book.publisherId === publisher.id &&
                      (!subjectId || (book.subjectId === subjectId && book.isActive)) &&
                      (!onlyMissingAnswerKey || missingAnswerKeyIds.has(book.id)),
                  )}
                  subjectsById={subjectsById}
                  topics={topics}
                  tests={tests}
                  focusBookId={focusBookId}
                  isFocusPublisher={publisher.id === focusPublisherId}
                  canEdit={canEdit}
                  missingAnswerKeyInfoById={missingAnswerKeyInfoById}
                  onlyMissingAnswerKey={onlyMissingAnswerKey}
                  onAddBook={setBookModalPublisher}
                  onAddTopic={handleAddTopic}
                  onAddTest={setTestModalTopic}
                  onEditTopic={setEditingTopic}
                  onEditTest={setEditingTest}
                  onDeleteTest={setDeletingTest}
                  onManageAnswerKey={setAnswerKeyTest}
                  onEditBook={setEditingBook}
                  onToggleActive={handleToggleActive}
                  onApproveBook={handleApproveBook}
                  onRejectBook={setRejectingBook}
                  onPreviewImage={setPreviewImage}
                />
              ))
            )}
          </div>
        </div>
      )}

      {canEdit && showPublisherModal ? (
        <AddPublisherModal onCreated={handlePublisherCreated} onClose={() => setShowPublisherModal(false)} />
      ) : null}

      {canEdit && bookModalPublisher ? (
        <ResourceBookModal
          publisher={bookModalPublisher}
          subjects={subjects}
          presetSubjectId={subjectId}
          onSaved={handleBookSaved}
          onClose={() => setBookModalPublisher(null)}
        />
      ) : null}

      {canEdit && editingBook ? (
        <ResourceBookModal
          book={editingBook}
          publisher={publishers?.find((publisher) => publisher.id === editingBook.publisherId)}
          subjects={subjects}
          onSaved={handleBookSaved}
          onClose={() => setEditingBook(null)}
        />
      ) : null}

      {canEdit && rejectingBook ? (
        <RejectResourceBookModal
          book={rejectingBook}
          onConfirm={handleRejectBook}
          onClose={() => setRejectingBook(null)}
        />
      ) : null}

      {canEdit && topicModalBook ? (
        <TopicModal
          book={topicModalBook}
          onSaved={handleTopicCreated}
          onClose={() => setTopicModalBook(null)}
        />
      ) : null}

      {canEdit && testModalTopic ? (
        <TestModal
          topic={testModalTopic}
          onSaved={handleTestCreated}
          onClose={() => setTestModalTopic(null)}
        />
      ) : null}

      {canEdit && editingTopic ? (
        <TopicModal
          topic={editingTopic}
          book={resourceBooks?.find((book) => book.id === editingTopic.resourceBookId)}
          onSaved={handleTopicUpdated}
          onClose={() => setEditingTopic(null)}
        />
      ) : null}

      {canEdit && editingTest ? (
        <TestModal
          test={editingTest}
          topic={topics?.find((topic) => topic.id === editingTest.topicId)}
          onSaved={handleTestUpdated}
          onClose={() => setEditingTest(null)}
        />
      ) : null}

      {canEdit && answerKeyTest ? (
        <AnswerKeyFlow
          test={answerKeyTest}
          onTestUpdated={handleAnswerKeyTestUpdated}
          onClose={() => {
            setAnswerKeyTest(null)
            // Cevap anahtarı girişi testlerin hasAnswerKey durumunu değiştirir; "Eksik cevap
            // anahtarı" filtresi açıkken tüm veriyi tazeleyerek tamamlanan testlerin listeden
            // düşmesini ve kalan eksiklerin görünmesini sağlıyoruz.
            if (onlyMissingAnswerKey) {
              loadData()
            } else {
              refreshMissingAnswerKeyBooks()
            }
          }}
        />
      ) : null}

      {canEdit && deletingTest ? (
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

      <ImagePreviewLightbox preview={previewImage} onClose={() => setPreviewImage(null)} />
    </div>
    </div>
  )
}
