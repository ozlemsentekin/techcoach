import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Calendar, Check, ChevronDown, GraduationCap, Library, MapPin, Phone, School, Search, Users, X } from 'lucide-react'
import LoadingState from '../../shared/LoadingState'
import EmptyState from '../../shared/EmptyState'
import Button from '../../ui/Button'
import { FieldIcon, WizardSteps } from '../../parent/components/StudentWizardShared'
import { GENDER_OPTIONS } from '../../parent/components/studentWizardConstants'
import { LIBRARY_GRADES, RESOURCE_TYPE_LABELS } from '../../shared/library/libraryConstants'
import {
  assignTeacherLibraryResourceBook,
  getTeacherStudentPrivateResourceBooks,
  getTeacherStudentProfile,
  updateTeacherStudentProfile,
} from '../../../services/teacherService'

const STEPS = [
  { key: 1, label: 'Temel Bilgiler' },
  { key: 2, label: 'Okul Bilgileri' },
  { key: 3, label: 'Özel Kaynaklar' },
]

const LOCKED_FIELD_CLASS =
  'w-full cursor-not-allowed rounded-xl border border-panel-border bg-[#f4f5f6] p-2 pl-9 text-base text-panel-text-muted'

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

export default function TeacherStudentProfileModal({ student, onClose, onAssigned }) {
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
  const [basicsError, setBasicsError] = useState('')
  const [basicsSaving, setBasicsSaving] = useState(false)

  useEffect(() => {
    let ignore = false
    getTeacherStudentProfile(student.studentTeacherId)
      .then(({ profile: loadedProfile, canEditBasics: editable }) => {
        if (ignore) return
        setProfile(loadedProfile || {})
        setCanEditBasics(Boolean(editable))

        const nameParts = student.studentFullName.trim().split(/\s+/)
        setBasicsFirstName(nameParts[0] || '')
        setBasicsLastName(nameParts.slice(1).join(' ') || '')
        setBasicsGrade(loadedProfile?.grade || student.studentGrade || '')
        setBasicsBirthDate(loadedProfile?.birthDate ? String(loadedProfile.birthDate).slice(0, 10) : '')
        setBasicsGender(loadedProfile?.gender || '')
        setBasicsPhone(loadedProfile?.phone || student.studentPhone || '')
      })
      .catch((err) => {
        if (!ignore) setProfileError(err.message)
      })
    return () => {
      ignore = true
    }
  }, [student.studentTeacherId, student.studentFullName, student.studentGrade, student.studentPhone])

  const handleSaveBasics = async () => {
    setBasicsSaving(true)
    setBasicsError('')
    try {
      const { profile: savedProfile } = await updateTeacherStudentProfile(student.studentTeacherId, {
        firstName: basicsFirstName,
        lastName: basicsLastName,
        grade: basicsGrade,
        birthDate: basicsBirthDate,
        gender: basicsGender,
        phone: basicsPhone,
      })
      setProfile(savedProfile)
      onAssigned?.()
    } catch (err) {
      setBasicsError(err.message)
    } finally {
      setBasicsSaving(false)
    }
  }

  const loadResourceBooks = () => {
    setResourceError('')
    return getTeacherStudentPrivateResourceBooks(student.studentTeacherId)
      .then((data) => {
        setBooks(data.resourceBooks)
        setGradeMissing(Boolean(data.gradeMissing))
      })
      .catch((err) => setResourceError(err.message))
  }

  useEffect(() => {
    loadResourceBooks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student.studentTeacherId])

  const visibleBooks = useMemo(() => {
    const source = books || []
    const scoped = showLibrary ? source : source.filter((book) => book.assigned)
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
    if (!selectedIds.size) return
    setSaving(true)
    setResourceError('')
    try {
      await Promise.all(
        [...selectedIds].map((resourceBookId) => assignTeacherLibraryResourceBook(student.studentTeacherId, resourceBookId)),
      )
      setSelectedIds(new Set())
      await loadResourceBooks()
      onAssigned?.()
    } catch (err) {
      setResourceError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const photoUrl = profile?.photoUrl || student.studentPhotoUrl || ''
  const basicsGenderLabel = GENDER_OPTIONS.find((option) => option.value === basicsGender)?.label || ''
  const assignedCount = (books || []).filter((book) => book.assigned).length
  const EDITABLE_FIELD_CLASS =
    'w-full rounded-xl border border-panel-border p-2 pl-9 text-base text-panel-text focus:border-panel-blue focus:outline-none'

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <div className="flex h-full w-full max-w-5xl flex-col overflow-hidden bg-white shadow-panel-2 sm:h-[min(680px,90vh)] sm:rounded-2xl">
        <div className="flex items-center justify-between gap-4 px-4 pb-3 pt-3 sm:px-6 sm:pb-3.5 sm:pt-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-panel-text">Profil Kartı</h2>
            <p className="truncate text-xs text-panel-text-muted">{student.studentFullName}</p>
          </div>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <WizardSteps step={step} steps={STEPS} onStepClick={setStep} />

        <div className="min-h-0 flex-1 overflow-y-auto border-t border-[#edf0f1] px-4 py-4 sm:px-6 sm:py-5">
          {step === 1 ? (
            profile === null ? (
              <LoadingState label="Profil yükleniyor..." />
            ) : profileError ? (
              <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-sm text-panel-warm">{profileError}</div>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:gap-5">
                <div className="flex justify-center sm:w-2/5 sm:items-start">
                  {photoUrl ? (
                    <img loading="lazy" decoding="async"
                      src={photoUrl}
                      alt={`${student.studentFullName} fotoğrafı`}
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
                      <div className="relative">
                        <FieldIcon icon={Calendar} />
                        <input
                          type="date"
                          value={basicsBirthDate}
                          onChange={(event) => setBasicsBirthDate(event.target.value)}
                          aria-label="Doğum Tarihi"
                          className={EDITABLE_FIELD_CLASS}
                        />
                      </div>
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
                      <Button type="button" size="md" onClick={handleSaveBasics} disabled={basicsSaving}>
                        {basicsSaving ? 'Kaydediliyor...' : 'Kaydet'}
                      </Button>
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
                      <div className="relative">
                        <FieldIcon icon={Calendar} />
                        <input
                          type="date"
                          value={basicsBirthDate}
                          disabled
                          aria-label="Doğum Tarihi"
                          className={LOCKED_FIELD_CLASS}
                        />
                      </div>
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
                    {student.subjectName || 'Ders'}
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
          <Button type="button" variant="secondary" size="md" onClick={onClose} disabled={saving}>
            Kapat
          </Button>
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
