import { ArrowRight, BookMarked, CalendarRange, LineChart, Plus } from 'lucide-react'
import Button from '../../ui/Button'

// Hiç çocuk profili eklenmemiş bir velinin "Çocuklarım" ekranında gördüğü karşılama
// içeriği. Sade EmptyState yerine geçer: TechCoach'un nasıl çalıştığını özetler ve
// tek net bir sonraki adımı (çocuk profili oluştur) öne çıkarır.
const STEPS = [
  {
    icon: BookMarked,
    title: 'Profil & kaynak',
    body: 'Çocuğunuzun sınıf ve okul bilgisini girin, kitap ve kaynaklarını atayın.',
  },
  {
    icon: CalendarRange,
    title: 'Haftalık plan',
    body: 'Gün gün ödev, test ve mola ekleyin; özel ders saatleri plana yansısın.',
  },
  {
    icon: LineChart,
    title: 'Takip',
    body: 'Günlük görev akışı, hata defteri ve gelişim analiziyle ilerlemeyi görün.',
  },
]

export default function ParentWelcome({ parentName, onAddChild }) {
  const firstName = parentName?.trim().split(/\s+/)[0] || ''

  return (
    <div className="panel-card overflow-hidden">
      <div className="border-b border-panel-border bg-panel-accent-soft/60 px-6 py-8 text-center sm:px-10">
        <h2 className="text-2xl font-bold text-panel-text sm:text-3xl">
          {firstName ? `Hoş geldiniz, ${firstName}` : 'TechCoach’a hoş geldiniz'}
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-base leading-7 text-panel-text-muted">
          Başlamak için çocuğunuzun profilini oluşturun. Kurulumun her adımını daha sonra
          da düzenleyebilir, istediğiniz adımı atlayabilirsiniz.
        </p>
        <Button type="button" size="md" onClick={onAddChild} className="mt-5">
          <Plus size={16} aria-hidden="true" />
          Çocuk Profilini Oluştur
        </Button>
      </div>

      <div className="grid gap-4 px-6 py-6 sm:grid-cols-3 sm:px-10">
        {STEPS.map((step, index) => (
          <div key={step.title} className="flex flex-col gap-2 rounded-2xl border border-panel-border bg-panel-surface p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-panel-blue-soft text-panel-blue">
                <step.icon size={18} aria-hidden="true" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wide text-panel-text-muted">
                Adım {index + 1}
              </span>
            </div>
            <p className="text-base font-semibold text-panel-text">{step.title}</p>
            <p className="text-sm leading-6 text-panel-text-muted">{step.body}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-1.5 border-t border-panel-border px-6 py-4 text-sm text-panel-text-muted">
        <span>Kurulumdan sonra “Bugün” ekranında bir başlangıç rehberi sizi karşılayacak.</span>
        <ArrowRight size={14} aria-hidden="true" />
      </div>
    </div>
  )
}
