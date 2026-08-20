import { useEffect, useState } from 'react'
import { School, Search, Upload, X } from 'lucide-react'
import { authRequest } from '../../../services/authClient'
import PageHeader from '../../layout/PageHeader'
import LoadingState from '../../shared/LoadingState'
import EmptyState from '../../shared/EmptyState'
import Button from '../../ui/Button'
import Badge from '../../ui/Badge'
import DataTable from '../../ui/DataTable'
import ActionsMenu from '../../ui/ActionsMenu'
import ProvinceDistrictSelect from '../components/ProvinceDistrictSelect'
import SchoolScheduleEditor from '../components/SchoolScheduleEditor'
import { GRADE_OPTIONS } from '../components/studentWizardConstants'

const SCHOOL_TYPE_LABELS = { devlet: 'Devlet', ozel: 'Özel' }
const SCHOOL_TYPE_TONES = { devlet: 'sage', ozel: 'accent' }

function schoolMenuItems({ school, onEdit, onSchedule, onToggleActive }) {
  return [
    { label: 'Düzenle', onClick: () => onEdit(school) },
    { label: 'Ders Programı', onClick: () => onSchedule(school) },
    {
      label: school.isActive ? 'Pasif Yap' : 'Aktif Yap',
      onClick: () => onToggleActive(school),
    },
  ]
}

function SchoolModal({ school, onSaved, onClose }) {
  const isEdit = Boolean(school)
  const [provinceId, setProvinceId] = useState(school?.provinceId || null)
  const [districtId, setDistrictId] = useState(school?.districtId || null)
  const [name, setName] = useState(school?.name || '')
  const [type, setType] = useState(school?.type || 'devlet')
  const [isActive, setIsActive] = useState(school ? school.isActive : true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!districtId) {
      setError('İlçe seçilmeli.')
      return
    }
    if (name.trim().length < 2) {
      setError('Okul adı en az 2 karakter olmalı.')
      return
    }

    setError('')
    setLoading(true)
    try {
      const data = isEdit
        ? await authRequest(`/api/panel-admin/schools/${school.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ name: name.trim(), type, isActive }),
          })
        : await authRequest('/api/panel-admin/schools', {
            method: 'POST',
            body: JSON.stringify({ districtId, name: name.trim(), type }),
          })
      onSaved(data.school)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="h-full w-full overflow-y-auto border border-panel-border bg-panel-surface p-4 shadow-panel-1 sm:h-auto sm:max-h-[90vh] sm:max-w-md sm:rounded-2xl sm:p-5"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-panel-text">{isEdit ? 'Okulu Düzenle' : 'Okul Ekle'}</h2>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {error ? (
          <div className="mb-3 rounded-xl bg-panel-accent-soft px-3 py-1.5 text-sm text-panel-warm">{error}</div>
        ) : null}

        <div className="flex flex-col gap-3">
          {isEdit ? (
            <p className="text-sm text-panel-text-muted">
              {school.provinceName} / {school.districtName}
            </p>
          ) : (
            <ProvinceDistrictSelect
              provinceId={provinceId}
              districtId={districtId}
              onProvinceChange={setProvinceId}
              onDistrictChange={setDistrictId}
            />
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">Okul Adı</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">Tür</span>
            <div className="flex gap-2">
              {['devlet', 'ozel'].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={type === value}
                  onClick={() => setType(value)}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                    type === value
                      ? 'border-[#c96a1f] bg-[#fbe9d7] text-[#c96a1f]'
                      : 'border-panel-border bg-white text-panel-text hover:bg-[#f8f7fb]'
                  }`}
                >
                  {SCHOOL_TYPE_LABELS[value]}
                </button>
              ))}
            </div>
          </div>

          {isEdit ? (
            <label className="flex items-center gap-2.5">
              <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} className="h-4 w-4" />
              <span className="text-sm font-medium text-panel-text">Aktif</span>
            </label>
          ) : null}

          <Button type="submit" disabled={loading} size="md" className="w-full">
            {loading ? 'Kaydediliyor...' : isEdit ? 'Kaydet' : 'Okul Oluştur'}
          </Button>
        </div>
      </form>
    </div>
  )
}

function BulkImportSchoolsModal({ onImported, onClose }) {
  const [provinceId, setProvinceId] = useState(null)
  const [districtId, setDistrictId] = useState(null)
  const [rows, setRows] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!districtId) {
      setError('İlçe seçilmeli.')
      return
    }
    if (!rows.trim()) {
      setError('İçe aktarılacak okul listesi boş olamaz.')
      return
    }

    setError('')
    setLoading(true)
    try {
      const data = await authRequest('/api/panel-admin/schools/bulk-import', {
        method: 'POST',
        body: JSON.stringify({ districtId, rows }),
      })
      setResult(data)
      onImported()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="h-full w-full overflow-y-auto border border-panel-border bg-panel-surface p-4 shadow-panel-1 sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-2xl sm:p-5"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-panel-text">Toplu Okul İçe Aktar</h2>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {error ? (
          <div className="mb-3 rounded-xl bg-panel-accent-soft px-3 py-1.5 text-sm text-panel-warm">{error}</div>
        ) : null}

        <div className="flex flex-col gap-3">
          <ProvinceDistrictSelect
            provinceId={provinceId}
            districtId={districtId}
            onProvinceChange={setProvinceId}
            onDistrictChange={setDistrictId}
          />

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">
              Okul Listesi (her satır: <code>Okul Adı;devlet</code> veya <code>Okul Adı;ozel</code>)
            </span>
            <textarea
              value={rows}
              onChange={(event) => setRows(event.target.value)}
              rows={8}
              placeholder={'Örnek Ortaokulu;devlet\nÖzel Örnek Koleji;ozel'}
              className="rounded-xl border border-panel-border p-2.5 font-mono text-sm text-panel-text"
            />
          </label>

          {result ? (
            <div className="rounded-xl bg-[#f8f7fb] px-3 py-2.5 text-sm text-panel-text">
              <p>
                {result.createdCount} eklendi, {result.skippedCount} atlandı (zaten vardı).
              </p>
              {result.errors?.length ? (
                <ul className="mt-1.5 list-disc pl-4 text-xs text-panel-warm">
                  {result.errors.slice(0, 10).map((item) => (
                    <li key={item.line}>
                      Satır {item.line}: {item.reason}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <Button type="submit" disabled={loading} size="md" className="w-full">
            {loading ? 'İçe aktarılıyor...' : 'İçe Aktar'}
          </Button>
        </div>
      </form>
    </div>
  )
}

function SchoolClassScheduleModal({ school, onClose }) {
  const [grade, setGrade] = useState(GRADE_OPTIONS[0])
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [banner, setBanner] = useState('')

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setError('')

    authRequest(`/api/panel-admin/schools/${school.id}/class-schedules?grade=${grade}`, { method: 'GET' })
      .then((data) => {
        if (!ignore) setEntries(data.entries)
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [school.id, grade])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setBanner('')
    try {
      const data = await authRequest(`/api/panel-admin/schools/${school.id}/class-schedules`, {
        method: 'PUT',
        body: JSON.stringify({ grade, entries }),
      })
      setEntries(data.entries)
      setBanner('Ders programı kaydedildi.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <div className="flex h-full w-full flex-col bg-white shadow-panel-2 sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4 px-4 py-3 sm:px-5 sm:py-4">
          <div>
            <h2 className="text-lg font-semibold text-panel-text">Ders Programı</h2>
            <p className="text-sm text-panel-text-muted">{school.name}</p>
          </div>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto border-t border-[#edf0f1] px-4 py-4 sm:px-5">
          {error ? (
            <div className="mb-3 rounded-xl bg-panel-accent-soft px-3 py-1.5 text-sm text-panel-warm">{error}</div>
          ) : null}
          {banner ? (
            <div className="mb-3 rounded-xl bg-panel-sage-soft px-3 py-1.5 text-sm text-panel-text">{banner}</div>
          ) : null}

          <div className="mb-3 flex flex-wrap gap-1.5">
            {GRADE_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={grade === option}
                onClick={() => setGrade(option)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  grade === option
                    ? 'border-[#c96a1f] bg-[#fbe9d7] text-[#c96a1f]'
                    : 'border-panel-border bg-white text-panel-text hover:bg-[#f8f7fb]'
                }`}
              >
                {option}. Sınıf
              </button>
            ))}
          </div>

          {loading ? <LoadingState label="Ders programı yükleniyor..." /> : <SchoolScheduleEditor entries={entries} onChange={setEntries} />}
        </div>

        <div className="flex flex-col gap-2 border-t border-[#edf0f1] px-4 py-3 sm:flex-row sm:items-center sm:justify-end sm:px-5">
          <Button type="button" variant="secondary" size="md" onClick={onClose} disabled={saving}>
            Kapat
          </Button>
          <Button type="button" size="md" onClick={handleSave} disabled={saving || loading}>
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function AdminSchoolsPage() {
  const [schools, setSchools] = useState(null)
  const [error, setError] = useState('')
  const [provinceId, setProvinceId] = useState(null)
  const [districtId, setDistrictId] = useState(null)
  const [query, setQuery] = useState('')
  const [showSchoolModal, setShowSchoolModal] = useState(false)
  const [editingSchool, setEditingSchool] = useState(null)
  const [showBulkImport, setShowBulkImport] = useState(false)
  const [openMenuSchoolId, setOpenMenuSchoolId] = useState(null)
  const [scheduleModalSchool, setScheduleModalSchool] = useState(null)

  const loadSchools = () => {
    const params = new URLSearchParams()
    if (provinceId) params.set('provinceId', provinceId)
    if (districtId) params.set('districtId', districtId)
    if (query.trim()) params.set('search', query.trim())

    authRequest(`/api/panel-admin/schools?${params.toString()}`, { method: 'GET' })
      .then((data) => setSchools(data.schools))
      .catch((err) => setError(err.message))
  }

  useEffect(() => {
    const timer = setTimeout(loadSchools, 250)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provinceId, districtId, query])

  const handleSchoolSaved = (school) => {
    setSchools((current) => {
      const exists = (current || []).some((item) => item.id === school.id)
      return exists ? current.map((item) => (item.id === school.id ? school : item)) : [school, ...(current || [])]
    })
    setShowSchoolModal(false)
    setEditingSchool(null)
  }

  const handleToggleActive = async (school) => {
    try {
      const data = await authRequest(`/api/panel-admin/schools/${school.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: school.name, type: school.type, isActive: !school.isActive }),
      })
      handleSchoolSaved(data.school)
    } catch (err) {
      setError(err.message)
    }
  }

  const menuContext = {
    onEdit: setEditingSchool,
    onSchedule: setScheduleModalSchool,
    onToggleActive: handleToggleActive,
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Okul Yönetimi"
        actions={
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
                placeholder="Okul ara..."
                className="w-48 rounded-lg border border-[#dfe4e5] bg-white py-1.5 pl-8 pr-3 text-sm text-[#253d3e] focus:outline-none focus:ring-2 focus:ring-[#1c2b5e]/20 sm:w-56"
              />
            </div>
            <Button
              variant="secondary"
              onClick={() => setShowBulkImport(true)}
              className="h-10 rounded-[10px] border-[#dfe4e5] bg-white px-4 text-sm font-medium text-[#253d3e] hover:bg-[#f8f7fb]"
            >
              <Upload size={14} className="mr-1.5 inline" aria-hidden="true" />
              Toplu İçe Aktar
            </Button>
            <Button
              onClick={() => setShowSchoolModal(true)}
              className="h-10 rounded-[10px] bg-[#1c2b5e] px-4 text-sm font-medium text-white hover:opacity-90"
            >
              + Okul Ekle
            </Button>
          </>
        }
      />

      <div className="max-w-xl">
        <ProvinceDistrictSelect
          provinceId={provinceId}
          districtId={districtId}
          onProvinceChange={(value) => {
            setProvinceId(value)
            setDistrictId(null)
          }}
          onDistrictChange={setDistrictId}
        />
      </div>

      {error ? (
        <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{error}</div>
      ) : schools === null ? (
        <LoadingState label="Okullar yükleniyor..." />
      ) : schools.length === 0 ? (
        <EmptyState icon={School} title="Okul bulunamadı" description="Yukarıdaki butonlarla okul ekleyebilir veya toplu içe aktarabilirsiniz." />
      ) : (
        <div className="fade-slide-in flex flex-col gap-3">
          <div className="grid gap-3 md:hidden">
            {schools.map((school) => (
              <article key={school.id} className="rounded-xl border border-panel-border bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="line-clamp-2 text-sm font-bold leading-snug text-[#253d3e]">{school.name}</h2>
                    <p className="mt-1 text-xs text-[#667475]">
                      {school.provinceName} / {school.districtName}
                    </p>
                  </div>
                  <ActionsMenu
                    isOpen={openMenuSchoolId === school.id}
                    onToggle={() => setOpenMenuSchoolId((current) => (current === school.id ? null : school.id))}
                    onClose={() => setOpenMenuSchoolId(null)}
                    triggerLabel="Okul işlemleri"
                    items={schoolMenuItems({ school, ...menuContext })}
                  />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge tone={SCHOOL_TYPE_TONES[school.type] || 'neutral'}>
                    {SCHOOL_TYPE_LABELS[school.type] || school.type}
                  </Badge>
                  <button
                    type="button"
                    onClick={() => handleToggleActive(school)}
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${
                      school.isActive ? 'bg-[#e5f3ea] text-[#34845a]' : 'bg-[#f1f1f3] text-[#8a8a92]'
                    }`}
                  >
                    {school.isActive ? 'Aktif' : 'Pasif'}
                  </button>
                </div>
              </article>
            ))}
          </div>

          <DataTable className="hidden md:block">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="bg-[#f8f7fb] text-[13px] font-semibold text-[#1c2b5e]">
                  <th className="px-4 py-3">Okul Adı</th>
                  <th className="px-4 py-3">İl</th>
                  <th className="px-4 py-3">İlçe</th>
                  <th className="px-4 py-3">Tür</th>
                  <th className="px-4 py-3">Durum</th>
                  <th className="px-4 py-3 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf0f1]">
                {schools.map((school) => (
                  <tr key={school.id} className="hover:bg-[#f8f7fb]">
                    <td className="px-4 py-3 text-sm font-semibold text-[#253d3e]">{school.name}</td>
                    <td className="px-4 py-3 text-sm text-[#667475]">{school.provinceName}</td>
                    <td className="px-4 py-3 text-sm text-[#667475]">{school.districtName}</td>
                    <td className="px-4 py-3">
                      <Badge tone={SCHOOL_TYPE_TONES[school.type] || 'neutral'}>
                        {SCHOOL_TYPE_LABELS[school.type] || school.type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(school)}
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${
                          school.isActive ? 'bg-[#e5f3ea] text-[#34845a]' : 'bg-[#f1f1f3] text-[#8a8a92]'
                        }`}
                      >
                        {school.isActive ? 'Aktif' : 'Pasif'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end">
                        <ActionsMenu
                          isOpen={openMenuSchoolId === school.id}
                          onToggle={() =>
                            setOpenMenuSchoolId((current) => (current === school.id ? null : school.id))
                          }
                          onClose={() => setOpenMenuSchoolId(null)}
                          triggerLabel="Okul işlemleri"
                          items={schoolMenuItems({ school, ...menuContext })}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTable>
        </div>
      )}

      {showSchoolModal ? <SchoolModal onSaved={handleSchoolSaved} onClose={() => setShowSchoolModal(false)} /> : null}
      {editingSchool ? (
        <SchoolModal school={editingSchool} onSaved={handleSchoolSaved} onClose={() => setEditingSchool(null)} />
      ) : null}
      {showBulkImport ? (
        <BulkImportSchoolsModal onImported={loadSchools} onClose={() => setShowBulkImport(false)} />
      ) : null}
      {scheduleModalSchool ? (
        <SchoolClassScheduleModal school={scheduleModalSchool} onClose={() => setScheduleModalSchool(null)} />
      ) : null}
    </div>
  )
}
