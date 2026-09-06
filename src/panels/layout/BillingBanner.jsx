import { AlertTriangle } from 'lucide-react'
import { useBillingGate } from '../../context/useBillingGate'

// Ödeme gecikmesi uyarı bandı — tüm panellerde (veli / öğrenci / öğretmen) PanelLayout içinde,
// içerik akışının üstünde gösterilir.
//   grace      → sarı bant, tam erişim sürüyor, kalan gün bilgisi
//   restricted → kırmızı bant, yeni görev ekleme kapalı
export default function BillingBanner() {
  const { billingState, overdueDays, promptPayment } = useBillingGate()

  if (billingState !== 'grace' && billingState !== 'restricted') {
    return null
  }

  const daysLeft = typeof overdueDays === 'number' ? Math.max(3 - overdueDays, 0) : null
  const isRestricted = billingState === 'restricted'

  const message = isRestricted
    ? 'Aboneliğinizin ödemesi alınamadı. Ödemeyi tamamlayana kadar yeni görev ekleyemezsiniz — mevcut plan ve kayıtlarınız görüntülenmeye devam eder.'
    : daysLeft && daysLeft > 0
      ? `Ödemeniz alınamadı. ${daysLeft} gün içinde ödeme yapılmazsa yeni görev ekleme kapanacak.`
      : 'Ödemeniz alınamadı. En kısa sürede ödeme yapın, aksi halde yeni görev ekleme kapanacak.'

  return (
    <div
      role="alert"
      className={`mb-4 flex flex-col gap-2 rounded-xl border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between ${
        isRestricted
          ? 'border-panel-red/40 bg-panel-red-soft text-panel-red'
          : 'border-panel-accent/40 bg-panel-accent-soft text-panel-warm'
      }`}
    >
      <span className="flex items-start gap-2">
        <AlertTriangle size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
        <span>{message}</span>
      </span>
      <button
        type="button"
        onClick={promptPayment}
        className={`shrink-0 self-start rounded-lg px-3 py-1.5 text-sm font-semibold text-white sm:self-auto ${
          isRestricted ? 'bg-panel-red' : 'bg-panel-warm'
        }`}
      >
        Şimdi Öde
      </button>
    </div>
  )
}
