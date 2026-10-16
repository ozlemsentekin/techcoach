import PageHeader from '../../layout/PageHeader'
import SchoolHomeworksView from '../../shared/SchoolHomeworksView'

export default function SchoolHomeworksPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Okul Ödevleri" subtitle="Okulda verilen ödevlerin ders ders listesi." />
      <SchoolHomeworksView />
    </div>
  )
}
