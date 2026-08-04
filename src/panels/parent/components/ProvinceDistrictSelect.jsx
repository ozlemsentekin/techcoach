import { useEffect, useState } from 'react'
import { authRequest } from '../../../services/authClient'

export default function ProvinceDistrictSelect({ provinceId, districtId, onProvinceChange, onDistrictChange }) {
  const [provinces, setProvinces] = useState(null)
  const [districts, setDistricts] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false

    authRequest('/api/panel/geo/provinces', { method: 'GET' })
      .then((data) => {
        if (!ignore) setProvinces(data.provinces)
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })

    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    if (!provinceId) {
      return undefined
    }

    let ignore = false

    authRequest(`/api/panel/geo/districts?provinceId=${provinceId}`, { method: 'GET' })
      .then((data) => {
        if (!ignore) setDistricts(data.districts)
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })

    return () => {
      ignore = true
    }
  }, [provinceId])

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <label className="flex flex-1 flex-col gap-1.5">
        <span className="text-sm font-medium text-panel-text-muted">İl</span>
        <select
          value={provinceId || ''}
          onChange={(event) => {
            const value = event.target.value || null
            onProvinceChange(value)
            onDistrictChange(null)
          }}
          className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
        >
          <option value="">İl seçin</option>
          {(provinces || []).map((province) => (
            <option key={province.id} value={province.id}>
              {province.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-1 flex-col gap-1.5">
        <span className="text-sm font-medium text-panel-text-muted">İlçe</span>
        <select
          value={districtId || ''}
          onChange={(event) => onDistrictChange(event.target.value || null)}
          disabled={!provinceId}
          className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text disabled:cursor-not-allowed disabled:bg-[#f5f6f7] disabled:text-panel-text-muted"
        >
          <option value="">{provinceId ? 'İlçe seçin' : 'Önce il seçin'}</option>
          {(districts || []).map((district) => (
            <option key={district.id} value={district.id}>
              {district.name}
            </option>
          ))}
        </select>
      </label>

      {error ? <p className="text-xs text-panel-warm">{error}</p> : null}
    </div>
  )
}
