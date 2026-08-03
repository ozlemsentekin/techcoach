import { useEffect, useMemo, useState } from 'react'
import { BookOpen, CalendarDays, GraduationCap, Phone, Search } from 'lucide-react'
import { authRequest } from '../../../services/authClient'
import PageHeader from '../../layout/PageHeader'
import EmptyState from '../../shared/EmptyState'
import LoadingState from '../../shared/LoadingState'
import Button from '../../ui/Button'
import DataTable from '../../ui/DataTable'
import { MotionDiv } from '../../ui/motion'
import TeacherResourceBooksModal from '../components/TeacherResourceBooksModal'

const WEEKDAY_SHORT_LABELS = {
  pazartesi: 'Pzt',
  sali: 'Salı',
  carsamba: 'Çrş',
  persembe: 'Prş',
  cuma: 'Cuma',
  cumartesi: 'Cmt',
  pazar: 'Paz',
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
        <span key={name} className="max-w-[155px] truncate rounded-full bg-[#f5f2fb] px-2.5 py-1 text-xs font-semibold text-[#655e94]">
          {name}
        </span>
      ))}
      {hiddenCount > 0 ? (
        <span className="rounded-full bg-[#eef3f3] px-2.5 py-1 text-xs font-semibold text-[#5f7f81]">+{hiddenCount}</span>
      ) : null}
    </div>
  )
}

export default function TeachersPage() {
  const [teachers, setTeachers] = useState(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [resourceModalTeacher, setResourceModalTeacher] = useState(null)

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
                className="w-full rounded-xl border border-[#dfe4e5] bg-white py-2.5 pl-9 pr-3 text-sm text-[#253d3e] focus:outline-none focus:ring-2 focus:ring-[#655e94]/20"
              />
            </div>

            <span className="rounded-full bg-[#f5f2fb] px-3 py-1 text-xs font-semibold text-[#655e94]">
              {filteredTeachers.length} öğretmen
            </span>
          </div>

          {filteredTeachers.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#dfe4e5] bg-white px-4 py-8 text-center text-sm text-[#667475]">
              Aramayla eşleşen öğretmen yok.
            </p>
          ) : (
            <DataTable>
              <table className="w-full min-w-[1080px] text-left">
                <thead>
                  <tr className="bg-[#f8f7fb] text-[13px] font-semibold text-[#655e94]">
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
                  {filteredTeachers.map((teacher) => (
                    <tr key={teacher.id} className="hover:bg-[#f8f7fb]">
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-[#253d3e]">{teacher.fullName}</p>
                        <a
                          href={`tel:${teacher.phone.replace(/\s/g, '')}`}
                          className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[#667475]"
                        >
                          <Phone size={12} aria-hidden="true" />
                          {teacher.phone}
                        </a>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-[#667475]">
                        {teacher.studentFullName || 'Öğrenci'}
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
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-[34px] rounded-[9px] border-[#dfe4e5] bg-white text-[#253d3e] hover:bg-[#f8f7fb]"
                          onClick={() => setResourceModalTeacher(teacher)}
                        >
                          <BookOpen size={14} aria-hidden="true" />
                          Kaynak
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTable>
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
    </div>
  )
}
