import { useEffect, useState } from 'react'
import { Award, BookOpen, Check, GraduationCap, ListChecks, Search, UserRound, Users, X } from 'lucide-react'
import { authRequest } from '../../../services/authClient'
import PageHeader from '../../layout/PageHeader'
import LoadingState from '../../shared/LoadingState'
import EmptyState from '../../shared/EmptyState'
import Button from '../../ui/Button'
import DataTable from '../../ui/DataTable'
import ActionsMenu from '../../ui/ActionsMenu'
import { MotionDiv } from '../../ui/motion'
import StudentTeacherModal from '../components/StudentTeacherModal'
import StudentProfileModal from '../components/StudentProfileModal'
import StudentReportCardModal from '../components/StudentReportCardModal'
import StudentResourceLibraryModal from '../components/StudentResourceLibraryModal'

const EMAIL_RULE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const RESOURCE_BOOK_TYPE_LABELS = {
  konu_anlatimi: 'Konu Anlatımı',
  soru_bankasi: 'Soru Bankası',
  okuma_kitabi: 'Okuma Kitabı',
}

const INITIAL_FORM = {
  fullName: '',
  email: '',
  acceptConsent: false,
}

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function groupResourceBooksBySubject(resourceBooks) {
  const groups = new Map()

  resourceBooks.forEach((book) => {
    const key = book.subjectId || 'no-subject'
    if (!groups.has(key)) {
      groups.set(key, {
        id: key,
        name: book.subjectName || 'Derssiz Kaynaklar',
        books: [],
      })
    }
    groups.get(key).books.push(book)
  })

  return Array.from(groups.values())
}

function ResourceAvatar({ book }) {
  if (book.imageUrl) {
    return (
      <img
        src={book.imageUrl}
        alt={`${book.name} görseli`}
        className="h-14 w-14 shrink-0 rounded-xl border border-[#e5e8e9] object-cover"
      />
    )
  }

  return (
    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#f5f2fb] text-[#655e94]">
      <BookOpen size={22} aria-hidden="true" />
    </span>
  )
}

function AddStudentModal({ onCreated, onClose }) {
  const [form, setForm] = useState(INITIAL_FORM)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (event) => {
    const { name, type, value, checked } = event.target
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (form.fullName.trim().length < 3) {
      setError('Ad soyad en az 3 karakter olmalı.')
      return
    }
    if (form.email && !EMAIL_RULE.test(form.email)) {
      setError('Geçerli bir e-posta adresi girin.')
      return
    }
    if (!form.acceptConsent) {
      setError('Devam etmek için onay vermelisiniz.')
      return
    }

    setError('')
    setLoading(true)
    try {
      const data = await authRequest('/api/parent/students', {
        method: 'POST',
        body: JSON.stringify(form),
      })
      onCreated(data.student)
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
          <h2 className="text-lg font-semibold text-panel-text">Öğrenci Ekle</h2>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {error ? (
          <div className="mb-3 rounded-xl bg-panel-accent-soft px-3 py-2.5 text-sm text-panel-warm">{error}</div>
        ) : null}

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">Ad Soyad</span>
            <input
              name="fullName"
              value={form.fullName}
              onChange={handleChange}
              className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">E-posta (tercihen)</span>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
            />
          </label>

          <label className="flex items-start gap-2 text-sm text-panel-text">
            <input
              type="checkbox"
              name="acceptConsent"
              checked={form.acceptConsent}
              onChange={handleChange}
              className="mt-0.5 h-5 w-5 rounded border-panel-border"
            />
            <span>Bu öğrenci için ebeveyn olarak KVKK ve aydınlatma metni onayını veriyorum.</span>
          </label>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Oluşturuluyor...' : 'Öğrenci Profilini Oluştur'}
          </Button>
        </div>
      </form>
    </div>
  )
}

function StudentResourceModal({ student, onSaved, onClose }) {
  const [resourceBooks, setResourceBooks] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let ignore = false

    authRequest(`/api/parent/students/${student.id}/resource-books`, { method: 'GET' })
      .then((data) => {
        if (ignore) return
        setResourceBooks(data.resourceBooks)
        setSelectedIds(new Set(data.resourceBooks.filter((book) => book.assigned).map((book) => book.id)))
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })

    return () => {
      ignore = true
    }
  }, [student.id])

  const filteredResourceBooks = (resourceBooks || []).filter((book) => {
    const normalizedQuery = query.trim().toLocaleLowerCase('tr-TR')
    if (!normalizedQuery) return true

    return [book.name, book.publisherName, book.subjectName]
      .filter(Boolean)
      .some((value) => value.toLocaleLowerCase('tr-TR').includes(normalizedQuery))
  })

  const subjectGroups = groupResourceBooksBySubject(filteredResourceBooks)

  const toggleResource = (bookId) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(bookId)) next.delete(bookId)
      else next.add(bookId)
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const data = await authRequest(`/api/parent/students/${student.id}/resource-books`, {
        method: 'PUT',
        body: JSON.stringify({ resourceBookIds: Array.from(selectedIds) }),
      })
      onSaved(student.id, data.resourceCount)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="flex max-h-[88vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-panel-2">
        <div className="flex items-start justify-between gap-4 border-b border-[#edf0f1] px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-panel-text">Kaynak Ekle</h2>
            <p className="text-sm text-panel-text-muted">{student.fullName}</p>
          </div>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf0f1] px-5 py-3">
          <div className="relative w-full sm:w-80">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#87a3a5]"
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Kaynak, yayın evi veya ders ara..."
              className="w-full rounded-xl border border-[#dfe4e5] bg-white py-2 pl-9 pr-3 text-sm text-[#253d3e] focus:outline-none focus:ring-2 focus:ring-[#655e94]/20"
            />
          </div>
          <span className="rounded-full bg-[#f5f2fb] px-3 py-1 text-xs font-semibold text-[#655e94]">
            {selectedIds.size} kaynak seçili
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error ? (
            <div className="mb-4 rounded-xl bg-panel-accent-soft px-4 py-3 text-sm text-panel-warm">{error}</div>
          ) : null}

          {resourceBooks === null ? (
            <LoadingState label="Kaynaklar yükleniyor..." />
          ) : resourceBooks.length === 0 ? (
            <EmptyState icon={BookOpen} title="Henüz kaynak yok" description="Admin panelinden kaynak ekleyebilirsiniz." />
          ) : subjectGroups.length === 0 ? (
            <p className="py-8 text-sm text-[#667475]">Aramayla eşleşen kaynak yok.</p>
          ) : (
            <div className="flex flex-col gap-6">
              {subjectGroups.map((group) => (
                <section key={group.id} className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3 border-b border-[#edf0f1] pb-2">
                    <h3 className="text-sm font-bold text-[#253d3e]">{group.name}</h3>
                    <span className="text-xs font-medium text-[#667475]">{group.books.length} kaynak</span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {group.books.map((book) => {
                      const selected = selectedIds.has(book.id)
                      return (
                        <button
                          key={book.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => toggleResource(book.id)}
                          className={`flex min-h-[118px] items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                            selected
                              ? 'border-[#655e94] bg-[#f8f7fb] shadow-[0_2px_10px_rgba(101,94,148,0.12)]'
                              : 'border-[#e5e8e9] bg-white hover:border-[#c9bfec] hover:bg-[#fbfaff]'
                          }`}
                        >
                          <ResourceAvatar book={book} />
                          <span className="flex min-w-0 flex-1 flex-col gap-1">
                            <span className="flex items-start justify-between gap-2">
                              <span className="line-clamp-2 text-sm font-bold leading-snug text-[#253d3e]">{book.name}</span>
                              <span
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                                  selected ? 'border-[#655e94] bg-[#655e94] text-white' : 'border-[#cfd5d7] bg-white'
                                }`}
                              >
                                {selected ? <Check size={13} aria-hidden="true" /> : null}
                              </span>
                            </span>
                            <span className="truncate text-xs text-[#667475]">{book.publisherName || 'Yayın evi yok'}</span>
                            <span className="flex flex-wrap items-center gap-1.5 pt-1">
                              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-[#655e94]">
                                {RESOURCE_BOOK_TYPE_LABELS[book.type] || book.type}
                              </span>
                              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-[#667475]">
                                {book.pageCount} sayfa
                              </span>
                            </span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-[#edf0f1] px-5 py-4">
          <Button type="button" variant="secondary" size="md" onClick={onClose} disabled={saving}>
            Vazgeç
          </Button>
          <Button type="button" size="md" onClick={handleSave} disabled={saving || resourceBooks === null}>
            {saving ? 'Kaydediliyor...' : 'Kaynakları Kaydet'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function StudentsPage() {
  const [students, setStudents] = useState(null)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [resourceModalStudent, setResourceModalStudent] = useState(null)
  const [libraryModalStudent, setLibraryModalStudent] = useState(null)
  const [teacherModalStudent, setTeacherModalStudent] = useState(null)
  const [profileModalStudent, setProfileModalStudent] = useState(null)
  const [reportCardStudent, setReportCardStudent] = useState(null)
  const [openMenuStudentId, setOpenMenuStudentId] = useState(null)

  const loadStudents = () => {
    authRequest('/api/parent/students', { method: 'GET' })
      .then((data) => setStudents(data.students))
      .catch((err) => setError(err.message))
  }

  useEffect(() => {
    loadStudents()
  }, [])

  const handleCreated = (student) => {
    setStudents((current) => [...(current || []), student])
    setShowModal(false)
  }

  const handleResourcesSaved = (studentId, resourceCount) => {
    setStudents((current) =>
      (current || []).map((student) => (student.id === studentId ? { ...student, resourceCount } : student)),
    )
    setResourceModalStudent(null)
  }

  const handleTeachersSaved = (studentId, teacherCount) => {
    setStudents((current) =>
      (current || []).map((student) => (student.id === studentId ? { ...student, teacherCount } : student)),
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Öğrenci Profillerim"
        actions={
          <Button
            onClick={() => setShowModal(true)}
            className="h-10 rounded-[10px] bg-[#655e94] px-4 text-sm font-medium text-white hover:opacity-90"
          >
            + Öğrenci Ekle
          </Button>
        }
      />

      {error ? (
        <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{error}</div>
      ) : students === null ? (
        <LoadingState label="Öğrenciler yükleniyor..." />
      ) : students.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Henüz öğrenci profili yok"
          description="Yukarıdaki butonla ilk öğrenci profilini oluşturabilirsiniz."
        />
      ) : (
        <MotionDiv initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <DataTable>
            <table className="w-full min-w-[920px] text-left">
              <thead>
                <tr className="bg-[#f8f7fb] text-[13px] font-semibold text-[#655e94]">
                  <th className="px-4 py-3">Ad Soyad</th>
                  <th className="px-4 py-3">E-posta</th>
                  <th className="px-4 py-3">Kaynak</th>
                  <th className="px-4 py-3">Öğretmen</th>
                  <th className="px-4 py-3">Kayıt Tarihi</th>
                  <th className="px-4 py-3">Son Giriş</th>
                  <th className="px-4 py-3 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf0f1]">
                {students.map((student) => (
                  <tr key={student.id} className="hover:bg-[#f8f7fb]">
                    <td className="px-4 py-3 text-sm font-semibold text-[#253d3e]">{student.fullName}</td>
                    <td className="px-4 py-3 text-sm text-[#667475]">{student.email}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-[#667475]">
                      {student.resourceCount || 0} kaynak
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-[#667475]">
                      {student.teacherCount || 0} öğretmen
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-[#667475]">
                      {formatDate(student.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-[#667475]">
                      {formatDate(student.lastLoginAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end">
                        <ActionsMenu
                          isOpen={openMenuStudentId === student.id}
                          onToggle={() =>
                            setOpenMenuStudentId((current) => (current === student.id ? null : student.id))
                          }
                          onClose={() => setOpenMenuStudentId(null)}
                          triggerLabel="Öğrenci işlemleri"
                          items={[
                            { label: 'Öğretmenler', icon: GraduationCap, onClick: () => setTeacherModalStudent(student) },
                            { label: 'Kaynaklar', icon: BookOpen, onClick: () => setResourceModalStudent(student) },
                            { label: 'İçerik Takibi', icon: ListChecks, onClick: () => setLibraryModalStudent(student) },
                            { label: 'Profil', icon: UserRound, onClick: () => setProfileModalStudent(student) },
                            { label: 'LGS Karnesi', icon: Award, onClick: () => setReportCardStudent(student) },
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTable>
        </MotionDiv>
      )}

      {showModal ? <AddStudentModal onCreated={handleCreated} onClose={() => setShowModal(false)} /> : null}
      {resourceModalStudent ? (
        <StudentResourceModal
          student={resourceModalStudent}
          onSaved={handleResourcesSaved}
          onClose={() => setResourceModalStudent(null)}
        />
      ) : null}
      {libraryModalStudent ? (
        <StudentResourceLibraryModal student={libraryModalStudent} onClose={() => setLibraryModalStudent(null)} />
      ) : null}
      {teacherModalStudent ? (
        <StudentTeacherModal
          student={teacherModalStudent}
          onSaved={handleTeachersSaved}
          onClose={() => setTeacherModalStudent(null)}
        />
      ) : null}
      {profileModalStudent ? (
        <StudentProfileModal
          student={profileModalStudent}
          onClose={() => setProfileModalStudent(null)}
        />
      ) : null}
      {reportCardStudent ? (
        <StudentReportCardModal
          student={reportCardStudent}
          onClose={() => setReportCardStudent(null)}
        />
      ) : null}
    </div>
  )
}
