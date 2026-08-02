import { Capacitor } from '@capacitor/core'
import { useAuth } from '../context/useAuth'

export default function PaywallPage() {
  const { authUser, logout } = useAuth()
  const isNative = Capacitor.isNativePlatform()
  const status = authUser?.entitlement?.status || 'none'

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-panel-bg px-6 text-center text-panel-text">
      <h1 className="text-2xl font-semibold">Abonelik Gerekli</h1>
      <p className="max-w-md text-panel-text-muted">
        {status === 'expired' || status === 'cancelled'
          ? 'Aboneliğiniz sona erdi. Devam etmek için yenilemeniz gerekiyor.'
          : 'techcoach\'u kullanmaya devam etmek için bir abonelik gerekiyor.'}
      </p>
      {isNative ? (
        <p className="max-w-md text-sm text-panel-text-muted">
          Abonelik satın alma yakında burada açılacak.
        </p>
      ) : (
        <p className="max-w-md text-sm text-panel-text-muted">
          Abonelik satın almak için techcoach mobil uygulamasını indirin.
        </p>
      )}
      <button
        type="button"
        onClick={logout}
        className="rounded-md border border-panel-border px-4 py-2 text-sm text-panel-text-muted hover:text-panel-text"
      >
        Oturumu kapat
      </button>
    </div>
  )
}
