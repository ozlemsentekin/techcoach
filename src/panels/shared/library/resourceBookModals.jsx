import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Copy, FileText, Plus, Trash2, X } from 'lucide-react'
import Button from '../../ui/Button'
import LoadingState from '../LoadingState'
import { authRequest } from '../../../services/authClient'

const CONTENT_TOPIC_EXAMPLE = '1. Ünite — Çarpanlar ve Katlar'

function TopicBookPageRow({ label, page, active = false, subline, action, footer }) {
  return (
    <div
      className={`rounded-md px-2 py-1 ${
        active ? 'bg-[#f8e3d0] text-[#7a3d16] shadow-[inset_3px_0_0_#c9772f]' : 'text-[#6f6258]'
      }`}
    >
      <div className="flex min-w-0 items-baseline gap-2">
        <span className={`min-w-0 break-words text-[13px] leading-snug ${active ? 'font-semibold' : 'font-medium'}`}>
          {label}
        </span>
        <span className="min-w-[20px] flex-1 border-b border-dotted border-[#d8c6b5]" aria-hidden="true" />
        <span className="shrink-0 text-[11px] font-semibold tabular-nums">{page}</span>
        {action ? <span className="shrink-0 self-center">{action}</span> : null}
      </div>
      {subline ? <p className="mt-0.5 pl-2 text-[11px] text-[#8b7666]">{subline}</p> : null}
      {footer ? <div className="mt-1 pl-2">{footer}</div> : null}
    </div>
  )
}

// Kaynağa eklenmiş içerikleri (aynı adlı satırları birleştirerek) başlangıç sayfasına göre
// sıralı bir "İçindekiler" listesine dönüştürür. Bir içeriğin başlangıç sayfası, o içeriğe
// bağlı testlerin en küçük başlangıç sayfasıdır; hiç testi yoksa sayfa bilinmiyor demektir.
// bookTopics / bookTests bu kaynağa göre önceden filtrelenmiş olarak beklenir.
function buildBookContents(bookTopics, bookTests) {
  const groups = new Map()
  bookTopics.forEach((topic) => {
    const existing = groups.get(topic.name)
    if (existing) existing.topicIds.push(topic.id)
    else groups.set(topic.name, { name: topic.name, topicIds: [topic.id] })
  })

  const entries = Array.from(groups.values()).map((group) => {
    const groupTests = bookTests.filter((test) => group.topicIds.includes(test.topicId))
    const pages = groupTests
      .map((test) => Number(test.pageStart))
      .filter((page) => Number.isInteger(page) && page > 0)
    return {
      name: group.name,
      topicIds: group.topicIds,
      testCount: groupTests.length,
      page: pages.length ? Math.min(...pages) : null,
    }
  })

  entries.sort((a, b) => {
    if (a.page == null && b.page == null) return a.name.localeCompare(b.name, 'tr')
    if (a.page == null) return 1
    if (b.page == null) return -1
    return a.page - b.page
  })

  return entries
}

function TopicContentsPreview({
  bookName,
  topicName,
  bookContents,
  editingName,
  onDeleteEntry,
  deleteBusy,
  onAddTests,
}) {
  const trimmed = topicName.trim()
  const isEdit = Boolean(editingName)
  const [pendingKey, setPendingKey] = useState(null)
  const canDelete = Boolean(onDeleteEntry) && !isEdit
  const canAddTests = Boolean(onAddTests) && !isEdit

  return (
    <div className="relative flex h-full min-h-[300px] flex-col bg-[#fffdf8] p-4 sm:p-5">
      <div className="absolute inset-x-4 top-2.5 h-px bg-[#eadbc8] sm:inset-x-5" aria-hidden="true" />
      <h3 className="mb-2.5 mt-1 break-words text-base font-semibold text-[#2f2925]">
        {(bookName || 'Kaynak Kitap') + ' — İçindekiler'}
      </h3>

      <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto" aria-live="polite">
        {bookContents.map((entry) => {
          const active = isEdit && entry.name === editingName
          const confirming = pendingKey === entry.name
          return (
            <TopicBookPageRow
              key={entry.name}
              label={active ? trimmed || entry.name : entry.name}
              page={entry.page == null ? '—' : String(entry.page)}
              active={active}
              action={
                canAddTests || canDelete ? (
                  <span className="flex items-center gap-0.5">
                    {canAddTests ? (
                      <button
                        type="button"
                        aria-label={`${entry.name} içeriğine test ekle`}
                        onClick={() => onAddTests(entry)}
                        className="flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium text-[#b85f22] hover:bg-[#f6e6d2]"
                      >
                        <Plus size={12} aria-hidden="true" />
                        test
                      </button>
                    ) : null}
                    {canDelete ? (
                      <button
                        type="button"
                        aria-label={`${entry.name} içeriğini sil`}
                        disabled={deleteBusy}
                        onClick={() =>
                          entry.testCount > 0 ? setPendingKey(entry.name) : onDeleteEntry(entry)
                        }
                        className="flex h-6 w-6 items-center justify-center rounded-md text-[#b49c84] hover:bg-[#f1e2d0] hover:text-[#a23b1e] disabled:opacity-40"
                      >
                        <Trash2 size={13} aria-hidden="true" />
                      </button>
                    ) : null}
                  </span>
                ) : null
              }
              footer={
                confirming ? (
                  <div className="rounded-md bg-[#fbeee0] px-2 py-1.5 text-[11px] text-[#7a3d16]">
                    <p className="mb-1.5">
                      Bu içeriğin altında {entry.testCount} test var. İçerikle birlikte testler ve
                      cevap anahtarları da silinecek.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={deleteBusy}
                        onClick={() => onDeleteEntry(entry)}
                        className="rounded-md bg-[#a23b1e] px-2 py-1 font-semibold text-white disabled:opacity-50"
                      >
                        {deleteBusy ? 'Siliniyor…' : 'Sil'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingKey(null)}
                        className="rounded-md border border-[#d8c6b5] px-2 py-1 font-semibold text-[#7a3d16]"
                      >
                        Vazgeç
                      </button>
                    </div>
                  </div>
                ) : null
              }
            />
          )
        })}

        {!isEdit ? (
          <TopicBookPageRow label={trimmed || 'Yeni içerik başlığı'} page={trimmed ? '…' : '—'} active />
        ) : null}

        {bookContents.length === 0 && isEdit ? (
          <p className="px-2 text-[13px] text-[#8b7666]">Bu kaynağa henüz içerik eklenmedi.</p>
        ) : null}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-[#eadbc8] pt-2 text-[11px] font-medium text-[#b49c84]">
        <span>techcoach kitaplık</span>
        <span>02</span>
      </div>
    </div>
  )
}

function TopicModal({ book, topic, topics = [], tests = [], onSaved, onDeleted, onTestsCreated, onClose }) {
  const isEdit = Boolean(topic)
  const [name, setName] = useState(topic?.name || '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  // İçindekiler satırındaki "test" düğmesiyle açılan iç modalin hedef içeriği.
  const [testEntry, setTestEntry] = useState(null)

  // topics/tests bu kaynağa ait olacak şekilde önceden filtrelenmiş gelir (Kütüphane
  // katalog ekranı tüm listeyi verdiği için orada book.id'ye göre süzülür).
  const bookId = book?.id
  const bookContents = useMemo(() => {
    const bookTopics = topics.filter((item) => item.resourceBookId == null || item.resourceBookId === bookId)
    const bookTopicIds = new Set(bookTopics.map((item) => item.id))
    const bookTests = tests.filter((item) => bookTopicIds.has(item.topicId))
    return buildBookContents(bookTopics, bookTests)
  }, [bookId, topics, tests])

  // İçindekiler listesinden bir içeriği (ve varsa altındaki testleri) siler. Aynı adlı
  // birden çok topic satırı oluşmuş olabileceğinden hepsi tek tek silinir.
  const handleDeleteEntry = async (entry) => {
    setDeleteBusy(true)
    setError('')
    try {
      for (const topicId of entry.topicIds) {
        await authRequest(`/api/panel-admin/resource-book-topics/${topicId}`, { method: 'DELETE' })
      }
      onDeleted?.(entry.topicIds)
    } catch (err) {
      setError(err.message)
    } finally {
      setDeleteBusy(false)
    }
  }

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
        className="h-full w-full overflow-y-auto border border-panel-border bg-[#fbf4ec] p-3 shadow-panel-1 sm:h-auto sm:max-h-[92vh] sm:max-w-5xl sm:rounded-2xl sm:p-5"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-[#9b7a5a]">{book?.name || 'Kaynak Kitap'}</p>
            <h2 className="text-lg font-semibold text-panel-text">{isEdit ? 'İçerik Düzenle' : 'İçerik Ekle'}</h2>
          </div>
          <button
            type="button"
            aria-label="Kapat"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-panel-text-muted hover:bg-white hover:text-panel-text"
          >
            <X size={20} />
          </button>
        </div>

        {error ? (
          <div className="mb-3 rounded-xl bg-panel-accent-soft px-3 py-1.5 text-sm text-panel-warm">{error}</div>
        ) : null}

        <div className="relative overflow-hidden rounded-2xl border border-[#eadbc8] bg-[#e8d7c3] p-1.5 shadow-[0_18px_50px_rgba(92,62,35,0.18)] sm:p-2">
          <div
            className="pointer-events-none absolute bottom-3 left-1/2 top-3 z-10 hidden w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-[#cdb49a] to-transparent md:block"
            aria-hidden="true"
          />
          <div className="grid overflow-hidden rounded-xl border border-[#eadbc8] bg-white shadow-[inset_0_0_34px_rgba(133,92,55,0.08)] md:grid-cols-2">
            <section className="relative flex min-h-[300px] min-w-0 flex-col bg-[#fffaf4] p-4 sm:p-5 md:border-r md:border-[#eadbc8]">
              <div className="absolute inset-x-4 top-2.5 h-px bg-[#eadbc8] sm:inset-x-5" aria-hidden="true" />
              <div className="mb-3 flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f8e3d0] text-[#c9772f]">
                  <BookOpen size={16} aria-hidden="true" />
                </span>
                <h3 className="min-w-0 break-words text-base font-semibold text-[#2f2925]">
                  {isEdit ? 'İçerik başlığını düzenle' : 'Yeni içerik ekle'}
                </h3>
              </div>

              <div className="mb-3 rounded-lg border border-[#eadbc8] bg-[#fff4e6] p-2.5">
                <p className="mb-1.5 text-xs font-semibold text-[#6d4a31]">Nasıl içerik eklenir?</p>
                <ol className="flex flex-col gap-1.5 text-[11px] leading-snug text-[#7d6a5a]">
                  <li className="flex gap-2">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#f0dcc5] text-[10px] font-bold text-[#8a5a33]">
                      1
                    </span>
                    <span>
                      İçeriğin kitaptaki başlığını yazın — bir bölüm ya da ünite. Örn.{' '}
                      <span className="font-medium text-[#3d3028]">“{CONTENT_TOPIC_EXAMPLE}”</span>
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#f0dcc5] text-[10px] font-bold text-[#8a5a33]">
                      2
                    </span>
                    <span>
                      <span className="font-medium text-[#3d3028]">İçeriği Oluştur</span>’a basın; içerik
                      sağdaki içindekiler listesine sayfa sırasına göre yerleşir.
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#f0dcc5] text-[10px] font-bold text-[#8a5a33]">
                      3
                    </span>
                    <span>Sonra bu içeriğe testlerini (konu, ad, başlangıç sayfası) ekleyin.</span>
                  </li>
                </ol>
                <p className="mt-1.5 text-[10px] text-[#9b8574]">
                  Yanlış eklediğiniz içeriği sağdaki listedeki çöp kutusu ile silebilirsiniz.
                </p>
              </div>

              <div className="mt-auto flex flex-col gap-1.5">
                <label htmlFor="topic-name-input" className="text-[13px] font-semibold text-[#4a3b31]">
                  İçerik Adı
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="topic-name-input"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={`Örn. ${CONTENT_TOPIC_EXAMPLE}`}
                    className="h-9 min-w-0 flex-1 rounded-lg border border-[#d8c6b5] bg-white px-3 text-sm text-panel-text shadow-[0_1px_0_rgba(255,255,255,0.8)] outline-none focus:border-[#c9772f] focus:ring-2 focus:ring-[#c9772f]/15"
                    autoFocus
                  />
                  <Button type="submit" disabled={loading} size="md" className="shrink-0 rounded-lg">
                    {loading ? 'Kaydediliyor...' : isEdit ? 'Kaydet' : 'Ekle'}
                  </Button>
                </div>
                <span className="text-[11px] text-[#7d6a5a]">
                  Kitabın içindekiler bölümündeki başlığı yazın.
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-[#eadbc8] pt-2 text-[11px] font-medium text-[#b49c84]">
                <span>giriş</span>
                <span>01</span>
              </div>
            </section>

            <section className="min-w-0">
              <TopicContentsPreview
                bookName={book?.name}
                topicName={name}
                bookContents={bookContents}
                editingName={topic?.name || ''}
                onDeleteEntry={onDeleted ? handleDeleteEntry : undefined}
                deleteBusy={deleteBusy}
                onAddTests={onTestsCreated ? setTestEntry : undefined}
              />
            </section>
          </div>
        </div>
      </form>

      {testEntry ? (
        <AddTestsBookModal
          book={book}
          topic={{ id: testEntry.topicIds[0], name: testEntry.name }}
          existingTests={tests.filter((item) => testEntry.topicIds.includes(item.topicId))}
          onSaved={(createdTests) => {
            onTestsCreated?.(createdTests)
            setTestEntry(null)
          }}
          onClose={() => setTestEntry(null)}
        />
      ) : null}
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
            <span className="text-sm font-medium text-panel-text-muted">Test Konusu</span>
            <input
              value={topicName}
              onChange={(event) => setTopicName(event.target.value)}
              placeholder="ör. Asal Sayılar"
              className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">Test Adı</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="ör. 1. Test"
              className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">Kitapta başladığı sayfa</span>
            <input
              type="number"
              min="1"
              value={pageStart}
              onChange={(event) => setPageStart(event.target.value)}
              placeholder="ör. 12"
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
function createEmptyTestRow(seed = {}) {
  testRowIdCounter += 1
  return {
    id: `row-${testRowIdCounter}`,
    topicName: seed.topicName || '',
    name: seed.name || '',
    pageStart: seed.pageStart || '',
  }
}

// Mevcut testler + doldurulan taslak satırları tek bir sayfa sırasına göre sıralı önizleme
// listesine dönüştürür (İçindekiler önizlemesindeki mantığın testler için karşılığı).
function buildTopicTestPreview(existingTests, draftRows) {
  const existing = existingTests.map((test) => ({
    key: `saved-${test.id}`,
    topicName: (test.topicName || '').trim(),
    name: (test.name || '').trim(),
    page: Number(test.pageStart) || null,
    draft: false,
  }))
  const drafts = draftRows
    .map((row) => ({
      key: row.id,
      topicName: row.topicName.trim(),
      name: row.name.trim(),
      page: Number(row.pageStart) || null,
      draft: true,
    }))
    .filter((row) => row.topicName || row.name || row.page)

  return [...existing, ...drafts].sort((a, b) => {
    if (a.page == null && b.page == null) return 0
    if (a.page == null) return 1
    if (b.page == null) return -1
    return a.page - b.page
  })
}

// Test Ekle akışı — İçerik Ekle ile aynı kitap-açılımı görseli: solda "nasıl eklenir" rehberi
// ve pratik çok-satırlı giriş (kopyala/sil), sağda içerik başlığı + testler eklendikçe sayfa
// sırasına göre görünen liste.
function AddTestsBookModal({ book, topic, existingTests = [], onSaved, onClose }) {
  const [rows, setRows] = useState(() => [createEmptyTestRow()])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const updateRow = (id, patch) => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  const addRow = () => {
    setRows((current) => [...current, createEmptyTestRow()])
  }

  // Aynı konudan art arda birkaç test eklemek (1. Test, 2. Test, ...) en sık yapılan işlem;
  // konu adını yeni satıra kopyalayarak her seferinde yeniden yazmayı önler.
  const duplicateRow = (id) => {
    setRows((current) => {
      const index = current.findIndex((row) => row.id === id)
      if (index === -1) return current
      const newRow = createEmptyTestRow({ topicName: current[index].topicName })
      return [...current.slice(0, index + 1), newRow, ...current.slice(index + 1)]
    })
  }

  const removeRow = (id) => {
    setRows((current) => (current.length > 1 ? current.filter((row) => row.id !== id) : current))
  }

  const validateRows = () => {
    for (const row of rows) {
      if (row.topicName.trim().length < 2) return 'Test Konusu en az 2 karakter olmalı.'
      if (row.name.trim().length < 2) return 'Test Adı en az 2 karakter olmalı.'
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

  const preview = buildTopicTestPreview(existingTests, rows)
  const guideStep = (n, children) => (
    <li className="flex gap-2">
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#f0dcc5] text-[10px] font-bold text-[#8a5a33]">
        {n}
      </span>
      <span>{children}</span>
    </li>
  )

  return (
    <div className="fixed inset-0 z-[55] flex items-stretch justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="h-full w-full overflow-y-auto border border-panel-border bg-[#fbf4ec] p-3 shadow-panel-1 sm:h-auto sm:max-h-[92vh] sm:max-w-5xl sm:rounded-2xl sm:p-5"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-[#9b7a5a]">{book?.name || 'Kaynak Kitap'}</p>
            <h2 className="text-lg font-semibold text-panel-text">Test Ekle</h2>
          </div>
          <button
            type="button"
            aria-label="Kapat"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-panel-text-muted hover:bg-white hover:text-panel-text"
          >
            <X size={20} />
          </button>
        </div>

        {error ? (
          <div className="mb-3 rounded-xl bg-panel-accent-soft px-3 py-1.5 text-sm text-panel-warm">{error}</div>
        ) : null}

        <div className="relative overflow-hidden rounded-2xl border border-[#eadbc8] bg-[#e8d7c3] p-1.5 shadow-[0_18px_50px_rgba(92,62,35,0.18)] sm:p-2">
          <div
            className="pointer-events-none absolute bottom-3 left-1/2 top-3 z-10 hidden w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-[#cdb49a] to-transparent md:block"
            aria-hidden="true"
          />
          <div className="grid overflow-hidden rounded-xl border border-[#eadbc8] bg-white shadow-[inset_0_0_34px_rgba(133,92,55,0.08)] md:grid-cols-2">
            <section className="relative flex min-h-[300px] min-w-0 flex-col bg-[#fffaf4] p-4 sm:p-5 md:border-r md:border-[#eadbc8]">
              <div className="absolute inset-x-4 top-2.5 h-px bg-[#eadbc8] sm:inset-x-5" aria-hidden="true" />
              <div className="mb-3 flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f8e3d0] text-[#c9772f]">
                  <FileText size={16} aria-hidden="true" />
                </span>
                <h3 className="min-w-0 break-words text-base font-semibold text-[#2f2925]">Bu içeriğe test ekle</h3>
              </div>

              <div className="mb-3 rounded-lg border border-[#eadbc8] bg-[#fff4e6] p-2.5">
                <p className="mb-1.5 text-xs font-semibold text-[#6d4a31]">Nasıl test eklenir?</p>
                <ol className="flex flex-col gap-1.5 text-[11px] leading-snug text-[#7d6a5a]">
                  {guideStep(
                    1,
                    <>
                      <span className="font-medium text-[#3d3028]">Test Konusu</span> — testin işlediği konu.
                      Örn. “Asal Sayılar”.
                    </>,
                  )}
                  {guideStep(
                    2,
                    <>
                      <span className="font-medium text-[#3d3028]">Test Adı</span> — kitaptaki adı. Örn. “1. Test”.
                    </>,
                  )}
                  {guideStep(
                    3,
                    <>
                      <span className="font-medium text-[#3d3028]">Başlangıç sayfası</span> — testin kitapta
                      başladığı sayfa.
                    </>,
                  )}
                </ol>
                <p className="mt-1.5 text-[10px] text-[#9b8574]">
                  Aynı konudan çok test varsa <span className="font-medium text-[#8a5a33]">kopyala</span> ile konu
                  adını yeni satıra taşıyın. Soru sayısı ve cevap anahtarını sonra ekleyebilirsiniz.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                {rows.map((row, index) => (
                  <div key={row.id} className="rounded-lg border border-[#e6d5c1] bg-white p-2.5">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-[#9b7a5a]">{index + 1}. test</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label="Konuyu kopyalayarak satır ekle"
                          onClick={() => duplicateRow(row.id)}
                          className="flex h-6 w-6 items-center justify-center rounded-md text-[#b49c84] hover:bg-[#f1e2d0] hover:text-[#8a5a33]"
                        >
                          <Copy size={13} aria-hidden="true" />
                        </button>
                        {rows.length > 1 ? (
                          <button
                            type="button"
                            aria-label="Satırı sil"
                            onClick={() => removeRow(row.id)}
                            className="flex h-6 w-6 items-center justify-center rounded-md text-[#b49c84] hover:bg-[#f1e2d0] hover:text-[#a23b1e]"
                          >
                            <Trash2 size={13} aria-hidden="true" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <input
                        value={row.topicName}
                        onChange={(event) => updateRow(row.id, { topicName: event.target.value })}
                        placeholder="Test Konusu — ör. Asal Sayılar"
                        className="h-8 w-full rounded-md border border-[#d8c6b5] bg-white px-2 text-[13px] text-panel-text outline-none focus:border-[#c9772f] focus:ring-2 focus:ring-[#c9772f]/15"
                      />
                      <div className="flex gap-1.5">
                        <input
                          value={row.name}
                          onChange={(event) => updateRow(row.id, { name: event.target.value })}
                          placeholder="Test Adı — ör. 1. Test"
                          className="h-8 min-w-0 flex-1 rounded-md border border-[#d8c6b5] bg-white px-2 text-[13px] text-panel-text outline-none focus:border-[#c9772f] focus:ring-2 focus:ring-[#c9772f]/15"
                        />
                        <input
                          type="number"
                          min="1"
                          inputMode="numeric"
                          value={row.pageStart}
                          onChange={(event) => updateRow(row.id, { pageStart: event.target.value })}
                          placeholder="Sayfa"
                          className="h-8 w-20 shrink-0 rounded-md border border-[#d8c6b5] bg-white px-2 text-[13px] text-panel-text outline-none focus:border-[#c9772f] focus:ring-2 focus:ring-[#c9772f]/15"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addRow}
                  className="inline-flex w-fit items-center gap-1 text-[13px] font-medium text-[#b85f22] hover:underline"
                >
                  <Plus size={13} aria-hidden="true" />
                  Satır ekle
                </button>
              </div>

              <div className="mt-3 border-t border-[#eadbc8] pt-2.5">
                <Button type="submit" disabled={loading} size="md" className="w-full rounded-lg">
                  {loading
                    ? 'Kaydediliyor…'
                    : rows.length > 1
                      ? `${rows.length} testi ekle`
                      : 'Testi ekle'}
                </Button>
              </div>

              <div className="mt-2.5 flex items-center justify-between border-t border-[#eadbc8] pt-2 text-[11px] font-medium text-[#b49c84]">
                <span>test girişi</span>
                <span>01</span>
              </div>
            </section>

            <section className="min-w-0">
              <div className="relative flex h-full min-h-[300px] flex-col bg-[#fffdf8] p-4 sm:p-5">
                <div className="absolute inset-x-4 top-2.5 h-px bg-[#eadbc8] sm:inset-x-5" aria-hidden="true" />
                <p className="mt-1 break-words text-[11px] font-medium text-[#9b7a5a]">
                  {book?.name || 'Kaynak Kitap'}
                </p>
                <h3 className="mb-2.5 break-words text-base font-semibold text-[#2f2925]">
                  {topic?.name || 'İçerik'}
                </h3>

                <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto" aria-live="polite">
                  {preview.length === 0 ? (
                    <p className="px-2 text-[13px] text-[#8b7666]">
                      Henüz test yok. Soldan ekledikçe burada sayfa sırasına göre görünecek.
                    </p>
                  ) : (
                    preview.map((item) => (
                      <TopicBookPageRow
                        key={item.key}
                        label={[item.topicName, item.name].filter(Boolean).join(' · ') || 'Yeni test'}
                        page={item.page == null ? '…' : String(item.page)}
                        active={item.draft}
                      />
                    ))
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-[#eadbc8] pt-2 text-[11px] font-medium text-[#b49c84]">
                  <span>techcoach kitaplık</span>
                  <span>02</span>
                </div>
              </div>
            </section>
          </div>
        </div>
      </form>
    </div>
  )
}

function TestModal({ book, topic, test, tests = [], onSaved, onClose }) {
  if (test) {
    return <EditTestModal test={test} topic={topic} onSaved={onSaved} onClose={onClose} />
  }
  const resolvedBook = book || (topic?.bookName ? { name: topic.bookName } : null)
  const existingTests = tests.filter((item) => item.topicId === topic?.id)
  return (
    <AddTestsBookModal
      book={resolvedBook}
      topic={topic}
      existingTests={existingTests}
      onSaved={onSaved}
      onClose={onClose}
    />
  )
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
          testinin soru sayısını belirleyin. Kaydettikten sonra cevap anahtarı ekranı açılır.
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
          {loading ? 'Kaydediliyor...' : 'Kaydet ve Cevap Anahtarına Geç'}
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

export { TopicModal, TestModal, AnswerKeyFlow }
