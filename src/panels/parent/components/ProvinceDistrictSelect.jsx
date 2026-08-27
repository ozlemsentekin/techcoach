import { useEffect, useState } from 'react'
import { MapPin } from 'lucide-react'
import { authRequest } from '../../../services/authClient'
import Combobox from '../../ui/Combobox'

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
    if (!provinceId) return undefined

    let ignore = false

    authRequest(`/api/panel/geo/districts?provinceId=${provinceId}`, { method: 'GET' })
      .then((data) => {
        if (!ignore) setDistricts({ provinceId, items: data.districts })
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })

    return () => {
      ignore = true
    }
  }, [provinceId])

  // Yeni il seçildiğinde eski ilin ilçelerini gösterme (yeni liste yüklenene kadar boş).
  const districtItems = districts && districts.provinceId === provinceId ? districts.items : null

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="flex flex-1 flex-col gap-1.5">
        <span className="text-sm font-medium text-panel-text-muted">İl</span>
        <Combobox
          value={provinceId || ''}
          onChange={(value) => {
            onProvinceChange(value || null)
            onDistrictChange(null)
          }}
          options={provinces || []}
          loading={provinces === null}
          icon={MapPin}
          placeholder="İl seçin"
          searchPlaceholder="İl ara..."
          emptyLabel="İl bulunamadı"
        />
      </div>

      <div className="flex flex-1 flex-col gap-1.5">
        <span className="text-sm font-medium text-panel-text-muted">İlçe</span>
        <Combobox
          value={districtId || ''}
          onChange={(value) => onDistrictChange(value || null)}
          options={districtItems || []}
          disabled={!provinceId}
          loading={Boolean(provinceId) && districtItems === null}
          icon={MapPin}
          placeholder={provinceId ? 'İlçe seçin' : 'Önce il seçin'}
          searchPlaceholder="İlçe ara..."
          emptyLabel="İlçe bulunamadı"
        />
      </div>

      {error ? <p className="text-xs text-panel-warm">{error}</p> : null}
    </div>
  )
}
