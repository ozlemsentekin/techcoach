import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BookOpen, Clock, Target, Users } from 'lucide-react'
import { cachedGet } from '../../../services/authClient'
import { getProgressOverview } from '../../../services/progressService'
import LoadingState from '../../shared/LoadingState'
import EmptyState from '../../shared/EmptyState'
import PageHeader from '../../layout/PageHeader'
import { RATE_TONES } from '../../shared/rateTones'
import { cn } from '../../ui/utils'
import { todayISODate } from '../../../utils/time'
import {
  buildActivityRecords,
  buildSubjectTabs,
  formatNumber,
  subjectKey,
  subjectLabel,
} from '../../shared/progressAnalytics'
import { AnalysisBody, SummaryMetric } from '../../shared/analysisView'
import { SORTS, analyzeEntity, buildAnalysis, pct, toneFor } from '../../shared/analysisData'

const LAST_ACTIVITY_FMT = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

// Çocuğun TechCoach'taki son işlemi — overview'daki görev/oturum/manuel test/hata kayıtlarının
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

// Veli "Gelişim Analizi": öğretmenin Sınıf Analizi'yle aynı grafik seti, ama satırlar
// öğrenci yerine ders — tek çocuk seçilir, tüm dersleri karşılaştırılır.
const PARENT_LABELS = {
  entityHeader: 'Ders',
  monthlyPerfSubtitle: 'Ders başına aylık çözülen soru ve o ayın başarı yüzdesi (Ağustos–Haziran)',
  monthlyResultSubtitle: 'Ders başına aylık doğru / yanlış / boş dağılımı ve o ayın başarı yüzdesi',
  resourceSubtitle: 'Kaynak × ders — her hücrede o kitaptaki doğruluk yüzdesi ve tamamlanma oranı',
  resourceEmpty: 'Bu çocukta kaynak bazlı çözüm kaydı henüz yok.',
  taskSubtitle: 'Her dersteki görev tamamlama disiplini',
  hardestTitle: 'Her derste en zorlanılan konu ve kitap',
  hardestSubtitle: 'Her ders için doğruluğu en düşük konu/kaynak',
  comparisonTitle: 'Ders karşılaştırması',
  comparisonSubtitle: 'Dersleri emek, doğruluk, net ve biriken görev üzerinden karşılaştırın',
}

export default function ProgressPage() {
  const [searchParams] = useSearchParams()
  const requestedStudentId = searchParams.get('studentId') || ''
  const [students, setStudents] = useState(null)
  const [selectedStudentId, setSelectedStudentId] = useState(requestedStudentId)
  const [studentsError, setStudentsError] = useState('')
  const [loadedOverview, setLoadedOverview] = useState(null)
  const [failedOverview, setFailedOverview] = useState(null)
  const [sortKey, setSortKey] = useState('accuracyAsc')
  const today = useMemo(() => todayISODate(), [])

  useEffect(() => {
    let ignore = false
    cachedGet('/api/parent/students')
      .then((data) => {
        if (ignore) return
        setStudents(data.students)
        setSelectedStudentId((current) => {
          if (current && data.students.some((student) => student.id === current)) return current
          return data.students[0]?.id || ''
        })
      })
      .catch((err) => {
        if (!ignore) setStudentsError(err.message)
      })
    return () => {
      ignore = true
    }
  }, [])

  const selectedStudent = students?.find((student) => student.id === selectedStudentId) || students?.[0] || null

  const activeStudentId = selectedStudent?.id || ''

  useEffect(() => {
    if (!activeStudentId) return undefined
    let ignore = false
    getProgressOverview(activeStudentId)
      .then((data) => {
        if (!ignore) setLoadedOverview({ id: activeStudentId, data })
      })
      .catch((err) => {
        if (!ignore) setFailedOverview({ id: activeStudentId, message: err.message })
      })
    return () => {
      ignore = true
    }
  }, [activeStudentId])

  // Öğrenci değişince eski çocuğun verisi ekranda kalmasın.
  const overview = loadedOverview?.id === activeStudentId ? loadedOverview.data : null
  const overviewError = failedOverview?.id === activeStudentId ? failedOverview.message : ''

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
    // Kaynaklar ısı haritasında SATIR olduğu için üst sınır yok — çocuğun test çözdüğü
    // tüm kaynaklar gösterilir.
    return buildAnalysis(entities, today, { maxResources: Infinity })
  }, [overview, today])

  const sortedSubjects = useMemo(() => {
    if (!analysis) return []
    return [...analysis.entities].sort(SORTS[sortKey].fn)
  }, [analysis, sortKey])

  const lastActivity = useMemo(() => deriveLastActivity(overview), [overview])

  if (studentsError) {
    return <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{studentsError}</div>
  }

  if (students === null) {
    return <LoadingState label="Öğrenciler yükleniyor..." />
  }

  if (!students.length) {
    return (
      <EmptyState
        icon={Users}
        title="Bağlı öğrenci bulunamadı"
        description="Gelişim verilerini görebilmek için önce bir öğrenci profili eklemelisin."
      />
    )
  }

  const headerActions =
    students.length > 1 ? (
      <select
        value={selectedStudent?.id || ''}
        onChange={(event) => setSelectedStudentId(event.target.value)}
        className="h-10 rounded-xl border border-panel-border bg-panel-surface px-3 text-sm font-medium text-panel-text"
        aria-label="Öğrenci seç"
      >
        {students.map((student) => (
          <option key={student.id} value={student.id}>
            {student.fullName}
          </option>
        ))}
      </select>
    ) : null

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Gelişim Analizi"
        subtitle={
          selectedStudent
            ? `${selectedStudent.fullName} için tüm derslerin emek, doğruluk ve kaynak ilerlemesi.`
            : 'Tüm derslerin emek, doğruluk ve kaynak ilerlemesi.'
        }
        actions={headerActions}
      />

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
          description={`${selectedStudent?.fullName || 'Bu öğrenci'} için henüz çözüm, görev veya kaynak kaydı yok.`}
        />
      ) : (
        <AnalysisBody
          analysis={analysis}
          sortedEntities={sortedSubjects}
          sortKey={sortKey}
          onSortChange={setSortKey}
          labels={PARENT_LABELS}
          showLastActivity={false}
          heatmapLayout="resource-rows"
        />
      )}
    </div>
  )
}
