import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, ChevronRight, Pencil, Plus, Trash2, X } from 'lucide-react'
import Button from '../../ui/Button'
import LoadingState from '../LoadingState'
import ConfirmationDialog from '../ConfirmationDialog'
import { ResourceBookAvatar, ImagePreviewLightbox } from '../ResourceBookCard'
import { TopicModal, TestModal } from '../library/resourceBookModals'
import ResourceSolveList from './ResourceSolveList'
import {
  deleteBookshelfBook,
  getBookshelfBook,
  getBookshelfStudents,
  setBookshelfBookStudents,
  updateBookshelfBook,
} from '../../../services/bookshelfService'
import { authRequest } from '../../../services/authClient'
import { BOOKSHELF_RESOURCE_TYPE_LABELS } from './bookshelfConstants'
import StudentPicker from './StudentPicker'

// Bir test satırında soru adedi + (adet girilince) cevap anahtarını Excel tarzı, modal açmadan
// satır içinde düzenlemeyi sağlar. Kaydetme OTOMATİK değil: her alanın yanındaki ✓ butonuna
// basılınca kaydedilir (alandan çıkarken/Tab ile geçerken yanlışlıkla eksik kaydetmeyi veya başka
// bir satırın o anda gelen güncellemesiyle üzerine yazılmayı önler). Kaydedilince yalnızca bu
// testin kendi kaydı güncellenir (onTestUpdated) — tüm listeyi yeniden çekip her satırı sıfırdan
// render etmiyoruz, bu hem daha hızlı hem başka satırlardaki kaydedilmemiş girişleri korur.
function InlineTestRow({ test, canEdit, showAnswerKey, onTestUpdated }) {
  const [questionCount, setQuestionCount] = useState(test.questionCount ? String(test.questionCount) : '')
  const [countError, setCountError] = useState('')
  const [savingCount, setSavingCount] = useState(false)

  const [quickInput, setQuickInput] = useState('')
  const [keyLoaded, setKeyLoaded] = useState(false)
  const [keyError, setKeyError] = useState('')
  const [savingKey, setSavingKey] = useState(false)

  const effectiveCount = Number(test.questionCount) || 0
  const showKeyField = canEdit && showAnswerKey && effectiveCount > 0

  useEffect(() => {
    setQuestionCount(test.questionCount ? String(test.questionCount) : '')
  }, [test.questionCount])

  useEffect(() => {
    if (!showKeyField) {
      setKeyLoaded(false)
      setQuickInput('')
      return undefined
    }
    let ignore = false
    setKeyLoaded(false)
    authRequest(`/api/panel-admin/resource-book-topic-tests/${test.id}/answer-key`, { method: 'GET' })
      .then((data) => {
        if (ignore) return
        const labelByOrderNo = Object.fromEntries(data.entries.map((entry) => [entry.orderNo, entry.correctLabel]))
        const loaded = Array.from({ length: effectiveCount }, (_, i) => labelByOrderNo[i + 1] || '')
        setQuickInput(loaded.join(''))
        setKeyLoaded(true)
      })
      .catch((err) => {
        if (!ignore) setKeyError(err.message)
      })
    return () => {
      ignore = true
    }
  }, [test.id, effectiveCount, showKeyField])

  const handleSaveQuestionCount = async () => {
    const trimmed = questionCount.trim()
    const num = trimmed === '' ? null : Number(trimmed)
    if (trimmed !== '' && (!Number.isInteger(num) || num <= 0)) {
      setCountError('Pozitif tam sayı olmalı.')
      return
    }
    setCountError('')
    setSavingCount(true)
    try {
      const data = await authRequest(`/api/panel-admin/resource-book-topic-tests/${test.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          topicName: test.topicName,
          name: test.name,
          pageStart: test.pageStart,
          pageEnd: test.pageEnd,
          questionCount: num,
        }),
      })
      onTestUpdated(data.test)
    } catch (err) {
      setCountError(err.message)
    } finally {
      setSavingCount(false)
    }
  }

  const handleQuickInputChange = (event) => {
    const letters = event.target.value
      .toUpperCase()
      .replace(/[^ABCD]/g, '')
      .slice(0, effectiveCount)
    setQuickInput(letters)
  }

  const handleSaveAnswerKey = async () => {
    setKeyError('')
    setSavingKey(true)
    try {
      const entries = quickInput
        .split('')
        .map((label, i) => ({ orderNo: i + 1, correctLabel: label }))
        .filter((entry) => entry.correctLabel)
      await authRequest(`/api/panel-admin/resource-book-topic-tests/${test.id}/answer-key`, {
        method: 'PUT',
        body: JSON.stringify({ entries }),
      })
      onTestUpdated({ ...test, hasAnswerKey: entries.length === effectiveCount && effectiveCount > 0 })
    } catch (err) {
      setKeyError(err.message)
    } finally {
      setSavingKey(false)
    }
  }

  return (
    <div className="flex flex-col gap-1 rounded-lg px-1.5 py-1">
      <span className="min-w-0 truncate text-xs font-medium text-panel-text-muted">
        {test.topicName ? `${test.topicName} · ` : ''}
        {test.name} · s.{test.pageStart}
        {test.pageEnd && test.pageEnd !== test.pageStart ? `-${test.pageEnd}` : ''}
      </span>
      {canEdit ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <label className="flex shrink-0 items-center gap-1">
            <span className="text-[10px] font-medium text-panel-text-muted">Soru</span>
            <input
              type="number"
              min="1"
              inputMode="numeric"
              value={questionCount}
              onChange={(event) => setQuestionCount(event.target.value)}
              disabled={savingCount}
              className="h-7 w-14 rounded-md border border-panel-border px-1.5 text-xs text-panel-text outline-none focus:border-panel-blue focus:ring-2 focus:ring-panel-blue-soft disabled:opacity-60"
            />
            <button
              type="button"
              aria-label="Soru sayısını kaydet"
              title="Kaydet"
              onClick={handleSaveQuestionCount}
              disabled={savingCount}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-panel-border text-panel-text-muted hover:border-panel-blue hover:text-panel-blue disabled:opacity-60"
            >
              <Check size={13} aria-hidden="true" />
            </button>
          </label>
          {showKeyField ? (
            <label className="flex min-w-0 flex-1 items-center gap-1">
              <span className="shrink-0 text-[10px] font-medium text-panel-text-muted">Cevap</span>
              <input
                value={quickInput.split('').join('-')}
                onChange={handleQuickInputChange}
                disabled={savingKey || !keyLoaded}
                placeholder={keyLoaded ? 'ör. ABCDA...' : 'yükleniyor...'}
                className="h-7 min-w-0 flex-1 rounded-md border border-panel-border px-1.5 font-mono text-xs tracking-wide text-panel-text outline-none focus:border-panel-warm focus:ring-2 focus:ring-panel-warm/15 disabled:opacity-60"
              />
              <button
                type="button"
                aria-label="Cevap anahtarını kaydet"
                title="Kaydet"
                onClick={handleSaveAnswerKey}
                disabled={savingKey || !keyLoaded}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-panel-border text-panel-text-muted hover:border-panel-warm hover:text-panel-warm disabled:opacity-60"
              >
                <Check size={13} aria-hidden="true" />
              </button>
            </label>
          ) : null}
        </div>
      ) : test.questionCount ? (
        <span className="text-[11px] text-panel-text-muted">{test.questionCount} soru</span>
      ) : null}
      {countError ? <p className="text-[10px] text-panel-warm">{countError}</p> : null}
      {keyError ? <p className="text-[10px] text-panel-warm">{keyError}</p> : null}
    </div>
  )
}

function ContentTab({ book, topics, tests, canEdit, onChanged, onTestUpdated }) {
  const [expandedTopicId, setExpandedTopicId] = useState(null)
  const [topicModalOpen, setTopicModalOpen] = useState(false)
  const [editingTopic, setEditingTopic] = useState(null)
  const [testModalTopic, setTestModalTopic] = useState(null)
  const [editingTest, setEditingTest] = useState(null)
  const [deletingTest, setDeletingTest] = useState(null)
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [switchingMode, setSwitchingMode] = useState(false)
  const [switchError, setSwitchError] = useState('')

  const handleSwitchToStructured = async () => {
    setSwitchingMode(true)
    setSwitchError('')
    try {
      await updateBookshelfBook(book.id, {
        name: book.name,
        subjectId: book.subjectId,
        grade: book.grade,
        publisherId: book.publisherId,
        imageUrl: book.imageUrl,
        contentMode: 'structured',
      })
      onChanged()
    } catch (err) {
      setSwitchError(err.message)
    } finally {
      setSwitchingMode(false)
    }
  }

  const testsByTopic = useMemo(() => {
    const map = new Map()
    tests.forEach((test) => {
      const list = map.get(test.topicId) || []
      list.push(test)
      map.set(test.topicId, list)
    })
    return map
  }, [tests])

  const showAnswerKey = book.type === 'soru_bankasi' || book.type === 'etkinlik'

  if (book.contentMode === 'simple') {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-panel-border bg-panel-surface-soft/60 p-4">
        <p className="text-sm text-panel-text-muted">
          Bu kitap "İçerik ve cevap anahtarı oluşturmayacağım" modunda eklendi: konu/test tanımlı
          değil, görev doğrudan kitap üzerinden verilir ve sonuç elle girilir.
        </p>
        {canEdit ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="w-fit"
              disabled={switchingMode}
              onClick={handleSwitchToStructured}
            >
              {switchingMode ? 'Geçiliyor...' : 'İçindekiler eklemeye başla'}
            </Button>
            {switchError ? <p className="text-xs text-panel-warm">{switchError}</p> : null}
          </>
        ) : null}
      </div>
    )
  }

  const handleDeleteTest = async () => {
    if (!deletingTest) return
    setDeleting(true)
    setDeleteError('')
    try {
      await authRequest(`/api/panel-admin/resource-book-topic-tests/${deletingTest.id}`, { method: 'DELETE' })
      setDeletingTest(null)
      onChanged()
    } catch (err) {
      setDeleteError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {canEdit ? (
        <Button type="button" size="sm" variant="secondary" className="w-fit gap-1.5" onClick={() => setTopicModalOpen(true)}>
          <Plus size={15} aria-hidden="true" />
          İçindekiler Ekle
        </Button>
      ) : null}

      {topics.length === 0 ? (
        <p className="p-2 text-sm text-panel-text-muted">Bu kaynağa henüz içindekiler eklenmemiş.</p>
      ) : (
        <div className="flex flex-col gap-2 rounded-xl border border-panel-border p-2">
          {topics.map((topic) => {
            const topicTests = testsByTopic.get(topic.id) || []
            const collapsed = expandedTopicId !== topic.id
            return (
              <div key={topic.id} className="py-0.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setExpandedTopicId(collapsed ? topic.id : null)}
                    className="flex flex-1 items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-left text-sm font-medium text-panel-text hover:bg-panel-blue-soft"
                  >
                    {collapsed ? (
                      <ChevronRight size={14} className="shrink-0 text-panel-text-muted" />
                    ) : (
                      <ChevronDown size={14} className="shrink-0 text-panel-text-muted" />
                    )}
                    <span className="min-w-0 flex-1 truncate">{topic.name}</span>
                    <span className="text-[11px] font-medium text-panel-text-muted">{topicTests.length} test</span>
                  </button>
                  {canEdit ? (
                    <button
                      type="button"
                      aria-label="İçeriği düzenle"
                      onClick={() => setEditingTopic(topic)}
                      className="text-panel-text-muted hover:text-panel-blue"
                    >
                      <Pencil size={13} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>

                {!collapsed ? (
                  <div className="ml-5 flex flex-col gap-1.5 pl-1">
                    {canEdit ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="w-fit gap-1.5"
                        onClick={() => setTestModalTopic(topic)}
                      >
                        <Plus size={14} aria-hidden="true" />
                        Test Ekle
                      </Button>
                    ) : null}
                    {topicTests.length === 0 ? (
                      <p className="py-1 text-xs text-panel-text-muted">
                        Bu içeriğe henüz test eklenmemiş. “Test Ekle” ile kitaptaki testleri girin.
                      </p>
                    ) : (
                      topicTests.map((test) => (
                        <div key={test.id} className="flex items-start gap-2 rounded-lg px-1.5 py-1">
                          <div className="min-w-0 flex-1">
                            <InlineTestRow test={test} canEdit={canEdit} showAnswerKey={showAnswerKey} onTestUpdated={onTestUpdated} />
                          </div>
                          {canEdit ? (
                            <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
                              <button
                                type="button"
                                aria-label="Testi düzenle"
                                title="Test adı, konu veya sayfa aralığını düzenle"
                                onClick={() => setEditingTest(test)}
                                className="text-panel-text-muted hover:text-panel-blue"
                              >
                                <Pencil size={12} aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                aria-label="Testi sil"
                                onClick={() => {
                                  setDeleteError('')
                                  setDeletingTest(test)
                                }}
                                className="text-panel-text-muted hover:text-panel-warm"
                              >
                                <Trash2 size={12} aria-hidden="true" />
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}

      {topicModalOpen ? (
        <TopicModal
          book={book}
          topics={topics}
          tests={tests}
          onDeleted={() => onChanged()}
          onTestsCreated={() => onChanged()}
          onTestDeleted={() => onChanged()}
          onSaved={(topic) => {
            // Modal kapanmaz: kullanıcı art arda birden çok içindekiler başlığı ekleyebilsin
            // (TopicModal ekleme sonrası kendi formunu temizliyor). Kapatmak için X'e basılır.
            // Yeni içeriği hemen aç ki "Test Ekle" butonu görünür olsun.
            if (topic?.id) setExpandedTopicId(topic.id)
            onChanged()
          }}
          onClose={() => setTopicModalOpen(false)}
        />
      ) : null}
      {editingTopic ? (
        <TopicModal
          topic={editingTopic}
          book={book}
          topics={topics}
          tests={tests}
          onSaved={() => {
            setEditingTopic(null)
            onChanged()
          }}
          onClose={() => setEditingTopic(null)}
        />
      ) : null}
      {testModalTopic ? (
        <TestModal
          topic={{ ...testModalTopic, bookName: book?.name }}
          book={book}
          tests={tests}
          onSaved={() => {
            setTestModalTopic(null)
            onChanged()
          }}
          onTestDeleted={() => onChanged()}
          onClose={() => setTestModalTopic(null)}
        />
      ) : null}
      {editingTest ? (
        <TestModal
          test={editingTest}
          topic={topics.find((topic) => topic.id === editingTest.topicId)}
          onSaved={() => {
            setEditingTest(null)
            onChanged()
          }}
          onClose={() => setEditingTest(null)}
        />
      ) : null}
      {deletingTest ? (
        <ConfirmationDialog
          title="Testi Sil"
          description={deleteError || `"${deletingTest.name}" testini silmek istediğinize emin misiniz?`}
          confirmLabel={deleting ? 'Siliniyor...' : 'Sil'}
          cancelLabel="Vazgeç"
          onConfirm={handleDeleteTest}
          onCancel={() => {
            if (deleting) return
            setDeletingTest(null)
            setDeleteError('')
          }}
        />
      ) : null}
    </div>
  )
}

function AssigneesTab({ book, onChanged }) {
  const [students, setStudents] = useState(null)
  const [assignedIds, setAssignedIds] = useState(
    () => new Set((book.assignedStudents || []).map((s) => String(s.id))),
  )
  const [savingIds, setSavingIds] = useState(() => new Set())
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false
    getBookshelfStudents()
      .then((list) => {
        if (!ignore) setStudents(list)
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })
    return () => {
      ignore = true
    }
  }, [])

  const toggle = async (studentId) => {
    const key = String(studentId)
    const next = new Set(assignedIds)
    if (next.has(key)) next.delete(key)
    else next.add(key)

    setSavingIds((current) => new Set(current).add(key))
    setError('')
    const previous = assignedIds
    setAssignedIds(next)
    try {
      await setBookshelfBookStudents(book.id, [...next])
      onChanged()
    } catch (err) {
      setAssignedIds(previous)
      setError(err.message)
    } finally {
      setSavingIds((current) => {
        const n = new Set(current)
        n.delete(key)
        return n
      })
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-panel-text-muted">
        Bu kaynağın hangi çocuk/öğrencilerin kitaplığında görüneceğini seçin.
        {book.otherAssignedCount > 0
          ? ` Ayrıca yönetmediğiniz ${book.otherAssignedCount} kişiye daha atanmış.`
          : ''}
      </p>
      {error ? <div className="rounded-xl bg-panel-accent-soft px-3 py-2 text-sm text-panel-warm">{error}</div> : null}
      {students === null ? (
        <LoadingState label="Öğrenciler yükleniyor..." />
      ) : students.length === 0 ? (
        <p className="p-2 text-sm text-panel-text-muted">Atama yapabileceğiniz çocuk/öğrenci yok.</p>
      ) : (
        <StudentPicker students={students} selectedIds={assignedIds} onToggle={toggle} savingIds={savingIds} />
      )}
    </div>
  )
}

export default function BookshelfDetailModal({
  resourceBookId,
  showAssignees = true,
  solveStudentId = null,
  initialTab = null,
  onClose,
  onChanged,
  onEdit,
}) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const canSolve = Boolean(solveStudentId)
  // Giriş noktasına göre açılan sekme: kitap adına/kapağa tıklanınca İçindekiler (kaynağı
  // yönetme niyeti), "Test sonuçlarını gir" butonuna tıklanınca Test Sonuçları (sonuç girme
  // niyeti) — ikisi de aynı solveStudentId bağlamında açılabildiği için tek başına canSolve
  // hangi sekmenin açılacağını belirlemeye yetmiyor, çağıran taraf initialTab ile netleştirir.
  const [tab, setTab] = useState(initialTab || (canSolve ? 'solve' : 'content'))
  const [previewImage, setPreviewImage] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)

  const load = () => {
    getBookshelfBook(resourceBookId)
      .then((result) => setData(result))
      .catch((err) => setError(err.message))
  }

  // İçindekiler'deki satır-içi soru sayısı/cevap anahtarı kaydından sonra çağrılır: tüm
  // kitabı yeniden çekmek yerine sadece bu testin kaydını yerinde günceller — hem daha hızlı
  // hem diğer satırlardaki henüz kaydedilmemiş girişleri korur (bkz. InlineTestRow).
  const handleTestUpdated = (updatedTest) => {
    setData((current) =>
      current
        ? {
            ...current,
            tests: current.tests.map((item) => (item.id === updatedTest.id ? { ...item, ...updatedTest } : item)),
          }
        : current,
    )
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceBookId])

  const book = data?.resourceBook || null
  // Katalog kaynaklarında atama yönetilemez → "Atananlar" sekmesi gizlenir, yalnızca içerik gösterilir.
  const canShowAssignees = showAssignees && Boolean(book?.canManageAssignees)
  // "İçindekiler" sekmesi: solve modunda yalnızca düzenleyebilenlere; solve modu yoksa her zaman
  // (shared/teacher Kitaplık bugünkü gibi salt-görüntüleme içeriği de gösterir).
  const canShowContent = !canSolve || Boolean(book?.canEditContent)
  // Doğal iş akışı: önce İçindekiler (konu → test → cevap anahtarı) eklenir, sonra test
  // sonuçları girilir — sekmeler de bu sırayla gösterilir.
  const availableTabs = [
    canShowContent ? 'content' : null,
    canSolve ? 'solve' : null,
    canShowAssignees ? 'assignees' : null,
  ].filter(Boolean)
  const activeTab = availableTabs.includes(tab) ? tab : availableTabs[0]
  const TAB_LABELS = { solve: 'Test Sonuçları', content: 'İçindekiler', assignees: 'Atananlar' }

  const handleDelete = async () => {
    setDeleting(true)
    setDeleteError('')
    try {
      await deleteBookshelfBook(resourceBookId)
      onChanged?.()
      onClose()
    } catch (err) {
      setDeleteError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <div className="flex h-full w-full max-w-3xl flex-col overflow-hidden bg-panel-surface p-4 shadow-panel-1 sm:h-[86vh] sm:rounded-2xl sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            {book ? (
              <ResourceBookAvatar
                book={book}
                size="row"
                onClick={book.imageUrl ? () => setPreviewImage({ url: book.imageUrl, name: book.name }) : undefined}
              />
            ) : null}
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-panel-text">{book?.name || 'Kaynak'}</h2>
              <p className="text-xs text-panel-text-muted">
                {[book?.publisherName, book?.subjectName, book?.grade ? `${book.grade}. sınıf` : null, book ? BOOKSHELF_RESOURCE_TYPE_LABELS[book.type] : null]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {book?.canEditContent ? (
              <button type="button" aria-label="Kitabı düzenle" onClick={() => onEdit?.(book)} className="text-panel-text-muted hover:text-panel-blue">
                <Pencil size={16} aria-hidden="true" />
              </button>
            ) : null}
            {book?.canDelete ? (
              <button
                type="button"
                aria-label="Kitabı sil"
                onClick={() => {
                  setDeleteError('')
                  setConfirmDelete(true)
                }}
                className="text-panel-text-muted hover:text-panel-warm"
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            ) : null}
            <button type="button" aria-label="Kapat" onClick={onClose} className="text-panel-text-muted hover:text-panel-text">
              <X size={20} />
            </button>
          </div>
        </div>

        {availableTabs.length > 1 ? (
          <div className="mb-4 flex gap-1 border-b border-panel-border">
            {availableTabs.map((tabKey) => (
              <button
                key={tabKey}
                type="button"
                onClick={() => setTab(tabKey)}
                className={`border-b-2 px-3 pb-2.5 text-sm font-semibold transition-colors ${
                  activeTab === tabKey ? 'border-panel-blue text-panel-blue' : 'border-transparent text-panel-text-muted hover:text-panel-text'
                }`}
              >
                {TAB_LABELS[tabKey]}
              </button>
            ))}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {error ? (
            <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-sm text-panel-warm">{error}</div>
          ) : data === null ? (
            <LoadingState label="Yükleniyor..." />
          ) : activeTab === 'solve' ? (
            <ResourceSolveList studentId={solveStudentId} book={book} />
          ) : activeTab === 'assignees' && canShowAssignees ? (
            <AssigneesTab book={book} onChanged={() => { load(); onChanged?.() }} />
          ) : (
            <ContentTab
              book={book}
              topics={data.topics}
              tests={data.tests}
              canEdit={Boolean(book?.canEditContent)}
              onChanged={() => { load(); onChanged?.() }}
              onTestUpdated={handleTestUpdated}
            />
          )}
        </div>
      </div>

      {confirmDelete ? (
        <ConfirmationDialog
          title="Kitabı sil"
          description={
            deleteError || `"${book?.name}" kaynağını silmek istediğinize emin misiniz? Tüm atamalardan kaldırılır.`
          }
          confirmLabel={deleting ? 'Siliniyor...' : 'Sil'}
          cancelLabel="Vazgeç"
          onConfirm={handleDelete}
          onCancel={() => {
            if (deleting) return
            setConfirmDelete(false)
            setDeleteError('')
          }}
        />
      ) : null}

      <ImagePreviewLightbox preview={previewImage} onClose={() => setPreviewImage(null)} />
    </div>
  )
}
