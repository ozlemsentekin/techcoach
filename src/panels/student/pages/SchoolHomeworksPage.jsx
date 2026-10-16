import { useAuth } from '../../../context/useAuth'
import PageHeader from '../../layout/PageHeader'
import SchoolHomeworksView from '../../shared/SchoolHomeworksView'

export default function SchoolHomeworksPage() {
  const { authUser } = useAuth()
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Okul Ödevleri" subtitle="Okulda verilen ödevlerin ders ders listesi." />
      <SchoolHomeworksView studentGrade={authUser?.grade} />
    </div>
  )
}
