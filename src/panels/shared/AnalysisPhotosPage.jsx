import { useEffect, useMemo, useState } from 'react'
import { FileText, Image as ImageIcon } from 'lucide-react'
import PageHeader from '../layout/PageHeader'
import LoadingState from './LoadingState'
import EmptyState from './EmptyState'
import AnalysisPhotoViewer from './AnalysisPhotoViewer'
import { addDaysISO, todayISODate } from '../../utils/time'
import { toDateKey } from './progressAnalytics'

const collator = new Intl.Collator('tr-TR')
const ALL_SUBJECTS = '__tum-dersler__'

const RANGE_FILTERS = [
  { id: 'today', label: 'Bugün' },
  { id: 'week7', label: 'Son 7 Gün' },
  { id: 'month30', label: 'Son 30 Gün' },
  { id: 'all', label: 'Tümü' },
]

// Yayınevi rozetleri: sabit bir yayınevi listesi olmadığından isim hash'lenip bu paletten
// döngüsel bir renk seçilir — aynı yayınevi her zaman aynı rengi alır, tema değişse de
// (panel-* tokenleri) uyumlu kalır.
const PUBLISHER_TAG_PALETTE = [
  { text: 'text-panel-blue', bg: 'bg-panel-blue-soft' },
  { text: 'text-panel-sage', bg: 'bg-panel-sage-soft' },
  { text: 'text-panel-lilac', bg: 'bg-panel-lilac-soft' },
  { text: 'text-panel-slate', bg: 'bg-panel-slate-soft' },
  { text: 'text-panel-accent', bg: 'bg-panel-accent-soft' },
  { text: 'text-panel-warm', bg: 'bg-panel-warm-soft' },
  { text: 'text-panel-yellow', bg: 'bg-panel-yellow-soft' },
  { text: 'text-panel-green', bg: 'bg-panel-green-soft' },
]

function publisherTagStyle(name) {
  if (!name) return { text: 'text-panel-text-muted', bg: 'bg-panel-surface-soft' }
  let hash = 0
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0
  }
  return PUBLISHER_TAG_PALETTE[Math.abs(hash) % PUBLISHER_TAG_PALETTE.length]
}

function formatAddedAt(value) {
  if (!value) return ''
  try {
    return new Date(value).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return ''
  }
}

function inDateRange(dateKey, rangeId, today) {
  if (!dateKey) return false
  if (rangeId === 'all') return true
  if (dateKey > today) return false
  if (rangeId === 'today') return dateKey === today
  if (rangeId === 'week7') return dateKey >= addDaysISO(today, -6)
  if (rangeId === 'month30') return dateKey >= addDaysISO(today, -29)
  return true
}

function RangeFilter({ selectedRange, onSelect }) {
  return (
    <div className="flex w-full gap-1 rounded-xl border border-panel-border bg-panel-surface-soft p-1 sm:w-auto">
      {RANGE_FILTERS.map((filter) => (
        <button
          key={filter.id}
          type="button"
          aria-pressed={selectedRange === filter.id}
          onClick={() => onSelect(filter.id)}
          className={`h-9 flex-1 rounded-lg px-2 text-xs font-bold transition-colors sm:flex-none sm:px-3 ${
            selectedRange === filter.id
              ? 'bg-panel-surface text-panel-text shadow-sm'
              : 'text-panel-text-muted hover:text-panel-text'
          }`}
        >
          {filter.label}
        </button>
      ))}
    </div>
  )
}

function SubjectTabs({ subjects, selectedSubject, onSelect }) {
  if (subjects.length === 0) return null
  const totalCount = subjects.reduce((sum, subject) => sum + subject.count, 0)
  return (
    <div className="flex gap-4 overflow-x-auto border-b border-panel-border" role="tablist" aria-label="Ders sekmeleri">
      <button
        type="button"
        role="tab"
        aria-selected={selectedSubject === ALL_SUBJECTS}
        onClick={() => onSelect(ALL_SUBJECTS)}
        className={`shrink-0 whitespace-nowrap border-b-2 px-1 pb-2.5 text-sm font-semibold transition-colors ${
          selectedSubject === ALL_SUBJECTS
            ? 'border-panel-blue text-panel-blue'
            : 'border-transparent text-panel-text-muted hover:text-panel-text'
        }`}
      >
        Tüm Dersler <span className="opacity-60">({totalCount})</span>
      </button>
      {subjects.map((subject) => (
        <button
          key={subject.key}
          type="button"
          role="tab"
          aria-selected={selectedSubject === subject.key}
          onClick={() => onSelect(subject.key)}
          className={`shrink-0 whitespace-nowrap border-b-2 px-1 pb-2.5 text-sm font-semibold transition-colors ${
            selectedSubject === subject.key
              ? 'border-panel-blue text-panel-blue'
              : 'border-transparent text-panel-text-muted hover:text-panel-text'
          }`}
        >
          {subject.label} <span className="opacity-60">({subject.count})</span>
        </button>
      ))}
    </div>
  )
}

// "Hata Analizlerim" menüsü: veli tarafından eklenmiş Hata Analiz görsellerini YayınEvi/Kaynak/
// İçerik/Test/Soru No tablosunda listeler; "Analizi Göster" AnalysisPhotoViewer'ı açar (slayt gibi
// gezinme + yazdırma — bkz. o dosyadaki yorum). Ekleme/kaldırma burada değil, Hata Defteri'nden
// yapılır (bu sayfa salt-görüntüleme). Öğrenci ve veli panelinde tek öğrenci bağlamında, öğretmen
// panelinde kendi kapsamındaki tüm öğrenciler için (bu yüzden showStudentColumn) kullanılır.
export default function AnalysisPhotosPage({
  fetchItems,
  fetchPhotos,
  fetchQuestionPhoto,
  showStudentColumn = false,
  title = 'Hata Analizlerim',
  subtitle = 'Eklenen hata analiz görsellerine buradan ulaşabilirsin.',
  headerActions,
  backSlot = null,
}) {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [openItem, setOpenItem] = useState(null)
  const [openQuestionItem, setOpenQuestionItem] = useState(null)
  const [selectedRange, setSelectedRange] = useState('week7')
  const [selectedSubject, setSelectedSubject] = useState(ALL_SUBJECTS)

  // AnalysisPhotoViewer birden fazla görsel bekliyor (slayt gibi gezinme için); asıl soru
  // fotoğrafı tek görsel olduğundan tek elemanlı bir dizi olarak sarmalanır — aynı bileşen hem
  // "Analizi Göster" hem "Soruyu Göster" için (slayt/yazdırma dahil) yeniden kullanılır.
  const fetchQuestionPhotos = fetchQuestionPhoto
    ? async (id) => {
        const url = await fetchQuestionPhoto(id)
        return url ? [{ id, photoUrl: url }] : []
      }
    : undefined

  useEffect(() => {
    let ignore = false
    fetchItems()
      .then((data) => {
        if (ignore) return
        setError('')
        setItems(data)
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })
    return () => {
      ignore = true
    }
  }, [fetchItems])

  const today = todayISODate()

  const dateFilteredItems = useMemo(() => {
    if (!items) return []
    return items.filter((item) => inDateRange(toDateKey(item.analysisPhotoAddedAt), selectedRange, today))
  }, [items, selectedRange, today])

  const subjects = useMemo(() => {
    const counts = new Map()
    dateFilteredItems.forEach((item) => {
      const label = item.subject || 'Genel'
      counts.set(label, (counts.get(label) || 0) + 1)
    })
    return Array.from(counts.entries())
      .map(([label, count]) => ({ key: label, label, count }))
      .sort((a, b) => collator.compare(a.label, b.label))
  }, [dateFilteredItems])

  const visibleItems = useMemo(() => {
    if (selectedSubject === ALL_SUBJECTS) return dateFilteredItems
    return dateFilteredItems.filter((item) => (item.subject || 'Genel') === selectedSubject)
  }, [dateFilteredItems, selectedSubject])

  return (
    <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
      {backSlot ? <div>{backSlot}</div> : null}
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {headerActions}
            <RangeFilter selectedRange={selectedRange} onSelect={setSelectedRange} />
          </div>
        }
      />

      {error ? (
        <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{error}</div>
      ) : items === null ? (
        <LoadingState label="Hata analizleri yükleniyor..." />
      ) : items.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="Henüz hata analizi yok"
          description="Hata Defteri'nde bir soruya Hata Analiz görseli eklendiğinde burada listelenecek."
        />
      ) : (
        <div className="flex flex-col gap-3">
          <SubjectTabs subjects={subjects} selectedSubject={selectedSubject} onSelect={setSelectedSubject} />

          {visibleItems.length === 0 ? (
            <EmptyState
              icon={ImageIcon}
              title="Bu filtrede hata analizi yok"
              description="Seçili tarih aralığında veya derste eklenmiş hata analiz görseli bulunamadı."
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-panel-border bg-panel-surface">
              <table className="w-full min-w-[640px] table-fixed border-collapse text-left text-xs">
                <colgroup>
                  {showStudentColumn ? <col className="w-[110px]" /> : null}
                  <col className="w-[130px]" />
                  <col className="w-[220px]" />
                  <col className="w-[220px]" />
                  <col className="w-[70px]" />
                  <col className="w-[60px]" />
                  <col className="w-[100px]" />
                  <col className="w-[210px]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-panel-border bg-panel-surface-soft text-[11px] font-semibold uppercase tracking-wide text-panel-text-muted">
                    {showStudentColumn ? <th className="whitespace-nowrap px-3 py-2.5">Öğrenci</th> : null}
                    <th className="whitespace-nowrap px-3 py-2.5">Yayın Evi</th>
                    <th className="whitespace-nowrap px-3 py-2.5">Kaynak</th>
                    <th className="whitespace-nowrap px-3 py-2.5">İçerik Adı</th>
                    <th className="whitespace-nowrap px-3 py-2.5">Test Adı</th>
                    <th className="whitespace-nowrap px-3 py-2.5">Soru No</th>
                    <th className="whitespace-nowrap px-3 py-2.5">Son Ekleme</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.map((item) => {
                    const tag = publisherTagStyle(item.publisherName)
                    return (
                <tr key={item.id} className="border-b border-panel-border last:border-0 hover:bg-panel-surface-soft">
                  {showStudentColumn ? (
                    <td className="truncate px-3 py-2.5 font-medium text-panel-text" title={item.studentFullName || ''}>
                      {item.studentFullName || '—'}
                    </td>
                  ) : null}
                  <td className="px-3 py-2.5">
                    {item.publisherName ? (
                      <span
                        className={`inline-block max-w-full truncate rounded-full px-2.5 py-1 text-[11px] font-semibold ${tag.bg} ${tag.text}`}
                        title={item.publisherName}
                      >
                        {item.publisherName}
                      </span>
                    ) : (
                      <span className="text-panel-text-muted">—</span>
                    )}
                  </td>
                  <td className="truncate px-3 py-2.5 text-panel-text-muted" title={item.bookName || ''}>
                    {item.bookName || '—'}
                  </td>
                  <td className="truncate px-3 py-2.5 text-panel-text-muted" title={item.topicName || item.topic || ''}>
                    {item.topicName || item.topic || '—'}
                  </td>
                  <td className="truncate px-3 py-2.5 text-panel-text-muted">{item.testName || '—'}</td>
                  <td className="truncate px-3 py-2.5 text-panel-text-muted">{item.questionNumber ?? '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-panel-text-muted">{formatAddedAt(item.analysisPhotoAddedAt)}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {fetchQuestionPhoto ? (
                        <button
                          type="button"
                          onClick={() => setOpenQuestionItem(item)}
                          className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-panel-border px-3 py-1.5 text-xs font-semibold text-panel-text hover:bg-panel-surface-soft"
                        >
                          <FileText size={14} aria-hidden="true" />
                          Soruyu Göster
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setOpenItem(item)}
                        className="flex items-center gap-1.5 whitespace-nowrap rounded-full border-2 border-panel-blue px-3 py-1.5 text-xs font-bold text-panel-blue hover:bg-panel-blue-soft"
                      >
                        <ImageIcon size={14} aria-hidden="true" />
                        Analizi Göster{item.analysisPhotoCount > 1 ? ` (${item.analysisPhotoCount})` : ''}
                      </button>
                    </div>
                  </td>
                </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {openItem ? (
        <AnalysisPhotoViewer
          wrongQuestionId={openItem.id}
          fetchPhotos={fetchPhotos}
          contextLabel={[
            openItem.publisherName,
            openItem.testName || openItem.topic,
            openItem.questionNumber != null ? `Soru ${openItem.questionNumber}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
          onClose={() => setOpenItem(null)}
        />
      ) : null}

      {openQuestionItem ? (
        <AnalysisPhotoViewer
          wrongQuestionId={openQuestionItem.id}
          fetchPhotos={fetchQuestionPhotos}
          title="Soru"
          pdfFileNamePrefix="hata-defteri-soru"
          contextLabel={[
            openQuestionItem.publisherName,
            openQuestionItem.testName || openQuestionItem.topic,
            openQuestionItem.questionNumber != null ? `Soru ${openQuestionItem.questionNumber}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
          onClose={() => setOpenQuestionItem(null)}
        />
      ) : null}
    </div>
  )
}
