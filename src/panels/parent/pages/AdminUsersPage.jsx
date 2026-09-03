import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronRight, Library, LogIn, Pencil, Search, ShieldCheck, Trash2, X } from 'lucide-react'
import { authRequest } from '../../../services/authClient'
import { useAuth } from '../../../context/useAuth'
import PageHeader from '../../layout/PageHeader'
import LoadingState from '../../shared/LoadingState'
import EmptyState from '../../shared/EmptyState'
import ConfirmationDialog from '../../shared/ConfirmationDialog'
import Badge from '../../ui/Badge'
import Button from '../../ui/Button'
import DataTable from '../../ui/DataTable'
import SubjectPicker from '../components/SubjectPicker'

const ROLE_TONE = {
  ebeveyn: 'slate',
  ogrenci: 'sage',
  ogretmen: 'blue',
}

const TABS = [
  { value: 'veliler', label: 'Veliler' },
  { value: 'ogretmenler', label: 'Öğretmenler' },
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

function formatDateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
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

// Admin olmayıp kütüphane düzenleme yetkisi verilmiş kullanıcılar için rozet.
function LibraryBadge({ user }) {
  if (user.isAdmin || !user.canManageLibrary) return null
  return (
    <Badge tone="sage">
      <Library size={12} aria-hidden="true" />
      Kütüphane
    </Badge>
  )
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
  const [canManageLibrary, setCanManageLibrary] = useState(Boolean(user.canManageLibrary))
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
          canManageLibrary,
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
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="h-full w-full max-w-md overflow-y-auto border border-panel-border bg-panel-surface p-4 shadow-panel-1 sm:h-auto sm:max-h-[90vh] sm:rounded-2xl sm:p-5"
      >
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

          <label className="flex items-center gap-2.5">
            <input
              type="checkbox"
              checked={isAdmin || canManageLibrary}
              disabled={isAdmin}
              onChange={(event) => setCanManageLibrary(event.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm font-medium text-panel-text">Kütüphane düzenleme yetkisi</span>
          </label>
          <p className="-mt-2 text-xs text-panel-text-muted">
            {isAdmin
              ? 'Admin kullanıcılar kütüphaneyi zaten düzenleyebilir.'
              : 'Bu yetki verilen kullanıcı; yayın evi, kaynak, içerik, test ve cevap anahtarı ekleyip düzenleyebilir. Verilmeyenler kütüphaneyi yalnızca görüntüler.'}
          </p>

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
          <LibraryBadge user={user} />
        </div>
      </td>
      <td className="px-4 py-3">
        <ContactCell user={user} />
      </td>
      <td className="px-4 py-3">
        <RoleBadge user={user} />
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-[#667475]">{formatDate(user.createdAt)}</td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-[#667475]">{formatDateTime(user.lastLoginAt)}</td>
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

function UserMobileCard({ user, indent = false, isSelf, impersonating, onEdit, onImpersonate, onDelete }) {
  return (
    <article className={`rounded-xl border border-panel-border bg-white p-4 shadow-sm ${indent ? 'ml-4 border-dashed' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <h3 className="min-w-0 truncate text-sm font-bold text-[#253d3e]">{user.fullName}</h3>
            {user.isAdmin ? (
              <Badge tone="lilac">
                <ShieldCheck size={12} aria-hidden="true" />
                Admin
              </Badge>
            ) : null}
            <LibraryBadge user={user} />
          </div>
          <div className="mt-1">
            <ContactCell user={user} />
          </div>
        </div>
        <RowActions
          user={user}
          isSelf={isSelf}
          impersonating={impersonating}
          onEdit={onEdit}
          onImpersonate={onImpersonate}
          onDelete={onDelete}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <RoleBadge user={user} />
        <span className="rounded-full bg-[#f8f7fb] px-2.5 py-1 text-[11px] font-semibold text-[#667475]">
          Kayıt: {formatDate(user.createdAt)}
        </span>
        <span className="rounded-full bg-[#f8f7fb] px-2.5 py-1 text-[11px] font-semibold text-[#667475]">
          Son giriş: {formatDateTime(user.lastLoginAt)}
        </span>
      </div>
    </article>
  )
}

function GroupRow({ user, students, isSelf, impersonating, onEdit, onImpersonate, onDelete }) {
  const [expanded, setExpanded] = useState(false)
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
            <LibraryBadge user={user} />
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
        <td className="whitespace-nowrap px-4 py-3 text-sm text-[#667475]">{formatDateTime(user.lastLoginAt)}</td>
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

function GroupMobileCard({ user, students, isSelf, impersonating, onEdit, onImpersonate, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const hasStudents = students.length > 0

  return (
    <div className="flex flex-col gap-2">
      <article className="rounded-xl border border-panel-border bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            disabled={!hasStudents}
            onClick={() => setExpanded((value) => !value)}
            className="flex min-w-0 flex-1 items-start gap-2 text-left disabled:cursor-default"
          >
            <span className="mt-0.5 flex w-4 shrink-0 items-center justify-center">
              {hasStudents ? (
                expanded ? (
                  <ChevronDown size={14} className="text-[#87a3a5]" aria-hidden="true" />
                ) : (
                  <ChevronRight size={14} className="text-[#87a3a5]" aria-hidden="true" />
                )
              ) : null}
            </span>
            <span className="min-w-0">
              <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                <span className="min-w-0 truncate text-sm font-bold text-[#253d3e]">{user.fullName}</span>
                {user.isAdmin ? (
                  <Badge tone="lilac">
                    <ShieldCheck size={12} aria-hidden="true" />
                    Admin
                  </Badge>
                ) : null}
                <LibraryBadge user={user} />
                {hasStudents ? (
                  <span className="inline-flex items-center rounded-full bg-[#f8f7fb] px-2.5 py-1 text-xs font-medium text-[#1c2b5e]">
                    {students.length} öğrenci
                  </span>
                ) : null}
              </span>
              <span className="mt-1 block">
                <ContactCell user={user} />
              </span>
            </span>
          </button>

          <RowActions
            user={user}
            isSelf={isSelf}
            impersonating={impersonating}
            onEdit={onEdit}
            onImpersonate={onImpersonate}
            onDelete={onDelete}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 pl-6">
          <RoleBadge user={user} />
          <span className="rounded-full bg-[#f8f7fb] px-2.5 py-1 text-[11px] font-semibold text-[#667475]">
            Kayıt: {formatDate(user.createdAt)}
          </span>
          <span className="rounded-full bg-[#f8f7fb] px-2.5 py-1 text-[11px] font-semibold text-[#667475]">
            Son giriş: {formatDateTime(user.lastLoginAt)}
          </span>
        </div>
      </article>

      {hasStudents && expanded
        ? students.map((student) => (
            <UserMobileCard
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
    </div>
  )
}

export default function AdminUsersPage() {
  const { authUser, impersonateUser } = useAuth()
  const navigate = useNavigate()
  const [users, setUsers] = useState(null)
  const [teacherLinks, setTeacherLinks] = useState([])
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [impersonatingId, setImpersonatingId] = useState('')
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState('veliler')
  const [editingUser, setEditingUser] = useState(null)
  const [deletingUser, setDeletingUser] = useState(null)
  const [deletingUserError, setDeletingUserError] = useState('')
  const [deletingUserLoading, setDeletingUserLoading] = useState(false)

  useEffect(() => {
    let ignore = false

    authRequest('/api/panel-admin/users', { method: 'GET' })
      .then((data) => {
        if (!ignore) {
          setUsers(data.users)
          setTeacherLinks(data.teacherLinks || [])
        }
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
    if (!q) return users
    return users.filter(
      (user) =>
        user.fullName.toLowerCase().includes(q) ||
        (user.email || '').toLowerCase().includes(q) ||
        (user.phone || '').toLowerCase().includes(q),
    )
  }, [users, query])

  const parentCount = useMemo(() => (users || []).filter((u) => u.role === 'ebeveyn').length, [users])
  const teacherCount = useMemo(() => (users || []).filter((u) => u.role === 'ogretmen').length, [users])

  // Aktif sekmeye göre üst seviye üyeleri ve altlarında girintili gösterilecek
  // öğrencileri hesapla. Veliler sekmesi: veli + parentId ile bağlı çocuklar.
  // Öğretmenler sekmesi: öğretmen + StudentTeachers ile bağlı öğrenciler.
  const { groups, orphans } = useMemo(() => {
    if (!filteredUsers) return { groups: [], orphans: [] }
    const byId = new Map(filteredUsers.map((u) => [u.id, u]))

    if (tab === 'ogretmenler') {
      const studentsByTeacher = new Map()
      teacherLinks.forEach(({ teacherId, studentId }) => {
        if (!byId.has(teacherId) || !byId.has(studentId)) return
        const list = studentsByTeacher.get(teacherId) || []
        if (!list.some((s) => s.id === studentId)) list.push(byId.get(studentId))
        studentsByTeacher.set(teacherId, list)
      })
      const teacherGroups = filteredUsers
        .filter((u) => u.role === 'ogretmen')
        .map((teacher) => ({ user: teacher, students: studentsByTeacher.get(teacher.id) || [] }))
      return { groups: teacherGroups, orphans: [] }
    }

    const studentsByParent = new Map()
    filteredUsers.forEach((u) => {
      if (u.role !== 'ogrenci' || !u.parentId || !byId.has(u.parentId)) return
      const list = studentsByParent.get(u.parentId) || []
      list.push(u)
      studentsByParent.set(u.parentId, list)
    })
    const parentGroups = filteredUsers
      .filter((u) => u.role === 'ebeveyn')
      .map((parent) => ({ user: parent, students: studentsByParent.get(parent.id) || [] }))
    const orphanStudents = filteredUsers.filter(
      (u) => u.role === 'ogrenci' && !(u.parentId && byId.has(u.parentId)),
    )
    return { groups: parentGroups, orphans: orphanStudents }
  }, [filteredUsers, teacherLinks, tab])

  const isEmpty = groups.length === 0 && orphans.length === 0

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Üyeler"
        actions={
          users && users.length > 0 ? (
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
        <div className="fade-slide-in flex flex-col gap-4">
          <div className="flex gap-1 border-b border-panel-border">
            {TABS.map((option) => {
              const count = option.value === 'veliler' ? parentCount : teacherCount
              const active = tab === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTab(option.value)}
                  className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
                    active
                      ? 'border-[#1c2b5e] text-[#1c2b5e]'
                      : 'border-transparent text-[#667475] hover:text-[#253d3e]'
                  }`}
                >
                  {option.label}
                  <span className="ml-1.5 text-xs font-medium text-[#87a3a5]">{count}</span>
                </button>
              )
            })}
          </div>

          {isEmpty ? (
            <p className="rounded-xl border border-dashed border-panel-border bg-white px-4 py-6 text-sm text-[#667475]">
              {query.trim()
                ? 'Aramayla eşleşen kayıt yok.'
                : tab === 'veliler'
                  ? 'Henüz veli kaydı yok.'
                  : 'Henüz öğretmen kaydı yok.'}
            </p>
          ) : (
            <>
              <div className="grid gap-3 md:hidden">
                {groups.map(({ user, students }) => (
                  <GroupMobileCard
                    key={user.id}
                    user={user}
                    students={students}
                    isSelf={user.id === authUser?.id}
                    impersonating={Boolean(impersonatingId)}
                    onEdit={setEditingUser}
                    onImpersonate={handleImpersonate}
                    onDelete={setDeletingUser}
                  />
                ))}
                {orphans.map((student) => (
                  <UserMobileCard
                    key={student.id}
                    user={student}
                    isSelf={student.id === authUser?.id}
                    impersonating={Boolean(impersonatingId)}
                    onEdit={setEditingUser}
                    onImpersonate={handleImpersonate}
                    onDelete={setDeletingUser}
                  />
                ))}
              </div>

              <DataTable className="hidden md:block">
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
                  {groups.map(({ user, students }) => (
                    <GroupRow
                      key={user.id}
                      user={user}
                      students={students}
                      isSelf={user.id === authUser?.id}
                      impersonating={Boolean(impersonatingId)}
                      onEdit={setEditingUser}
                      onImpersonate={handleImpersonate}
                      onDelete={setDeletingUser}
                    />
                  ))}
                  {orphans.map((student) => (
                    <UserRow
                      key={student.id}
                      user={student}
                      isSelf={student.id === authUser?.id}
                      impersonating={Boolean(impersonatingId)}
                      onEdit={setEditingUser}
                      onImpersonate={handleImpersonate}
                      onDelete={setDeletingUser}
                    />
                  ))}
                </tbody>
              </table>
              </DataTable>
            </>
          )}
        </div>
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
