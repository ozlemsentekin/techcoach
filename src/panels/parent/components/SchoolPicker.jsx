import { useEffect, useState } from 'react'
import { Search, School, X } from 'lucide-react'
import { authRequest } from '../../../services/authClient'
import Badge from '../../ui/Badge'
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
    if (!districtId || school) {
      return undefined
    }

    let ignore = false
    const timer = setTimeout(() => {
      const search = query.trim()
      authRequest(
        `/api/panel/geo/schools?districtId=${districtId}${search ? `&search=${encodeURIComponent(search)}` : ''}`,
        { method: 'GET' },
      )
        .then((data) => {
          if (!ignore) setSchools(data.schools)
        })
        .catch((err) => {
          if (!ignore) setError(err.message)
        })
    }, 250)

    return () => {
      ignore = true
      clearTimeout(timer)
    }
  }, [districtId, query, school])

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

        {school ? (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-panel-border bg-[#fbfaff] p-2.5">
            <span className="flex min-w-0 items-center gap-2">
              <School size={16} className="shrink-0 text-[#655e94]" aria-hidden="true" />
              <span className="truncate text-sm font-medium text-panel-text">{school.name}</span>
              {school.type ? (
                <Badge tone={SCHOOL_TYPE_TONES[school.type] || 'neutral'}>
                  {SCHOOL_TYPE_LABELS[school.type] || school.type}
                </Badge>
              ) : null}
            </span>
            <button
              type="button"
              aria-label="Okul seçimini kaldır"
              onClick={() => onSchoolChange(null)}
              className="shrink-0 text-panel-text-muted hover:text-panel-warm"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        ) : !districtId ? (
          <p className="rounded-xl border border-dashed border-panel-border p-2.5 text-sm text-panel-text-muted">
            Okul aramak için önce il ve ilçe seçin.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#87a3a5]"
                aria-hidden="true"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Okul adı ara..."
                className="w-full rounded-xl border border-[#dfe4e5] bg-white py-2 pl-9 pr-3 text-sm text-[#253d3e] focus:outline-none focus:ring-2 focus:ring-[#655e94]/20"
              />
            </div>

            {error ? <p className="text-xs text-panel-warm">{error}</p> : null}

            <div className="max-h-52 overflow-y-auto rounded-xl border border-panel-border">
              {schools === null ? (
                <p className="p-3 text-sm text-panel-text-muted">Okullar yükleniyor...</p>
              ) : schools.length === 0 ? (
                <p className="p-3 text-sm text-panel-text-muted">Bu ilçede henüz okul eklenmemiş.</p>
              ) : (
                schools.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSchoolChange(item)}
                    className="flex w-full items-center justify-between gap-2 border-b border-panel-border/60 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-[#f8f7fb]"
                  >
                    <span className="truncate text-panel-text">{item.name}</span>
                    <Badge tone={SCHOOL_TYPE_TONES[item.type] || 'neutral'}>
                      {SCHOOL_TYPE_LABELS[item.type] || item.type}
                    </Badge>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
