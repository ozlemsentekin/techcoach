import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, ArrowLeft, BookOpen, Layers } from 'lucide-react'
import PageHeader from '../layout/PageHeader'
import LoadingState from './LoadingState'
import EmptyState from './EmptyState'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import { MotionDiv } from '../ui/motion'
import WrongQuestionGalleryModal from './WrongQuestionGalleryModal'

const SHELF_TONES = [
  'border-panel-blue bg-panel-blue-soft',
  'border-panel-lilac bg-panel-lilac-soft',
  'border-panel-sage bg-panel-sage-soft',
  'border-panel-warm bg-panel-accent-soft',
  'border-panel-slate bg-panel-slate-soft',
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

    const topicKey = item.topic || ''
    if (!subjectGroup.topicsByKey.has(topicKey)) {
      subjectGroup.topicsByKey.set(topicKey, { topic: item.topic || null, items: [] })
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
      className={`flex flex-col items-start gap-3 rounded-2xl border-l-[6px] p-4 text-left shadow-sm transition-transform hover:-translate-y-0.5 ${tone}`}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/70 text-panel-text">
        <BookOpen size={20} aria-hidden="true" />
      </div>
      <div>
        <h3 className="text-base font-semibold text-panel-text">{subject}</h3>
        <p className="text-sm text-panel-text-muted">{count} soru</p>
      </div>
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
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
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
