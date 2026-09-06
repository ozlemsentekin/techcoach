import { useEffect, useRef } from 'react'
import { ArrowRight, BookOpen, GraduationCap, LineChart, Repeat2, Sparkles, UserRound, X } from 'lucide-react'
import Button from '../../ui/Button'

const STAGES = [
  { icon: UserRound, title: 'Çocuğunuzu tanımlayın', description: 'Profilini oluşturun, ardından okul ve sınıf bilgilerini ekleyin.' },
  { icon: BookOpen, title: 'Kitaplığını hazırlayın', description: 'Kullandığı kaynakları kütüphaneden seçin. Kaynak kütüphanede yoksa kendiniz oluşturun veya sisteme eklenmesi için kaynak talebi gönderin.', options: ['Kütüphaneden seç', 'Kendin oluştur', 'Kaynak talebi aç'] },
  { icon: GraduationCap, title: 'Öğretmenlerini ekleyin', optional: true, description: 'Özel ders öğretmenlerini çocuğunuz ve takip ettikleri kaynaklarla eşleştirerek öğretmenlere panel erişimi verebilirsiniz.' },
  { icon: LineChart, title: 'Çalışmayı başlatın ve ölçün', description: 'Geçmiş test sonuçlarını girin veya çocuğunuza yeni görev verin. Başarı oranını, kitap tamamlama oranını ve yanlış soruları birlikte takip edin.' },
]

export default function ParentWelcomeModal({ parentName, onClose, onStart }) {
  const dialogRef = useRef(null)
  const firstName = parentName?.trim().split(/\s+/)[0]
  useEffect(() => {
    const previousFocus = document.activeElement
    const dialog = dialogRef.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    return () => {
      dialog.close()
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [])

  return (
    <dialog ref={dialogRef} aria-labelledby="parent-welcome-title" aria-describedby="parent-welcome-description" onCancel={(event) => { event.preventDefault(); onClose() }} className="fixed inset-0 m-auto max-h-[calc(100dvh-24px)] w-[calc(100%-24px)] max-w-4xl overflow-y-auto rounded-3xl border border-panel-border bg-panel-surface p-0 text-panel-text shadow-panel-2 backdrop:bg-black/50">
      <div className="px-5 pb-5 pt-3 sm:px-7 sm:pb-6">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 text-xs font-bold text-panel-warm"><Sparkles size={15} aria-hidden="true" />TechCoach ile ilk adım</span>
          <Button autoFocus variant="ghost" onClick={onClose} className="min-h-11 px-2">Daha sonra <X size={18} aria-hidden="true" /></Button>
        </div>
        <h2 id="parent-welcome-title" className="mt-2 text-2xl font-bold sm:text-3xl">{firstName ? `Hoş geldiniz, ${firstName}` : 'Hoş geldiniz'}</h2>
        <p id="parent-welcome-description" className="mt-2 max-w-2xl text-sm leading-6 text-panel-text-muted">Önce çocuğunuzun çalışma alanını birlikte hazırlayalım. Ardından sonuçlar ve yanlışlar, gelişimi görünür bir döngüye dönüştürsün.</p>
        <ol className="mt-5 grid gap-3 sm:grid-cols-2">
          {STAGES.map((stage, index) => (
            <li key={stage.title} className="rounded-2xl border border-panel-border bg-panel-surface p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-panel-blue-soft text-panel-blue"><stage.icon size={17} aria-hidden="true" /></span>
                <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-bold"><span><span className="text-panel-text-muted">{index + 1}. </span>{stage.title}</span>{stage.optional ? <span className="inline-flex rounded-full bg-panel-sage-soft px-2 py-0.5 text-xs font-medium text-panel-text">İsteğe bağlı</span> : null}</h3>
              </div>
              <p className="mt-2 text-sm leading-6 text-panel-text-muted">{stage.description}</p>
              {stage.options ? <ul aria-label="Kaynak ekleme seçenekleri" className="mt-2 flex flex-wrap gap-1.5">{stage.options.map((option) => <li key={option} className="rounded-md bg-panel-surface-soft px-2 py-1 text-[11px] font-medium text-panel-text">{option}</li>)}</ul> : null}
            </li>
          ))}
        </ol>
        <div className="mt-4 rounded-2xl bg-panel-blue-soft/60 px-4 py-3">
          <p className="flex items-center gap-2 text-xs font-bold text-panel-blue"><Repeat2 size={16} aria-hidden="true" />Her çalışmada devam eden döngü</p>
          <p className="mt-1.5 text-sm leading-6 text-panel-text">Görev verilir → test çözülür → sonuç girilir → yanlış soru fotoğraflanır → dijital hata defteri ve gelişim analizi oluşur.</p>
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-panel-text-muted">Rehber, sizi ilgili ekranlara adım adım götürecek.</p>
          <Button className="min-h-11 w-full sm:w-auto" onClick={onStart}>Başlangıç rehberini aç <ArrowRight size={16} aria-hidden="true" /></Button>
        </div>
      </div>
    </dialog>
  )
}
