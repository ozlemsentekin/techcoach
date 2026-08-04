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
import { MotionDiv } from '../../ui/motion'
import ProvinceDistrictSelect from '../components/ProvinceDistrictSelect'

const SCHOOL_TYPE_LABELS = { devlet: 'Devlet', ozel: 'Özel' }
const SCHOOL_TYPE_TONES = { devlet: 'sage', ozel: 'accent' }

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md panel-card p-5">
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
                      ? 'border-[#655e94] bg-[#f5f2fb] text-[#655e94]'
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-lg panel-card p-5">
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
                className="w-48 rounded-lg border border-[#dfe4e5] bg-white py-1.5 pl-8 pr-3 text-sm text-[#253d3e] focus:outline-none focus:ring-2 focus:ring-[#655e94]/20 sm:w-56"
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
              className="h-10 rounded-[10px] bg-[#655e94] px-4 text-sm font-medium text-white hover:opacity-90"
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
        <MotionDiv initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <DataTable>
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="bg-[#f8f7fb] text-[13px] font-semibold text-[#655e94]">
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
                          items={[
                            { label: 'Düzenle', onClick: () => setEditingSchool(school) },
                            {
                              label: school.isActive ? 'Pasif Yap' : 'Aktif Yap',
                              onClick: () => handleToggleActive(school),
                            },
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

      {showSchoolModal ? <SchoolModal onSaved={handleSchoolSaved} onClose={() => setShowSchoolModal(false)} /> : null}
      {editingSchool ? (
        <SchoolModal school={editingSchool} onSaved={handleSchoolSaved} onClose={() => setEditingSchool(null)} />
      ) : null}
      {showBulkImport ? (
        <BulkImportSchoolsModal onImported={loadSchools} onClose={() => setShowBulkImport(false)} />
      ) : null}
    </div>
  )
}
