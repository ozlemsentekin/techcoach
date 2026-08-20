import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, ArrowLeft, BookOpen, ChevronRight, Layers, Tag } from 'lucide-react'
import PageHeader from '../layout/PageHeader'
import LoadingState from './LoadingState'
import EmptyState from './EmptyState'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import { MotionDiv } from '../ui/motion'
import WrongQuestionGalleryModal from './WrongQuestionGalleryModal'
import { ResourceBookAvatar } from './ResourceBookCard'

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
  return `${subject || ''}::${topic || ''}`
}

function groupBySubjectAndTopic(wrongQuestions) {
  const bySubject = new Map()
  wrongQuestions.forEach((item) => {
    if (!item.hasPhoto) return
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
function groupBySubjectAndSource(wrongQuestions) {
  const bySubject = new Map()
  wrongQuestions.forEach((item) => {
    if (!item.hasPhoto) return
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
        bookImageUrl: item.bookImageUrl || null,
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

function ContentTopicCard({ topic, wrongCount, stats, onClick }) {
  const successPercent = stats?.successRate != null ? Math.round(stats.successRate * 100) : null
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
          <h3 className="text-sm font-semibold leading-snug text-panel-text">{topic || 'Genel'}</h3>
        </div>
        <Badge tone="warm" className="shrink-0">
          {wrongCount} yanlış
        </Badge>
      </div>

      <div className="rounded-lg bg-panel-sage-soft px-2 py-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-panel-sage">Başarı Oranı</span>
          <span className="text-sm font-bold tabular-nums text-panel-sage">
            {successPercent != null ? `%${successPercent}` : '—'}
          </span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/70">
          <div
            className="h-full rounded-full bg-panel-sage transition-all"
            style={{ width: `${successPercent ?? 0}%` }}
          />
        </div>
      </div>

      <p className="text-xs text-panel-text-muted">
        {stats && stats.totalAnswered > 0
          ? `${stats.totalAnswered} soru çözüldü (tüm kaynaklar)`
          : 'Henüz çözüm verisi yok'}
      </p>
    </button>
  )
}

const GROUP_MODE_OPTIONS = [
  { value: 'topic', label: 'İçerik Grubuna Göre' },
  { value: 'source', label: 'Kaynağa Göre' },
]

function GroupModeToggle({ mode, onChange }) {
  return (
    <div className="inline-flex w-fit gap-1 rounded-full border border-panel-border bg-panel-surface-soft p-1">
      {GROUP_MODE_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
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

function SourceProfileCard({ bookName, publisherName, bookImageUrl, wrongCount, onClick }) {
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
      <Badge tone="warm" className="w-fit">
        {wrongCount} yanlış
      </Badge>
    </button>
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
  title = 'Hata Defterim',
  subtitle = 'Fotoğrafını çektiğin yanlış sorular ders ders burada.',
  headerActions,
  hideHeaderWhenUnselected = false,
}) {
  const [wrongQuestions, setWrongQuestions] = useState(null)
  const [topicStats, setTopicStats] = useState([])
  const [error, setError] = useState('')
  const [selectedSubject, setSelectedSubject] = useState(null)
  const [groupMode, setGroupMode] = useState('topic')
  const [selectedSourceKey, setSelectedSourceKey] = useState(null)
  const [galleryTopicKey, setGalleryTopicKey] = useState(null)

  useEffect(() => {
    let ignore = false
    Promise.all([fetchWrongQuestions(), fetchTopicStats().catch(() => [])])
      .then(([wrongQuestionsData, topicStatsData]) => {
        if (ignore) return
        setWrongQuestions(wrongQuestionsData)
        setTopicStats(topicStatsData || [])
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })
    return () => {
      ignore = true
    }
  }, [fetchWrongQuestions, fetchTopicStats])

  const contentGroups = useMemo(() => (wrongQuestions ? groupBySubjectAndTopic(wrongQuestions) : []), [wrongQuestions])
  const sourceGroups = useMemo(() => (wrongQuestions ? groupBySubjectAndSource(wrongQuestions) : []), [wrongQuestions])
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

  const activeTopics = activeSource ? activeSource.topics : groupMode === 'topic' ? selectedContentGroup?.topics : null
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
      prev.map((item) => (item.id === wrongQuestionId ? { ...item, mistakeReason: updated.mistakeReason } : item)),
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
      {activeSource ? (
        <PageHeader
          title={activeSource.bookName || 'Kaynak belirtilmemiş'}
          subtitle={`${activeSource.publisherName || 'Yayın evi belirtilmemiş'} · ${activeSource.items.length} yanlış soru`}
          actions={
            <div className="flex items-center gap-2">
              {headerActions}
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
        <MotionDiv
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
        >
          {activeSource.topics.map((topicGroup) => (
            <ContentTopicCard
              key={topicStatsKey(effectiveSelectedSubject, topicGroup.topic)}
              topic={topicGroup.topic}
              wrongCount={topicGroup.items.length}
              stats={topicStatsMap.get(topicStatsKey(effectiveSelectedSubject, topicGroup.topic))}
              onClick={() => setGalleryTopicKey(topicStatsKey(effectiveSelectedSubject, topicGroup.topic))}
            />
          ))}
        </MotionDiv>
      ) : effectiveSelectedSubject ? (
        <div className="flex flex-col gap-4">
          <GroupModeToggle mode={groupMode} onChange={handleChangeGroupMode} />
          {groupMode === 'source' ? (
            <MotionDiv
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
            >
              {selectedSourceGroup?.sources.map((source) => (
                <SourceProfileCard
                  key={sourceKeyFor(source.bookName)}
                  bookName={source.bookName}
                  publisherName={source.publisherName}
                  bookImageUrl={source.bookImageUrl}
                  wrongCount={source.items.length}
                  onClick={() => setSelectedSourceKey(sourceKeyFor(source.bookName))}
                />
              ))}
            </MotionDiv>
          ) : (
            <MotionDiv
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
            >
              {selectedContentGroup?.topics.map((topicGroup) => (
                <ContentTopicCard
                  key={topicStatsKey(effectiveSelectedSubject, topicGroup.topic)}
                  topic={topicGroup.topic}
                  wrongCount={topicGroup.items.length}
                  stats={topicStatsMap.get(topicStatsKey(effectiveSelectedSubject, topicGroup.topic))}
                  onClick={() => setGalleryTopicKey(topicStatsKey(effectiveSelectedSubject, topicGroup.topic))}
                />
              ))}
            </MotionDiv>
          )}
        </div>
      ) : (
        <MotionDiv
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
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
        </MotionDiv>
      )}

      {galleryTopicGroup ? (
        <WrongQuestionGalleryModal
          title={galleryTopicGroup.topic || 'Genel'}
          items={galleryTopicGroup.items}
          fetchPhoto={fetchPhoto}
          onClose={() => setGalleryTopicKey(null)}
          onUpdateMistakeReason={handleUpdateMistakeReason}
        />
      ) : null}
    </div>
  )
}
