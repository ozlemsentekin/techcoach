import { useEffect, useState } from 'react'
import { BookOpen, Copy, FileText, ListTree, Trash2, X } from 'lucide-react'
import Button from '../../ui/Button'
import LoadingState from '../LoadingState'
import { authRequest } from '../../../services/authClient'

// Kaynak yapısı üç katmanlı: Kitap → İçerik (bölüm/ünite) → Test. "İçerik", "Test Konusu"
// ve "Test Adı" terimleri karışabildiği için ekleme ekranlarında somut bir örnekle gösterilir.
function ContentHierarchyHint({ bookName, highlight }) {
  const row = (active) =>
    `flex items-start gap-2 rounded-lg px-2 py-1.5 ${active ? 'bg-panel-blue-soft' : ''}`
  return (
    <div className="mb-4 rounded-xl border border-panel-border bg-panel-surface-soft p-3">
      <p className="mb-2 text-xs font-semibold text-panel-text">Kaynak nasıl bölünüyor?</p>
      <div className="flex flex-col gap-0.5 text-xs text-panel-text-muted">
        <div className={row(false)}>
          <BookOpen size={14} className="mt-0.5 shrink-0 text-panel-blue" aria-hidden="true" />
          <span>
            <span className="font-semibold text-panel-text">Kitap</span>
            {bookName ? <span> — {bookName}</span> : null}
          </span>
        </div>
        <div className="ml-3 border-l border-panel-border pl-3">
          <div className={row(highlight === 'topic')}>
            <ListTree size={14} className="mt-0.5 shrink-0 text-panel-blue" aria-hidden="true" />
            <span>
              <span className="font-semibold text-panel-text">İçerik</span> — kitabın bir bölümü / ünitesi
              <span className="block italic">örnek: “1. Ünite — Çarpanlar ve Katlar”</span>
            </span>
          </div>
          <div className="ml-3 border-l border-panel-border pl-3">
            <div className={row(highlight === 'test')}>
              <FileText size={14} className="mt-0.5 shrink-0 text-panel-blue" aria-hidden="true" />
              <span>
                <span className="font-semibold text-panel-text">Test</span> — o bölümdeki tek bir test
                <span className="block italic">
                  örnek: Test Konusu “Asal Sayılar” · Test Adı “1. Test” · kitapta 12. sayfada başlıyor
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>
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

        {!isEdit ? <ContentHierarchyHint bookName={book?.name} highlight="topic" /> : null}

        {error ? (
          <div className="mb-3 rounded-xl bg-panel-accent-soft px-3 py-1.5 text-sm text-panel-warm">{error}</div>
        ) : null}

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">İçerik Adı (kitabın bölümü / ünitesi)</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Örn. 1. Ünite — Çarpanlar ve Katlar"
              className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
            />
            <span className="text-xs text-panel-text-muted">
              Kitabın içindekiler bölümündeki başlığı yazın. Testleri bir sonraki adımda bu içeriğe ekleyeceksiniz.
            </span>
          </label>

          <Button type="submit" disabled={loading} size="md" className="w-full">
            {loading ? 'Kaydediliyor...' : isEdit ? 'Kaydet' : 'İçeriği Oluştur'}
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

        <ContentHierarchyHint bookName={topic?.bookName} highlight="test" />

        {topic ? (
          <p className="mb-3 text-sm text-panel-text-muted">
            Eklenecek içerik: <span className="font-medium text-panel-text">{topic.name}</span>
          </p>
        ) : null}

        <p className="mb-3 text-xs text-panel-text-muted">
          Her satır bir testtir. <span className="font-medium text-panel-text">Test Konusu</span> = testin işlediği
          konu (ör. “Asal Sayılar”), <span className="font-medium text-panel-text">Test Adı</span> = kitaptaki adı
          (ör. “1. Test”), <span className="font-medium text-panel-text">Başladığı Sayfa</span> = kitapta bu testin
          başladığı sayfa numarası. Soru sayısını ve cevap anahtarını sonra ekleyebilirsiniz.
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
                  <label className="flex flex-col gap-1 text-xs font-medium text-panel-text-muted">
                    Test Konusu
                    <input
                      value={row.topicName}
                      onChange={(event) => updateRow(row.id, { topicName: event.target.value })}
                      placeholder="ör. Asal Sayılar"
                      className="rounded-lg border border-panel-border p-2 text-sm text-panel-text"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-panel-text-muted">
                    Test Adı
                    <input
                      value={row.name}
                      onChange={(event) => updateRow(row.id, { name: event.target.value })}
                      placeholder="ör. 1. Test"
                      className="rounded-lg border border-panel-border p-2 text-sm text-panel-text"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-panel-text-muted">
                    Kitapta başladığı sayfa
                    <input
                      type="number"
                      min="1"
                      value={row.pageStart}
                      onChange={(event) => updateRow(row.id, { pageStart: event.target.value })}
                      placeholder="ör. 12"
                      className="rounded-lg border border-panel-border p-2 text-sm text-panel-text"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-xl border border-panel-border sm:block">
            <table className="w-full min-w-[460px] text-left text-sm">
              <thead>
                <tr className="bg-panel-surface-soft text-xs font-semibold text-panel-text-muted">
                  <th className="px-3 py-2">Test Konusu</th>
                  <th className="px-3 py-2">Test Adı</th>
                  <th className="w-36 px-3 py-2">Başladığı Sayfa</th>
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
                        placeholder="ör. Asal Sayılar"
                        className="w-full rounded-lg border border-panel-border p-1.5 text-sm text-panel-text"
                      />
                    </td>
                    <td className="p-1.5">
                      <input
                        value={row.name}
                        onChange={(event) => updateRow(row.id, { name: event.target.value })}
                        placeholder="ör. 1. Test"
                        className="w-full rounded-lg border border-panel-border p-1.5 text-sm text-panel-text"
                      />
                    </td>
                    <td className="p-1.5">
                      <input
                        type="number"
                        min="1"
                        value={row.pageStart}
                        onChange={(event) => updateRow(row.id, { pageStart: event.target.value })}
                        placeholder="ör. 12"
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
