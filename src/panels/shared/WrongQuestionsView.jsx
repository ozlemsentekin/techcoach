import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, ArrowLeft, BookOpen, ChevronRight, Layers } from 'lucide-react'
import PageHeader from '../layout/PageHeader'
import LoadingState from './LoadingState'
import EmptyState from './EmptyState'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import { MotionDiv } from '../ui/motion'
import WrongQuestionGalleryModal from './WrongQuestionGalleryModal'

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

    // Grouped by kitap adı (bookName), not the free-text topic label: the same book's tests can
    // carry differently-worded topic strings (renamed/re-entered over time), which fragmented one
    // book into several cards, while unrelated books sharing a generic "1. Ünite - ..." topic name
    // got merged into one. bookName is the stable identifier; topic falls back only for legacy
    // manually-entered rows that have no linked book.
    const topicKey = item.bookName || item.topic || ''
    if (!subjectGroup.topicsByKey.has(topicKey)) {
      subjectGroup.topicsByKey.set(topicKey, { topic: item.bookName || item.topic || null, items: [] })
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
}) {
  const [wrongQuestions, setWrongQuestions] = useState(null)
  const [topicStats, setTopicStats] = useState([])
  const [error, setError] = useState('')
  const [selectedSubject, setSelectedSubject] = useState(null)
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

  const groups = useMemo(() => (wrongQuestions ? groupBySubjectAndTopic(wrongQuestions) : []), [wrongQuestions])
  const selectedGroup = groups.find((group) => group.subject === selectedSubject) || null

  const topicStatsMap = useMemo(() => {
    const map = new Map()
    topicStats.forEach((stat) => map.set(topicStatsKey(stat.subject, stat.topic), stat))
    return map
  }, [topicStats])

  const galleryTopicGroup = selectedGroup?.topics.find(
    (topicGroup) => topicStatsKey(selectedGroup.subject, topicGroup.topic) === galleryTopicKey,
  )

  const handleUpdateMistakeReason = async (wrongQuestionId, mistakeReason) => {
    const updated = await updateMistakeReason(wrongQuestionId, mistakeReason)
    setWrongQuestions((prev) =>
      prev.map((item) => (item.id === wrongQuestionId ? { ...item, mistakeReason: updated.mistakeReason } : item)),
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
      {selectedGroup ? (
        <PageHeader
          title={selectedGroup.subject}
          subtitle={`${selectedGroup.items.length} yanlış soru`}
          actions={
            <div className="flex items-center gap-2">
              {headerActions}
              <Button variant="secondary" onClick={() => setSelectedSubject(null)}>
                <ArrowLeft size={15} aria-hidden="true" />
                Derslere Dön
              </Button>
            </div>
          }
        />
      ) : (
        <PageHeader title={title} subtitle={subtitle} actions={headerActions} />
      )}

      {error ? (
        <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{error}</div>
      ) : wrongQuestions === null ? (
        <LoadingState label="Hata defteri yükleniyor..." />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={AlertCircle}
          title="Henüz fotoğraflanmış yanlış yok"
          description="Cevap kağıdında yanlış işaretlenen bir soruya tıklayıp fotoğrafını eklediğinde burada görünecek."
        />
      ) : selectedGroup ? (
        <MotionDiv
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
        >
          {selectedGroup.topics.map((topicGroup) => (
            <ContentTopicCard
              key={topicStatsKey(selectedGroup.subject, topicGroup.topic)}
              topic={topicGroup.topic}
              wrongCount={topicGroup.items.length}
              stats={topicStatsMap.get(topicStatsKey(selectedGroup.subject, topicGroup.topic))}
              onClick={() => setGalleryTopicKey(topicStatsKey(selectedGroup.subject, topicGroup.topic))}
            />
          ))}
        </MotionDiv>
      ) : (
        <MotionDiv
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
        >
          {groups.map((group, index) => (
            <SubjectShelfCard
              key={group.subject}
              subject={group.subject}
              count={group.items.length}
              tone={SHELF_TONES[index % SHELF_TONES.length]}
              onClick={() => setSelectedSubject(group.subject)}
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
