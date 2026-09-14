import Button from '../../ui/Button'

export default function SimpleBookGuide({ onGoToPlan }) {
  return (
    <section className="space-y-4 rounded-xl border border-panel-border bg-panel-surface-soft p-4">
      <h3 className="text-base font-semibold text-panel-text">Kitap kullanıma hazır</h3>
      <p className="text-sm leading-relaxed text-panel-text-muted">Bu kitabı içindekiler eklemeden kullanıyorsunuz. Konu, test veya cevap anahtarı hazırlamanız gerekmiyor.</p>
      <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-panel-text">
        <li>Çalışma planında görev ekleyip bu kitabı seçin.</li>
        <li>Görev notuna yapılacakları yazın: “Sayfa 24–28, Test 3’ü çöz” gibi.</li>
        <li>Görev tamamlanırken doğru, yanlış ve boş sayılarını girin.</li>
      </ol>
      <p className="text-xs text-panel-text-muted">Sonuçlar görev üzerinden kaydedilir; kitapta test listesi ve tamamlanma oranı gösterilmez.</p>
      {onGoToPlan && <Button onClick={onGoToPlan} className="min-h-11">Çalışma planına git</Button>}
    </section>
  )
}
