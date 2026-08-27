import { useEffect, useState } from 'react'
import { Check, GraduationCap, Palette, Phone, Plus, Trophy, UserRound, Users, X } from 'lucide-react'
import { authRequest } from '../../../services/authClient'
import { THEMES } from '../../../theme/themes'
import LoadingState from '../../shared/LoadingState'
import Button from '../../ui/Button'
import ResourceImageField from './ResourceImageField'
import SchoolPicker from './SchoolPicker'
import SchoolScheduleEditor from './SchoolScheduleEditor'
import SubjectPicker from './SubjectPicker'
import { COMMON_ARTS, COMMON_SPORTS } from './studentInterestCatalog'
import { BirthDateField, FieldIcon, WizardSteps } from './StudentWizardShared'
import { GENDER_OPTIONS, WIZARD_STEPS } from './studentWizardConstants'

const LOCKED_FIELD_CLASS =
  'w-full cursor-not-allowed rounded-xl border border-panel-border bg-[#f4f5f6] p-2 pl-9 text-base text-panel-text-muted'

export function InterestPicker({ label, catalog, selected, onChange }) {
  const [customInput, setCustomInput] = useState('')

  const toggle = (item) => {
    onChange(selected.includes(item) ? selected.filter((value) => value !== item) : [...selected, item])
  }

  const addCustom = () => {
    const trimmed = customInput.trim()
    if (!trimmed || selected.includes(trimmed)) {
      setCustomInput('')
      return
    }
    onChange([...selected, trimmed])
    setCustomInput('')
  }

  const extraSelected = selected.filter((item) => !catalog.includes(item))

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-panel-text-muted">{label}</span>
      <div className="flex flex-wrap gap-2">
        {catalog.map((item) => {
          const isSelected = selected.includes(item)
          return (
            <button
              key={item}
              type="button"
              aria-pressed={isSelected}
              onClick={() => toggle(item)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                isSelected
                  ? 'border-[#c96a1f] bg-[#fbe9d7] text-[#c96a1f]'
                  : 'border-panel-border bg-white text-panel-text hover:bg-[#f8f7fb]'
              }`}
            >
              {isSelected ? <Check size={13} aria-hidden="true" /> : null}
              {item}
            </button>
          )
        })}
        {extraSelected.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => toggle(item)}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#c96a1f] bg-[#fbe9d7] px-3 py-1.5 text-sm text-[#c96a1f]"
          >
            <Check size={13} aria-hidden="true" />
            {item}
            <X size={12} aria-hidden="true" />
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={customInput}
          onChange={(event) => setCustomInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              addCustom()
            }
          }}
          placeholder="Diğer..."
          className="flex-1 rounded-xl border border-panel-border p-2 text-sm text-panel-text"
        />
        <button
          type="button"
          onClick={addCustom}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-panel-border bg-white px-3 text-sm font-medium text-panel-text hover:bg-[#f8f7fb]"
        >
          <Plus size={14} aria-hidden="true" />
          Ekle
        </button>
      </div>
    </div>
  )
}

export default function StudentProfileModal({ student, onClose }) {
  const [step, setStep] = useState(1)
  const [profile, setProfile] = useState(null)
  const [provinceId, setProvinceId] = useState(null)
  const [districtId, setDistrictId] = useState(null)
  const [school, setSchool] = useState(null)
  const [birthDate, setBirthDate] = useState('')
  const [supportedTeam, setSupportedTeam] = useState('')
  const [grade, setGrade] = useState('')
  const [gender, setGender] = useState('')
  const [phone, setPhone] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [themeId, setThemeId] = useState('')
  const [interestedSports, setInterestedSports] = useState([])
  const [interestedArts, setInterestedArts] = useState([])
  const [schoolSchedule, setSchoolSchedule] = useState([])
  const [subjectIds, setSubjectIds] = useState([])
  const [allSubjects, setAllSubjects] = useState([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    authRequest('/api/panel/subjects', { method: 'GET' })
      .then((data) => setAllSubjects(data.subjects))
      .catch(() => setAllSubjects([]))
  }, [])

  useEffect(() => {
    let ignore = false

    authRequest(`/api/parent/students/${student.id}/profile`, { method: 'GET' })
      .then((data) => {
        if (ignore) return
        const loaded = data.profile
        setProfile(loaded || {})
        if (loaded) {
          setProvinceId(loaded.provinceId || null)
          setDistrictId(loaded.districtId || null)
          setSchool(loaded.schoolId ? { id: loaded.schoolId, name: loaded.schoolName, type: loaded.schoolType } : null)
          setBirthDate(loaded.birthDate ? String(loaded.birthDate).slice(0, 10) : '')
          setSupportedTeam(loaded.supportedTeam || '')
          setGrade(loaded.grade || '')
          setGender(loaded.gender || '')
          setPhone(loaded.phone || '')
          setPhotoUrl(loaded.photoUrl || '')
          setThemeId(loaded.themeId || '')
          setInterestedSports(loaded.interestedSports || [])
          setInterestedArts(loaded.interestedArts || [])
          setSchoolSchedule(loaded.schoolSchedule?.length ? loaded.schoolSchedule : loaded.suggestedSchoolSchedule || [])
          setSubjectIds(loaded.subjectIds || [])
        }
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })

    return () => {
      ignore = true
    }
  }, [student.id])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const data = await authRequest(`/api/parent/students/${student.id}/profile`, {
        method: 'PUT',
        body: JSON.stringify({
          provinceId,
          districtId,
          schoolId: school?.id || null,
          birthDate: birthDate || null,
          supportedTeam: supportedTeam.trim() || null,
          grade: grade.trim() || null,
          phone: phone.trim() || null,
          photoUrl: photoUrl || null,
          interestedSports,
          interestedArts,
          schoolSchedule,
          subjectIds,
          ...(themeId ? { themeId } : {}),
        }),
      })
      setProfile(data.profile)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const nameParts = student.fullName.trim().split(/\s+/)
  const firstName = nameParts[0] || ''
  const lastName = nameParts.slice(1).join(' ') || ''
  const genderLabel = GENDER_OPTIONS.find((option) => option.value === gender)?.label || ''
  const defaultThemeLabel = gender === 'kiz' ? 'Mor Tema' : gender === 'erkek' ? 'Mavi Tema' : 'cinsiyete göre'

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <div className="flex h-full w-full max-w-5xl flex-col overflow-hidden bg-white shadow-panel-2 sm:h-[min(680px,90vh)] sm:rounded-2xl">
        <div className="flex items-center justify-between gap-4 px-4 pb-3 pt-3 sm:px-6 sm:pb-3.5 sm:pt-4">
          <h2 className="text-lg font-semibold text-panel-text">Profil</h2>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {profile !== null ? <WizardSteps step={step} steps={WIZARD_STEPS} onStepClick={setStep} /> : null}

        <div className="min-h-0 flex-1 overflow-y-auto border-t border-[#edf0f1] px-4 py-4 sm:px-6 sm:py-5">
          {error ? (
            <div className="mb-3 rounded-xl bg-panel-accent-soft px-4 py-3 text-sm text-panel-warm">{error}</div>
          ) : null}

          {profile === null ? (
            <LoadingState label="Profil yükleniyor..." />
          ) : step === 1 ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:gap-5">
              <div className="flex justify-center sm:w-2/5 sm:items-start">
                <ResourceImageField value={photoUrl} onChange={setPhotoUrl} shape="circle" compact size={160} />
              </div>

              <div className="flex flex-col gap-2.5 sm:w-3/5">
                <div className="relative">
                  <FieldIcon icon={UserRound} />
                  <input value={firstName} disabled aria-label="Ad" className={LOCKED_FIELD_CLASS} />
                </div>

                <div className="relative">
                  <FieldIcon icon={UserRound} />
                  <input value={lastName} disabled aria-label="Soyad" className={LOCKED_FIELD_CLASS} />
                </div>

                <div className="relative">
                  <FieldIcon icon={GraduationCap} />
                  <input
                    value={grade ? `${grade}. Sınıf` : ''}
                    disabled
                    aria-label="Sınıf"
                    className={LOCKED_FIELD_CLASS}
                  />
                </div>

                <BirthDateField value={birthDate} disabled />

                <div className="relative">
                  <FieldIcon icon={Users} />
                  <input value={genderLabel} disabled aria-label="Cinsiyet" className={LOCKED_FIELD_CLASS} />
                </div>

                <div className="relative">
                  <FieldIcon icon={Phone} />
                  <input value={phone} disabled aria-label="Telefon" className={LOCKED_FIELD_CLASS} />
                </div>
              </div>
            </div>
          ) : null}

          {profile !== null && step === 2 ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-panel-text-muted">
                Çocuğunuzun okulunu il, ilçe ve okul adına göre seçin.
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

          {profile !== null && step === 3 ? (
            <div className="flex flex-col gap-3">
              {school?.id && grade ? (
                <p className="rounded-xl bg-panel-blue-soft/50 px-3 py-2.5 text-sm text-panel-text">
                  Okul ders saatleri, seçilen okul ve sınıf bilgisinden otomatik alınır ve haftalık planda "Okulda"
                  olarak görünür. Değişiklik için okul yönetimindeki ders programını güncelleyin.
                </p>
              ) : (
                <>
                  <p className="text-sm text-panel-text-muted">
                    Okul sistemde tanımlı değil. Okul ders saatlerini elle girin (hafta sonu kurs programı varsa
                    cumartesi/pazar da eklenebilir). Bu saatler haftalık planda "Okulda" olarak görünür ve bu saatlere
                    ödev eklenemez.
                  </p>
                  <SchoolScheduleEditor entries={schoolSchedule} onChange={setSchoolSchedule} />
                </>
              )}
            </div>
          ) : null}

          {profile !== null && step === 4 ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-panel-text-muted">
                Soldaki listeden çocuğunuzun okulda aldığı dersleri seçin, sağdaki listeye eklensin.
              </p>
              <SubjectPicker allSubjects={allSubjects} selectedIds={subjectIds} onChange={setSubjectIds} />
            </div>
          ) : null}

          {profile !== null && step === 5 ? (
            <div className="flex flex-col gap-4">
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
          <Button type="button" variant="secondary" size="md" onClick={onClose} disabled={saving}>
            Vazgeç
          </Button>
          <Button type="button" size="md" onClick={handleSave} disabled={saving || profile === null}>
            {saving ? 'Kaydediliyor...' : 'Profili Kaydet'}
          </Button>
        </div>
      </div>
    </div>
  )
}
