import { TrendingUp } from 'lucide-react'
import PageHeader from '../../layout/PageHeader'
import EmptyState from '../../shared/EmptyState'

export default function ProgressPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <PageHeader title="Gelişim" subtitle="Aylin'in emeği ve istikrarı burada görünecek." />
      <EmptyState
        icon={TrendingUp}
        title="Yakında burada olacak"
        description="Gelişim grafikleri bir sonraki geliştirme aşamasında ekleniyor."
      />
    </div>
  )
}
