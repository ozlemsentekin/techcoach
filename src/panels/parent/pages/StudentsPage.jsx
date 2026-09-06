import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertCircle,
  BookOpen,
  GraduationCap,
  Phone,
  Plus,
  School,
  TrendingUp,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { authRequest, cachedGet, invalidateCache } from '../../../services/authClient'
import { useAuth } from '../../../context/useAuth'
import { readJSON, writeJSON } from '../../../services/storage'
import { useParentStudentsGate } from '../useParentStudentsGate'
import PageHeader from '../../layout/PageHeader'
import LoadingState from '../../shared/LoadingState'
import Button from '../../ui/Button'
import StudentTeacherModal from '../components/StudentTeacherModal'
import StudentProfileModal from '../components/StudentProfileModal'
import StudentResourceLibraryModal from '../components/StudentResourceLibraryModal'
import StudentResourcePicker from '../components/StudentResourcePicker'
import SchoolPicker from '../components/SchoolPicker'
import ResourceImageField from '../components/ResourceImageField'
import { BirthDateField, FieldIcon, WizardSteps } from '../components/StudentWizardShared'
import { ADD_STUDENT_WIZARD_STEPS, GENDER_OPTIONS, GRADE_OPTIONS, getGradeBirthYearRange } from '../components/studentWizardConstants'
import ChildSeatPurchaseModal from '../components/ChildSeatPurchaseModal'
import ParentWelcome from '../components/ParentWelcome'
import ParentWelcomeModal from '../components/ParentWelcomeModal'

const WELCOME_SEEN_KEY = 'parentWelcomeSeen'

function hasSeenWelcome(parentId) {
  if (!parentId) return true
  const map = readJSON(WELCOME_SEEN_KEY, {})
  return Boolean(map && map[parentId])
}

function markWelcomeSeen(parentId) {
  if (!parentId) return
  const map = readJSON(WELCOME_SEEN_KEY, {}) || {}
  writeJSON(WELCOME_SEEN_KEY, { ...map, [parentId]: true })
}

const INITIAL_FORM = {
  firstName: '',
  lastName: '',
  birthDate: '',
  phone: '',
  gender: '',
  grade: '',
  acceptConsent: false,
}

function StudentAvatar({ student }) {
  if (student.photoUrl) {
    return (
      <img loading="lazy" decoding="async"
        src={student.photoUrl}
        alt={`${student.fullName} fotoğrafı`}
        className="h-12 w-12 shrink-0 rounded-xl border border-panel-border object-cover"
      />
    )
  }

  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-panel-blue-soft text-panel-blue">
      <GraduationCap size={24} aria-hidden="true" />
    </span>
  )
}

function AddStudentModal({ onCreated, onClose, onAssignResources }) {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [studentId, setStudentId] = useState(null)
  const [createdStudent, setCreatedStudent] = useState(null)
  const [form, setForm] = useState(INITIAL_FORM)
  const [photoUrl, setPhotoUrl] = useState('')
  const [provinceId, setProvinceId] = useState(null)
  const [districtId, setDistrictId] = useState(null)
  const [school, setSchool] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // Kaynak Seçimi adımı kaydını StudentResourcePicker üstlenir; buradan çağırırız.
  const resourcePickerRef = useRef(null)
  const handleResourcePickerReady = useCallback((api) => {
    resourcePickerRef.current = api
  }, [])

  const handleChange = (event) => {
    const { name, type, value, checked } = event.target
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleCreate = async (event) => {
    event.preventDefault()

    const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`.trim()
    if (form.firstName.trim().length < 2 || form.lastName.trim().length < 2) {
      setError('Ad ve soyad girilmeli.')
      return
    }
    if (!form.birthDate) {
      setError('Doğum tarihi seçilmeli.')
      return
    }
    if (!form.gender) {
      setError('Cinsiyet seçilmeli.')
      return
    }
    if (!form.phone.trim()) {
      setError('Telefon numarası girilmeli.')
      return
    }
    if (!GRADE_OPTIONS.includes(form.grade)) {
      setError('Sınıf seçilmeli.')
      return
    }
    const birthYearRange = getGradeBirthYearRange(form.grade)
    const birthYear = Number(form.birthDate.slice(0, 4))
    if (birthYearRange && (birthYear < birthYearRange.min || birthYear > birthYearRange.max)) {
      setError(
        `${form.grade}. sınıf için doğum tarihi ${birthYearRange.min}-${birthYearRange.max} yılları arasında olmalı.`,
      )
      return
    }
    if (!form.acceptConsent) {
      setError('Devam etmek için onay vermelisiniz.')
      return
    }

    if (studentId) {
      setStep(2)
      return
    }

    setError('')
    setLoading(true)
    try {
      const data = await authRequest('/api/parent/students', {
        method: 'POST',
        body: JSON.stringify({
          fullName,
          birthDate: form.birthDate,
          phone: form.phone.trim(),
          gender: form.gender,
          grade: form.grade,
          photoUrl: photoUrl || null,
          acceptConsent: form.acceptConsent,
        }),
      })
      invalidateCache('/api/parent/students')
      setStudentId(data.student.id)
      setCreatedStudent(data.student)
      onCreated(data.student)
      setStep(2)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Sihirbaz yalnızca temel + okul bilgisini kaydeder. Dersler (sınıfa göre otomatik), panel
  // teması (cinsiyete göre otomatik) ve hobiler "Detay" ekranından yönetilir — bu yüzden burada
  // gönderilmez (backend gönderilmeyen alanları korur).
  const saveProfile = () =>
    authRequest(`/api/parent/students/${studentId}/profile`, {
      method: 'PUT',
      body: JSON.stringify({
        provinceId,
        districtId,
        schoolId: school?.id || null,
        birthDate: form.birthDate,
        grade: form.grade,
        phone: form.phone.trim(),
        photoUrl: photoUrl || null,
      }),
    }).then((result) => {
      invalidateCache('/api/parent/students')
      return result
    })

  const handleSaveSchool = async () => {
    if (!school) {
      setError('Okul seçilmeli.')
      return
    }
    setError('')
    setLoading(true)
    try {
      await saveProfile()
      setStep(3)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSkipSchool = () => {
    setError('')
    setStep(3)
  }

  // Kaynak Seçimi adımı: seçilen kaynakları StudentResourcePicker kendi PUT'u ile atar.
  const handleSaveResources = async () => {
    setError('')
    setLoading(true)
    try {
      if (resourcePickerRef.current?.save) {
        await resourcePickerRef.current.save()
        invalidateCache('/api/parent/students')
      }
      setStep(4)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSkipResources = () => {
    setError('')
    setStep(4)
  }

  const handleAssignResourcesNow = () => {
    onClose()
    if (createdStudent && onAssignResources) onAssignResources(createdStudent)
  }

  const gradeBirthYearRange = getGradeBirthYearRange(form.grade)

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <div className="flex h-full w-full max-w-5xl flex-col overflow-hidden bg-white shadow-panel-2 sm:h-auto sm:max-h-[90vh] sm:rounded-2xl">
        <div className="flex items-center justify-between gap-4 px-4 pb-3 pt-3 sm:px-6 sm:pb-3.5 sm:pt-4">
          <h2 className="text-lg font-semibold text-panel-text">
            {step === 4 ? 'Profil hazır' : 'Çocuk Ekle'}
          </h2>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {step !== 4 ? <WizardSteps step={step} steps={ADD_STUDENT_WIZARD_STEPS} /> : null}

        <div className="min-h-0 flex-1 overflow-y-auto border-t border-[#edf0f1] px-4 py-4 sm:min-h-[460px] sm:px-6 sm:py-5">
          {error ? (
            <div className="mb-3 rounded-xl bg-panel-accent-soft px-4 py-3 text-sm text-panel-warm">{error}</div>
          ) : null}

          {step === 1 ? (
            <form id="add-student-step1" onSubmit={handleCreate} className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:gap-5">
                <div className="flex justify-center sm:w-2/5 sm:items-start">
                  <ResourceImageField value={photoUrl} onChange={setPhotoUrl} shape="circle" compact size={160} />
                </div>

                <div className="flex flex-col gap-2.5 sm:w-3/5">
                  <div className="relative">
                    <FieldIcon icon={UserRound} />
                    <input
                      name="firstName"
                      value={form.firstName}
                      onChange={handleChange}
                      placeholder="Ad *"
                      aria-label="Ad"
                      className="w-full rounded-xl border border-panel-border p-2 pl-9 text-base text-panel-text"
                    />
                  </div>

                  <div className="relative">
                    <FieldIcon icon={UserRound} />
                    <input
                      name="lastName"
                      value={form.lastName}
                      onChange={handleChange}
                      placeholder="Soyad *"
                      aria-label="Soyad"
                      className="w-full rounded-xl border border-panel-border p-2 pl-9 text-base text-panel-text"
                    />
                  </div>

                  <div className="relative">
                    <FieldIcon icon={GraduationCap} />
                    <select
                      name="grade"
                      value={form.grade}
                      onChange={handleChange}
                      aria-label="Sınıf"
                      className="w-full rounded-xl border border-panel-border p-2 pl-9 text-base text-panel-text"
                    >
                      <option value="">Sınıf Seçin *</option>
                      {GRADE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}. Sınıf
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <BirthDateField
                      name="birthDate"
                      required
                      value={form.birthDate}
                      onChange={handleChange}
                      min={gradeBirthYearRange ? `${gradeBirthYearRange.min}-01-01` : undefined}
                      max={gradeBirthYearRange ? `${gradeBirthYearRange.max}-12-31` : undefined}
                    />
                    {gradeBirthYearRange ? (
                      <span className="text-xs text-panel-text-muted">
                        {form.grade}. sınıf için beklenen doğum yılı: {gradeBirthYearRange.min}–{gradeBirthYearRange.max}
                      </span>
                    ) : null}
                  </div>

                  <div className="relative">
                    <FieldIcon icon={Users} />
                    <select
                      name="gender"
                      value={form.gender}
                      onChange={handleChange}
                      aria-label="Cinsiyet"
                      className="w-full rounded-xl border border-panel-border p-2 pl-9 text-base text-panel-text"
                    >
                      <option value="">Cinsiyet Seçin *</option>
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
                      name="phone"
                      value={form.phone}
                      onChange={handleChange}
                      placeholder="Telefon (Örn. 05XX XXX XX XX) *"
                      aria-label="Telefon"
                      className="w-full rounded-xl border border-panel-border p-2 pl-9 text-base text-panel-text"
                    />
                  </div>
                </div>
              </div>

              <p className="-mt-1.5 text-xs text-panel-text-muted">
                Öğrenci, telefon numarası ve varsayılan olarak telefonun son 6 hanesinden oluşan şifreyle, sizin
                hesabınızdan bağımsız olarak doğrudan giriş yapabilir.
              </p>

              <label className="flex items-start gap-2 text-sm text-panel-text">
                <input
                  type="checkbox"
                  name="acceptConsent"
                  checked={form.acceptConsent}
                  onChange={handleChange}
                  className="mt-0.5 h-5 w-5 rounded border-panel-border"
                />
                <span>Çocuğum için ebeveyn olarak KVKK ve aydınlatma metni onayını veriyorum.</span>
              </label>
            </form>
          ) : null}

          {step === 2 ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-panel-text-muted">
                Çocuğunuzun okulunu il, ilçe ve okul adına göre seçin. Şu an bilmiyorsanız bu adımı atlayıp daha
                sonra "Detay" ekranından ekleyebilirsiniz.
              </p>
              <SchoolPicker
                provinceId={provinceId}
                districtId={districtId}
                school={school}
                onProvinceChange={setProvinceId}
                onDistrictChange={setDistrictId}
                onSchoolChange={setSchool}
              />
            </div>
          ) : null}

          {step === 3 && studentId ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-panel-text-muted">
                Çocuğunuzun kullandığı kaynak kitapları kütüphaneden seçin. Bu adım zorunlu değildir —
                daha sonra "Kitaplık" menüsünden de kaynak ekleyebilirsiniz.
              </p>
              <StudentResourcePicker studentId={studentId} onReady={handleResourcePickerReady} />
            </div>
          ) : null}

          {step === 4 ? (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-panel-sage-soft text-panel-sage">
                <GraduationCap size={30} aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-xl font-bold text-panel-text">
                  {(createdStudent?.fullName || form.firstName || 'Çocuğunuz').trim().split(/\s+/)[0]} için profil hazır
                </h3>
                <p className="mx-auto mt-1.5 max-w-sm text-sm leading-6 text-panel-text-muted">
                  Sırada haftalık planı kurmak var. “Bugün” ekranındaki başlangıç rehberi
                  kalan adımlarda size yol gösterecek.
                </p>
              </div>
              <div className="mt-1 flex w-full max-w-sm flex-col gap-2">
                <Button type="button" size="md" onClick={handleAssignResourcesNow}>
                  <BookOpen size={16} aria-hidden="true" />
                  Kaynak / Kitap Ata
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => navigate('/parent/weekly-plan')}
                >
                  <TrendingUp size={16} aria-hidden="true" />
                  Haftalık Planı Kur
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col items-stretch gap-2 border-t border-[#edf0f1] px-4 py-3 sm:flex-row sm:items-center sm:justify-end sm:px-6 sm:py-4">
          {step === 1 ? (
            <>
              <Button type="button" variant="secondary" size="md" onClick={onClose} disabled={loading}>
                Vazgeç
              </Button>
              <Button type="submit" form="add-student-step1" size="md" disabled={loading}>
                {loading ? 'Kaydediliyor...' : 'Kaydet ve Devam Et'}
              </Button>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Button type="button" variant="secondary" size="md" onClick={() => setStep(1)} disabled={loading}>
                Geri
              </Button>
              <Button type="button" variant="secondary" size="md" onClick={handleSkipSchool} disabled={loading}>
                Atla
              </Button>
              <Button type="button" size="md" onClick={handleSaveSchool} disabled={loading}>
                {loading ? 'Kaydediliyor...' : 'Kaydet ve Devam Et'}
              </Button>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <Button type="button" variant="secondary" size="md" onClick={() => setStep(2)} disabled={loading}>
                Geri
              </Button>
              <Button type="button" variant="secondary" size="md" onClick={handleSkipResources} disabled={loading}>
                Atla ve Bitir
              </Button>
              <Button type="button" size="md" onClick={handleSaveResources} disabled={loading}>
                {loading ? 'Kaydediliyor...' : 'Kaydet ve Bitir'}
              </Button>
            </>
          ) : null}

          {step === 4 ? (
            <Button type="button" variant="secondary" size="md" onClick={onClose}>
              Panele git
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function StudentCard({ student, onOpenLibrary, onOpenProfile, onOpenTeachers }) {
  const navigate = useNavigate()

  const gradeText = student.grade ? (/^\d+$/.test(student.grade) ? `${student.grade}. Sınıf` : student.grade) : null
  const schoolText = [student.schoolName, gradeText].filter(Boolean).join(' · ')

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-panel-border bg-panel-surface p-5 shadow-panel-1">
      <div className="flex min-w-0 items-center gap-3">
        <StudentAvatar student={student} />
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-panel-text">{student.fullName}</p>
          {student.phone ? (
            <p className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-panel-text-muted">
              <Phone size={13} className="shrink-0" aria-hidden="true" />
              <span className="truncate">{student.phone}</span>
            </p>
          ) : null}
          {schoolText ? (
            <p className="mt-1.5 inline-flex max-w-full items-center gap-1.5 truncate rounded-full bg-panel-accent-soft px-2.5 py-1 text-xs font-medium text-panel-warm">
              <School size={13} className="shrink-0" aria-hidden="true" />
              <span className="truncate">{schoolText}</span>
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onOpenProfile(student)}
          className="h-auto w-full justify-start gap-2.5 px-3 py-2"
        >
          <UserRound size={16} className="shrink-0" aria-hidden="true" />
          Detay
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onOpenLibrary(student)}
          className="h-auto w-full justify-start gap-2.5 px-3 py-2"
        >
          <BookOpen size={16} className="shrink-0" aria-hidden="true" />
          Kaynaklar
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => navigate(`/parent/mistakes?studentId=${student.id}`)}
          className="h-auto w-full justify-start gap-2.5 px-3 py-2"
        >
          <AlertCircle size={16} className="shrink-0" aria-hidden="true" />
          Hata Defteri
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onOpenTeachers(student)}
          className="h-auto w-full justify-start gap-2.5 px-3 py-2"
        >
          <GraduationCap size={16} className="shrink-0" aria-hidden="true" />
          Öğretmenler
        </Button>
      </div>
    </div>
  )
}

export default function StudentsPage() {
  const { markHasStudents } = useParentStudentsGate()
  const { authUser } = useAuth()
  const parentId = authUser?.id
  const [searchParams, setSearchParams] = useSearchParams()
  const [students, setStudents] = useState(null)
  const [quota, setQuota] = useState(null)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showSeatPurchase, setShowSeatPurchase] = useState(false)
  const [seatPurchaseBanner] = useState(() => searchParams.get('cocuk_koltugu') === 'eklendi')
  const [seatPaymentFailed, setSeatPaymentFailed] = useState(() => searchParams.get('odeme') === 'hata')
  const [libraryModalStudent, setLibraryModalStudent] = useState(null)
  const [teacherModalStudent, setTeacherModalStudent] = useState(null)
  const [profileModalStudent, setProfileModalStudent] = useState(null)
  const [showWelcome, setShowWelcome] = useState(false)

  const loadStudents = ({ force } = {}) => {
    if (force) invalidateCache('/api/parent/students')
    return cachedGet('/api/parent/students')
      .then((data) => {
        setStudents(data.students)
        setQuota(data.quota || null)
        return data
      })
      .catch((err) => setError(err.message))
  }

  // iyzico çocuk-koltuğu ödemesi başarıyla dönünce /parent/students?cocuk_koltugu=eklendi olur:
  // kotayı tazele (force), URL'i temizle ve hak açıldıysa profil sihirbazını aç.
  useEffect(() => {
    const justPurchased = searchParams.get('cocuk_koltugu') === 'eklendi'
    const paymentFailed = searchParams.get('odeme') === 'hata'
    if (justPurchased || paymentFailed) {
      searchParams.delete('cocuk_koltugu')
      searchParams.delete('odeme')
      setSearchParams(searchParams, { replace: true })
    }
    if (paymentFailed) {
      setShowSeatPurchase(true)
    }
    loadStudents({ force: justPurchased }).then((data) => {
      if (justPurchased && data?.quota?.hasRemaining) setShowModal(true)
      const list = data?.students || []
      if (!justPurchased && list.length === 0 && !authUser?.isAdmin && !hasSeenWelcome(parentId)) {
        setShowWelcome(true)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Başlangıç rehberindeki adımlar buraya "?action=profile|resources|teachers&studentId=..."
  // ile derin bağlantı verir; öğrenciler yüklendiğinde ilgili modal bir kez açılır.
  useEffect(() => {
    if (!students || students.length === 0) return
    const action = searchParams.get('action')
    if (!action) return
    const targetId = searchParams.get('studentId')
    const target = students.find((student) => student.id === targetId) || students[0]
    if (!target) return
    if (action === 'profile') setProfileModalStudent(target)
    else if (action === 'resources') setLibraryModalStudent(target)
    else if (action === 'teachers') setTeacherModalStudent(target)
    searchParams.delete('action')
    searchParams.delete('studentId')
    setSearchParams(searchParams, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students])

  const handleCloseWelcome = () => {
    markWelcomeSeen(parentId)
    setShowWelcome(false)
  }

  const handleAddChild = () => {
    if (quota && !quota.hasRemaining) {
      setShowSeatPurchase(true)
    } else {
      setShowModal(true)
    }
  }

  const handleCreated = (student) => {
    setStudents((current) => [...(current || []), student])
    markHasStudents()
  }

  const handleWizardClose = () => {
    setShowModal(false)
    loadStudents({ force: true })
  }

  const handleSeatPurchaseClose = () => {
    setShowSeatPurchase(false)
    setSeatPaymentFailed(false)
    loadStudents({ force: true })
  }

  const handleTeachersSaved = (studentId, teacherCount) => {
    setStudents((current) =>
      (current || []).map((student) => (student.id === studentId ? { ...student, teacherCount } : student)),
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Çocuklarım"
        subtitle="Çocuklarınızın profillerini yönetin, gelişimlerini takip edin ve onlara özel kaynaklara ulaşın."
        actions={
          students && students.length > 0 ? (
            <Button onClick={handleAddChild}>
              <Plus size={16} aria-hidden="true" />
              Çocuk Profili Ekle
            </Button>
          ) : null
        }
      />

      {seatPurchaseBanner ? (
        <div className="rounded-xl bg-panel-sage-soft px-4 py-3 text-sm text-panel-text" role="status">
          Ödemeniz alındı. Yeni çocuk profilinizi şimdi oluşturabilirsiniz.
        </div>
      ) : null}

      {seatPaymentFailed ? (
        <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-sm text-panel-warm" role="alert">
          Ödeme tamamlanamadı ya da onaylanamadı. Tekrar deneyebilirsiniz. Sorun sürerse veya
          kartınızdan ücret alındığını görürseniz bizimle iletişime geçin.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{error}</div>
      ) : students === null ? (
        <LoadingState label="Çocuklar yükleniyor..." />
      ) : students.length === 0 ? (
        <ParentWelcome parentName={authUser?.fullName} onAddChild={handleAddChild} />
      ) : (
        <div className="fade-slide-in">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {students.map((student) => (
              <StudentCard
                key={student.id}
                student={student}
                onOpenLibrary={setLibraryModalStudent}
                onOpenProfile={setProfileModalStudent}
                onOpenTeachers={setTeacherModalStudent}
              />
            ))}
          </div>
        </div>
      )}

      {showWelcome ? (
        <ParentWelcomeModal parentName={authUser?.fullName} onClose={handleCloseWelcome} />
      ) : null}
      {showModal ? (
        <AddStudentModal
          onCreated={handleCreated}
          onClose={handleWizardClose}
          onAssignResources={setLibraryModalStudent}
        />
      ) : null}
      {showSeatPurchase ? <ChildSeatPurchaseModal onClose={handleSeatPurchaseClose} /> : null}
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
    </div>
  )
}
