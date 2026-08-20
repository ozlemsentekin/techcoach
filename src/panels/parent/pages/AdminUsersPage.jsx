import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronRight, LogIn, Pencil, Search, ShieldCheck, Trash2, X } from 'lucide-react'
import { authRequest } from '../../../services/authClient'
import { useAuth } from '../../../context/useAuth'
import PageHeader from '../../layout/PageHeader'
import LoadingState from '../../shared/LoadingState'
import EmptyState from '../../shared/EmptyState'
import ConfirmationDialog from '../../shared/ConfirmationDialog'
import Badge from '../../ui/Badge'
import Button from '../../ui/Button'
import DataTable from '../../ui/DataTable'
import { MotionDiv } from '../../ui/motion'
import SubjectPicker from '../components/SubjectPicker'

const ROLE_TONE = {
  ebeveyn: 'slate',
  ogrenci: 'sage',
  ogretmen: 'blue',
}

const ROLE_FILTERS = [
  { value: 'all', label: 'Tümü' },
  { value: 'ebeveyn', label: 'Ebeveyn' },
  { value: 'ogrenci', label: 'Öğrenci' },
  { value: 'ogretmen', label: 'Öğretmen' },
]

const PANEL_PATH_BY_ROLE = {
  ebeveyn: '/parent/dashboard',
  ogretmen: '/teacher/students',
  ogrenci: '/student/today',
}

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatPhone(value) {
  if (!value) return null
  const digits = value.replace(/\D/g, '').replace(/^90/, '')
  if (digits.length !== 10) return value
  return `0${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 8)} ${digits.slice(8, 10)}`
}

function RoleBadge({ user }) {
  if (!user.role) return <span className="text-sm text-[#667475]">—</span>
  return <Badge tone={ROLE_TONE[user.role] || 'neutral'}>{user.role}</Badge>
}

function ContactCell({ user }) {
  if (!user.email && !user.phone) {
    return <span className="text-sm text-[#667475]">—</span>
  }
  return (
    <div className="flex flex-col">
      {user.email ? <span className="text-sm text-[#667475]">{user.email}</span> : null}
      {user.phone ? <span className="text-xs text-[#87a3a5]">{formatPhone(user.phone)}</span> : null}
    </div>
  )
}

function EditUserModal({ user, isSelf, onSaved, onClose }) {
  const [fullName, setFullName] = useState(user.fullName || '')
  const [email, setEmail] = useState(user.email || '')
  const [phone, setPhone] = useState(user.phone || '')
  const [isAdmin, setIsAdmin] = useState(user.isAdmin)
  const [subjectIds, setSubjectIds] = useState(user.teacherSubjectIds || [])
  const [allSubjects, setAllSubjects] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const isTeacher = user.role === 'ogretmen'

  useEffect(() => {
    if (!isTeacher) return
    let ignore = false
    authRequest('/api/panel-admin/subjects', { method: 'GET' })
      .then((data) => {
        if (!ignore) setAllSubjects(data.subjects)
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })
    return () => {
      ignore = true
    }
  }, [isTeacher])

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (fullName.trim().length < 2) {
      setError('Ad soyad en az 2 karakter olmalı.')
      return
    }
    if (!email.trim() && !phone.trim()) {
      setError('E-posta veya telefon numarasından en az biri girilmeli.')
      return
    }

    setError('')
    setLoading(true)
    try {
      const data = await authRequest(`/api/panel-admin/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          isAdmin,
          ...(isTeacher ? { subjectIds } : {}),
        }),
      })
      onSaved(data.user)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md panel-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-panel-text">Üyeyi Düzenle</h2>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {error ? (
          <div className="mb-3 rounded-xl bg-panel-accent-soft px-3 py-1.5 text-sm text-panel-warm">{error}</div>
        ) : null}

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">Ad Soyad</span>
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">E-posta</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">Telefon</span>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="05XX XXX XX XX"
              className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
            />
            {user.role === 'ogrenci' ? (
              <span className="text-xs text-panel-text-muted">
                Öğrenci bu numarayla ebeveyn hesabından bağımsız olarak doğrudan giriş yapabilir.
              </span>
            ) : null}
          </label>

          {isTeacher ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-panel-text-muted">Branş</span>
              {allSubjects === null ? (
                <p className="text-xs text-panel-text-muted">Dersler yükleniyor...</p>
              ) : (
                <SubjectPicker
                  allSubjects={allSubjects}
                  selectedIds={subjectIds}
                  onChange={setSubjectIds}
                  allLabel="Tüm Dersler"
                  selectedLabel="Öğretmenin Branşları"
                />
              )}
            </div>
          ) : null}

          <label className={`flex items-center gap-2.5 ${isSelf ? 'opacity-50' : ''}`}>
            <input
              type="checkbox"
              checked={isAdmin}
              disabled={isSelf}
              onChange={(event) => setIsAdmin(event.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm font-medium text-panel-text">Admin yetkisi</span>
          </label>
          {isSelf ? (
            <p className="-mt-2 text-xs text-panel-text-muted">Kendi admin yetkinizi buradan kaldıramazsınız.</p>
          ) : null}

          <Button type="submit" disabled={loading} size="md" className="w-full">
            {loading ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        </div>
      </form>
    </div>
  )
}

function RowActions({ user, isSelf, impersonating, onEdit, onImpersonate, onDelete }) {
  return (
    <div className="flex items-center justify-end gap-3">
      {!isSelf && PANEL_PATH_BY_ROLE[user.role] ? (
        <button
          type="button"
          aria-label="Üyenin paneline giriş yap"
          title="Panele Giriş Yap"
          disabled={impersonating}
          className="text-[#87a3a5] hover:text-[#253d3e] disabled:opacity-50"
          onClick={() => onImpersonate(user)}
        >
          <LogIn size={14} aria-hidden="true" />
        </button>
      ) : null}
      <button
        type="button"
        aria-label="Üyeyi düzenle"
        className="text-[#87a3a5] hover:text-[#253d3e]"
        onClick={() => onEdit(user)}
      >
        <Pencil size={14} aria-hidden="true" />
      </button>
      {!isSelf ? (
        <button
          type="button"
          aria-label="Üyeyi sil"
          title="Üyeyi Sil"
          className="text-[#87a3a5] hover:text-panel-warm"
          onClick={() => onDelete(user)}
        >
          <Trash2 size={14} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  )
}

function UserRow({ user, indent = false, isSelf, impersonating, onEdit, onImpersonate, onDelete }) {
  return (
    <tr className="hover:bg-[#f8f7fb]">
      <td className="px-4 py-3 text-[#253d3e]">
        <div className={`flex items-center gap-2 ${indent ? 'pl-6' : ''}`}>
          <span className="text-sm font-semibold text-[#253d3e]">{user.fullName}</span>
          {user.isAdmin ? (
            <Badge tone="lilac">
              <ShieldCheck size={12} aria-hidden="true" />
              Admin
            </Badge>
          ) : null}
        </div>
      </td>
      <td className="px-4 py-3">
        <ContactCell user={user} />
      </td>
      <td className="px-4 py-3">
        <RoleBadge user={user} />
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-[#667475]">{formatDate(user.createdAt)}</td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-[#667475]">{formatDate(user.lastLoginAt)}</td>
      <td className="px-4 py-3 text-right">
        <RowActions
          user={user}
          isSelf={isSelf}
          impersonating={impersonating}
          onEdit={onEdit}
          onImpersonate={onImpersonate}
          onDelete={onDelete}
        />
      </td>
    </tr>
  )
}

function ParentRow({ user, students, isSelf, impersonating, onEdit, onImpersonate, onDelete }) {
  const [expanded, setExpanded] = useState(true)
  const hasStudents = students.length > 0

  return (
    <>
      <tr
        className={hasStudents ? 'cursor-pointer hover:bg-[#f8f7fb]' : 'hover:bg-[#f8f7fb]'}
        onClick={hasStudents ? () => setExpanded((value) => !value) : undefined}
      >
        <td className="px-4 py-3 text-[#253d3e]">
          <div className="flex items-center gap-2">
            <span className="flex w-4 shrink-0 items-center justify-center">
              {hasStudents ? (
                expanded ? (
                  <ChevronDown size={14} className="text-[#87a3a5]" aria-hidden="true" />
                ) : (
                  <ChevronRight size={14} className="text-[#87a3a5]" aria-hidden="true" />
                )
              ) : null}
            </span>
            <span className="text-sm font-semibold text-[#253d3e]">{user.fullName}</span>
            {user.isAdmin ? (
              <Badge tone="lilac">
                <ShieldCheck size={12} aria-hidden="true" />
                Admin
              </Badge>
            ) : null}
            {hasStudents ? (
              <span className="inline-flex items-center rounded-full bg-[#f8f7fb] px-2.5 py-1 text-xs font-medium text-[#1c2b5e]">
                {students.length} öğrenci
              </span>
            ) : null}
          </div>
        </td>
        <td className="px-4 py-3">
        <ContactCell user={user} />
      </td>
        <td className="px-4 py-3">
          <RoleBadge user={user} />
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-sm text-[#667475]">{formatDate(user.createdAt)}</td>
        <td className="whitespace-nowrap px-4 py-3 text-sm text-[#667475]">{formatDate(user.lastLoginAt)}</td>
        <td className="px-4 py-3 text-right" onClick={(event) => event.stopPropagation()}>
          <RowActions
            user={user}
            isSelf={isSelf}
            impersonating={impersonating}
            onEdit={onEdit}
            onImpersonate={onImpersonate}
            onDelete={onDelete}
          />
        </td>
      </tr>
      {hasStudents && expanded
        ? students.map((student) => (
            <UserRow
              key={student.id}
              user={student}
              indent
              isSelf={false}
              impersonating={impersonating}
              onEdit={onEdit}
              onImpersonate={onImpersonate}
              onDelete={onDelete}
            />
          ))
        : null}
    </>
  )
}

export default function AdminUsersPage() {
  const { authUser, impersonateUser } = useAuth()
  const navigate = useNavigate()
  const [users, setUsers] = useState(null)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [impersonatingId, setImpersonatingId] = useState('')
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [editingUser, setEditingUser] = useState(null)
  const [deletingUser, setDeletingUser] = useState(null)
  const [deletingUserError, setDeletingUserError] = useState('')
  const [deletingUserLoading, setDeletingUserLoading] = useState(false)

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

  const handleImpersonate = async (user) => {
    setActionError('')
    setImpersonatingId(user.id)
    try {
      const impersonatedUser = await impersonateUser(user.id)
      navigate(PANEL_PATH_BY_ROLE[impersonatedUser.role] || '/')
    } catch (err) {
      setActionError(err.message)
    } finally {
      setImpersonatingId('')
    }
  }

  const handleUserUpdated = (updatedUser) => {
    setUsers((current) =>
      (current || []).map((item) => (item.id === updatedUser.id ? { ...item, ...updatedUser } : item)),
    )
    setEditingUser(null)
  }

  const handleDeleteUser = async () => {
    if (!deletingUser) return
    setDeletingUserLoading(true)
    setDeletingUserError('')
    try {
      await authRequest(`/api/panel-admin/users/${deletingUser.id}`, { method: 'DELETE' })
      setUsers((current) => (current || []).filter((item) => item.id !== deletingUser.id))
      setDeletingUser(null)
    } catch (err) {
      setDeletingUserError(err.message)
    } finally {
      setDeletingUserLoading(false)
    }
  }

  const filteredUsers = useMemo(() => {
    if (!users) return null
    const q = query.trim().toLowerCase()
    return users.filter((user) => {
      const matchesQuery =
        !q ||
        user.fullName.toLowerCase().includes(q) ||
        (user.email || '').toLowerCase().includes(q) ||
        (user.phone || '').toLowerCase().includes(q)
      const matchesRole = roleFilter === 'all' || user.role === roleFilter
      return matchesQuery && matchesRole
    })
  }, [users, query, roleFilter])

  const studentsByParentId = new Map()
  filteredUsers?.forEach((user) => {
    if (!user.parentId) return
    const siblings = studentsByParentId.get(user.parentId) || []
    siblings.push(user)
    studentsByParentId.set(user.parentId, siblings)
  })

  const parentedStudentIds = new Set(
    filteredUsers
      ?.filter((user) => user.parentId && filteredUsers.some((candidate) => candidate.id === user.parentId))
      .map((user) => user.id) || [],
  )
  const topLevelUsers = filteredUsers?.filter((user) => !parentedStudentIds.has(user.id)) || []

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Üyeler"
        actions={
          users && users.length > 0 ? (
            <>
              <div className="relative">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#87a3a5]"
                  aria-hidden="true"
                />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Ad, e-posta veya telefon ara..."
                  className="w-48 rounded-lg border border-[#dfe4e5] bg-white py-1.5 pl-8 pr-3 text-sm text-[#253d3e] focus:outline-none focus:ring-2 focus:ring-[#1c2b5e]/20 sm:w-56"
                />
              </div>
              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
                className="rounded-lg border border-[#dfe4e5] bg-white px-3 py-1.5 text-sm text-[#253d3e] focus:outline-none focus:ring-2 focus:ring-[#1c2b5e]/20"
              >
                {ROLE_FILTERS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </>
          ) : null
        }
      />

      {actionError ? (
        <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{actionError}</div>
      ) : null}

      {error ? (
        <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{error}</div>
      ) : users === null ? (
        <LoadingState label="Kullanıcılar yükleniyor..." />
      ) : users.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="Henüz kullanıcı yok" />
      ) : (
        <MotionDiv initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <DataTable>
            {topLevelUsers.length === 0 ? (
              <p className="px-4 py-6 text-sm text-[#667475]">Aramayla eşleşen kullanıcı yok.</p>
            ) : (
              <table className="w-full min-w-[760px] text-left">
                <thead>
                  <tr className="bg-[#f8f7fb] text-[13px] font-semibold text-[#1c2b5e]">
                    <th className="px-4 py-3">Ad Soyad</th>
                    <th className="px-4 py-3">İletişim</th>
                    <th className="px-4 py-3">Rol</th>
                    <th className="px-4 py-3">Kayıt Tarihi</th>
                    <th className="px-4 py-3">Son Giriş</th>
                    <th className="w-10 px-4 py-3">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf0f1]">
                  {topLevelUsers.map((user) => (
                    <ParentRow
                      key={user.id}
                      user={user}
                      students={studentsByParentId.get(user.id) || []}
                      isSelf={user.id === authUser?.id}
                      impersonating={Boolean(impersonatingId)}
                      onEdit={setEditingUser}
                      onImpersonate={handleImpersonate}
                      onDelete={setDeletingUser}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </DataTable>
        </MotionDiv>
      )}

      {editingUser ? (
        <EditUserModal
          user={editingUser}
          isSelf={editingUser.id === authUser?.id}
          onSaved={handleUserUpdated}
          onClose={() => setEditingUser(null)}
        />
      ) : null}

      {deletingUser ? (
        <ConfirmationDialog
          title="Üyeyi Sil"
          description={
            deletingUserError ||
            `"${deletingUser.fullName}" adlı üyeyi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`
          }
          confirmLabel={deletingUserLoading ? 'Siliniyor...' : 'Sil'}
          cancelLabel="Vazgeç"
          onConfirm={handleDeleteUser}
          onCancel={() => {
            setDeletingUser(null)
            setDeletingUserError('')
          }}
        />
      ) : null}
    </div>
  )
}
