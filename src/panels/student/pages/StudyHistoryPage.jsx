import PageHeader from '../../layout/PageHeader'
import StudyHistoryView from '../../shared/StudyHistoryView'

export default function StudyHistoryPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Çalışma Geçmişi" subtitle="Çözdüğün tüm testler ve optik sonuçların." />
      <StudyHistoryView photoMode="edit" />
    </div>
  )
}
