import { ListChecks } from 'lucide-react'
import PageHeader from '../../layout/PageHeader'
import EmptyState from '../../shared/EmptyState'

export default function TestsPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <PageHeader title="Testlerim" subtitle="Çözdüğün testler burada listelenecek." />
      <EmptyState
        icon={ListChecks}
        title="Yakında burada olacak"
        description="Test geçmişi, net hesaplama ve karşılaştırmalar bir sonraki geliştirme aşamasında ekleniyor."
      />
    </div>
  )
}
