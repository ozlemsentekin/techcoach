import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, KeyRound, X } from 'lucide-react'
import LoadingState from '../LoadingState'
import { getBookshelfBook, getBookshelfTestAnswerKey } from '../../../services/bookshelfService'
import { buildBookContents } from './bookContents'

// Cevap anahtarını salt-okunur gösterir: doğru şık renkli, diğerleri düz — düzenleme yok.
function AnswerKeyViewer({ test, onClose }) {
  const [entries, setEntries] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false
    getBookshelfTestAnswerKey(test.id)
      .then((data) => {
        if (ignore) return
        const labelByOrderNo = Object.fromEntries(data.map((entry) => [entry.orderNo, entry.correctLabel]))
        const length = test.questionCount || data.length
        setEntries(Array.from({ length }, (_, i) => labelByOrderNo[i + 1] || ''))
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })
    return () => {
      ignore = true
    }
  }, [test.id, test.questionCount])

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <div className="flex h-full w-full flex-col bg-white sm:h-auto sm:max-h-[85vh] sm:max-w-lg sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-[#edf0f1] px-4 py-3 sm:px-5 sm:py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-panel-text">Cevap Anahtarı</h2>
            <p className="truncate text-xs text-[#667475]">
              {test.name}
              {test.topicName ? ` · ${test.topicName}` : ''}
            </p>
          </div>
          <button type="button" aria-label="Kapat" onClick={onClose} className="shrink-0 text-panel-text-muted hover:text-panel-text">
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {error ? (
            <div className="mb-3 rounded-xl bg-panel-accent-soft px-3 py-1.5 text-sm text-panel-warm">{error}</div>
          ) : entries === null ? (
            <LoadingState label="Cevap anahtarı yükleniyor..." />
          ) : entries.length === 0 ? (
            <p className="p-2 text-sm text-panel-text-muted">Bu test için henüz cevap anahtarı girilmemiş.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {entries.map((label, index) => (
                <div key={index} className="flex items-center gap-3 rounded-xl border border-panel-border px-3 py-2">
                  <span className="w-5 shrink-0 text-center text-sm font-semibold text-[#b85f22]">{index + 1}</span>
                  <div className="flex flex-1 justify-start gap-2">
                    {['A', 'B', 'C', 'D'].map((option) => {
                      const correct = label === option
                      return (
                        <span
                          key={option}
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold ${
                            correct
                              ? 'border-panel-warm bg-panel-warm text-white'
                              : 'border-panel-border text-panel-text-muted'
                          }`}
                        >
                          {option}
                        </span>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// "Kaynak Ata" akışındaki kitap-açılımı/içindekiler tasarımının salt-görüntüleme hâli: veli ve
// öğretmen bir kaynağın içindekiler listesini (içerik → testler) ve testlerin cevap anahtarını
// düzenleme yetkisi olmadan görebilir.
export default function ResourceBookContentViewerModal({ resourceBookId, onClose }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [expandedKey, setExpandedKey] = useState(null)
  const [answerKeyTest, setAnswerKeyTest] = useState(null)

  useEffect(() => {
    let ignore = false
    getBookshelfBook(resourceBookId)
      .then((result) => {
        if (!ignore) setData(result)
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })
    return () => {
      ignore = true
    }
  }, [resourceBookId])

  const book = data?.resourceBook || null
  const showAnswerKey = book && (book.type === 'soru_bankasi' || book.type === 'etkinlik')

  const contents = useMemo(() => (data ? buildBookContents(data.topics, data.tests) : []), [data])

  const testsByGroup = useMemo(() => {
    const map = new Map()
    if (!data) return map
    contents.forEach((entry) => {
      const groupTests = data.tests
        .filter((test) => entry.topicIds.includes(test.topicId))
        .sort((a, b) => (Number(a.pageStart) || 0) - (Number(b.pageStart) || 0))
      map.set(entry.name, groupTests)
    })
    return map
  }, [contents, data])

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <div className="h-full w-full overflow-y-auto border border-panel-border bg-[#fbf4ec] p-3 shadow-panel-1 sm:h-auto sm:max-h-[92vh] sm:max-w-3xl sm:rounded-2xl sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-[#9b7a5a]">
            <span className="min-w-0 truncate">{book?.name || 'Kaynak'}</span>
            <ChevronRight size={13} className="shrink-0 text-[#c9b4a0]" aria-hidden="true" />
            <span className="shrink-0 font-semibold text-panel-text">İçindekiler</span>
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

        <div className="relative overflow-hidden rounded-2xl border border-[#eadbc8] bg-white shadow-[inset_0_0_34px_rgba(133,92,55,0.08)]">
          {error ? (
            <div className="m-4 rounded-xl bg-panel-accent-soft px-3 py-2 text-sm text-panel-warm">{error}</div>
          ) : data === null ? (
            <div className="p-6">
              <LoadingState label="İçindekiler yükleniyor..." />
            </div>
          ) : (
            <div className="relative flex flex-col bg-[#fffdf8] p-4 sm:p-5">
              <div className="absolute inset-x-4 top-2.5 h-px bg-[#eadbc8] sm:inset-x-5" aria-hidden="true" />
              <h3 className="mb-2.5 mt-1 break-words text-base font-semibold text-[#2f2925]">
                {(book?.name || 'Kaynak Kitap') + ' — İçindekiler'}
              </h3>

              {contents.length === 0 ? (
                <p className="px-2 text-[13px] text-[#8b7666]">Bu kaynağa henüz içerik eklenmedi.</p>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {contents.map((entry) => {
                    const groupTests = testsByGroup.get(entry.name) || []
                    const expanded = expandedKey === entry.name
                    return (
                      <div key={entry.name}>
                        <button
                          type="button"
                          onClick={() => setExpandedKey(expanded ? null : entry.name)}
                          className="flex w-full min-w-0 items-baseline gap-2 rounded-md px-2 py-1.5 text-left hover:bg-[#f8e3d0]/60"
                        >
                          {expanded ? (
                            <ChevronDown size={13} className="shrink-0 text-[#b49c84]" aria-hidden="true" />
                          ) : (
                            <ChevronRight size={13} className="shrink-0 text-[#b49c84]" aria-hidden="true" />
                          )}
                          <span className="min-w-0 flex-1 break-words text-[13px] font-medium leading-snug text-[#6f6258]">
                            {entry.name}
                          </span>
                          <span className="min-w-[20px] flex-1 border-b border-dotted border-[#d8c6b5]" aria-hidden="true" />
                          <span className="shrink-0 text-[11px] font-semibold tabular-nums text-[#6f6258]">
                            {entry.page == null ? '—' : entry.page}
                          </span>
                        </button>

                        {expanded ? (
                          <div className="ml-6 flex flex-col gap-0.5 pb-1.5 pl-2">
                            {groupTests.length === 0 ? (
                              <p className="py-1 text-[12px] text-[#8b7666]">Bu içeriğe henüz test eklenmemiş.</p>
                            ) : (
                              groupTests.map((test) => (
                                <div
                                  key={test.id}
                                  className="flex items-center gap-2 rounded-md px-1.5 py-1 text-[12px] text-[#8b7666]"
                                >
                                  <span className="min-w-0 flex-1 truncate">
                                    {test.name} · s.{test.pageStart}
                                    {test.questionCount ? ` · ${test.questionCount} soru` : ''}
                                  </span>
                                  {showAnswerKey && test.hasAnswerKey ? (
                                    <button
                                      type="button"
                                      onClick={() => setAnswerKeyTest(test)}
                                      className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-[#b85f22] hover:bg-[#f6e6d2]"
                                    >
                                      <KeyRound size={12} aria-hidden="true" />
                                      Cevap Anahtarı
                                    </button>
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

              <div className="mt-3 flex items-center justify-between border-t border-[#eadbc8] pt-2 text-[11px] font-medium text-[#b49c84]">
                <span>techcoach kitaplık</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {answerKeyTest ? <AnswerKeyViewer test={answerKeyTest} onClose={() => setAnswerKeyTest(null)} /> : null}
    </div>
  )
}
