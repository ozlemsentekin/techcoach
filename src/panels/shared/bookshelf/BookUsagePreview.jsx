const PREPARATION = {
  structured: [
    { title: 'Konu ve testleri girin', text: 'Kaydettikten sonra İçindekiler bölümüne kitabın konu ve testlerini girin.' },
    { title: 'Cevap anahtarını ekleyin', text: 'Otomatik değerlendirme istiyorsanız testlerin doğru cevaplarını girin.' },
    { title: 'Ardından listeden görev verin', text: 'Oluşturduğunuz listeden test seçin; biten testleri takip edin.' },
  ],
  simple: [
    { title: 'Kitap bilgilerini girmeniz yeterli', text: 'İçindekiler veya cevap anahtarı eklemeden kitabı kaydedin.' },
    { title: 'Görevi siz yazın', text: 'Her görevde “Sayfa 24–28, Test 3’ü çöz” gibi bir not yazın.' },
    { title: 'Sonucu öğrenci girsin', text: 'Öğrenci doğru, yanlış ve boş sayılarını yazar. Test takibini siz yaparsınız.' },
  ],
}

export default function BookUsagePreview({ simple }) {
  return (
    <section aria-label="Yapmanız gerekenler" aria-live="polite" className="mt-3 [@media(max-height:650px)]:mt-2 rounded-2xl border border-panel-border bg-panel-surface-soft p-3 sm:p-4 [@media(max-height:650px)]:p-2">
      <h4 className="mb-3 [@media(max-height:650px)]:mb-2 text-sm font-bold text-panel-text">{simple ? 'Nasıl kullanacaksınız?' : 'Önce sizin yapacaklarınız'}</h4>
      <ol className="space-y-3 [@media(max-height:650px)]:space-y-2">
        {PREPARATION[simple ? 'simple' : 'structured'].map(({ title, text }, index) => (
          <li key={title} className="flex items-start gap-2.5">
            <span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-panel-surface text-xs font-bold text-panel-warm">{index + 1}</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-snug text-panel-text">{title}</p>
              <p className="mt-1 text-xs leading-snug text-panel-text-muted">{text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
