import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { authRequest } from '../../../services/authClient'
import PageHeader from '../../layout/PageHeader'
import LoadingState from '../../shared/LoadingState'
import EmptyState from '../../shared/EmptyState'

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false

    authRequest('/api/panel-admin/users', { method: 'GET' })
      .then((data) => {
        if (!ignore) setUsers(data.users)
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })

    return () => {
      ignore = true
    }
  }, [])

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <PageHeader title="Admin Paneli" subtitle="Sistemdeki tüm kullanıcılar" />

      {error ? (
        <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{error}</div>
      ) : users === null ? (
        <LoadingState label="Kullanıcılar yükleniyor..." />
      ) : users.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="Henüz kullanıcı yok" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-panel-border bg-panel-surface">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-panel-border text-panel-text-muted">
                <th className="px-4 py-3 font-medium">Ad Soyad</th>
                <th className="px-4 py-3 font-medium">E-posta</th>
                <th className="px-4 py-3 font-medium">Rol</th>
                <th className="px-4 py-3 font-medium">Ebeveyn</th>
                <th className="px-4 py-3 font-medium">Kayıt Tarihi</th>
                <th className="px-4 py-3 font-medium">Son Giriş</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-panel-border last:border-0">
                  <td className="px-4 py-3 text-panel-text">
                    <div className="flex items-center gap-2">
                      {user.fullName}
                      {user.isAdmin ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-panel-lilac-soft px-2 py-0.5 text-xs font-medium text-panel-lilac">
                          <ShieldCheck size={12} aria-hidden="true" />
                          Admin
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-panel-text-muted">{user.email}</td>
                  <td className="px-4 py-3 text-panel-text-muted">{user.role || '—'}</td>
                  <td className="px-4 py-3 text-panel-text-muted">{user.parentName || '—'}</td>
                  <td className="px-4 py-3 text-panel-text-muted">{formatDate(user.createdAt)}</td>
                  <td className="px-4 py-3 text-panel-text-muted">{formatDate(user.lastLoginAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
