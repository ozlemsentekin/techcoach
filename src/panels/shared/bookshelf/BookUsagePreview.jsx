import { useId, useState } from 'react'
import { BookOpen, Check, ClipboardList, ImagePlus, ListChecks } from 'lucide-react'

const STAGES = [
  {
    label: 'Görev',
    structured: { title: 'Testi listeden seçin', text: 'Önce içindekiler ve cevap anahtarlarını hazırlarsınız. Sonra görevleri test listesinden seçersiniz.' },
    simple: { title: 'Testi görev notuna yazın', text: 'İçerik hazırlığı gerekmez. Hangi testin çözüleceğini görev notuna siz yazarsınız.' },
  },
  {
    label: 'Cevap',
    structured: { title: 'Sistem sonucu hesaplar', text: 'Öğrenci dijital optik formda cevaplarını işaretler. Doğru, yanlış ve boşu sistem hesaplar.' },
    simple: { title: 'Öğrenci sayıları girer', text: 'Optik form açılmaz. Öğrenci doğru, yanlış ve boş sayılarını kendisi girer.' },
  },
  {
    label: 'Hata defteri',
    structured: { title: 'Hatalar testle bağlantılı', text: 'Öğrenci yanlış/boş soruların görsellerini ekler. Testle ilişkili dijital hata defteri oluşur.' },
    simple: { title: 'Görseller testten bağımsız', text: 'Öğrenci yanlış sayısı kadar görsel yükleyebilir. Görseller belirli bir testle eşleşmez.' },
  },
  {
    label: 'Takip',
    structured: { title: 'Test bazında ilerleme', text: 'Kitabın tamamlanma oranı görünür. Uzaktan takip eden öğretmen de biten testleri kolayca izler.' },
    simple: { title: 'Test takibi manuel', text: 'Siz veya uzaktan takip eden öğretmen, biten testleri görev notlarından elle takip edersiniz.' },
  },
]

export default function BookUsagePreview({ simple }) {
  const [stage, setStage] = useState(0)
  const id = useId()
  const current = STAGES[stage][simple ? 'simple' : 'structured']
  return (
    <section aria-label="Seçiminizin kullanım sürecine etkisi" className="mt-4 rounded-2xl border border-panel-border bg-panel-surface-soft p-3 sm:p-4 [@media(max-height:650px)]:mt-2 [@media(max-height:650px)]:p-2">
      <div className="mb-2 flex [@media(max-height:650px)]:hidden items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-panel-text">Bu seçimle nasıl çalışır?</span>
        <span className="text-panel-text-muted">Örnek süreç</span>
      </div>
      <div role="tablist" aria-label="Kullanım süreci" className="grid grid-cols-4 gap-1">
        {STAGES.map(({ label }, index) => (
          <button key={label} type="button" role="tab" id={`${id}-tab-${index}`} aria-controls={`${id}-panel`} aria-selected={stage === index} tabIndex={stage === index ? 0 : -1}
            onClick={() => setStage(index)}
            onKeyDown={(event) => {
              const next = event.key === 'ArrowRight' ? (index + 1) % 4 : event.key === 'ArrowLeft' ? (index + 3) % 4 : event.key === 'Home' ? 0 : event.key === 'End' ? 3 : null
              if (next !== null) {
                event.preventDefault()
                setStage(next)
                document.getElementById(`${id}-tab-${next}`)?.focus()
              }
            }}
            className={`flex min-h-11 items-center justify-center gap-1 rounded-lg px-1 text-xs leading-tight focus-visible:outline focus-visible:outline-2 focus-visible:outline-panel-accent ${stage === index ? 'bg-panel-text font-semibold text-panel-surface' : 'text-panel-text hover:bg-panel-surface'}`}>
            <span aria-hidden="true" className="opacity-60">{index + 1}.</span>{label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${stage}`} tabIndex={0} className="mt-3 grid min-h-32 grid-cols-[88px_minmax(0,1fr)] items-center gap-3 rounded-xl bg-panel-surface p-3 outline-offset-2 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-4 [@media(max-height:650px)]:mt-2 [@media(max-height:650px)]:min-h-28 [@media(max-height:650px)]:p-2">
        <div aria-hidden="true"><ProcessIllustration stage={stage} simple={simple} /></div>
        <div aria-live="polite">
          <h4 className="text-sm font-bold leading-snug text-panel-text">{current.title}</h4>
          <p className="mt-2 text-xs leading-relaxed text-panel-text-muted [@media(max-height:650px)]:mt-1">{current.text}</p>
        </div>
      </div>
    </section>
  )
}

function ProcessIllustration({ stage, simple }) {
  const box = 'rounded-xl border border-panel-border bg-panel-surface-soft p-2 text-[10px] text-panel-text sm:p-3 sm:text-xs'
  if (stage === 0) return (
    <div className={box}>
      <div className="mb-2 flex [@media(max-height:650px)]:hidden items-center gap-1 font-semibold">{simple ? <ClipboardList size={14} /> : <ListChecks size={14} />}{simple ? 'Görev notu' : 'Test listesi'}</div>
      {simple ? <div className="rounded border border-dashed border-panel-text-muted bg-panel-surface p-1.5">Kesirler<br />Test 1’i çöz<span className="text-panel-warm"> ▏</span></div> : <div className="space-y-1"><div className="flex items-center gap-1 rounded bg-panel-accent-soft p-1 text-panel-warm"><Check size={12} />Test 1</div><div className="rounded bg-panel-surface p-1">□ Test 2</div></div>}
    </div>
  )
  if (stage === 1) return (
    <div className={box}>
      <p className="mb-2 font-semibold">{simple ? 'Sonuç girişi' : 'Optik form'}</p>
      {simple ? <div className="space-y-1">{['Doğru  8', 'Yanlış  1', 'Boş  1'].map(value => <div key={value} className="rounded border border-panel-border bg-panel-surface px-1">{value}</div>)}</div> : <><div className="flex items-center justify-between gap-0.5"><span>1</span>{['A', 'B', 'C', 'D'].map(letter => <span key={letter} className={`flex h-4 w-4 items-center justify-center rounded-full border text-[9px] ${letter === 'B' ? 'border-panel-accent bg-panel-accent text-white' : 'border-panel-border'}`}>{letter}</span>)}</div><div className="mt-2 rounded bg-emerald-50 p-1 text-center text-emerald-700">8 D · 1 Y · 1 B</div><p className="mt-1 text-center text-[9px]">Otomatik hesap</p></>}
    </div>
  )
  if (stage === 2) return (
    <div className={box}>
      <div className="mb-2 flex [@media(max-height:650px)]:hidden items-center gap-1 font-semibold"><BookOpen size={14} />Hata defteri</div>
      <div className="flex items-center justify-center gap-1 rounded bg-panel-surface py-2"><ImagePlus size={22} className="text-panel-warm" /></div>
      <p className={`mt-2 rounded p-1 text-center ${simple ? 'bg-panel-surface' : 'bg-panel-accent-soft text-panel-warm'}`}>{simple ? 'Test bağı yok' : 'Test 1 · Soru 4'}</p>
    </div>
  )
  return (
    <div className={box}>
      <p className="mb-2 font-semibold">{simple ? 'Görev notları' : 'Kitap ilerlemesi'}</p>
      {simple ? <><div className="rounded bg-panel-surface p-1">Test 1 ✓</div><div className="mt-1 rounded border border-dashed border-panel-text-muted p-1">Elle takip</div></> : <><div className="flex justify-between font-semibold"><span>6 / 10 test</span><span>%60</span></div><div className="my-2 h-2 overflow-hidden rounded-full bg-panel-border"><div className="h-full w-3/5 bg-emerald-500" /></div><div className="text-emerald-700">✓ Test 1 bitti</div></>}
    </div>
  )
}
