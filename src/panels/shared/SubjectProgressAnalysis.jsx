import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Clock, Target } from 'lucide-react'
import { getProgressOverview } from '../../services/progressService'
import LoadingState from './LoadingState'
import EmptyState from './EmptyState'
import { RATE_TONES } from './rateTones'
import { cn } from '../ui/utils'
import { todayISODate } from '../../utils/time'
import {
  buildActivityRecords,
  buildSubjectTabs,
  formatNumber,
  subjectKey,
  subjectLabel,
} from './progressAnalytics'
import { AnalysisBody, SummaryMetric } from './analysisView'
import { SORTS, analyzeEntity, buildAnalysis, pct, toneFor } from './analysisData'

const LAST_ACTIVITY_FMT = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

// Öğrencinin TechCoach'taki son işlemi — overview'daki görev/oturum/manuel test/hata kayıtlarının
// en yeni zaman damgası (backend'de ayrı bir alan yok, istemcide türetiliyor).
function deriveLastActivity(overview) {
  if (!overview) return null
  let max = null
  const consider = (value) => {
    if (!value) return
    const time = new Date(value).getTime()
    if (!Number.isNaN(time) && (max === null || time > max)) max = time
  }
  for (const task of overview.tasks || []) {
    consider(task.updatedAt)
    consider(task.completedAt)
    consider(task.createdAt)
  }
  for (const session of overview.sessions || []) {
    consider(session.createdAt)
    consider(session.endedAt)
    consider(session.startedAt)
  }
  for (const completion of overview.manualTestCompletions || []) consider(completion.markedAt)
  for (const wrong of overview.wrongQuestions || []) consider(wrong.createdAt)
  return max === null ? null : new Date(max)
}

// Ders bazlı "Gelişim Analizi" gövdesi: öğretmenin Sınıf Analizi'yle aynı grafik seti, ama
// satırlar öğrenci yerine ders. Veli (çocuk seçerek) ve öğrenci (kendisi, studentId'siz) kullanır.
const SUBJECT_LABELS = {
  entityHeader: 'Ders',
  monthlyPerfSubtitle: 'Ders başına aylık çözülen soru ve o ayın başarı yüzdesi (Ağustos–Haziran)',
  monthlyResultSubtitle: 'Ders başına aylık doğru / yanlış / boş dağılımı ve o ayın başarı yüzdesi',
  resourceSubtitle: 'Kaynak × ders — her hücrede o kitaptaki doğruluk yüzdesi ve tamamlanma oranı',
  resourceEmpty: 'Henüz kaynak bazlı çözüm kaydı yok.',
  taskSubtitle: 'Her dersteki görev tamamlama disiplini',
  hardestTitle: 'Her derste en zorlanılan konu ve kitap',
  hardestSubtitle: 'Her ders için doğruluğu en düşük konu/kaynak',
  comparisonTitle: 'Ders karşılaştırması',
  comparisonSubtitle: 'Dersleri emek, doğruluk, net ve biriken görev üzerinden karşılaştırın',
}

// studentId boşsa endpoint oturumdaki öğrencinin kendi verisini döner.
export default function SubjectProgressAnalysis({ studentId = '', studentName = '' }) {
  const [loadedOverview, setLoadedOverview] = useState(null)
  const [failedOverview, setFailedOverview] = useState(null)
  const [sortKey, setSortKey] = useState('accuracyAsc')
  const today = useMemo(() => todayISODate(), [])

  useEffect(() => {
    let ignore = false
    getProgressOverview(studentId || undefined)
      .then((data) => {
        if (!ignore) setLoadedOverview({ id: studentId, data })
      })
      .catch((err) => {
        if (!ignore) setFailedOverview({ id: studentId, message: err.message })
      })
    return () => {
      ignore = true
    }
  }, [studentId])

  // Öğrenci değişince eski çocuğun verisi ekranda kalmasın.
  const overview = loadedOverview?.id === studentId ? loadedOverview.data : null
  const overviewError = failedOverview?.id === studentId ? failedOverview.message : ''

  const analysis = useMemo(() => {
    if (!overview) return null
    const testsById = new Map((overview.tests || []).map((test) => [test.id, test]))
    const allRecords = buildActivityRecords(overview, testsById)
    const subjects = buildSubjectTabs(overview)
    const entities = subjects.map((subject) =>
      analyzeEntity({
        key: subject.key,
        name: subject.label,
        shortLabel: subject.label,
        records: allRecords.filter((record) => subjectKey(record.subject) === subject.key),
        tasks: (overview.tasks || []).filter((task) => subjectKey(subjectLabel(task)) === subject.key),
        overview,
        subjectFilterKey: subject.key,
      }),
    )
    // Kaynaklar ısı haritasında SATIR olduğu için üst sınır yok — test çözülen
    // tüm kaynaklar gösterilir.
    return buildAnalysis(entities, today, { maxResources: Infinity })
  }, [overview, today])

  const sortedSubjects = useMemo(() => {
    if (!analysis) return []
    return [...analysis.entities].sort(SORTS[sortKey].fn)
  }, [analysis, sortKey])

  const lastActivity = useMemo(() => deriveLastActivity(overview), [overview])

  return (
    <>
      {lastActivity ? (
        <p className="-mt-2 flex items-center gap-1.5 text-sm text-panel-text-muted">
          <Clock size={14} className="shrink-0" aria-hidden="true" />
          Son işlem zamanı:{' '}
          <span className="font-semibold text-panel-text">{LAST_ACTIVITY_FMT.format(lastActivity)}</span>
        </p>
      ) : null}

      {analysis ? (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <SummaryMetric
            icon={BookOpen}
            iconClassName="bg-panel-blue-soft text-panel-blue"
            title="Ders Sayısı"
            value={formatNumber(analysis.summary.count)}
            description={`${formatNumber(analysis.summary.activeCount)} derste aktif çözüm var`}
          />
          <SummaryMetric
            icon={Target}
            iconClassName={cn('bg-panel-blue-soft', RATE_TONES[toneFor(analysis.summary.overallAccuracy)].text)}
            valueClassName={
              Number.isFinite(analysis.summary.overallAccuracy)
                ? RATE_TONES[toneFor(analysis.summary.overallAccuracy)].text
                : undefined
            }
            title="Genel Başarı Ortalaması"
            value={pct(analysis.summary.overallAccuracy)}
            description={
              analysis.summary.activeCount
                ? `${analysis.summary.activeCount} ders · %${Math.round(analysis.summary.minAccuracy)}–%${Math.round(
                    analysis.summary.maxAccuracy,
                  )} arası`
                : 'Henüz çözüm yok'
            }
          />
        </div>
      ) : null}

      {overviewError ? (
        <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{overviewError}</div>
      ) : !analysis ? (
        <LoadingState label="Gelişim verileri yükleniyor..." />
      ) : analysis.entities.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Gösterilecek ders bulunamadı"
          description={`${studentName || 'Bu öğrenci'} için henüz çözüm, görev veya kaynak kaydı yok.`}
        />
      ) : (
        <AnalysisBody
          analysis={analysis}
          sortedEntities={sortedSubjects}
          sortKey={sortKey}
          onSortChange={setSortKey}
          labels={SUBJECT_LABELS}
          showLastActivity={false}
        />
      )}
    </>
  )
}
