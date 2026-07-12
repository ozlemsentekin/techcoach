import { CalendarRange } from 'lucide-react'
import PageHeader from '../../layout/PageHeader'
import EmptyState from '../../shared/EmptyState'

export default function WeeklyPlanPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <PageHeader title="Haftalık Görünüm" />
      <EmptyState
        icon={CalendarRange}
        title="Yakında burada olacak"
        description="Haftalık özet görünümü bir sonraki geliştirme aşamasında ekleniyor."
      />
    </div>
  )
}
