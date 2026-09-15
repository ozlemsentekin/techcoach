import { useEffect, useMemo, useState } from 'react'
import { BookOpen, ChevronRight, FileText, Plus, Trash2, X } from 'lucide-react'
import Button from '../../ui/Button'
import LoadingState from '../LoadingState'
import { authRequest } from '../../../services/authClient'
import { buildBookContents } from './bookContents'

// Kitap-açılımı modallerinin tek satırlık başlığı: "Kaynak › İçerik › işlem" gibi bir
// breadcrumb + kapat düğmesi. Ara segmentler taşarsa kısalır, son segment (işlem) sabit.
function ModalBreadcrumb({ segments, onClose }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-[#9b7a5a]">
        {segments.filter(Boolean).map((segment, index, list) => {
          const last = index === list.length - 1
          return (
            <span key={index} className="flex min-w-0 items-center gap-1.5">
              {index > 0 ? (
                <ChevronRight size={13} className="shrink-0 text-[#c9b4a0]" aria-hidden="true" />
              ) : null}
              <span className={last ? 'shrink-0 font-semibold text-panel-text' : 'min-w-0 truncate'}>
                {segment}
              </span>
            </span>
          )
        })}
      </h2>
      <button
        type="button"
        aria-label="Kapat"
        onClick={onClose}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-panel-text-muted hover:bg-white hover:text-panel-text"
      >
        <X size={20} />
      </button>
    </div>
  )
}

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

function TopicContentsPreview({
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
    <div className="relative flex h-full min-h-0 flex-col bg-[#fffdf8] p-4 sm:p-5">
      <div className="absolute inset-x-4 top-2.5 h-px bg-[#eadbc8] sm:inset-x-5" aria-hidden="true" />
      <h3 className="mb-2.5 mt-1 break-words text-base font-semibold text-[#2f2925]">
        İçindekiler
      </h3>

      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto" aria-live="polite">
        {bookContents.map((entry) => {
          const active = isEdit && entry.name === editingName
          const confirming = pendingKey === entry.name
          return (
            <TopicBookPageRow
              key={entry.name}
              label={active ? trimmed || entry.name : entry.name}
              page={entry.page == null ? '—' : String(entry.page)}
              active={active}
              subline={entry.testCount > 0 ? `${entry.testCount} test eklendi` : undefined}
              action={
                canAddTests || canDelete ? (
                  <span className="flex items-center gap-0.5">
                    {canAddTests ? (
                      <button
                        type="button"
                        aria-label={`${entry.name} içeriğine test ekle`}
                        onClick={() => onAddTests(entry)}
                        className="flex h-11 items-center gap-1 rounded-md px-2 text-xs font-medium text-[#b85f22] hover:bg-[#f6e6d2]"
                      >
                        <Plus size={12} aria-hidden="true" />
                        Test ekle
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
                        className="flex h-11 w-9 items-center justify-center rounded-md text-[#b49c84] hover:bg-[#f1e2d0] hover:text-[#a23b1e] disabled:opacity-40"
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

        {!isEdit && trimmed ? (
          <TopicBookPageRow label={trimmed || 'Yeni içerik başlığı'} page={trimmed ? '…' : '—'} active />
        ) : null}

        {bookContents.length === 0 && !trimmed ? (
          <p className="px-2 text-[13px] text-[#8b7666]">İlk üniteyi veya bölümü ekleyerek başlayın.</p>
        ) : null}
      </div>

    </div>
  )
}

function TopicModal({
  book,
  topic,
  topics = [],
  tests = [],
  onSaved,
  onDeleted,
  onTestsCreated,
  onTestDeleted,
  onClose,
}) {
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
      // Yeni ekleme akışında formu temizleyip odağı geri veriyoruz ki kullanıcı modal
      // kapanmadan art arda birden çok içindekiler başlığı ekleyebilsin (parent modalı bu
      // durumda açık bırakır, bkz. BookshelfDetailModal/PublisherCatalogScreen onSaved).
      // Düzenleme akışında (isEdit) tek kayıt güncellendiği için parent modalı kapatır.
      if (!isEdit) {
        setName('')
        document.getElementById('topic-name-input')?.focus()
      }
      onSaved(data.topic)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 sm:p-4">
      <form onSubmit={handleSubmit} role="dialog" aria-modal="true" aria-label="İçindekileri tanımla"
        className="flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden border border-panel-border bg-panel-surface shadow-panel-1 sm:h-[640px] sm:max-h-[92dvh] sm:max-w-5xl sm:rounded-2xl">
        <div className="flex shrink-0 items-center gap-3 border-b border-panel-border p-4">
          {book?.imageUrl ? <img src={book.imageUrl} alt="Kitap kapağı" className="h-12 w-10 shrink-0 rounded object-contain" /> : <BookOpen size={28} className="shrink-0 text-panel-warm" aria-hidden="true" />}
          <div className="min-w-0 flex-1"><h2 className="text-lg font-bold text-panel-text">İçindekileri tanımla</h2><p className="truncate text-sm text-panel-text-muted">{book?.name}</p></div>
          <button type="button" aria-label="Kapat" disabled={loading || deleteBusy} onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-full text-panel-text-muted hover:bg-panel-surface-soft"><X size={20} /></button>
        </div>
        {error && <p role="alert" className="shrink-0 px-4 py-2 text-sm text-panel-warm">{error}</p>}
        <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-px overflow-hidden bg-[#eadbc8] md:grid-cols-2 md:grid-rows-1">
          <section className="flex min-h-0 flex-col justify-center bg-[#fffaf4] p-4 md:p-8">
            <h3 className="mb-1 text-base font-semibold text-panel-text">{isEdit ? 'Başlığı düzenleyin' : '1. Ünite veya bölüm ekleyin'}</h3>
            <p className="mb-4 text-sm text-panel-text-muted">Kitabın içindekiler sayfasındaki başlıkları kullanın.</p>
            <label htmlFor="topic-name-input" className="mb-2 text-sm font-medium text-panel-text">Ünite / bölüm adı</label>
            <div className="flex items-center gap-2">
              <input id="topic-name-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Örn. Çarpanlar ve Katlar" className="h-11 min-w-0 flex-1 rounded-xl border border-panel-border bg-white px-3 text-base text-panel-text outline-none focus:border-panel-accent focus:ring-2 focus:ring-panel-accent/20" />
              <Button type="submit" disabled={loading || name.trim().length < 2} className="h-11">{loading ? 'Ekleniyor…' : isEdit ? 'Kaydet' : 'Ekle'}</Button>
            </div>
            {!isEdit && onTestsCreated && <p className="mt-3 text-xs text-panel-text-muted">2. Eklediğiniz başlıktan “Test ekle” ile devam edin.</p>}
          </section>
          <section className="min-h-0 min-w-0 overflow-hidden md:shadow-[inset_12px_0_18px_-18px_#8b7666]">
            <TopicContentsPreview topicName={name} bookContents={bookContents} editingName={topic?.name || ''} onDeleteEntry={onDeleted ? handleDeleteEntry : undefined} deleteBusy={deleteBusy} onAddTests={onTestsCreated ? setTestEntry : undefined} />
          </section>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-panel-border px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          <p className="text-xs text-panel-text-muted">{bookContents.length} başlık eklendi</p>
          <Button type="button" disabled={loading || deleteBusy} variant="secondary" className="h-11" onClick={onClose}>{book?.hasAnswerKey && tests.length > 0 ? 'Cevap anahtarlarına geç' : 'Kitaba dön'}</Button>
        </div>
      </form>
      {testEntry ? (
        <AddTestsBookModal book={book} topic={{ id: testEntry.topicIds[0], name: testEntry.name }} existingTests={tests.filter((item) => testEntry.topicIds.includes(item.topicId))}
          onSaved={(createdTests) => { onTestsCreated?.(createdTests); setTestEntry(null) }} onTestDeleted={onTestDeleted} onClose={() => setTestEntry(null)} />
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

// Mevcut testleri sayfa sırasına göre sıralı önizleme listesine dönüştürür (İçindekiler
// önizlemesindeki mantığın testler için karşılığı).
function buildTopicTestPreview(existingTests) {
  return existingTests
    .map((test) => ({
      key: test.id,
      id: test.id,
      topicName: (test.topicName || '').trim(),
      name: (test.name || '').trim(),
      page: Number(test.pageStart) || null,
      pageEnd: Number(test.pageEnd) || null,
      hasAnswerKey: Boolean(test.hasAnswerKey),
    }))
    .sort((a, b) => {
      if (a.page == null && b.page == null) return 0
      if (a.page == null) return 1
      if (b.page == null) return -1
      return a.page - b.page
    })
}

// Test Ekle akışı: "kaç test, hangi sayfa aralığında" söylenir, testler otomatik ardışık
// sayfalara bölünüp tek adımda oluşturulur (tek test eklemek için sayı 1 bırakılır). Sağda
// kitaptaki testler sayfa sırasına göre görünür, çöp kutusu ile silinebilir.
function AddTestsBookModal({ book, topic, existingTests = [], onSaved, onTestDeleted, onClose }) {
  const [mobilePage, setMobilePage] = useState('form')
  const [topicName, setTopicName] = useState('')
  const [namePrefix, setNamePrefix] = useState('Test')
  const [firstTestNumber, setFirstTestNumber] = useState('1')
  const [count, setCount] = useState('1')
  const [startPage, setStartPage] = useState('')
  const [endPage, setEndPage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [deletingTestId, setDeletingTestId] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const countNumber = Number(count)
  const firstTestNumberValue = Number(firstTestNumber)
  const startNumber = Number(startPage)
  const endNumber = Number(endPage)
  const hasValidRange = Number.isInteger(startNumber) && startNumber > 0 && Number.isInteger(endNumber) && endNumber >= startNumber
  const totalPages = hasValidRange ? endNumber - startNumber + 1 : null

  // Kaydedilmiş bir testi siler; endpoint testin sorularını ve (varsa) cevap anahtarını da
  // birlikte temizler.
  const deleteSavedTest = async (item) => {
    setDeleteBusy(true)
    setError('')
    try {
      await authRequest(`/api/panel-admin/resource-book-topic-tests/${item.id}`, { method: 'DELETE' })
      setDeletingTestId(null)
      onTestDeleted?.(item.id)
    } catch (err) {
      setError(err.message)
    } finally {
      setDeleteBusy(false)
    }
  }

  const handleCreate = async (event) => {
    event.preventDefault()
    if (topicName.trim().length < 2) return setError('Test konusu en az 2 karakter olmalı.')
    if (!Number.isInteger(countNumber) || countNumber <= 0) return setError('Test sayısı pozitif bir tam sayı olmalı.')
    if (!Number.isInteger(firstTestNumberValue) || firstTestNumberValue <= 0) {
      return setError('İlk test numarası pozitif bir tam sayı olmalı.')
    }
    if (!Number.isInteger(startNumber) || startNumber <= 0) return setError('Başlangıç sayfası pozitif bir tam sayı olmalı.')
    if (!Number.isInteger(endNumber) || endNumber < startNumber) return setError('Bitiş sayfası başlangıçtan küçük olamaz.')
    if (totalPages < countNumber) {
      setError(
        `${startNumber}-${endNumber} aralığında ${totalPages} sayfa var, ${countNumber} teste bölünemez (her test en az 1 sayfa olmalı).`,
      )
      return
    }

    setError('')
    setLoading(true)
    // Toplam sayfa aralığı testlere mümkün olduğunca eşit paylaştırılır; tam bölünmüyorsa
    // kalan sayfalar baştaki testlere birer fazla verilir.
    const basePages = Math.floor(totalPages / countNumber)
    const extra = totalPages % countNumber
    let cursor = startNumber
    const createdTests = []
    try {
      for (let i = 0; i < countNumber; i += 1) {
        const pagesForThisTest = basePages + (i < extra ? 1 : 0)
        const rowStart = cursor
        const rowEnd = rowStart + pagesForThisTest - 1
        cursor = rowEnd + 1
        const data = await authRequest('/api/panel-admin/resource-book-topic-tests', {
          method: 'POST',
          body: JSON.stringify({
            topicId: topic.id,
            topicName: topicName.trim(),
            name: `${namePrefix.trim() || 'Test'}${firstTestNumberValue + i}`,
            pageStart: rowStart,
            pageEnd: rowEnd,
          }),
        })
        createdTests.push(data.test)
      }
      onSaved(createdTests)
      // Sonraki grubu eklerken kaldığı yerden devam etsin diye ilk test numarasını otomatik
      // ilerletiyoruz (ör. 1-15 eklendiyse form 16 ile açık kalır); sayfa/adet alanları sıfırlanır.
      setFirstTestNumber(String(firstTestNumberValue + countNumber))
      setCount('1')
      setStartPage('')
      setEndPage('')
    } catch (err) {
      setError(err.message)
      if (createdTests.length > 0) onSaved(createdTests)
    } finally {
      setLoading(false)
    }
  }

  const preview = buildTopicTestPreview(existingTests)

  return (
    <div className="fixed inset-0 z-[55] flex items-stretch justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <form
        onSubmit={handleCreate}
        role="dialog" aria-modal="true" aria-label="Testleri ekle"
        className="flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden border border-panel-border bg-[#fbf4ec] p-3 shadow-panel-1 sm:h-[640px] sm:max-h-[92dvh] sm:max-w-5xl sm:rounded-2xl sm:p-5"
      >
        <div className="mb-3 flex shrink-0 items-center gap-3">
          <FileText size={24} className="shrink-0 text-panel-warm" aria-hidden="true" />
          <div className="min-w-0 flex-1"><h2 className="text-lg font-bold text-panel-text">Testleri ekle</h2><p className="truncate text-xs text-panel-text-muted">{topic?.name}</p></div>
          <button type="button" aria-label="Kapat" disabled={loading} onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-panel-text-muted"><X size={20} /></button>
        </div>

        <div className="mb-3 flex shrink-0 gap-2 md:hidden">
          <Button type="button" className="h-11 flex-1" variant={mobilePage === 'form' ? 'primary' : 'secondary'} onClick={() => setMobilePage('form')}>Test bilgileri</Button>
          <Button type="button" className="h-11 flex-1" variant={mobilePage === 'list' ? 'primary' : 'secondary'} onClick={() => setMobilePage('list')}>Eklenenler ({preview.length})</Button>
        </div>
        {error ? (
          <div className="mb-3 rounded-xl bg-panel-accent-soft px-3 py-1.5 text-sm text-panel-warm">{error}</div>
        ) : null}

        <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-[#eadbc8] bg-[#e8d7c3] p-1.5 shadow-[0_18px_50px_rgba(92,62,35,0.18)] sm:p-2">
          <div
            className="pointer-events-none absolute bottom-3 left-1/2 top-3 z-10 hidden w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-[#cdb49a] to-transparent md:block"
            aria-hidden="true"
          />
          <div className="grid h-full min-h-0 overflow-hidden rounded-xl border border-[#eadbc8] bg-white shadow-[inset_0_0_34px_rgba(133,92,55,0.08)] md:grid-cols-2">
            <section className={`relative min-h-0 min-w-0 flex-col overflow-y-auto bg-[#fffaf4] p-3 sm:p-5 md:flex md:border-r md:border-[#eadbc8] ${mobilePage === 'form' ? 'flex' : 'hidden'}`}>
              <div className="absolute inset-x-4 top-2.5 h-px bg-[#eadbc8] sm:inset-x-5" aria-hidden="true" />
              <p className="mb-3 text-xs text-panel-text-muted">Sayfa aralığı testlere eşit paylaştırılır.</p>

              <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[12px] font-medium text-[#4a3b31]">Test Konusu</span>
                  <input
                    value={topicName}
                    onChange={(event) => setTopicName(event.target.value)}
                    placeholder="ör. Asal Sayılar"
                    autoFocus
                    className="h-10 w-full rounded-lg border border-[#d8c6b5] bg-white px-3 text-sm text-panel-text outline-none focus:border-[#c9772f] focus:ring-2 focus:ring-[#c9772f]/15"
                  />
                </label>

                <div className="grid grid-cols-3 gap-2.5">
                  <label className="flex flex-col gap-1">
                    <span className="text-[12px] font-medium text-[#4a3b31]">Kaç test?</span>
                    <input
                      type="number"
                      min="1"
                      inputMode="numeric"
                      value={count}
                      onChange={(event) => setCount(event.target.value)}
                      className="h-10 w-full rounded-lg border border-[#d8c6b5] bg-white px-3 text-sm text-panel-text outline-none focus:border-[#c9772f] focus:ring-2 focus:ring-[#c9772f]/15"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[12px] font-medium text-[#4a3b31]">İlk test no</span>
                    <input
                      type="number"
                      min="1"
                      inputMode="numeric"
                      value={firstTestNumber}
                      onChange={(event) => setFirstTestNumber(event.target.value)}
                      title="Kitaptaki ilk testin numarası — her zaman 1'den başlamayabilir"
                      className="h-10 w-full rounded-lg border border-[#d8c6b5] bg-white px-3 text-sm text-panel-text outline-none focus:border-[#c9772f] focus:ring-2 focus:ring-[#c9772f]/15"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[12px] font-medium text-[#4a3b31]">Ad öneki</span>
                    <input
                      value={namePrefix}
                      onChange={(event) => setNamePrefix(event.target.value)}
                      placeholder="Test"
                      className="h-10 w-full rounded-lg border border-[#d8c6b5] bg-white px-3 text-sm text-panel-text outline-none focus:border-[#c9772f] focus:ring-2 focus:ring-[#c9772f]/15"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <label className="flex flex-col gap-1">
                    <span className="text-[12px] font-medium text-[#4a3b31]">Başlangıç sayfası</span>
                    <input
                      type="number"
                      min="1"
                      inputMode="numeric"
                      value={startPage}
                      onChange={(event) => setStartPage(event.target.value)}
                      placeholder="ör. 7"
                      className="h-10 w-full rounded-lg border border-[#d8c6b5] bg-white px-3 text-sm text-panel-text outline-none focus:border-[#c9772f] focus:ring-2 focus:ring-[#c9772f]/15"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[12px] font-medium text-[#4a3b31]">Bitiş sayfası</span>
                    <input
                      type="number"
                      min="1"
                      inputMode="numeric"
                      value={endPage}
                      onChange={(event) => setEndPage(event.target.value)}
                      placeholder="ör. 34"
                      className="h-10 w-full rounded-lg border border-[#d8c6b5] bg-white px-3 text-sm text-panel-text outline-none focus:border-[#c9772f] focus:ring-2 focus:ring-[#c9772f]/15"
                    />
                  </label>
                </div>

                {hasValidRange && countNumber > 0 && Number.isInteger(firstTestNumberValue) && firstTestNumberValue > 0 ? (
                  <p className="rounded-lg bg-[#fff4e6] px-2.5 py-2 text-[11px] text-[#8a5a33]">
                    {countNumber > 1
                      ? `${namePrefix.trim() || 'Test'}${firstTestNumberValue} – ${namePrefix.trim() || 'Test'}${firstTestNumberValue + countNumber - 1} arası ${countNumber} test oluşturulacak`
                      : `${namePrefix.trim() || 'Test'}${firstTestNumberValue} oluşturulacak`}
                    {' '}({totalPages} sayfa{countNumber > 1 ? `, ~${Math.round(totalPages / countNumber)} sayfa/test` : ''}).
                  </p>
                ) : null}
              </div>

            </section>

            <section className={`min-h-0 min-w-0 md:block ${mobilePage === 'list' ? 'block' : 'hidden'}`}>
              <div className="relative flex h-full min-h-0 flex-col bg-[#fffdf8] p-4 sm:p-5">
                <div className="absolute inset-x-4 top-2.5 h-px bg-[#eadbc8] sm:inset-x-5" aria-hidden="true" />
                <p className="mt-1 break-words text-[11px] font-medium text-[#9b7a5a]">
                  {book?.name || 'Kaynak Kitap'}
                </p>
                <h3 className="mb-2.5 break-words text-base font-semibold text-[#2f2925]">
                  {topic?.name || 'İçerik'}
                </h3>

                <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto" aria-live="polite">
                  {preview.length === 0 ? (
                    <p className="px-2 text-[13px] text-[#8b7666]">
                      Eklediğiniz testler burada görünür.
                    </p>
                  ) : (
                    preview.map((item) => (
                      <TopicBookPageRow
                        key={item.key}
                        label={[item.topicName, item.name].filter(Boolean).join(' · ') || 'Test'}
                        page={
                          item.page == null
                            ? '…'
                            : item.pageEnd && item.pageEnd !== item.page
                              ? `${item.page}-${item.pageEnd}`
                              : String(item.page)
                        }
                        action={
                          <button
                            type="button"
                            aria-label={`${item.name || 'Test'} testini sil`}
                            disabled={deleteBusy}
                            onClick={() => setDeletingTestId(item.id)}
                            className="flex h-6 w-6 items-center justify-center rounded-md text-[#b49c84] hover:bg-[#f1e2d0] hover:text-[#a23b1e] disabled:opacity-40"
                          >
                            <Trash2 size={13} aria-hidden="true" />
                          </button>
                        }
                        footer={
                          deletingTestId === item.id ? (
                            <div className="rounded-md bg-[#fbeee0] px-2 py-1.5 text-[11px] text-[#7a3d16]">
                              <p className="mb-1.5">
                                Bu test{item.hasAnswerKey ? ' ve cevap anahtarı' : ''} silinsin mi?
                              </p>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  disabled={deleteBusy}
                                  onClick={() => deleteSavedTest(item)}
                                  className="rounded-md bg-[#a23b1e] px-2 py-1 font-semibold text-white disabled:opacity-50"
                                >
                                  {deleteBusy ? 'Siliniyor…' : 'Sil'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingTestId(null)}
                                  className="rounded-md border border-[#d8c6b5] px-2 py-1 font-semibold text-[#7a3d16]"
                                >
                                  Vazgeç
                                </button>
                              </div>
                            </div>
                          ) : null
                        }
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
        <div className="flex shrink-0 items-center justify-between gap-3 pt-3 pb-[env(safe-area-inset-bottom)]">
          <Button variant="secondary" className="h-11" disabled={loading} onClick={onClose}>İçindekilere dön</Button>
          <Button type="submit" disabled={loading} className="h-11">{loading ? 'Ekleniyor…' : 'Testleri ekle'}</Button>
        </div>
      </form>
    </div>
  )
}

function TestModal({ book, topic, test, tests = [], onSaved, onTestDeleted, onClose }) {
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
      onTestDeleted={onTestDeleted}
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
  // Hızlı giriş: kullanıcı harfleri art arda yazar ("abcda..."), alan otomatik "A-B-C-D-A"
  // biçiminde tireli gösterir; her değişiklikte tüm cevap anahtarı bu harflerden yeniden
  // kurulur (soru bazlı optik seçim hâlâ ayrı ayrı kullanılabilir, ikisi aynı entries'i besler).
  const [quickInput, setQuickInput] = useState('')

  useEffect(() => {
    authRequest(`/api/panel-admin/resource-book-topic-tests/${test.id}/answer-key`, { method: 'GET' })
      .then((data) => {
        const labelByOrderNo = Object.fromEntries(data.entries.map((entry) => [entry.orderNo, entry.correctLabel]))
        const loaded = Array.from({ length: test.questionCount }, (_, i) => labelByOrderNo[i + 1] || '')
        setEntries(loaded)
        setQuickInput(loaded.join(''))
      })
      .catch((err) => setError(err.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [test.id])

  const setLabel = (index, label) => {
    setEntries((current) => {
      const next = current.map((value, i) => (i === index ? label : value))
      setQuickInput(next.join(''))
      return next
    })
  }

  const handleQuickInputChange = (event) => {
    const letters = event.target.value
      .toUpperCase()
      .replace(/[^ABCD]/g, '')
      .slice(0, entries?.length || 0)
    setQuickInput(letters)
    setEntries((current) => current.map((_, i) => letters[i] || ''))
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
              <div className="mb-3 rounded-xl border border-panel-border bg-panel-surface-soft/60 p-2.5">
                <label htmlFor="answer-key-quick-input" className="text-xs font-semibold text-panel-text">
                  Hızlı giriş
                </label>
                <input
                  id="answer-key-quick-input"
                  value={quickInput.split('').join('-')}
                  onChange={handleQuickInputChange}
                  placeholder={`ör. ${'ABCDA'.slice(0, Math.min(5, entries.length))}...`}
                  autoFocus
                  className="mt-1.5 h-9 w-full rounded-lg border border-panel-border bg-white px-2.5 font-mono text-sm tracking-wide text-panel-text outline-none focus:border-panel-warm focus:ring-2 focus:ring-panel-warm/15"
                />
                <p className="mt-1 text-[11px] text-panel-text-muted">
                  A, B, C, D harflerini sırayla yaz — aralarına tire otomatik gelir. İstersen aşağıdan soru soru da
                  işaretleyebilirsin.
                </p>
              </div>

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
