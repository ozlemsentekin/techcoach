import { AlertCircle } from 'lucide-react'
import PageHeader from '../../layout/PageHeader'
import EmptyState from '../../shared/EmptyState'

export default function MistakesPage() {
  return (
    <div className="flex w-full flex-col gap-5">
      <PageHeader title="Hata Defterim" subtitle="Yanlış yaptığın sorular burada tutulacak." />
      <EmptyState
        icon={AlertCircle}
        title="Yakında burada olacak"
        description="Yanlış soru defteri ve tekrar akışı bir sonraki geliştirme aşamasında ekleniyor."
      />
    </div>
  )
}
