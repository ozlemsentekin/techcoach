import { useEffect, useMemo, useState } from 'react'
import { BookOpen, CalendarDays, Eye, GraduationCap, KeyRound, Mail, Phone, Search, UserRound, Users, X } from 'lucide-react'
import { authRequest } from '../../../services/authClient'
import PageHeader from '../../layout/PageHeader'
import EmptyState from '../../shared/EmptyState'
import LoadingState from '../../shared/LoadingState'
import ActionsMenu from '../../ui/ActionsMenu'
import Button from '../../ui/Button'
import DataTable from '../../ui/DataTable'
import { MotionDiv } from '../../ui/motion'
import TeacherProfileModal from '../components/TeacherProfileModal'
import TeacherResourceBooksModal from '../components/TeacherResourceBooksModal'
import GrantTeacherAccessDialog from '../components/GrantTeacherAccessDialog'

const WEEKDAY_SHORT_LABELS = {
  pazartesi: 'Pzt',
  sali: 'Salı',
  carsamba: 'Çrş',
  persembe: 'Prş',
  cuma: 'Cuma',
  cumartesi: 'Cmt',
  pazar: 'Paz',
}

const RESOURCE_BOOK_TYPE_LABELS = {
  konu_anlatimi: 'Konu Anlatımı',
  soru_bankasi: 'Soru Bankası',
  okuma_kitabi: 'Okuma Kitabı',
}

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '')
  return digits || normalizeText(value)
}

function teacherGroupKey(teacher) {
  return [normalizeText(teacher.fullName), normalizePhone(teacher.phone)].join('|')
}

function getTeacherAssociations(teacher, teachers) {
  const key = teacherGroupKey(teacher)
  return (teachers || []).filter((item) => teacherGroupKey(item) === key)
}

function groupAssociationCounts(teachers) {
  const counts = new Map()
  const teacherList = teachers || []

  teacherList.forEach((teacher) => {
    const key = teacherGroupKey(teacher)
    counts.set(key, (counts.get(key) || 0) + 1)
  })
  return counts
}

function uniqueValues(values) {
  return Array.from(new Set(values.filter(Boolean)))
}

function scheduleText(teacher) {
  if (teacher.type !== 'ozel_ogretmen' || !teacher.schedule?.length) {
    return 'Program yok'
  }

  return teacher.schedule
    .map((row) => `${WEEKDAY_SHORT_LABELS[row.dayOfWeek] || row.dayOfWeek} ${row.startTime}-${row.endTime}`)
    .join(', ')
}

function resourceNames(teacher) {
  return teacher.resourceBooks?.map((book) => book.name).filter(Boolean) || []
}

function resourceCountText(count) {
  return count === 1 ? '1 kaynak' : `${count} kaynak`
}

function ResourceSummary({ teacher }) {
  const names = resourceNames(teacher)

  if (!names.length) {
    return <span className="text-sm text-[#8a9697]">Kaynak yok</span>
  }

  const visibleNames = names.slice(0, 2)
  const hiddenCount = names.length - visibleNames.length

  return (
    <div className="flex max-w-[340px] flex-wrap gap-1.5">
      {visibleNames.map((name) => (
        <span key={name} className="max-w-[155px] truncate rounded-full bg-[#fbe9d7] px-2.5 py-1 text-xs font-semibold text-[#c96a1f]">
          {name}
        </span>
      ))}
      {hiddenCount > 0 ? (
        <span className="rounded-full bg-[#eef3f3] px-2.5 py-1 text-xs font-semibold text-[#5f7f81]">+{hiddenCount}</span>
      ) : null}
    </div>
  )
}

function TeacherResourceList({ resourceBooks }) {
  const books = resourceBooks || []

  if (!books.length) {
    return (
      <div className="rounded-xl border border-dashed border-[#dfe4e5] bg-white px-3 py-4 text-sm text-[#8a9697]">
        Bu öğrenci için takip edilen kaynak yok.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
      {books.map((book) => (
        <div key={book.id} className="flex min-w-0 items-start gap-3 rounded-xl border border-[#e5e8e9] bg-white p-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#fbe9d7] text-[#c96a1f]">
            <BookOpen size={17} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm font-semibold leading-snug text-[#253d3e]">{book.name}</p>
            <p className="mt-1 truncate text-xs text-[#667475]">{book.publisherName || 'Yayın evi yok'}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-[#fbe9d7] px-2 py-0.5 text-[11px] font-semibold text-[#c96a1f]">
                {book.subjectName || 'Derssiz'}
              </span>
              <span className="rounded-full bg-[#eef3f3] px-2 py-0.5 text-[11px] font-semibold text-[#5f7f81]">
                {RESOURCE_BOOK_TYPE_LABELS[book.type] || book.type}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function TeacherDetailCard({ teacher, associations, onEditResources, onClose }) {
  const subjects = uniqueValues(associations.map((item) => item.subjectName))
  const totalResourceCount = associations.reduce((total, item) => total + (item.resourceBooks?.length || 0), 0)

  return (
    <MotionDiv
      key={teacher.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-[#e4e8e9] bg-white shadow-[0_4px_16px_rgba(37,61,62,0.06)]"
    >
      <div className="flex flex-col gap-4 border-b border-[#edf0f1] px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#fbe9d7] text-[#c96a1f]">
            <GraduationCap size={24} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase text-[#1c2b5e]">Öğretmen Detayı</p>
            <h2 className="mt-1 truncate text-lg font-bold text-[#253d3e]">{teacher.fullName}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[#667475]">
              <a href={`tel:${teacher.phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-1.5">
                <Phone size={14} aria-hidden="true" />
                {teacher.phone}
              </a>
              <span className="inline-flex items-center gap-1.5">
                <Users size={14} aria-hidden="true" />
                {associations.length} ilişkili öğrenci
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[#eef3f3] px-3 py-1 text-xs font-semibold text-[#5f7f81]">
            {teacher.typeLabel}
          </span>
          <span className="rounded-full bg-[#fbe9d7] px-3 py-1 text-xs font-semibold text-[#c96a1f]">
            {resourceCountText(totalResourceCount)}
          </span>
          {subjects.slice(0, 3).map((subject) => (
            <span key={subject} className="rounded-full bg-[#fbf0dd] px-3 py-1 text-xs font-semibold text-[#8f6a3c]">
              {subject}
            </span>
          ))}
          <button
            type="button"
            aria-label="Detay kartını kapat"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#667475] hover:bg-[#f3f5f5] hover:text-[#253d3e]"
          >
            <X size={17} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 p-4">
        {associations.map((association) => (
          <article key={association.id} className="rounded-xl border border-[#e5e8e9] bg-[#fbfcfc] p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-bold text-[#253d3e]">{association.studentFullName || 'Öğrenci'}</h3>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#1c2b5e]">
                    {association.subjectName || 'Ders seçilmedi'}
                  </span>
                </div>
                {association.studentEmail ? (
                  <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-[#667475]">
                    <Mail size={14} aria-hidden="true" />
                    {association.studentEmail}
                  </p>
                ) : null}
                <p className="mt-2 inline-flex max-w-full items-center gap-1.5 text-sm text-[#667475]">
                  <CalendarDays size={14} className="shrink-0" aria-hidden="true" />
                  <span className="truncate">{scheduleText(association)}</span>
                </p>
              </div>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-[34px] rounded-[9px] border-[#dfe4e5] bg-white text-[#253d3e] hover:bg-[#f8f7fb]"
                onClick={() => onEditResources(association)}
              >
                <BookOpen size={14} aria-hidden="true" />
                Kaynakları Düzenle
              </Button>
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-[#253d3e]">Takip Edilen Kaynaklar</p>
                <span className="text-xs font-semibold text-[#667475]">
                  {resourceCountText(association.resourceBooks?.length || 0)}
                </span>
              </div>
              <TeacherResourceList resourceBooks={association.resourceBooks} />
            </div>
          </article>
        ))}
      </div>
    </MotionDiv>
  )
}

export default function TeachersPage() {
  const [teachers, setTeachers] = useState(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [resourceModalTeacher, setResourceModalTeacher] = useState(null)
  const [profileModalTeacher, setProfileModalTeacher] = useState(null)
  const [detailTeacherId, setDetailTeacherId] = useState(null)
  const [openMenuTeacherId, setOpenMenuTeacherId] = useState(null)
  const [grantAccessTeacher, setGrantAccessTeacher] = useState(null)

  useEffect(() => {
    let ignore = false

    authRequest('/api/parent/teachers', { method: 'GET' })
      .then((data) => {
        if (!ignore) setTeachers(data.teachers)
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })

    return () => {
      ignore = true
    }
  }, [])

  const filteredTeachers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('tr-TR')
    if (!normalizedQuery) return teachers || []

    return (teachers || []).filter((teacher) =>
      [
        teacher.fullName,
        teacher.studentFullName,
        teacher.subjectName,
        teacher.phone,
        teacher.typeLabel,
        ...resourceNames(teacher),
      ]
        .filter(Boolean)
        .some((value) => value.toLocaleLowerCase('tr-TR').includes(normalizedQuery)),
    )
  }, [query, teachers])

  const associationCounts = useMemo(() => groupAssociationCounts(teachers), [teachers])
  const selectedTeacher = useMemo(
    () => (teachers || []).find((teacher) => teacher.id === detailTeacherId) || null,
    [detailTeacherId, teachers],
  )
  const selectedTeacherAssociations = useMemo(
    () => (selectedTeacher ? getTeacherAssociations(selectedTeacher, teachers) : []),
    [selectedTeacher, teachers],
  )

  const handleTeacherResourcesSaved = (teacherId, resourceBooks, resourceCount) => {
    setTeachers((current) =>
      (current || []).map((teacher) =>
        teacher.id === teacherId
          ? { ...teacher, resourceBooks: resourceBooks.filter((book) => book.assigned), resourceCount }
          : teacher,
      ),
    )
    setResourceModalTeacher(null)
  }

  const toggleTeacherDetail = (teacher) => {
    setDetailTeacherId((current) => (current === teacher.id ? null : teacher.id))
  }

  const handleTeacherProfileSaved = (updatedTeacher) => {
    if (!updatedTeacher) return
    setTeachers((current) =>
      (current || []).map((teacher) =>
        teacher.id === updatedTeacher.id
          ? {
              ...teacher,
              fullName: updatedTeacher.fullName,
              subjectId: updatedTeacher.subjectId,
              subjectName: updatedTeacher.subjectName,
              phone: updatedTeacher.phone,
              type: updatedTeacher.type,
              typeLabel: updatedTeacher.typeLabel,
              schedule: updatedTeacher.schedule,
              updatedAt: updatedTeacher.updatedAt,
            }
          : teacher,
      ),
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Öğretmenler" />

      {error ? (
        <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{error}</div>
      ) : teachers === null ? (
        <LoadingState label="Öğretmenler yükleniyor..." />
      ) : teachers.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="Henüz öğretmen eklenmedi"
          description="Öğrenci profillerinden eklenen öğretmenler burada listelenir."
        />
      ) : (
        <MotionDiv initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#87a3a5]"
                aria-hidden="true"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Öğretmen, öğrenci, ders veya kaynak ara..."
                className="w-full rounded-xl border border-[#dfe4e5] bg-white py-2.5 pl-9 pr-3 text-sm text-[#253d3e] focus:outline-none focus:ring-2 focus:ring-[#1c2b5e]/20"
              />
            </div>

            <span className="rounded-full bg-[#fbe9d7] px-3 py-1 text-xs font-semibold text-[#c96a1f]">
              {filteredTeachers.length} öğretmen
            </span>
          </div>

          {filteredTeachers.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#dfe4e5] bg-white px-4 py-8 text-center text-sm text-[#667475]">
              Aramayla eşleşen öğretmen yok.
            </p>
          ) : (
            <>
              {selectedTeacher ? (
                <TeacherDetailCard
                  teacher={selectedTeacher}
                  associations={selectedTeacherAssociations}
                  onEditResources={setResourceModalTeacher}
                  onClose={() => setDetailTeacherId(null)}
                />
              ) : null}

              <DataTable>
                <table className="w-full min-w-[1160px] text-left">
                  <thead>
                    <tr className="bg-[#f8f7fb] text-[13px] font-semibold text-[#1c2b5e]">
                      <th className="px-4 py-3">Öğretmen</th>
                      <th className="px-4 py-3">Öğrenci</th>
                      <th className="px-4 py-3">Ders</th>
                      <th className="px-4 py-3">Tip</th>
                      <th className="px-4 py-3">Program</th>
                      <th className="px-4 py-3">Takip Edilen Kaynaklar</th>
                      <th className="px-4 py-3 text-right">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf0f1]">
                    {filteredTeachers.map((teacher) => {
                      const associationCount = associationCounts.get(teacherGroupKey(teacher)) || 1
                      const detailSelected = selectedTeacher?.id === teacher.id

                      return (
                        <tr key={teacher.id} className={detailSelected ? 'bg-[#f8f7fb]' : 'hover:bg-[#f8f7fb]'}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-semibold text-[#253d3e]">{teacher.fullName}</p>
                              {teacher.teacherUserId ? (
                                <span className="rounded-full bg-[#e8f3ee] px-2 py-0.5 text-[10px] font-semibold text-[#3f8f6c]">
                                  Panelde
                                </span>
                              ) : null}
                            </div>
                            <a
                              href={`tel:${teacher.phone.replace(/\s/g, '')}`}
                              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[#667475]"
                            >
                              <Phone size={12} aria-hidden="true" />
                              {teacher.phone}
                            </a>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-[#667475]">
                            <span>{teacher.studentFullName || 'Öğrenci'}</span>
                            {associationCount > 1 ? (
                              <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-[#1c2b5e]">
                                <Users size={12} aria-hidden="true" />
                                {associationCount} ilişkili öğrenci
                              </span>
                            ) : null}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-[#667475]">
                            <span className="inline-flex items-center gap-1.5">
                              <BookOpen size={14} aria-hidden="true" />
                              {teacher.subjectName || 'Ders seçilmedi'}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <span className="rounded-full bg-[#eef3f3] px-2.5 py-1 text-xs font-semibold text-[#5f7f81]">
                              {teacher.typeLabel}
                            </span>
                          </td>
                          <td className="max-w-[230px] px-4 py-3 text-sm text-[#667475]">
                            <span className="inline-flex items-center gap-1.5">
                              <CalendarDays size={14} aria-hidden="true" />
                              <span className="truncate">{scheduleText(teacher)}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <ResourceSummary teacher={teacher} />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end">
                              <ActionsMenu
                                isOpen={openMenuTeacherId === teacher.id}
                                onToggle={() =>
                                  setOpenMenuTeacherId((current) => (current === teacher.id ? null : teacher.id))
                                }
                                onClose={() => setOpenMenuTeacherId(null)}
                                triggerLabel="Öğretmen işlemleri"
                                items={[
                                  { label: 'Detay', icon: Eye, onClick: () => toggleTeacherDetail(teacher) },
                                  { label: 'Profil', icon: UserRound, onClick: () => setProfileModalTeacher(teacher) },
                                  { label: 'Kaynak', icon: BookOpen, onClick: () => setResourceModalTeacher(teacher) },
                                  ...(teacher.teacherUserId
                                    ? []
                                    : [
                                        {
                                          label: 'Panele Yetki Ver',
                                          icon: KeyRound,
                                          onClick: () => setGrantAccessTeacher(teacher),
                                        },
                                      ]),
                                ]}
                              />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </DataTable>
            </>
          )}
        </MotionDiv>
      )}

      {resourceModalTeacher ? (
        <TeacherResourceBooksModal
          student={{
            id: resourceModalTeacher.studentId,
            fullName: resourceModalTeacher.studentFullName || 'Öğrenci',
          }}
          teacher={resourceModalTeacher}
          onSaved={handleTeacherResourcesSaved}
          onClose={() => setResourceModalTeacher(null)}
        />
      ) : null}

      {profileModalTeacher ? (
        <TeacherProfileModal
          teacher={profileModalTeacher}
          onSaved={handleTeacherProfileSaved}
          onClose={() => setProfileModalTeacher(null)}
        />
      ) : null}

      {grantAccessTeacher ? (
        <GrantTeacherAccessDialog
          teacher={grantAccessTeacher}
          associationCount={associationCounts.get(teacherGroupKey(grantAccessTeacher)) || 1}
          onGranted={(updatedTeachers) => setTeachers(updatedTeachers)}
          onClose={() => setGrantAccessTeacher(null)}
        />
      ) : null}
    </div>
  )
}
