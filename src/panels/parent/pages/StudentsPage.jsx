import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  BookOpen,
  Calendar,
  GraduationCap,
  Palette,
  Phone,
  Plus,
  School,
  Trophy,
  TrendingUp,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { authRequest, cachedGet, invalidateCache } from '../../../services/authClient'
import { useParentStudentsGate } from '../useParentStudentsGate'
import { THEMES } from '../../../theme/themes'
import PageHeader from '../../layout/PageHeader'
import LoadingState from '../../shared/LoadingState'
import EmptyState from '../../shared/EmptyState'
import Button from '../../ui/Button'
import StudentTeacherModal from '../components/StudentTeacherModal'
import StudentProfileModal, { InterestPicker } from '../components/StudentProfileModal'
import StudentResourceLibraryModal from '../components/StudentResourceLibraryModal'
import SchoolPicker from '../components/SchoolPicker'
import SchoolScheduleEditor from '../components/SchoolScheduleEditor'
import SubjectPicker from '../components/SubjectPicker'
import ResourceImageField from '../components/ResourceImageField'
import { COMMON_ARTS, COMMON_SPORTS } from '../components/studentInterestCatalog'
import { FieldIcon, WizardSteps } from '../components/StudentWizardShared'
import { GENDER_OPTIONS, GRADE_OPTIONS, WIZARD_STEPS, getGradeBirthYearRange } from '../components/studentWizardConstants'

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

function AddStudentModal({ onCreated, onClose }) {
  const [step, setStep] = useState(1)
  const [studentId, setStudentId] = useState(null)
  const [form, setForm] = useState(INITIAL_FORM)
  const [photoUrl, setPhotoUrl] = useState('')
  const [provinceId, setProvinceId] = useState(null)
  const [districtId, setDistrictId] = useState(null)
  const [school, setSchool] = useState(null)
  const [themeId, setThemeId] = useState('')
  const [supportedTeam, setSupportedTeam] = useState('')
  const [interestedSports, setInterestedSports] = useState([])
  const [interestedArts, setInterestedArts] = useState([])
  const [schoolSchedule, setSchoolSchedule] = useState([])
  const [scheduleLoaded, setScheduleLoaded] = useState(false)
  const [subjectIds, setSubjectIds] = useState([])
  const [allSubjects, setAllSubjects] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    authRequest('/api/panel/subjects', { method: 'GET' })
      .then((data) => setAllSubjects(data.subjects))
      .catch(() => setAllSubjects([]))
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
      onCreated(data.student)
      setStep(2)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

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
        supportedTeam: supportedTeam.trim() || null,
        interestedSports,
        interestedArts,
        schoolSchedule,
        subjectIds,
        ...(themeId ? { themeId } : {}),
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

  // 3. adıma (Okul Ders Saatleri) ilk girişte, aynı okul+sınıf için admin tarafında tanımlı
  // bir ders programı şablonu varsa onu öneri olarak getirip ön dolgu yapar; veli düzenleyip
  // kaydedebilir veya tamamen atlayabilir.
  useEffect(() => {
    if (step !== 3 || scheduleLoaded || !studentId) return
    let ignore = false

    authRequest(`/api/parent/students/${studentId}/profile`, { method: 'GET' })
      .then((data) => {
        if (ignore) return
        const loaded = data.profile
        const initial = loaded?.schoolSchedule?.length ? loaded.schoolSchedule : loaded?.suggestedSchoolSchedule || []
        setSchoolSchedule(initial)
        setSubjectIds(loaded?.subjectIds || [])
        setScheduleLoaded(true)
      })
      .catch(() => {
        if (!ignore) setScheduleLoaded(true)
      })

    return () => {
      ignore = true
    }
  }, [step, scheduleLoaded, studentId])

  const handleSaveSchedule = async () => {
    setError('')
    setLoading(true)
    try {
      await saveProfile()
      setStep(4)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSkipSchedule = () => {
    setError('')
    setStep(4)
  }

  const handleSaveSubjects = async () => {
    setError('')
    setLoading(true)
    try {
      await saveProfile()
      setStep(5)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSkipSubjects = () => {
    setError('')
    setStep(5)
  }

  const handleFinish = async () => {
    setError('')
    setLoading(true)
    try {
      await saveProfile()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const defaultThemeLabel = form.gender === 'kiz' ? 'Mor Tema' : form.gender === 'erkek' ? 'Mavi Tema' : 'cinsiyete göre'
  const gradeBirthYearRange = getGradeBirthYearRange(form.grade)

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <div className="flex h-full w-full max-w-5xl flex-col overflow-hidden bg-white shadow-panel-2 sm:h-auto sm:max-h-[90vh] sm:rounded-2xl">
        <div className="flex items-center justify-between gap-4 px-4 pb-3 pt-3 sm:px-6 sm:pb-3.5 sm:pt-4">
          <h2 className="text-lg font-semibold text-panel-text">Çocuk Ekle</h2>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <WizardSteps step={step} steps={WIZARD_STEPS} />

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
                      placeholder="Ad"
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
                      placeholder="Soyad"
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
                      <option value="">Sınıf Seçin</option>
                      {GRADE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}. Sınıf
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="relative">
                      <FieldIcon icon={Calendar} />
                      <input
                        type="date"
                        name="birthDate"
                        value={form.birthDate}
                        onChange={handleChange}
                        min={gradeBirthYearRange ? `${gradeBirthYearRange.min}-01-01` : undefined}
                        max={gradeBirthYearRange ? `${gradeBirthYearRange.max}-12-31` : undefined}
                        aria-label="Doğum Tarihi"
                        className="w-full rounded-xl border border-panel-border p-2 pl-9 text-base text-panel-text"
                      />
                    </div>
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
                      <option value="">Cinsiyet Seçin</option>
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
                      placeholder="Telefon (Örn. 05XX XXX XX XX)"
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

          {step === 3 ? (
            <div className="flex flex-col gap-3">
              {school?.id && form.grade ? (
                <p className="rounded-xl bg-panel-blue-soft/50 px-3 py-2.5 text-sm text-panel-text">
                  Okul ders saatleri, seçtiğiniz okul ve sınıf bilgisinden otomatik alınır ve haftalık planda "Okulda"
                  olarak görünür. Bu adımı geçebilirsiniz.
                </p>
              ) : (
                <>
                  <p className="text-sm text-panel-text-muted">
                    Okul sistemde tanımlı değilse çocuğunuzun okul ders saatlerini elle girin (hafta sonu kurs programı
                    varsa cumartesi/pazar da eklenebilir). Bu saatler haftalık planda "Okulda" olarak görünür ve bu
                    saatlere ödev eklenemez. Şu an bilmiyorsanız bu adımı atlayabilirsiniz.
                  </p>
                  <SchoolScheduleEditor entries={schoolSchedule} onChange={setSchoolSchedule} />
                </>
              )}
            </div>
          ) : null}

          {step === 4 ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-panel-text-muted">
                Soldaki listeden çocuğunuzun okulda aldığı dersleri seçin, sağdaki listeye eklensin. Şu an
                bilmiyorsanız bu adımı atlayıp daha sonra "Detay" ekranından ekleyebilirsiniz.
              </p>
              <SubjectPicker allSubjects={allSubjects} selectedIds={subjectIds} onChange={setSubjectIds} />
            </div>
          ) : null}

          {step === 5 ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-panel-text-muted">
                Bu adımdaki bilgiler zorunlu değildir, istediğiniz zaman "Detay" ekranından güncelleyebilirsiniz.
              </p>

              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-panel-text-muted">Panel Stili</span>
                <div className="relative">
                  <FieldIcon icon={Palette} />
                  <select
                    value={themeId}
                    onChange={(event) => setThemeId(event.target.value)}
                    className="w-full rounded-xl border border-panel-border p-2 pl-9 text-base text-panel-text"
                  >
                    <option value="">Otomatik ({defaultThemeLabel})</option>
                    {THEMES.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-panel-text-muted">Tuttuğu Takım (opsiyonel)</span>
                <div className="relative">
                  <FieldIcon icon={Trophy} />
                  <input
                    value={supportedTeam}
                    onChange={(event) => setSupportedTeam(event.target.value)}
                    placeholder="Örn. Galatasaray"
                    className="w-full rounded-xl border border-panel-border p-2 pl-9 text-base text-panel-text"
                  />
                </div>
              </label>

              <InterestPicker
                label="Spor İlgi Alanları (opsiyonel)"
                catalog={COMMON_SPORTS}
                selected={interestedSports}
                onChange={setInterestedSports}
              />

              <InterestPicker
                label="Sanat İlgi Alanları (opsiyonel)"
                catalog={COMMON_ARTS}
                selected={interestedArts}
                onChange={setInterestedArts}
              />
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
              <Button type="button" variant="secondary" size="md" onClick={handleSkipSchedule} disabled={loading}>
                Atla
              </Button>
              <Button type="button" size="md" onClick={handleSaveSchedule} disabled={loading}>
                {loading ? 'Kaydediliyor...' : 'Kaydet ve Devam Et'}
              </Button>
            </>
          ) : null}

          {step === 4 ? (
            <>
              <Button type="button" variant="secondary" size="md" onClick={() => setStep(3)} disabled={loading}>
                Geri
              </Button>
              <Button type="button" variant="secondary" size="md" onClick={handleSkipSubjects} disabled={loading}>
                Atla
              </Button>
              <Button type="button" size="md" onClick={handleSaveSubjects} disabled={loading}>
                {loading ? 'Kaydediliyor...' : 'Kaydet ve Devam Et'}
              </Button>
            </>
          ) : null}

          {step === 5 ? (
            <>
              <Button type="button" variant="secondary" size="md" onClick={() => setStep(4)} disabled={loading}>
                Geri
              </Button>
              <Button type="button" variant="secondary" size="md" onClick={onClose} disabled={loading}>
                Atla ve Bitir
              </Button>
              <Button type="button" size="md" onClick={handleFinish} disabled={loading}>
                {loading ? 'Kaydediliyor...' : 'Kaydet ve Bitir'}
              </Button>
            </>
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
          onClick={() => navigate(`/parent/progress?studentId=${student.id}`)}
          className="h-auto w-full justify-start gap-2.5 px-3 py-2"
        >
          <TrendingUp size={16} className="shrink-0" aria-hidden="true" />
          Gelişim Analizi
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
  const [students, setStudents] = useState(null)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [libraryModalStudent, setLibraryModalStudent] = useState(null)
  const [teacherModalStudent, setTeacherModalStudent] = useState(null)
  const [profileModalStudent, setProfileModalStudent] = useState(null)

  const loadStudents = () => {
    cachedGet('/api/parent/students')
      .then((data) => setStudents(data.students))
      .catch((err) => setError(err.message))
  }

  useEffect(() => {
    loadStudents()
  }, [])

  const handleCreated = (student) => {
    setStudents((current) => [...(current || []), student])
    markHasStudents()
  }

  const handleWizardClose = () => {
    setShowModal(false)
    loadStudents()
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
          <Button onClick={() => setShowModal(true)}>
            <Plus size={16} aria-hidden="true" />
            Çocuk Profili Ekle
          </Button>
        }
      />

      {error ? (
        <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{error}</div>
      ) : students === null ? (
        <LoadingState label="Çocuklar yükleniyor..." />
      ) : students.length === 0 ? (
        <EmptyState
          icon={Users}
          title="İlk çocuk profilinizi oluşturun"
          description="Çocuğunuza özel içerik ve gelişim takibi için bir profil ekleyerek başlayın."
        />
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

      {showModal ? <AddStudentModal onCreated={handleCreated} onClose={handleWizardClose} /> : null}
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
