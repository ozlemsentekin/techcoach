import { TrendingUp } from 'lucide-react'
import PageHeader from '../../layout/PageHeader'
import EmptyState from '../../shared/EmptyState'

export default function ProgressPage() {
  return (
    <div className="flex w-full flex-col gap-5">
      <PageHeader title="Gelişimim" subtitle="Emek, istikrar ve öğrenme grafiklerin burada olacak." />
      <EmptyState
        icon={TrendingUp}
        title="Yakında burada olacak"
        description="Gelişim grafikleri bir sonraki geliştirme aşamasında ekleniyor."
      />
    </div>
  )
}
