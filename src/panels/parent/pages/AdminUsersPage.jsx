import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Search, ShieldCheck } from 'lucide-react'
import { authRequest } from '../../../services/authClient'
import PageHeader from '../../layout/PageHeader'
import LoadingState from '../../shared/LoadingState'
import EmptyState from '../../shared/EmptyState'
import Badge from '../../ui/Badge'
import DataTable from '../../ui/DataTable'
import { MotionDiv } from '../../ui/motion'

const ROLE_TONE = {
  ebeveyn: 'slate',
  ogrenci: 'sage',
}

const ROLE_FILTERS = [
  { value: 'all', label: 'Tümü' },
  { value: 'ebeveyn', label: 'Ebeveyn' },
  { value: 'ogrenci', label: 'Öğrenci' },
]

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function RoleBadge({ user }) {
  if (!user.role) return <span className="text-sm text-[#667475]">—</span>
  return <Badge tone={ROLE_TONE[user.role] || 'neutral'}>{user.role}</Badge>
}

function UserRow({ user, indent = false }) {
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
      <td className="px-4 py-3 text-sm text-[#667475]">{user.email}</td>
      <td className="px-4 py-3">
        <RoleBadge user={user} />
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-[#667475]">{formatDate(user.createdAt)}</td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-[#667475]">{formatDate(user.lastLoginAt)}</td>
    </tr>
  )
}

function ParentRow({ user, students }) {
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
              <span className="inline-flex items-center rounded-full bg-[#f8f7fb] px-2.5 py-1 text-xs font-medium text-[#655e94]">
                {students.length} öğrenci
              </span>
            ) : null}
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-[#667475]">{user.email}</td>
        <td className="px-4 py-3">
          <RoleBadge user={user} />
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-sm text-[#667475]">{formatDate(user.createdAt)}</td>
        <td className="whitespace-nowrap px-4 py-3 text-sm text-[#667475]">{formatDate(user.lastLoginAt)}</td>
      </tr>
      {hasStudents && expanded
        ? students.map((student) => <UserRow key={student.id} user={student} indent />)
        : null}
    </>
  )
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')

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

  const filteredUsers = useMemo(() => {
    if (!users) return null
    const q = query.trim().toLowerCase()
    return users.filter((user) => {
      const matchesQuery =
        !q || user.fullName.toLowerCase().includes(q) || user.email.toLowerCase().includes(q)
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
                  placeholder="Ad veya e-posta ara..."
                  className="w-48 rounded-lg border border-[#dfe4e5] bg-white py-1.5 pl-8 pr-3 text-sm text-[#253d3e] focus:outline-none focus:ring-2 focus:ring-[#655e94]/20 sm:w-56"
                />
              </div>
              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
                className="rounded-lg border border-[#dfe4e5] bg-white px-3 py-1.5 text-sm text-[#253d3e] focus:outline-none focus:ring-2 focus:ring-[#655e94]/20"
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
              <table className="w-full min-w-[720px] text-left">
                <thead>
                  <tr className="bg-[#f8f7fb] text-[13px] font-semibold text-[#655e94]">
                    <th className="px-4 py-3">Ad Soyad</th>
                    <th className="px-4 py-3">E-posta</th>
                    <th className="px-4 py-3">Rol</th>
                    <th className="px-4 py-3">Kayıt Tarihi</th>
                    <th className="px-4 py-3">Son Giriş</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf0f1]">
                  {topLevelUsers.map((user) => (
                    <ParentRow key={user.id} user={user} students={studentsByParentId.get(user.id) || []} />
                  ))}
                </tbody>
              </table>
            )}
          </DataTable>
        </MotionDiv>
      )}
    </div>
  )
}
