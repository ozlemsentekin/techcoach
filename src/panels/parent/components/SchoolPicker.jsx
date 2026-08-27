import { useEffect, useState } from 'react'
import { School } from 'lucide-react'
import { authRequest } from '../../../services/authClient'
import Badge from '../../ui/Badge'
import Combobox from '../../ui/Combobox'
import ProvinceDistrictSelect from './ProvinceDistrictSelect'

const SCHOOL_TYPE_LABELS = {
  devlet: 'Devlet',
  ozel: 'Özel',
}

const SCHOOL_TYPE_TONES = {
  devlet: 'sage',
  ozel: 'accent',
}

export default function SchoolPicker({
  provinceId,
  districtId,
  school,
  onProvinceChange,
  onDistrictChange,
  onSchoolChange,
}) {
  const [query, setQuery] = useState('')
  const [schools, setSchools] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!districtId) return undefined

    let ignore = false
    const timer = setTimeout(() => {
      const search = query.trim()
      authRequest(
        `/api/panel/geo/schools?districtId=${districtId}${search ? `&search=${encodeURIComponent(search)}` : ''}`,
        { method: 'GET' },
      )
        .then((data) => {
          if (!ignore) setSchools({ districtId, items: data.schools })
        })
        .catch((err) => {
          if (!ignore) setError(err.message)
        })
    }, 250)

    return () => {
      ignore = true
      clearTimeout(timer)
    }
  }, [districtId, query])

  // İlçe değişince eski ilçenin okullarını gösterme.
  const schoolItems = schools && schools.districtId === districtId ? schools.items : null

  const handleDistrictChange = (nextDistrictId) => {
    onSchoolChange(null)
    setQuery('')
    onDistrictChange(nextDistrictId)
  }

  return (
    <div className="flex flex-col gap-3">
      <ProvinceDistrictSelect
        provinceId={provinceId}
        districtId={districtId}
        onProvinceChange={(nextProvinceId) => {
          onSchoolChange(null)
          setQuery('')
          onDistrictChange(null)
          onProvinceChange(nextProvinceId)
        }}
        onDistrictChange={handleDistrictChange}
      />

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-panel-text-muted">Okul</span>
        <Combobox
          value={school?.id || ''}
          selectedOption={school}
          onChange={(_value, option) => onSchoolChange(option || null)}
          options={schoolItems || []}
          disabled={!districtId}
          loading={Boolean(districtId) && schoolItems === null}
          filter={false}
          onSearchChange={setQuery}
          clearable
          icon={School}
          placeholder={districtId ? 'Okul ara ve seç' : 'Önce il ve ilçe seçin'}
          searchPlaceholder="Okul adı ara..."
          emptyLabel="Bu ilçede okul bulunamadı"
          renderOption={(item) => (
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate text-panel-text">{item.name}</span>
              <Badge tone={SCHOOL_TYPE_TONES[item.type] || 'neutral'}>
                {SCHOOL_TYPE_LABELS[item.type] || item.type}
              </Badge>
            </span>
          )}
        />
        {error ? <p className="text-xs text-panel-warm">{error}</p> : null}
      </div>
    </div>
  )
}
