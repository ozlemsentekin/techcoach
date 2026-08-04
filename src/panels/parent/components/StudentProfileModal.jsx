import { useEffect, useState } from 'react'
import { Check, GraduationCap, Phone, Plus, School, X } from 'lucide-react'
import { authRequest } from '../../../services/authClient'
import LoadingState from '../../shared/LoadingState'
import Button from '../../ui/Button'
import ResourceImageField from './ResourceImageField'
import SchoolPicker from './SchoolPicker'

const COMMON_SPORTS = ['Futbol', 'Basketbol', 'Voleybol', 'Yüzme', 'Tenis', 'Atletizm', 'Judo/Güreş', 'Binicilik', 'Bisiklet']
const COMMON_ARTS = ['Resim', 'Müzik', 'Tiyatro', 'Dans', 'Fotoğrafçılık', 'El Sanatları', 'Yazarlık/Şiir']

const TABS = [
  { key: 'genel', label: 'Genel Bilgiler' },
  { key: 'hobiler', label: 'Hobiler' },
]

function InfoChip({ icon, children }) {
  const Icon = icon
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-panel-text-muted">
      <Icon size={13} className="shrink-0 text-[#87a3a5]" aria-hidden="true" />
      {children}
    </span>
  )
}

function InterestPicker({ label, catalog, selected, onChange }) {
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
                  ? 'border-[#655e94] bg-[#f5f2fb] text-[#655e94]'
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
            className="inline-flex items-center gap-1.5 rounded-full border border-[#655e94] bg-[#f5f2fb] px-3 py-1.5 text-sm text-[#655e94]"
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
  const [profile, setProfile] = useState(null)
  const [provinceId, setProvinceId] = useState(null)
  const [districtId, setDistrictId] = useState(null)
  const [school, setSchool] = useState(null)
  const [birthDate, setBirthDate] = useState('')
  const [supportedTeam, setSupportedTeam] = useState('')
  const [grade, setGrade] = useState('')
  const [phone, setPhone] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [interestedSports, setInterestedSports] = useState([])
  const [interestedArts, setInterestedArts] = useState([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('genel')

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
          setPhone(loaded.phone || '')
          setPhotoUrl(loaded.photoUrl || '')
          setInterestedSports(loaded.interestedSports || [])
          setInterestedArts(loaded.interestedArts || [])
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-panel-2">
        <div className="flex items-center justify-between gap-4 border-b border-[#edf0f1] px-6 py-4">
          <h2 className="text-lg font-semibold text-panel-text">Profil</h2>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error ? (
            <div className="mb-4 rounded-xl bg-panel-accent-soft px-4 py-3 text-sm text-panel-warm">{error}</div>
          ) : null}

          {profile === null ? (
            <LoadingState label="Profil yükleniyor..." />
          ) : (
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-5">
                <ResourceImageField value={photoUrl} onChange={setPhotoUrl} shape="circle" compact />

                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <p className="truncate text-lg font-semibold text-panel-text">{student.fullName}</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                    <InfoChip icon={Phone}>{phone || student.email || '—'}</InfoChip>
                    <InfoChip icon={School}>{school?.name || 'Okul girilmedi'}</InfoChip>
                    <InfoChip icon={GraduationCap}>{grade || 'Sınıf girilmedi'}</InfoChip>
                  </div>
                </div>
              </div>

              <div className="flex gap-5 border-b border-[#edf0f1]">
                {TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`-mb-px border-b-2 px-0.5 pb-2.5 text-sm font-medium transition-colors ${
                      activeTab === tab.key
                        ? 'border-[#655e94] text-[#655e94]'
                        : 'border-transparent text-panel-text-muted hover:text-panel-text'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeTab === 'genel' ? (
                <div className="flex flex-col gap-4">
                  <SchoolPicker
                    provinceId={provinceId}
                    districtId={districtId}
                    school={school}
                    onProvinceChange={setProvinceId}
                    onDistrictChange={setDistrictId}
                    onSchoolChange={setSchool}
                  />

                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <label className="flex min-w-[140px] flex-1 flex-col gap-1.5">
                      <span className="text-sm font-medium text-panel-text-muted">Doğum Tarihi</span>
                      <input
                        type="date"
                        value={birthDate}
                        onChange={(event) => setBirthDate(event.target.value)}
                        className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
                      />
                    </label>

                    <label className="flex min-w-[140px] flex-1 flex-col gap-1.5">
                      <span className="text-sm font-medium text-panel-text-muted">Sınıf</span>
                      <input
                        value={grade}
                        onChange={(event) => setGrade(event.target.value)}
                        placeholder="Örn. 8. Sınıf"
                        className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
                      />
                    </label>

                    <label className="flex min-w-[140px] flex-1 flex-col gap-1.5">
                      <span className="text-sm font-medium text-panel-text-muted">Tuttuğu Takım</span>
                      <input
                        value={supportedTeam}
                        onChange={(event) => setSupportedTeam(event.target.value)}
                        placeholder="Örn. Galatasaray"
                        className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
                      />
                    </label>
                  </div>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-panel-text-muted">Telefon</span>
                    <input
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="Örn. 05XX XXX XX XX"
                      className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
                    />
                    <span className="text-xs text-panel-text-muted">
                      Öğrenci bu numarayla, sizin hesabınızdan bağımsız olarak doğrudan giriş yapabilir.
                    </span>
                  </label>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <InterestPicker
                    label="İlgilendiği Sporlar"
                    catalog={COMMON_SPORTS}
                    selected={interestedSports}
                    onChange={setInterestedSports}
                  />

                  <InterestPicker
                    label="İlgilendiği Sanat Dalları"
                    catalog={COMMON_ARTS}
                    selected={interestedArts}
                    onChange={setInterestedArts}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-[#edf0f1] px-6 py-4">
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
