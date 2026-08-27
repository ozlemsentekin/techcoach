import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Check, ChevronDown, GraduationCap, Library, MapPin, Phone, School, Search, Users, X } from 'lucide-react'
import LoadingState from '../../shared/LoadingState'
import EmptyState from '../../shared/EmptyState'
import Button from '../../ui/Button'
import { BirthDateField, FieldIcon, WizardSteps } from '../../parent/components/StudentWizardShared'
import SchoolPicker from '../../parent/components/SchoolPicker'
import ResourceImageField from '../../parent/components/ResourceImageField'
import { GENDER_OPTIONS } from '../../parent/components/studentWizardConstants'
import { LIBRARY_GRADES, RESOURCE_TYPE_LABELS } from '../../shared/library/libraryConstants'
import { useAuth } from '../../../context/useAuth'
import { authRequest } from '../../../services/authClient'
import {
  addTeacherStudent,
  assignTeacherLibraryResourceBook,
  getTeacherEntitlement,
  getTeacherStudentPrivateResourceBooks,
  getTeacherStudentProfile,
  getTeacherStudents,
  updateTeacherStudentProfile,
} from '../../../services/teacherService'

const STEPS = [
  { key: 1, label: 'Temel Bilgiler' },
  { key: 2, label: 'Okul Bilgileri' },
  { key: 3, label: 'Özel Kaynaklar' },
]

const LOCKED_FIELD_CLASS =
  'w-full cursor-not-allowed rounded-xl border border-panel-border bg-[#f4f5f6] p-2 pl-9 text-base text-panel-text-muted'
const EDITABLE_FIELD_CLASS =
  'w-full rounded-xl border border-panel-border p-2 pl-9 text-base text-panel-text focus:border-panel-blue focus:outline-none'

const CREATE_FORM_INITIAL = {
  studentFullName: '',
  subjectId: '',
  grade: '',
  studentPhone: '',
  parentFullName: '',
  parentPhone: '',
}

function ResourceAvatar({ book }) {
  if (book.imageUrl) {
    return (
      <img loading="lazy" decoding="async"
        src={book.imageUrl}
        alt={`${book.name} görseli`}
        className="h-14 w-14 shrink-0 rounded-xl border border-panel-border object-cover"
      />
    )
  }

  return (
    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#fbe9d7] text-[#c96a1f]">
      <BookOpen size={22} aria-hidden="true" />
    </span>
  )
}

export default function TeacherStudentProfileModal({ student, onClose, onChanged }) {
  const { authUser } = useAuth()
  const [activeStudent, setActiveStudent] = useState(student || null)
  const [step, setStep] = useState(1)
  const [profile, setProfile] = useState(null)
  const [profileError, setProfileError] = useState('')
  const [canEditBasics, setCanEditBasics] = useState(false)
  const [books, setBooks] = useState(null)
  const [gradeMissing, setGradeMissing] = useState(false)
  const [resourceError, setResourceError] = useState('')
  const [showLibrary, setShowLibrary] = useState(false)
  const [resourceQuery, setResourceQuery] = useState('')
  const [openPublishers, setOpenPublishers] = useState(() => new Set())
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [saving, setSaving] = useState(false)

  const [basicsFirstName, setBasicsFirstName] = useState('')
  const [basicsLastName, setBasicsLastName] = useState('')
  const [basicsGrade, setBasicsGrade] = useState('')
  const [basicsBirthDate, setBasicsBirthDate] = useState('')
  const [basicsGender, setBasicsGender] = useState('')
  const [basicsPhone, setBasicsPhone] = useState('')
  const [basicsPhotoUrl, setBasicsPhotoUrl] = useState('')
  const [basicsError, setBasicsError] = useState('')
  const [basicsSaving, setBasicsSaving] = useState(false)

  const [schoolProvinceId, setSchoolProvinceId] = useState(null)
  const [schoolDistrictId, setSchoolDistrictId] = useState(null)
  const [school, setSchool] = useState(null)
  const [schoolError, setSchoolError] = useState('')
  const [schoolSaving, setSchoolSaving] = useState(false)

  const [subjects, setSubjects] = useState(null)
  const [entitlement, setEntitlement] = useState(null)
  const [createForm, setCreateForm] = useState(CREATE_FORM_INITIAL)
  const [createError, setCreateError] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (activeStudent) return
    let ignore = false
    Promise.all([authRequest('/api/panel/subjects', { method: 'GET' }), getTeacherEntitlement()])
      .then(([subjectsData, entitlementData]) => {
        if (ignore) return
        setSubjects(subjectsData.subjects)
        setEntitlement(entitlementData)
      })
      .catch((err) => {
        if (!ignore) setCreateError(err.message)
      })
    return () => {
      ignore = true
    }
  }, [activeStudent])

  // Öğretmenler yalnızca kendi profilindeki derslerden öğrenci ekleyebilir; branşı henüz
  // atanmamış (eski) hesaplarda geriye dönük uyumluluk için tüm dersler gösterilir.
  const teacherSubjectIds = authUser?.teacherSubjectIds
  const visibleSubjects = useMemo(() => {
    if (!subjects) return null
    if (!teacherSubjectIds?.length) return subjects
    const normalizedIds = teacherSubjectIds.map((id) => id.toLowerCase())
    return subjects.filter((subject) => normalizedIds.includes(subject.id.toLowerCase()))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjects, teacherSubjectIds?.length])

  useEffect(() => {
    if (!visibleSubjects) return
    setCreateForm((current) => ({ ...current, subjectId: current.subjectId || visibleSubjects[0]?.id || '' }))
  }, [visibleSubjects])

  const handleCreateChange = (event) => {
    const { name, value } = event.target
    setCreateForm((current) => ({ ...current, [name]: value }))
  }

  const handleCreateSubmit = async () => {
    if (createForm.studentFullName.trim().length < 3) {
      setCreateError('Öğrenci adı en az 3 karakter olmalı.')
      return
    }
    if (!createForm.subjectId) {
      setCreateError('Ders seçin.')
      return
    }
    if (!createForm.grade) {
      setCreateError('Sınıf seçin.')
      return
    }
    if (createForm.studentPhone.trim() && createForm.studentPhone.trim().length < 7) {
      setCreateError('Öğrenci telefon numarası en az 7 karakter olmalı.')
      return
    }
    if (createForm.parentFullName.trim().length < 3) {
      setCreateError('Veli adı en az 3 karakter olmalı.')
      return
    }
    if (createForm.parentPhone.trim().length < 7) {
      setCreateError('Veli telefon numarası en az 7 karakter olmalı.')
      return
    }

    setCreateError('')
    setCreating(true)
    try {
      const result = await addTeacherStudent(createForm)
      const list = await getTeacherStudents('all')
      const matched = list.find((item) => item.studentId === result.student.id) || null
      if (matched) {
        setActiveStudent(matched)
        setStep(2)
      } else {
        setCreateError('Öğrenci oluşturuldu ancak profil bilgisi yüklenemedi. Pencereyi kapatıp tekrar açabilirsiniz.')
      }
      onChanged?.()
    } catch (err) {
      setCreateError(err.message)
    } finally {
      setCreating(false)
    }
  }

  useEffect(() => {
    if (!activeStudent) return
    let ignore = false
    getTeacherStudentProfile(activeStudent.studentTeacherId)
      .then(({ profile: loadedProfile, canEditBasics: editable }) => {
        if (ignore) return
        setProfile(loadedProfile || {})
        setCanEditBasics(Boolean(editable))

        const nameParts = activeStudent.studentFullName.trim().split(/\s+/)
        setBasicsFirstName(nameParts[0] || '')
        setBasicsLastName(nameParts.slice(1).join(' ') || '')
        setBasicsGrade(loadedProfile?.grade || activeStudent.studentGrade || '')
        setBasicsBirthDate(loadedProfile?.birthDate ? String(loadedProfile.birthDate).slice(0, 10) : '')
        setBasicsGender(loadedProfile?.gender || '')
        setBasicsPhone(loadedProfile?.phone || activeStudent.studentPhone || '')
        setBasicsPhotoUrl(loadedProfile?.photoUrl || '')
        setSchoolProvinceId(loadedProfile?.provinceId || null)
        setSchoolDistrictId(loadedProfile?.districtId || null)
        setSchool(
          loadedProfile?.schoolId
            ? { id: loadedProfile.schoolId, name: loadedProfile.schoolName, type: loadedProfile.schoolType }
            : null,
        )
      })
      .catch((err) => {
        if (!ignore) setProfileError(err.message)
      })
    return () => {
      ignore = true
    }
  }, [activeStudent])

  const handleSaveBasics = async ({ advance = false } = {}) => {
    if (!activeStudent) return
    setBasicsSaving(true)
    setBasicsError('')
    try {
      const { profile: savedProfile } = await updateTeacherStudentProfile(activeStudent.studentTeacherId, {
        firstName: basicsFirstName,
        lastName: basicsLastName,
        grade: basicsGrade,
        birthDate: basicsBirthDate,
        gender: basicsGender,
        phone: basicsPhone,
        photoUrl: basicsPhotoUrl,
      })
      setProfile(savedProfile)
      onChanged?.()
      if (advance) setStep(2)
    } catch (err) {
      setBasicsError(err.message)
    } finally {
      setBasicsSaving(false)
    }
  }

  const handleSaveSchool = async ({ advance = false } = {}) => {
    if (!activeStudent) return
    setSchoolSaving(true)
    setSchoolError('')
    try {
      const { profile: savedProfile } = await updateTeacherStudentProfile(activeStudent.studentTeacherId, {
        firstName: basicsFirstName,
        lastName: basicsLastName,
        grade: basicsGrade,
        birthDate: basicsBirthDate,
        gender: basicsGender,
        phone: basicsPhone,
        provinceId: schoolProvinceId,
        districtId: schoolDistrictId,
        schoolId: school?.id || null,
      })
      setProfile(savedProfile)
      onChanged?.()
      if (advance) setStep(3)
    } catch (err) {
      setSchoolError(err.message)
    } finally {
      setSchoolSaving(false)
    }
  }

  const loadResourceBooks = () => {
    if (!activeStudent) return Promise.resolve()
    setResourceError('')
    return getTeacherStudentPrivateResourceBooks(activeStudent.studentTeacherId)
      .then((data) => {
        setBooks(data.resourceBooks)
        setGradeMissing(Boolean(data.gradeMissing))
      })
      .catch((err) => setResourceError(err.message))
  }

  useEffect(() => {
    loadResourceBooks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStudent])

  const visibleBooks = useMemo(() => {
    const source = books || []
    const scoped = showLibrary ? source.filter((book) => !book.assigned) : source.filter((book) => book.assigned)
    const query = resourceQuery.trim().toLocaleLowerCase('tr-TR')
    if (!query) return scoped
    return scoped.filter((book) =>
      [book.name, book.publisherName].filter(Boolean).some((value) => value.toLocaleLowerCase('tr-TR').includes(query)),
    )
  }, [books, showLibrary, resourceQuery])

  const publisherGroups = useMemo(() => {
    const groups = new Map()
    visibleBooks.forEach((book) => {
      const key = book.publisherName || 'Yayın evi yok'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(book)
    })
    return Array.from(groups.entries())
      .map(([publisherName, groupBooks]) => ({
        publisherName,
        books: [...groupBooks].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'tr-TR')),
      }))
      .sort((a, b) => a.publisherName.localeCompare(b.publisherName, 'tr'))
  }, [visibleBooks])

  const togglePublisherOpen = (publisherName) => {
    setOpenPublishers((current) => {
      const next = new Set(current)
      if (next.has(publisherName)) next.delete(publisherName)
      else next.add(publisherName)
      return next
    })
  }

  const toggleResource = (book) => {
    if (book.assigned) return
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(book.id)) next.delete(book.id)
      else next.add(book.id)
      return next
    })
  }

  const handleAssignSelected = async () => {
    if (!selectedIds.size || !activeStudent) return
    setSaving(true)
    setResourceError('')
    try {
      await Promise.all(
        [...selectedIds].map((resourceBookId) => assignTeacherLibraryResourceBook(activeStudent.studentTeacherId, resourceBookId)),
      )
      setSelectedIds(new Set())
      await loadResourceBooks()
      onChanged?.()
    } catch (err) {
      setResourceError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const photoUrl = profile?.photoUrl || activeStudent?.studentPhotoUrl || ''
  const basicsGenderLabel = GENDER_OPTIONS.find((option) => option.value === basicsGender)?.label || ''
  const assignedCount = (books || []).filter((book) => book.assigned).length
  const isCreateLoading = visibleSubjects === null || entitlement === null

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <div className="flex h-full w-full max-w-5xl flex-col overflow-hidden bg-white shadow-panel-2 sm:h-[min(680px,90vh)] sm:rounded-2xl">
        <div className="flex items-center justify-between gap-4 px-4 pb-3 pt-3 sm:px-6 sm:pb-3.5 sm:pt-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-panel-text">{activeStudent ? 'Profil Kartı' : 'Öğrenci Ekle'}</h2>
            <p className="truncate text-xs text-panel-text-muted">
              {activeStudent ? activeStudent.studentFullName : 'Yeni öğrenci bilgilerini girin'}
            </p>
          </div>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <WizardSteps step={step} steps={STEPS} onStepClick={activeStudent ? setStep : undefined} />

        <div className="min-h-0 flex-1 overflow-y-auto border-t border-[#edf0f1] px-4 py-4 sm:px-6 sm:py-5">
          {step === 1 ? (
            !activeStudent ? (
              isCreateLoading ? (
                <LoadingState label="Yükleniyor..." />
              ) : (
                <div className="flex flex-col gap-2.5">
                  {!entitlement.isActive ? (
                    <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-sm text-panel-warm">
                      Panel aboneliğiniz aktif değil, öğrenci ekleyemezsiniz.
                    </div>
                  ) : (
                    <p className="rounded-xl bg-panel-surface-soft px-4 py-3 text-sm text-panel-text-muted">
                      Kalan öğrenci hakkınız: <strong className="text-panel-text">{entitlement.remainingSeats}</strong> /{' '}
                      {entitlement.totalSeats}. Eklediğiniz öğrencinin velisinin zaten aktif bir planı varsa hakkınız
                      harcanmaz.
                    </p>
                  )}
                  {createError ? (
                    <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-sm text-panel-warm">{createError}</div>
                  ) : null}
                  <div className="relative">
                    <FieldIcon icon={Users} />
                    <input
                      name="studentFullName"
                      value={createForm.studentFullName}
                      onChange={handleCreateChange}
                      placeholder="Öğrenci Ad Soyad"
                      aria-label="Öğrenci Ad Soyad"
                      className={EDITABLE_FIELD_CLASS}
                    />
                  </div>
                  <div className="relative">
                    <FieldIcon icon={BookOpen} />
                    <select
                      name="subjectId"
                      value={createForm.subjectId}
                      onChange={handleCreateChange}
                      aria-label="Ders"
                      disabled={!visibleSubjects.length}
                      className={EDITABLE_FIELD_CLASS}
                    >
                      {visibleSubjects.length ? null : <option value="">Ders yok</option>}
                      {visibleSubjects.map((subject) => (
                        <option key={subject.id} value={subject.id}>
                          {subject.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="relative">
                    <FieldIcon icon={GraduationCap} />
                    <select
                      name="grade"
                      value={createForm.grade}
                      onChange={handleCreateChange}
                      aria-label="Sınıf"
                      className={EDITABLE_FIELD_CLASS}
                    >
                      <option value="">Sınıf seçin</option>
                      {LIBRARY_GRADES.map((grade) => (
                        <option key={grade} value={grade}>
                          {grade}. Sınıf
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="relative">
                    <FieldIcon icon={Phone} />
                    <input
                      name="studentPhone"
                      type="tel"
                      value={createForm.studentPhone}
                      onChange={handleCreateChange}
                      placeholder="Öğrenci Telefon (opsiyonel)"
                      aria-label="Öğrenci Telefon"
                      className={EDITABLE_FIELD_CLASS}
                    />
                  </div>
                  <div className="relative">
                    <FieldIcon icon={Users} />
                    <input
                      name="parentFullName"
                      value={createForm.parentFullName}
                      onChange={handleCreateChange}
                      placeholder="Veli Ad Soyad"
                      aria-label="Veli Ad Soyad"
                      className={EDITABLE_FIELD_CLASS}
                    />
                  </div>
                  <div className="relative">
                    <FieldIcon icon={Phone} />
                    <input
                      name="parentPhone"
                      type="tel"
                      value={createForm.parentPhone}
                      onChange={handleCreateChange}
                      placeholder="Veli Telefon"
                      aria-label="Veli Telefon"
                      className={EDITABLE_FIELD_CLASS}
                    />
                  </div>
                </div>
              )
            ) : profile === null ? (
              <LoadingState label="Profil yükleniyor..." />
            ) : profileError ? (
              <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-sm text-panel-warm">{profileError}</div>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:gap-5">
                <div className="flex justify-center sm:w-2/5 sm:items-start">
                  {canEditBasics ? (
                    <ResourceImageField
                      value={basicsPhotoUrl}
                      onChange={setBasicsPhotoUrl}
                      shape="circle"
                      compact
                      size={160}
                    />
                  ) : photoUrl ? (
                    <img loading="lazy" decoding="async"
                      src={photoUrl}
                      alt={`${activeStudent.studentFullName} fotoğrafı`}
                      className="h-40 w-40 rounded-full border border-panel-border object-cover"
                    />
                  ) : (
                    <span className="flex h-40 w-40 items-center justify-center rounded-full bg-panel-blue-soft text-panel-blue">
                      <GraduationCap size={40} aria-hidden="true" />
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-2.5 sm:w-3/5">
                  {canEditBasics ? (
                    <>
                      <div className="relative">
                        <FieldIcon icon={Users} />
                        <input
                          value={basicsFirstName}
                          onChange={(event) => setBasicsFirstName(event.target.value)}
                          aria-label="Ad"
                          className={EDITABLE_FIELD_CLASS}
                        />
                      </div>
                      <div className="relative">
                        <FieldIcon icon={Users} />
                        <input
                          value={basicsLastName}
                          onChange={(event) => setBasicsLastName(event.target.value)}
                          aria-label="Soyad"
                          className={EDITABLE_FIELD_CLASS}
                        />
                      </div>
                      <div className="relative">
                        <FieldIcon icon={GraduationCap} />
                        <select
                          value={basicsGrade}
                          onChange={(event) => setBasicsGrade(event.target.value)}
                          aria-label="Sınıf"
                          className={EDITABLE_FIELD_CLASS}
                        >
                          <option value="">Sınıf seçin</option>
                          {LIBRARY_GRADES.map((value) => (
                            <option key={value} value={value}>
                              {value}. Sınıf
                            </option>
                          ))}
                        </select>
                      </div>
                      <BirthDateField
                        value={basicsBirthDate}
                        onChange={(event) => setBasicsBirthDate(event.target.value)}
                      />
                      <div className="relative">
                        <FieldIcon icon={Users} />
                        <select
                          value={basicsGender}
                          onChange={(event) => setBasicsGender(event.target.value)}
                          aria-label="Cinsiyet"
                          className={EDITABLE_FIELD_CLASS}
                        >
                          <option value="">Cinsiyet seçin</option>
                          {GENDER_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="relative">
                        <FieldIcon icon={Phone} />
                        <input
                          value={basicsPhone}
                          onChange={(event) => setBasicsPhone(event.target.value)}
                          aria-label="Telefon"
                          placeholder="05XX XXX XX XX"
                          className={EDITABLE_FIELD_CLASS}
                        />
                      </div>
                      {basicsError ? (
                        <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-sm text-panel-warm">{basicsError}</div>
                      ) : null}
                      <p className="text-xs text-panel-text-muted">
                        Bu öğrenciyi siz eklediğiniz için temel bilgilerini düzenleyebilirsiniz.
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button
                          type="button"
                          variant="secondary"
                          size="md"
                          onClick={() => handleSaveBasics()}
                          disabled={basicsSaving}
                        >
                          {basicsSaving ? 'Kaydediliyor...' : 'Kaydet'}
                        </Button>
                        <Button
                          type="button"
                          size="md"
                          onClick={() => handleSaveBasics({ advance: true })}
                          disabled={basicsSaving}
                        >
                          {basicsSaving ? 'Kaydediliyor...' : 'Devam Et'}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="relative">
                        <FieldIcon icon={Users} />
                        <input value={basicsFirstName} disabled aria-label="Ad" className={LOCKED_FIELD_CLASS} />
                      </div>
                      <div className="relative">
                        <FieldIcon icon={Users} />
                        <input value={basicsLastName} disabled aria-label="Soyad" className={LOCKED_FIELD_CLASS} />
                      </div>
                      <div className="relative">
                        <FieldIcon icon={GraduationCap} />
                        <input
                          value={basicsGrade ? `${basicsGrade}. Sınıf` : ''}
                          disabled
                          aria-label="Sınıf"
                          className={LOCKED_FIELD_CLASS}
                        />
                      </div>
                      <BirthDateField value={basicsBirthDate} disabled />
                      <div className="relative">
                        <FieldIcon icon={Users} />
                        <input value={basicsGenderLabel} disabled aria-label="Cinsiyet" className={LOCKED_FIELD_CLASS} />
                      </div>
                      <div className="relative">
                        <FieldIcon icon={Phone} />
                        <input value={basicsPhone} disabled aria-label="Telefon" className={LOCKED_FIELD_CLASS} />
                      </div>
                      <p className="text-xs text-panel-text-muted">
                        Bu bilgiler veli tarafından doldurulur, öğretmen panelinden düzenlenemez.
                      </p>
                    </>
                  )}
                </div>
              </div>
            )
          ) : null}

          {step === 2 ? (
            profile === null ? (
              <LoadingState label="Profil yükleniyor..." />
            ) : profileError ? (
              <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-sm text-panel-warm">{profileError}</div>
            ) : canEditBasics ? (
              <div className="flex flex-col gap-2.5">
                <SchoolPicker
                  provinceId={schoolProvinceId}
                  districtId={schoolDistrictId}
                  school={school}
                  onProvinceChange={setSchoolProvinceId}
                  onDistrictChange={setSchoolDistrictId}
                  onSchoolChange={setSchool}
                />
                {schoolError ? (
                  <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-sm text-panel-warm">{schoolError}</div>
                ) : null}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => handleSaveSchool()}
                    disabled={schoolSaving}
                  >
                    {schoolSaving ? 'Kaydediliyor...' : 'Kaydet'}
                  </Button>
                  <Button
                    type="button"
                    size="md"
                    onClick={() => handleSaveSchool({ advance: true })}
                    disabled={schoolSaving}
                  >
                    {schoolSaving ? 'Kaydediliyor...' : 'Devam Et'}
                  </Button>
                </div>
              </div>
            ) : !profile.schoolId ? (
              <EmptyState
                icon={School}
                title="Okul bilgisi girilmemiş"
                description="Veli henüz bu öğrencinin okul bilgilerini panelden doldurmadı."
              />
            ) : (
              <div className="flex flex-col gap-2.5">
                <div className="relative">
                  <FieldIcon icon={MapPin} />
                  <input
                    value={[profile.provinceName, profile.districtName].filter(Boolean).join(' / ')}
                    disabled
                    aria-label="İl / İlçe"
                    className={LOCKED_FIELD_CLASS}
                  />
                </div>
                <div className="relative">
                  <FieldIcon icon={School} />
                  <input value={profile.schoolName || ''} disabled aria-label="Okul" className={LOCKED_FIELD_CLASS} />
                </div>
                <p className="text-xs text-panel-text-muted">
                  Bu bilgiler veli tarafından doldurulur, öğretmen panelinden düzenlenemez.
                </p>
              </div>
            )
          ) : null}

          {step === 3 ? (
            <div className="flex flex-col gap-4">
              {books?.length ? (
                <div className="flex gap-1 overflow-x-auto border-b border-panel-border">
                  <span className="shrink-0 whitespace-nowrap border-b-2 border-panel-blue px-3 pb-2.5 text-sm font-semibold text-panel-blue">
                    {activeStudent?.subjectName || 'Ders'}
                  </span>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative w-full sm:w-72">
                  <Search
                    size={14}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-panel-text-muted"
                    aria-hidden="true"
                  />
                  <input
                    value={resourceQuery}
                    onChange={(event) => setResourceQuery(event.target.value)}
                    placeholder="Kaynak veya yayın evi ara..."
                    className="w-full rounded-xl border border-panel-border bg-white py-2 pl-9 pr-3 text-sm text-panel-text focus:outline-none focus:ring-2 focus:ring-[#1c2b5e]/20"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex w-fit rounded-xl border border-panel-border bg-panel-surface p-1 shadow-sm">
                    <button
                      type="button"
                      aria-pressed={!showLibrary}
                      onClick={() => setShowLibrary(false)}
                      className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                        !showLibrary ? 'bg-panel-blue text-white shadow-sm' : 'text-panel-text-muted hover:bg-panel-surface-soft'
                      }`}
                    >
                      Atanan Kaynaklar{assignedCount ? ` (${assignedCount} Kaynak)` : ''}
                    </button>
                    <button
                      type="button"
                      aria-pressed={showLibrary}
                      onClick={() => setShowLibrary(true)}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                        showLibrary ? 'bg-panel-blue text-white shadow-sm' : 'text-panel-text-muted hover:bg-panel-surface-soft'
                      }`}
                    >
                      <Library size={14} aria-hidden="true" />
                      Kütüphane
                    </button>
                  </div>
                </div>
              </div>

              {resourceError ? (
                <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-sm text-panel-warm">{resourceError}</div>
              ) : null}

              {books === null ? (
                <LoadingState label="Kaynaklar yükleniyor..." />
              ) : gradeMissing ? (
                <EmptyState
                  icon={GraduationCap}
                  title="Sınıf seçilmedi"
                  description="Özel kaynakları görüntülemek için önce Öğrencilerim listesinden bu öğrencinin sınıfını tanımlayın."
                />
              ) : publisherGroups.length === 0 ? (
                <EmptyState
                  icon={BookOpen}
                  title={showLibrary ? 'Özel kaynak bulunamadı' : 'Atanmış kaynak yok'}
                  description={
                    resourceQuery.trim()
                      ? 'Aramayla eşleşen kaynak yok.'
                      : showLibrary
                        ? 'Bu derse ait onaylı özel kaynak bulunamadı.'
                        : 'Bu öğrenciye henüz özel kaynak atamadınız. Kütüphaneyi görüntüleyip kaynak atayabilirsiniz.'
                  }
                />
              ) : (
                <div className="flex flex-col gap-3">
                  {publisherGroups.map(({ publisherName, books: groupBooks }) => {
                    const isOpen = !showLibrary || openPublishers.has(publisherName)
                    return (
                    <div key={publisherName} className="overflow-hidden rounded-xl border border-panel-border bg-panel-surface">
                      <button
                        type="button"
                        onClick={() => togglePublisherOpen(publisherName)}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-bold text-panel-text"
                      >
                        <ChevronDown
                          size={16}
                          className={`shrink-0 text-panel-text-muted transition-transform ${isOpen ? 'rotate-0' : '-rotate-90'}`}
                          aria-hidden="true"
                        />
                        {publisherName}
                        <span className="rounded-full bg-panel-surface-soft px-2 py-0.5 text-[11px] font-medium text-panel-text-muted">
                          {groupBooks.length}
                        </span>
                      </button>
                      {isOpen ? (
                      <div className="grid grid-cols-1 gap-3 border-t border-panel-border p-3 sm:grid-cols-2 xl:grid-cols-3">
                        {groupBooks.map((book) => {
                          const selected = selectedIds.has(book.id)
                          return (
                            <button
                              key={book.id}
                              type="button"
                              aria-pressed={book.assigned || selected}
                              onClick={() => toggleResource(book)}
                              disabled={book.assigned}
                              className={`flex min-h-[118px] items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                                book.assigned
                                  ? 'cursor-default border-panel-blue bg-panel-blue-soft'
                                  : selected
                                    ? 'border-[#1c2b5e] bg-[#f8f7fb] shadow-[0_2px_10px_rgba(101,94,148,0.12)]'
                                    : 'border-panel-border bg-white hover:border-[#c1c8e0] hover:bg-[#f7f8fc]'
                              }`}
                            >
                              <ResourceAvatar book={book} />
                              <span className="flex min-w-0 flex-1 flex-col gap-1">
                                <span className="flex items-start justify-between gap-2">
                                  <span className="line-clamp-2 text-sm font-bold leading-snug text-panel-text">{book.name}</span>
                                  <span
                                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                                      book.assigned || selected
                                        ? 'border-[#1c2b5e] bg-[#1c2b5e] text-white'
                                        : 'border-panel-border bg-white'
                                    }`}
                                  >
                                    {book.assigned || selected ? <Check size={13} aria-hidden="true" /> : null}
                                  </span>
                                </span>
                                <span className="flex flex-wrap items-center gap-1.5 pt-1">
                                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-[#1c2b5e]">
                                    {RESOURCE_TYPE_LABELS[book.type] || book.type}
                                  </span>
                                  {book.assigned ? (
                                    <span className="rounded-full bg-panel-blue px-2 py-0.5 text-[11px] font-medium text-white">
                                      Atandı
                                    </span>
                                  ) : null}
                                </span>
                              </span>
                            </button>
                          )
                        })}
                      </div>
                      ) : null}
                    </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col items-stretch gap-2 border-t border-[#edf0f1] px-4 py-3 sm:flex-row sm:items-center sm:justify-end sm:px-6 sm:py-4">
          <Button type="button" variant="secondary" size="md" onClick={onClose} disabled={saving || creating || basicsSaving}>
            Kapat
          </Button>
          {!activeStudent && step === 1 ? (
            <Button
              type="button"
              size="md"
              onClick={handleCreateSubmit}
              disabled={creating || isCreateLoading || (entitlement && !entitlement.isActive)}
            >
              {creating ? 'Ekleniyor...' : 'Öğrenciyi Ekle ve Devam Et'}
            </Button>
          ) : null}
          {step === 3 ? (
            <Button type="button" size="md" onClick={handleAssignSelected} disabled={saving || selectedIds.size === 0}>
              {saving ? 'Atanıyor...' : `Seçilenleri Ata (${selectedIds.size})`}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
