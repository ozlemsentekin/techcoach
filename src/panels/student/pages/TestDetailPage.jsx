import { FileCheck2 } from 'lucide-react'
import PageHeader from '../../layout/PageHeader'
import EmptyState from '../../shared/EmptyState'

export default function TestDetailPage() {
  return (
    <div className="flex w-full flex-col gap-5">
      <PageHeader title="Test Detayı" />
      <EmptyState
        icon={FileCheck2}
        title="Yakında burada olacak"
        description="Test detay ekranı bir sonraki geliştirme aşamasında ekleniyor."
      />
    </div>
  )
}
