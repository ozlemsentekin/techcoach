import { useEffect, useMemo, useState } from 'react'
import { FileText, GraduationCap, Image as ImageIcon, User, Users } from 'lucide-react'
import PageHeader from '../layout/PageHeader'
import LoadingState from './LoadingState'
import EmptyState from './EmptyState'
import AnalysisPhotoViewer from './AnalysisPhotoViewer'
import AnalysisDetailModal from './AnalysisDetailModal'
import { addDaysISO, todayISODate } from '../../utils/time'
import { toDateKey } from './progressAnalytics'

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
    return new Date(value).toLocaleString('tr-TR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
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

// Sekmeler en çok analiz biriken dersten en aza doğru sıralanır (bkz. AnalysisPhotosPage'deki
// `subjects` useMemo) — "Tüm Dersler" sekmesi kasıtlı olarak yok: hiç analizi olmayan bir ders zaten
// listeye hiç girmiyor, bu yüzden ekstra bir "hepsi" görünümü katma değer taşımıyordu.
function SubjectTabs({ subjects, selectedSubject, onSelect }) {
  if (subjects.length === 0) return null
  return (
    <div className="flex gap-4 overflow-x-auto border-b border-panel-border" role="tablist" aria-label="Ders sekmeleri">
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

function IndicatorBadge({ icon: Icon, label, tone }) {
  const toneClasses = {
    sage: 'bg-panel-sage-soft text-panel-sage',
    blue: 'bg-panel-blue-soft text-panel-blue',
    lilac: 'bg-panel-lilac-soft text-panel-lilac',
    warm: 'bg-panel-warm-soft text-panel-warm',
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${toneClasses[tone]}`}>
      {Icon ? <Icon size={12} aria-hidden="true" /> : null}
      {label}
    </span>
  )
}

function AnalysisRow({ item, showStudentColumn, fetchQuestionPhoto, onShowQuestion, onShowDetail }) {
  const tag = publisherTagStyle(item.publisherName)
  const commentRoles = new Set((item.analysisComments || []).map((comment) => comment.role))

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-panel-border bg-panel-surface p-3.5 transition-colors hover:border-panel-blue/40 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {showStudentColumn && item.studentFullName ? (
            <span className="truncate text-xs font-semibold text-panel-text">{item.studentFullName}</span>
          ) : null}
          {item.publisherName ? (
            <span
              className={`inline-block max-w-full truncate rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${tag.bg} ${tag.text}`}
              title={item.publisherName}
            >
              {item.publisherName}
            </span>
          ) : null}
          {item.bookName ? (
            <span className="truncate text-xs text-panel-text-muted" title={item.bookName}>
              {item.bookName}
            </span>
          ) : null}
        </div>
        <div className="truncate text-sm font-semibold text-panel-text" title={item.topicName || item.topic || ''}>
          {item.topicName || item.topic || 'Genel'}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-panel-text-muted">
          <span>
            {[item.testName, item.questionNumber != null ? `Soru ${item.questionNumber}` : null].filter(Boolean).join(' · ') || '—'}
          </span>
          {item.lastActivityAt ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{formatAddedAt(item.lastActivityAt)}</span>
            </>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 sm:shrink-0 sm:justify-end sm:gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {commentRoles.has('ogrenci') ? <IndicatorBadge icon={User} label="Öğrenci" tone="sage" /> : null}
          {commentRoles.has('ebeveyn') ? <IndicatorBadge icon={Users} label="Veli" tone="warm" /> : null}
          {commentRoles.has('ogretmen') ? <IndicatorBadge icon={GraduationCap} label="Öğretmen" tone="blue" /> : null}
          {item.analysisPhotoCount > 0 ? (
            <IndicatorBadge icon={ImageIcon} label={String(item.analysisPhotoCount)} tone="lilac" />
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {fetchQuestionPhoto ? (
            <button
              type="button"
              onClick={onShowQuestion}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-panel-border px-3 py-1.5 text-xs font-semibold text-panel-text hover:bg-panel-surface-soft"
            >
              <FileText size={14} aria-hidden="true" />
              Soruyu Göster
            </button>
          ) : null}
          <button
            type="button"
            onClick={onShowDetail}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-full border-2 border-panel-blue px-3 py-1.5 text-xs font-bold text-panel-blue hover:bg-panel-blue-soft"
          >
            Analizi Gör
          </button>
        </div>
      </div>
    </div>
  )
}

// "Hata Analizlerim" menüsü: bir sorunun üzerinde biriken analiz yorumlarını (öğrenci/veli/öğretmen,
// N adet olabilir — bkz. mistakeAnalysis.js dosya başı yorumu) ve veli tarafından eklenen Hata
// Analiz görselini YayınEvi/Kaynak/İçerik/Test/Soru No kırılımıyla listeler. "Analizi Gör"
// AnalysisDetailModal'ı açar (doluysa yorum akışını + görseli gösterir, görsel için "Görseli
// Büyüt" AnalysisPhotoViewer'a devreder — slayt gibi gezinme + yazdırma, bkz. o dosya). Ekleme
// burada değil, Hata Defteri'nden yapılır (bu sayfa salt-görüntüleme). Öğrenci ve veli panelinde
// tek öğrenci bağlamında, öğretmen panelinde kendi kapsamındaki tüm öğrenciler için (bu yüzden
// showStudentColumn) kullanılır.
export default function AnalysisPhotosPage({
  fetchItems,
  fetchPhotos,
  fetchQuestionPhoto,
  showStudentColumn = false,
  title = 'Hata Analizlerim',
  subtitle = 'Öğrenci, veli ve öğretmen yorumlarına, eklenen hata analiz görsellerine buradan ulaşabilirsin.',
  headerActions,
  backSlot = null,
}) {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [openItem, setOpenItem] = useState(null)
  const [openQuestionItem, setOpenQuestionItem] = useState(null)
  const [openDetailItem, setOpenDetailItem] = useState(null)
  const [selectedRange, setSelectedRange] = useState('week7')
  const [selectedSubject, setSelectedSubject] = useState('')

  // AnalysisPhotoViewer birden fazla görsel bekliyor (slayt gibi gezinme için); asıl soru
  // fotoğrafı tek görsel olduğundan tek elemanlı bir dizi olarak sarmalanır — aynı bileşen hem
  // "Görseli Büyüt" hem "Soruyu Göster" için (slayt/yazdırma dahil) yeniden kullanılır.
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
    return items.filter((item) => inDateRange(toDateKey(item.lastActivityAt), selectedRange, today))
  }, [items, selectedRange, today])

  const subjects = useMemo(() => {
    const counts = new Map()
    dateFilteredItems.forEach((item) => {
      const label = item.subject || 'Genel'
      counts.set(label, (counts.get(label) || 0) + 1)
    })
    return Array.from(counts.entries())
      .map(([label, count]) => ({ key: label, label, count }))
      .sort((a, b) => b.count - a.count)
  }, [dateFilteredItems])

  // Seçili sekme tarih filtresi değişince listeden düşebilir (ör. "Bugün"e geçince o dersin hiç
  // kaydı kalmayabilir) — bu durumda geçerli bir seçim yokmuş gibi davranıp en çok analizi olan
  // derse (subjects zaten sayıya göre azalan sıralı) geri dönülür. Bir effect yerine türetilmiş bir
  // değer kullanmak, "geçersiz seçim" durumunun render sırasında ekstra bir render turu beklemeden
  // çözülmesini sağlar.
  const effectiveSubject = subjects.some((subject) => subject.key === selectedSubject)
    ? selectedSubject
    : subjects[0]?.key || ''

  const visibleItems = useMemo(() => {
    return dateFilteredItems.filter((item) => (item.subject || 'Genel') === effectiveSubject)
  }, [dateFilteredItems, effectiveSubject])

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
          description="Hata Defteri'nde bir soruya öğrenci notu, öğretmen analizi ya da Hata Analiz görseli eklendiğinde burada listelenecek."
        />
      ) : (
        <div className="flex flex-col gap-3">
          <SubjectTabs subjects={subjects} selectedSubject={effectiveSubject} onSelect={setSelectedSubject} />

          {visibleItems.length === 0 ? (
            <EmptyState
              icon={ImageIcon}
              title="Bu filtrede hata analizi yok"
              description="Seçili tarih aralığında veya derste bir analiz bulunamadı."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {visibleItems.map((item) => (
                <AnalysisRow
                  key={item.id}
                  item={item}
                  showStudentColumn={showStudentColumn}
                  fetchQuestionPhoto={fetchQuestionPhoto}
                  onShowQuestion={() => setOpenQuestionItem(item)}
                  onShowDetail={() => setOpenDetailItem(item)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {openDetailItem ? (
        <AnalysisDetailModal
          item={openDetailItem}
          onClose={() => setOpenDetailItem(null)}
          onShowPhotos={() => setOpenItem(openDetailItem)}
        />
      ) : null}

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
