import { useState } from 'react'
import { useAuth } from '../../../context/useAuth'
import PageHeader from '../../layout/PageHeader'
import SchoolHomeworksView, { PendingHomeworkSummary } from '../../shared/SchoolHomeworksView'

export default function SchoolHomeworksPage() {
  const { authUser } = useAuth()
  const [summary, setSummary] = useState(null)
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Okul Ödevleri"
        subtitle={summary ? <PendingHomeworkSummary subjects={summary} /> : 'Okulda verilen ödevlerin ders ders listesi.'}
      />
      <SchoolHomeworksView studentGrade={authUser?.grade} onSummaryChange={setSummary} />
    </div>
  )
}
