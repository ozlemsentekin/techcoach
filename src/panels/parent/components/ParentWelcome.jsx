import { ArrowRight, CalendarRange, CheckCircle2, LineChart, Sparkles } from 'lucide-react'
import Button from '../../ui/Button'

const STEPS = [
  { icon: CheckCircle2, title: 'Çocuğunuzu tanıyalım', body: 'Profilini oluşturun. Okul ve kaynak bilgilerini şimdi ekleyebilir veya sonraya bırakabilirsiniz.' },
  { icon: CalendarRange, title: 'İlk çalışmayı planlayın', body: 'Haftalık Plan’dan bir görev ekleyin. Tüm haftayı doldurmanız gerekmez; tek bir çalışmayla başlayın.' },
  { icon: LineChart, title: 'Birlikte takip edin', body: 'Bugün ekranından görevleri takip edin. Sonuçlar biriktikçe Gelişim Analizi’nden ilerlemeyi inceleyin.' },
]

export default function ParentWelcome({ parentName, onAddChild, onStartTour, compact = false }) {
  const firstName = parentName?.trim().split(/\s+/)[0] || ''
  return (
    <div className={compact ? 'overflow-hidden' : 'panel-card overflow-hidden'}>
      <div className="bg-gradient-to-br from-panel-accent-soft via-panel-surface to-panel-blue-soft px-5 py-7 sm:px-8">
        <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-panel-border bg-panel-surface px-3 py-1 text-xs font-semibold text-panel-text">
          <Sparkles size={14} aria-hidden="true" /> TechCoach ile ilk adım
        </span>
        <h2 id={compact ? 'parent-welcome-title' : undefined} className="text-2xl font-bold text-panel-text sm:text-3xl">
          {firstName ? `Hoş geldiniz, ${firstName}` : 'TechCoach’a hoş geldiniz'}
        </h2>
        <p className="mt-3 max-w-2xl text-lg font-semibold leading-7 text-panel-text">Çalışma düzeni netleşsin, çocuğunuzun gelişimi görünür olsun.</p>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-panel-text-muted">Neye çalışacak, bugün neler tamamlandı, nerede desteğe ihtiyaç var? Planı ve sonuçları tek yerden takip ederek çocuğunuza daha bilinçli eşlik edin.</p>
        <Button data-tour="create-child" onClick={onAddChild} className="mt-5 min-h-11 w-full sm:w-auto">
          Çocuğumun profilini oluştur <ArrowRight size={16} aria-hidden="true" />
        </Button>
        {onStartTour ? <Button variant="ghost" onClick={onStartTour} className="mt-3 min-h-11 w-full sm:ml-2 sm:w-auto">Başlangıç rehberini aç</Button> : null}
        <p className="mt-3 text-xs leading-5 text-panel-text-muted">İlk adım profil bilgileri. Okul, kitap ve öğretmen eklemeyi sonraya bırakabilirsiniz.</p>
      </div>
      <ol className={`grid gap-3 px-5 py-5 sm:px-8 ${compact ? '' : 'lg:grid-cols-3'}`}>
        {STEPS.map((step, index) => (
          <li key={step.title} className="flex gap-3 rounded-2xl border border-panel-border bg-panel-surface p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-panel-blue-soft text-panel-blue"><step.icon size={20} aria-hidden="true" /></span>
            <div><p className="text-sm font-bold text-panel-text"><span className="text-panel-text-muted">{index + 1}. </span>{step.title}</p><p className="mt-1 text-sm leading-6 text-panel-text-muted">{step.body}</p></div>
          </li>
        ))}
      </ol>
      <p className="border-t border-panel-border px-5 py-4 text-sm leading-6 text-panel-text-muted sm:px-8"><strong className="text-panel-text">Günlük alışkanlığınız:</strong> Bugün ekranını açın, görevleri gözden geçirin ve sonuçları çocuğunuzla değerlendirin.</p>
    </div>
  )
}
