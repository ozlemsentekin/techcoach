import { useAuth } from '../../../context/useAuth'
import PageHeader from '../../layout/PageHeader'

export default function SettingsPage() {
  const { authUser, logout } = useAuth()

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <PageHeader title="Ayarlar" />
      <div className="rounded-2xl border border-panel-border bg-panel-surface p-5">
        <div className="flex flex-col gap-2 text-base text-panel-text">
          <p>
            <span className="text-panel-text-muted">Ad Soyad:</span> {authUser?.fullName}
          </p>
          <p>
            <span className="text-panel-text-muted">E-posta:</span> {authUser?.email}
          </p>
        </div>
        <button
          type="button"
          onClick={() => logout().catch(() => {})}
          className="mt-5 rounded-xl border border-panel-border px-4 py-3 text-base font-medium text-panel-text"
        >
          Çıkış Yap
        </button>
      </div>
    </div>
  )
}
