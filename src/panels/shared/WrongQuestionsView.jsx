import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, ArrowLeft, BookOpen, ChevronDown, ChevronRight, Download, Layers, Loader2, Search, Tag } from 'lucide-react'
import PageHeader from '../layout/PageHeader'
import LoadingState from './LoadingState'
import EmptyState from './EmptyState'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import { cn } from '../ui/utils'
import WrongQuestionGalleryModal from './WrongQuestionGalleryModal'
import { ResourceBookAvatar } from './ResourceBookCard'
import { RATE_TONES, successRateTone } from './rateTones'

const NO_BOOK_KEY = '__kaynaksiz__'
const sourceKeyFor = (bookName) => bookName || NO_BOOK_KEY

const SHELF_TONES = [
  { icon: 'bg-panel-blue-soft text-panel-blue', hoverBorder: 'hover:border-panel-blue' },
  { icon: 'bg-panel-lilac-soft text-panel-lilac', hoverBorder: 'hover:border-panel-lilac' },
  { icon: 'bg-panel-sage-soft text-panel-sage', hoverBorder: 'hover:border-panel-sage' },
  { icon: 'bg-panel-accent-soft text-panel-warm', hoverBorder: 'hover:border-panel-warm' },
  { icon: 'bg-panel-slate-soft text-panel-slate', hoverBorder: 'hover:border-panel-slate' },
]

function topicStatsKey(subject, topic) {
  return `${(subject || '').trim()}::${(topic || '').trim()}`
}

function sourceStatsKey(subject, topic, bookName) {
  return `${topicStatsKey(subject, topic)}::${bookName || ''}`
}

// Bir kaynağın (kitabın) tüm konularındaki çözülmüş soruları toplamak için ders + kitap kimliği.
function sourceBookKey(subject, bookName) {
  return `${(subject || '').trim()}::${bookName || ''}`
}

function groupBySubjectAndTopic(wrongQuestions) {
  const bySubject = new Map()
  wrongQuestions.forEach((item) => {
    if (!bySubject.has(item.subject)) {
      bySubject.set(item.subject, { subject: item.subject, items: [], topicsByKey: new Map() })
    }
    const subjectGroup = bySubject.get(item.subject)
    subjectGroup.items.push(item)

    // "İçerik Grubuna Göre" sekmesi gerçek konu adına (topic) göre gruplar — farklı kitapların
    // testleri aynı konuyu işliyorsa (ör. "1. Ünite - Çarpanlar, Katlar ve Üslü İfadeler") tek
    // kartta birleşmesi beklenen davranıştır. Kitap bazlı, kararlı kimlikli gruplama zaten ayrı
    // "Kaynağa Göre" sekmesinde (bkz. groupBySubjectAndSource) sunuluyor; bookName'i burada
    // önceliklendirmek iki sekmeyi aynılaştırır ve bu fonksiyona daha önce yanlışlıkla eklenmişti.
    const topicKey = item.topic || item.bookName || ''
    if (!subjectGroup.topicsByKey.has(topicKey)) {
      subjectGroup.topicsByKey.set(topicKey, { topic: item.topic || item.bookName || null, items: [] })
    }
    subjectGroup.topicsByKey.get(topicKey).items.push(item)
  })

  return Array.from(bySubject.values())
    .map((group) => ({
      subject: group.subject,
      items: group.items,
      topics: Array.from(group.topicsByKey.values()).sort((a, b) => b.items.length - a.items.length),
    }))
    .sort((a, b) => b.items.length - a.items.length)
}

// bookName tests arası kararlı bir kimlik: aynı kitabın testleri zaman içinde farklı ifadelerle
// konu adı almış olabilir. "Kaynağa göre" görünüm bu yüzden birincil olarak bookName'e göre
// gruplar (bookName olmayan eski manuel kayıtlar tek bir "Kaynaksız" grubunda toplanır) ve her
// kaynağın altında konulara göre alt kırılım sunar.
// bookImages, sunucunun her satırda tekrar tekrar döndürmediği kapak fotoğraflarının kitap
// adına göre haritası (bkz. wrongQuestionService.js'deki WrongQuestionsResponse yorumu) —
// aynı ~140KB'lık base64 görüntünün yüzlerce soru satırında kopyalanmasını önler.
function groupBySubjectAndSource(wrongQuestions, bookImages) {
  const bySubject = new Map()
  wrongQuestions.forEach((item) => {
    if (!bySubject.has(item.subject)) {
      bySubject.set(item.subject, { subject: item.subject, items: [], sourcesByKey: new Map() })
    }
    const subjectGroup = bySubject.get(item.subject)
    subjectGroup.items.push(item)

    const sourceKey = sourceKeyFor(item.bookName)
    if (!subjectGroup.sourcesByKey.has(sourceKey)) {
      subjectGroup.sourcesByKey.set(sourceKey, {
        bookName: item.bookName || null,
        publisherName: item.publisherName || null,
        bookImageUrl: (item.bookName && bookImages?.[item.bookName]) || null,
        items: [],
        topicsByKey: new Map(),
      })
    }
    const sourceGroup = subjectGroup.sourcesByKey.get(sourceKey)
    sourceGroup.items.push(item)

    const topicKey = item.topic || ''
    if (!sourceGroup.topicsByKey.has(topicKey)) {
      sourceGroup.topicsByKey.set(topicKey, { topic: item.topic || null, items: [] })
    }
    sourceGroup.topicsByKey.get(topicKey).items.push(item)
  })

  return Array.from(bySubject.values()).map((group) => ({
    subject: group.subject,
    items: group.items,
    sources: Array.from(group.sourcesByKey.values())
      .map((source) => ({
        ...source,
        topics: Array.from(source.topicsByKey.values()).sort((a, b) => b.items.length - a.items.length),
      }))
      .sort((a, b) => {
        const publisherCompare = (a.publisherName || '').localeCompare(b.publisherName || '', 'tr')
        if (publisherCompare !== 0) return publisherCompare
        return (a.bookName || '').localeCompare(b.bookName || '', 'tr')
      }),
  }))
}

function SubjectShelfCard({ subject, count, tone, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex items-center gap-4 rounded-2xl border border-panel-border bg-panel-surface p-5 text-left shadow-panel-1 transition-all hover:-translate-y-0.5 hover:shadow-panel-2 ${tone.hoverBorder}`}
    >
      <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${tone.icon}`}>
        <BookOpen size={24} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-base font-bold text-panel-text">{subject}</h3>
        <p className="mt-0.5 text-sm text-panel-text-muted">{count} soru</p>
      </div>
      <ChevronRight
        size={18}
        className="shrink-0 text-panel-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-panel-text"
        aria-hidden="true"
      />
    </button>
  )
}

function ContentTopicCard({ topic, wrongCount, stats, scopeLabel, onClick }) {
  const successPercent = stats?.successRate != null ? Math.round(stats.successRate * 100) : null
  const colors = RATE_TONES[successRateTone(stats?.successRate)]
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col gap-3 rounded-2xl border border-panel-border bg-panel-surface p-4 text-left shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-panel-blue-soft text-panel-blue">
            <Layers size={16} aria-hidden="true" />
          </span>
          <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-snug text-panel-text">
            {topic || 'Genel'}
          </h3>
        </div>
        <Badge tone="warm" className="shrink-0">
          {wrongCount} yanlış
        </Badge>
      </div>

      <div className={cn('rounded-lg px-2 py-1.5', colors.chip)}>
        <div className="flex items-center justify-between gap-2">
          <span className={cn('text-[11px] font-semibold', colors.text)}>Başarı Oranı</span>
          <span className={cn('text-sm font-bold tabular-nums', colors.text)}>
            {successPercent != null ? `%${successPercent}` : '—'}
          </span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/70">
          <div
            className={cn('h-full rounded-full transition-all', colors.bar)}
            style={{ width: `${successPercent ?? 0}%` }}
          />
        </div>
      </div>

      {stats && stats.totalAnswered > 0 ? (
        <p className="text-xs text-panel-text-muted">
          {stats.totalAnswered} soru çözüldü{scopeLabel ? ` (${scopeLabel})` : ''}
        </p>
      ) : null}
    </button>
  )
}

const GROUP_MODE_OPTIONS = [
  { value: 'topic', label: 'İçerik Grubuna Göre' },
  { value: 'source', label: 'Kaynağa Göre' },
]

function GroupModeToggle({ mode, onChange }) {
  return (
    <div className="inline-flex w-full gap-1 rounded-full border border-panel-border bg-panel-surface-soft p-1 sm:w-fit">
      {GROUP_MODE_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`flex-1 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors sm:flex-none ${
            mode === option.value
              ? 'bg-panel-surface text-panel-blue shadow-panel-1'
              : 'text-panel-text-muted hover:text-panel-text'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function SourceProfileCard({ bookName, publisherName, bookImageUrl, wrongCount, stats, onClick }) {
  const solvedCount = stats?.totalAnswered ?? null
  const successPercent = stats?.successRate != null ? Math.round(stats.successRate * 100) : null
  const colors = RATE_TONES[successRateTone(stats?.successRate)]
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col gap-3 rounded-2xl border border-panel-border bg-panel-surface p-4 text-left shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md"
    >
      <span className="inline-flex w-fit items-center gap-1 rounded-full bg-panel-slate-soft px-2.5 py-1 text-[11px] font-semibold text-panel-slate">
        <Tag size={11} aria-hidden="true" />
        {publisherName || 'Yayın evi belirtilmemiş'}
      </span>
      <div className="flex items-center gap-3">
        <ResourceBookAvatar book={{ name: bookName, imageUrl: bookImageUrl }} size="md" />
        <h3 className="line-clamp-2 min-w-0 flex-1 text-sm font-bold leading-snug text-panel-text">
          {bookName || 'Kaynak belirtilmemiş'}
        </h3>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone="warm" className="w-fit">
          {solvedCount != null ? `${solvedCount} / ${wrongCount}` : wrongCount} yanlış
        </Badge>
        {successPercent != null ? (
          <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', colors.chip)}>
            (%{successPercent} başarı)
          </span>
        ) : null}
      </div>
    </button>
  )
}

function TopicAccordionHeader({ topic, wrongCount, stats, isOpen, onToggle }) {
  const successPercent = stats?.successRate != null ? Math.round(stats.successRate * 100) : null
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      className="flex w-full items-center gap-3 rounded-2xl border border-panel-border bg-panel-surface px-4 py-3 text-left shadow-sm transition-colors hover:border-panel-blue"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-panel-blue-soft text-panel-blue">
        <Layers size={16} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-semibold text-panel-text">{topic || 'Genel'}</h3>
        {stats && stats.totalAnswered > 0 ? (
          <p className="text-xs text-panel-text-muted">
            %{successPercent ?? 0} başarı · {stats.totalAnswered} soru çözüldü
          </p>
        ) : null}
      </div>
      <Badge tone="warm" className="shrink-0">
        {wrongCount} yanlış
      </Badge>
      <ChevronDown
        size={18}
        className={cn('shrink-0 text-panel-text-muted transition-transform', isOpen && 'rotate-180')}
        aria-hidden="true"
      />
    </button>
  )
}

// Kaynak içindeki tüm soruları küçük resimlerle ızgara halinde gösteren tekil kart. Fotoğraf,
// bileşen mount olduğunda (yani içerik grubu açıldığında) tembel çekilir; kapalı gruplar hiç
// mount edilmediği için fotoğraf istemez — WrongQuestionGalleryModal'daki tembel yükleme deseniyle
// aynı fikir, tek farkı burada tüm grup için paralel çalışır.
function WrongQuestionThumbnail({ item, fetchPhoto, onClick }) {
  const [photoUrl, setPhotoUrl] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false
    fetchPhoto(item.id)
      .then((url) => {
        if (!ignore) setPhotoUrl(url)
      })
      .catch((err) => {
        if (!ignore) setError(err.message || 'Fotoğraf yüklenemedi.')
      })
    return () => {
      ignore = true
    }
  }, [item.id, fetchPhoto])

  // topic (içerik grubu) zaten akordeon başlığında gösteriliyor; burada tekrar etmemek için
  // başlıkta sadece test adı ve soru numarası yer alır (bkz. kullanıcı isteği).
  const caption = `${item.testName || 'Test'} - Soru No: ${
    item.questionNumber != null && item.questionNumber !== '' ? item.questionNumber : '-'
  }`

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col overflow-hidden rounded-xl border border-panel-border bg-panel-surface text-left shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md"
    >
      <p className="line-clamp-2 px-2 py-1.5 text-[11px] font-medium leading-snug text-panel-text" title={caption}>
        {caption}
      </p>
      <div className="flex aspect-square w-full items-center justify-center overflow-hidden bg-panel-surface-soft">
        {photoUrl ? (
          <img
            loading="lazy"
            decoding="async"
            src={photoUrl}
            alt={caption}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : error ? (
          <AlertCircle size={20} className="text-panel-text-muted" aria-hidden="true" />
        ) : (
          <Loader2 size={20} className="animate-spin text-panel-text-muted" aria-hidden="true" />
        )}
      </div>
    </button>
  )
}

// Bir kaynağa (kitaba) tıklandığında açılan ekran: içerik gruplarına (konulara) göre kapalı
// gelen akordeonlar ve her grubun altında tüm sorulara ait fotoğrafların ızgara görünümü. Test
// adı/konuya göre arama, eşleşen gruplardaki soruları otomatik açar.
function SourceQuestionBoard({ subject, topics, statsForTopic, fetchPhoto, onSelectItem }) {
  const [query, setQuery] = useState('')
  const [expandedKeys, setExpandedKeys] = useState(() => new Set())

  const normalizedQuery = query.trim().toLocaleLowerCase('tr')

  const filteredTopics = useMemo(() => {
    if (!normalizedQuery) return topics
    return topics
      .map((topicGroup) => ({
        ...topicGroup,
        items: topicGroup.items.filter(
          (item) =>
            (item.testName || '').toLocaleLowerCase('tr').includes(normalizedQuery) ||
            (item.topic || '').toLocaleLowerCase('tr').includes(normalizedQuery),
        ),
      }))
      .filter((topicGroup) => topicGroup.items.length > 0)
  }, [topics, normalizedQuery])

  const toggleTopic = (key) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="fade-slide-in flex flex-col gap-3">
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-panel-text-muted"
          aria-hidden="true"
        />
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Test adı veya konuya göre ara..."
          className="w-full rounded-full border border-panel-border bg-panel-surface py-2 pl-9 pr-4 text-sm text-panel-text placeholder:text-panel-text-muted focus:border-panel-blue focus:outline-none"
        />
      </div>

      {filteredTopics.length === 0 ? (
        <p className="rounded-xl border border-dashed border-panel-border px-4 py-6 text-center text-sm text-panel-text-muted">
          Aramayla eşleşen soru bulunamadı.
        </p>
      ) : (
        filteredTopics.map((topicGroup) => {
          const key = topicStatsKey(subject, topicGroup.topic)
          const isOpen = Boolean(normalizedQuery) || expandedKeys.has(key)
          return (
            <div key={key} className="flex flex-col gap-2">
              <TopicAccordionHeader
                topic={topicGroup.topic}
                wrongCount={topicGroup.items.length}
                stats={statsForTopic(topicGroup.topic)}
                isOpen={isOpen}
                onToggle={() => toggleTopic(key)}
              />
              {isOpen ? (
                <div className="grid grid-cols-2 gap-2 px-1 min-[480px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {topicGroup.items.map((item, itemIndex) => (
                    <WrongQuestionThumbnail
                      key={item.id}
                      item={item}
                      fetchPhoto={fetchPhoto}
                      onClick={() => onSelectItem(topicGroup.items, itemIndex)}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          )
        })
      )}
    </div>
  )
}

// Aktif kaynaktaki (kitaptaki) tüm fotoğraflı yanlışları konu başlıklarıyla gruplayıp tek bir PDF'e
// gömer. Fotoğraflar tembel çekildiği için (bkz. WrongQuestionThumbnail) burada da aynı fetchPhoto
// ile sırayla indirilir; ilerleme durumu buton üzerinde "n/toplam" olarak gösterilir.
function SourcePdfExportButton({ subject, source, fetchPhoto }) {
  const [status, setStatus] = useState('idle')
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [error, setError] = useState('')

  const handleExport = async () => {
    if (status === 'loading') return
    setStatus('loading')
    setError('')
    setProgress({ done: 0, total: 0 })
    try {
      const [{ buildWrongQuestionsPdf, buildWrongQuestionsPdfFileName }, { savePdfDocument }] = await Promise.all([
        import('../../utils/wrongQuestionsPdf'),
        import('../../utils/savePdfDocument'),
      ])
      const doc = await buildWrongQuestionsPdf({
        subject,
        source,
        fetchPhoto,
        onProgress: (done, total) => setProgress({ done, total }),
      })
      await savePdfDocument(doc, buildWrongQuestionsPdfFileName(source.bookName))
    } catch (err) {
      setError(err.message || 'PDF oluşturulamadı.')
    } finally {
      setStatus('idle')
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="secondary" onClick={handleExport} disabled={status === 'loading'}>
        {status === 'loading' ? (
          <>
            <Loader2 size={15} className="animate-spin" aria-hidden="true" />
            {progress.total ? `PDF hazırlanıyor (${progress.done}/${progress.total})` : 'PDF hazırlanıyor...'}
          </>
        ) : (
          <>
            <Download size={15} aria-hidden="true" />
            PDF Olarak İndir
          </>
        )}
      </Button>
      {error ? <span className="max-w-[220px] text-right text-xs text-panel-warm">{error}</span> : null}
    </div>
  )
}

// Öğrenci/veli/öğretmen panellerinin ortak Hata Defteri görünümü: ders kartları -> içerik (konu)
// kartları -> fotoğraf galerisi + Dikkat Hatası/Bilgi Eksikliği etiketleme. Kimin verisini
// gösterdiği tamamen fetchWrongQuestions/fetchTopicStats/updateMistakeReason prop'larıyla
// belirlenir (bkz. StudentProgressView.jsx'teki aynı "fetchOverview prop olarak" deseni).
export default function WrongQuestionsView({
  fetchWrongQuestions,
  fetchTopicStats,
  fetchPhoto,
  updateMistakeReason,
  updateMistakeMeta,
  title = 'Hata Defterim',
  subtitle = 'Fotoğrafını çektiğin yanlış sorular ders ders burada.',
  headerActions,
  hideHeaderWhenUnselected = false,
}) {
  const [wrongQuestions, setWrongQuestions] = useState(null)
  const [bookImages, setBookImages] = useState({})
  const [topicStats, setTopicStats] = useState([])
  const [sourceTopicStats, setSourceTopicStats] = useState([])
  const [error, setError] = useState('')
  const [selectedSubject, setSelectedSubject] = useState(null)
  const [groupMode, setGroupMode] = useState('source')
  const [selectedSourceKey, setSelectedSourceKey] = useState(null)
  const [galleryTopicKey, setGalleryTopicKey] = useState(null)
  const [sourceGallerySelection, setSourceGallerySelection] = useState(null)

  useEffect(() => {
    let ignore = false

    fetchWrongQuestions()
      .then((data) => {
        if (ignore) return
        setError('')
        setWrongQuestions(data.wrongQuestions)
        setBookImages(data.bookImages || {})
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })

    fetchTopicStats()
      .then((statsData) => {
        if (ignore) return
        setTopicStats(statsData?.topicStats || [])
        setSourceTopicStats(statsData?.sourceTopicStats || [])
      })
      .catch(() => {
        if (ignore) return
        setTopicStats([])
        setSourceTopicStats([])
      })

    return () => {
      ignore = true
    }
  }, [fetchWrongQuestions, fetchTopicStats])

  const photoQuestions = useMemo(
    () => (wrongQuestions ? wrongQuestions.filter((item) => item.hasPhoto) : []),
    [wrongQuestions],
  )

  const contentGroups = useMemo(() => groupBySubjectAndTopic(photoQuestions), [photoQuestions])
  const sourceGroups = useMemo(() => groupBySubjectAndSource(photoQuestions, bookImages), [photoQuestions, bookImages])
  const hasSingleSubject = contentGroups.length === 1

  // Tek ders varsa (ör. öğretmen-öğrenci ilişkisi zaten tek derse özgü), ders seçim
  // ekranını atlayıp doğrudan o dersin içeriğini gösteriyoruz.
  const effectiveSelectedSubject = selectedSubject ?? (hasSingleSubject ? contentGroups[0].subject : null)

  const selectedContentGroup = contentGroups.find((group) => group.subject === effectiveSelectedSubject) || null
  const selectedSourceGroup = sourceGroups.find((group) => group.subject === effectiveSelectedSubject) || null
  const activeSource =
    groupMode === 'source' && selectedSourceKey
      ? selectedSourceGroup?.sources.find((source) => sourceKeyFor(source.bookName) === selectedSourceKey) || null
      : null

  const topicStatsMap = useMemo(() => {
    const map = new Map()
    topicStats.forEach((stat) => map.set(topicStatsKey(stat.subject, stat.topic), stat))
    return map
  }, [topicStats])

  const sourceTopicStatsMap = useMemo(() => {
    const map = new Map()
    sourceTopicStats.forEach((stat) => map.set(sourceStatsKey(stat.subject, stat.topic, stat.bookName), stat))
    return map
  }, [sourceTopicStats])

  // "Kaynağa Göre" kartlarında, o kaynağın tüm konularından çözülen toplam soru sayısını ve
  // birleşik başarı oranını göstermek için (ders, konu, kitap) kırılımını kitap düzeyinde toplar.
  const sourceBookStatsMap = useMemo(() => {
    const map = new Map()
    sourceTopicStats.forEach((stat) => {
      const key = sourceBookKey(stat.subject, stat.bookName)
      if (!map.has(key)) map.set(key, { totalAnswered: 0, correct: 0 })
      const entry = map.get(key)
      entry.totalAnswered += stat.totalAnswered || 0
      if (stat.successRate != null && stat.totalAnswered) {
        entry.correct += stat.successRate * stat.totalAnswered
      }
    })
    return new Map(
      Array.from(map.entries()).map(([key, entry]) => [
        key,
        {
          totalAnswered: entry.totalAnswered,
          successRate: entry.totalAnswered > 0 ? entry.correct / entry.totalAnswered : null,
        },
      ]),
    )
  }, [sourceTopicStats])

  const activeTopics = !activeSource && groupMode === 'topic' ? selectedContentGroup?.topics : null
  const galleryTopicGroup = activeTopics?.find(
    (topicGroup) => topicStatsKey(effectiveSelectedSubject, topicGroup.topic) === galleryTopicKey,
  )

  const handleSelectSubject = (subject) => {
    setSelectedSubject(subject)
    setSelectedSourceKey(null)
  }

  const handleBackToSubjects = () => {
    setSelectedSubject(null)
    setSelectedSourceKey(null)
  }

  const handleChangeGroupMode = (mode) => {
    setGroupMode(mode)
    setSelectedSourceKey(null)
  }

  const handleUpdateMistakeReason = async (wrongQuestionId, mistakeReason) => {
    const updated = await updateMistakeReason(wrongQuestionId, mistakeReason)
    setWrongQuestions((prev) =>
      prev ? prev.map((item) => (item.id === wrongQuestionId ? { ...item, mistakeReason: updated.mistakeReason } : item)) : prev,
    )
  }

  const handleUpdateMistakeMeta = updateMistakeMeta
    ? async (wrongQuestionId, updates) => {
        const updated = await updateMistakeMeta(wrongQuestionId, updates)
        setWrongQuestions((prev) =>
          prev
            ? prev.map((item) => {
                if (item.id !== wrongQuestionId) return item
                const next = { ...item }
                if ('topic' in updates) next.topic = updated.topic || undefined
                if ('studentNote' in updates) next.studentNote = updated.studentNote || undefined
                return next
              })
            : prev,
        )
      }
    : undefined

  return (
    <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
      {activeSource ? (
        <PageHeader
          title={activeSource.bookName || 'Kaynak belirtilmemiş'}
          subtitle={`${activeSource.publisherName || 'Yayın evi belirtilmemiş'} · ${activeSource.items.length} yanlış soru`}
          actions={
            <div className="flex items-center gap-2">
              {headerActions}
              <SourcePdfExportButton subject={effectiveSelectedSubject} source={activeSource} fetchPhoto={fetchPhoto} />
              <Button variant="secondary" onClick={() => setSelectedSourceKey(null)}>
                <ArrowLeft size={15} aria-hidden="true" />
                Kaynaklara Dön
              </Button>
            </div>
          }
        />
      ) : effectiveSelectedSubject ? (
        <PageHeader
          title={effectiveSelectedSubject}
          subtitle={`${selectedContentGroup?.items.length ?? 0} yanlış soru`}
          actions={
            <div className="flex items-center gap-2">
              {headerActions}
              {hasSingleSubject ? null : (
                <Button variant="secondary" onClick={handleBackToSubjects}>
                  <ArrowLeft size={15} aria-hidden="true" />
                  Derslere Dön
                </Button>
              )}
            </div>
          }
        />
      ) : hideHeaderWhenUnselected ? (
        headerActions ? <div className="flex justify-end">{headerActions}</div> : null
      ) : (
        <PageHeader title={title} subtitle={subtitle} actions={headerActions} />
      )}

      {error ? (
        <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{error}</div>
      ) : wrongQuestions === null ? (
        <LoadingState label="Hata defteri yükleniyor..." />
      ) : contentGroups.length === 0 ? (
        <EmptyState
          icon={AlertCircle}
          title="Henüz fotoğraflanmış yanlış yok"
          description="Cevap kağıdında yanlış işaretlenen bir soruya tıklayıp fotoğrafını eklediğinde burada görünecek."
        />
      ) : activeSource ? (
        <SourceQuestionBoard
          subject={effectiveSelectedSubject}
          topics={activeSource.topics}
          statsForTopic={(topic) =>
            sourceTopicStatsMap.get(sourceStatsKey(effectiveSelectedSubject, topic, activeSource.bookName))
          }
          fetchPhoto={fetchPhoto}
          onSelectItem={(items, index) => setSourceGallerySelection({ items, index })}
        />
      ) : effectiveSelectedSubject ? (
        <div className="flex flex-col gap-4">
          <GroupModeToggle mode={groupMode} onChange={handleChangeGroupMode} />
          {groupMode === 'source' ? (
            <div
              className="fade-slide-in grid grid-cols-1 gap-3 min-[520px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
            >
              {selectedSourceGroup?.sources.map((source) => (
                <SourceProfileCard
                  key={sourceKeyFor(source.bookName)}
                  bookName={source.bookName}
                  publisherName={source.publisherName}
                  bookImageUrl={source.bookImageUrl}
                  wrongCount={source.items.length}
                  stats={sourceBookStatsMap.get(sourceBookKey(effectiveSelectedSubject, source.bookName))}
                  onClick={() => setSelectedSourceKey(sourceKeyFor(source.bookName))}
                />
              ))}
            </div>
          ) : (
            <div
              className="fade-slide-in grid grid-cols-1 gap-3 min-[520px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
            >
              {selectedContentGroup?.topics.map((topicGroup) => (
                <ContentTopicCard
                  key={topicStatsKey(effectiveSelectedSubject, topicGroup.topic)}
                  topic={topicGroup.topic}
                  wrongCount={topicGroup.items.length}
                  stats={topicStatsMap.get(topicStatsKey(effectiveSelectedSubject, topicGroup.topic))}
                  scopeLabel="tüm kaynaklar"
                  onClick={() => setGalleryTopicKey(topicStatsKey(effectiveSelectedSubject, topicGroup.topic))}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div
          className="fade-slide-in grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
        >
          {contentGroups.map((group, index) => (
            <SubjectShelfCard
              key={group.subject}
              subject={group.subject}
              count={group.items.length}
              tone={SHELF_TONES[index % SHELF_TONES.length]}
              onClick={() => handleSelectSubject(group.subject)}
            />
          ))}
        </div>
      )}

      {galleryTopicGroup ? (
        <WrongQuestionGalleryModal
          title={galleryTopicGroup.topic || 'Genel'}
          items={galleryTopicGroup.items}
          fetchPhoto={fetchPhoto}
          onClose={() => setGalleryTopicKey(null)}
          onUpdateMistakeReason={handleUpdateMistakeReason}
          onUpdateMistakeMeta={handleUpdateMistakeMeta}
        />
      ) : null}

      {sourceGallerySelection ? (
        <WrongQuestionGalleryModal
          title={activeSource?.bookName || 'Kaynak'}
          items={sourceGallerySelection.items}
          initialIndex={sourceGallerySelection.index}
          fetchPhoto={fetchPhoto}
          onClose={() => setSourceGallerySelection(null)}
          onUpdateMistakeReason={handleUpdateMistakeReason}
          onUpdateMistakeMeta={handleUpdateMistakeMeta}
        />
      ) : null}
    </div>
  )
}
