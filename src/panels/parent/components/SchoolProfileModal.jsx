import { useEffect, useMemo, useState } from 'react'
import { CalendarOff, Layers, Pencil, Plus, Trash2, X } from 'lucide-react'
import { authRequest } from '../../../services/authClient'
import LoadingState from '../../shared/LoadingState'
import ConfirmationDialog from '../../shared/ConfirmationDialog'
import Button from '../../ui/Button'
import Badge from '../../ui/Badge'
import SchoolScheduleEditor from './SchoolScheduleEditor'
import ResourceImageField from './ResourceImageField'
import { GRADE_OPTIONS } from './studentWizardConstants'

const SCHOOL_TYPE_LABELS = { devlet: 'Devlet', ozel: 'Özel' }

const TABS = [
  { id: 'schedule', label: 'Ders Saatleri' },
  { id: 'calendar', label: 'Tatil Takvimi' },
  { id: 'resources', label: 'Kaynaklar' },
]

function GradePills({ grade, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {GRADE_OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={grade === option}
          onClick={() => onChange(option)}
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
  )
}

function ScheduleTab({ schoolId }) {
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
    setBanner('')
    authRequest(`/api/panel-admin/schools/${schoolId}/class-schedules?grade=${grade}`, { method: 'GET' })
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
  }, [schoolId, grade])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setBanner('')
    try {
      const data = await authRequest(`/api/panel-admin/schools/${schoolId}/class-schedules`, {
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
    <div className="flex flex-col gap-3">
      <p className="text-sm text-panel-text-muted">
        Bu okulda ve sınıfta okuyan öğrencilerin haftalık planında okul saatleri bu şablondan gösterilir.
      </p>
      <GradePills grade={grade} onChange={setGrade} />
      {error ? <div className="rounded-xl bg-panel-accent-soft px-3 py-1.5 text-sm text-panel-warm">{error}</div> : null}
      {banner ? <div className="rounded-xl bg-panel-sage-soft px-3 py-1.5 text-sm text-panel-text">{banner}</div> : null}
      {loading ? (
        <LoadingState label="Ders programı yükleniyor..." />
      ) : (
        <>
          <SchoolScheduleEditor entries={entries} onChange={setEntries} />
          <div className="flex justify-end">
            <Button type="button" size="md" onClick={handleSave} disabled={saving}>
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

function formatDateRange(startDate, endDate) {
  if (!endDate || startDate === endDate) return startDate
  return `${startDate} – ${endDate}`
}

function CalendarTab({ schoolId }) {
  const [entries, setEntries] = useState(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ startDate: '', endDate: '', name: '' })
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  useEffect(() => {
    let ignore = false
    authRequest(`/api/panel-admin/schools/${schoolId}/calendar`, { method: 'GET' })
      .then((data) => {
        if (!ignore) setEntries(data.entries)
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })
    return () => {
      ignore = true
    }
  }, [schoolId])

  const handleAdd = async (event) => {
    event.preventDefault()
    if (!form.startDate) {
      setError('Başlangıç tarihi seçin.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const data = await authRequest(`/api/panel-admin/schools/${schoolId}/calendar`, {
        method: 'POST',
        body: JSON.stringify({
          startDate: form.startDate,
          endDate: form.endDate || form.startDate,
          name: form.name.trim() || null,
        }),
      })
      setEntries((current) => [...(current || []), data.entry].sort((a, b) => a.startDate.localeCompare(b.startDate)))
      setForm({ startDate: '', endDate: '', name: '' })
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    const target = deleteTarget
    setDeleteTarget(null)
    try {
      await authRequest(`/api/panel-admin/schools/${schoolId}/calendar/${target.id}`, { method: 'DELETE' })
      setEntries((current) => (current || []).filter((entry) => entry.id !== target.id))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-panel-text-muted">
        Resmi tatil / okulun kapalı olduğu günler. Bu günlerde öğrencilerin haftalık planında okul saatleri gösterilmez.
      </p>
      {error ? <div className="rounded-xl bg-panel-accent-soft px-3 py-1.5 text-sm text-panel-warm">{error}</div> : null}

      <form onSubmit={handleAdd} className="grid gap-2 rounded-xl border border-panel-border bg-[#f8f7fb] p-3 sm:grid-cols-[1fr_1fr_1.5fr_auto] sm:items-end">
        <label className="flex flex-col gap-1 text-xs font-medium text-panel-text-muted">
          Başlangıç
          <input
            type="date"
            value={form.startDate}
            onChange={(e) => setForm((c) => ({ ...c, startDate: e.target.value }))}
            className="rounded-lg border border-panel-border bg-white p-2 text-sm text-panel-text"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-panel-text-muted">
          Bitiş (ops.)
          <input
            type="date"
            value={form.endDate}
            min={form.startDate || undefined}
            onChange={(e) => setForm((c) => ({ ...c, endDate: e.target.value }))}
            className="rounded-lg border border-panel-border bg-white p-2 text-sm text-panel-text"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-panel-text-muted">
          Ad (ops.)
          <input
            type="text"
            value={form.name}
            placeholder="Örn. 29 Ekim Cumhuriyet Bayramı"
            onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
            className="rounded-lg border border-panel-border bg-white p-2 text-sm text-panel-text"
          />
        </label>
        <Button type="submit" size="sm" disabled={saving} className="h-9">
          <Plus size={14} className="mr-1 inline" aria-hidden="true" />
          Ekle
        </Button>
      </form>

      {entries === null ? (
        <LoadingState label="Takvim yükleniyor..." />
      ) : entries.length === 0 ? (
        <p className="rounded-xl bg-white px-3 py-6 text-center text-sm text-panel-text-muted">Henüz tatil eklenmedi.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-panel-border bg-white px-3 py-2.5"
            >
              <span className="flex min-w-0 items-center gap-2 text-sm">
                <CalendarOff size={15} className="shrink-0 text-panel-text-muted" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block font-semibold text-panel-text">{formatDateRange(entry.startDate, entry.endDate)}</span>
                  {entry.name ? <span className="block text-xs text-panel-text-muted">{entry.name}</span> : null}
                </span>
              </span>
              <button
                type="button"
                aria-label="Sil"
                onClick={() => setDeleteTarget(entry)}
                className="shrink-0 rounded-lg p-1.5 text-panel-warm hover:bg-panel-warm/10"
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {deleteTarget ? (
        <ConfirmationDialog
          title="Tatil kaydı silinsin mi?"
          description={formatDateRange(deleteTarget.startDate, deleteTarget.endDate)}
          confirmLabel="Sil"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      ) : null}
    </div>
  )
}

function ResourceForm({ initial, onSubmit, onCancel, saving }) {
  const [name, setName] = useState(initial?.name || '')
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl || '')

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit({ name: name.trim(), imageUrl: imageUrl || null })
      }}
      className="flex flex-col gap-3 rounded-xl border border-panel-border bg-[#f8f7fb] p-3"
    >
      <label className="flex flex-col gap-1 text-xs font-medium text-panel-text-muted">
        Kaynak adı
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Örn. Matematik Ders Kitabı"
          className="rounded-lg border border-panel-border bg-white p-2 text-sm text-panel-text"
        />
      </label>
      <ResourceImageField value={imageUrl} onChange={setImageUrl} label="Profil görseli (ops.)" fit="cover" />
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={onCancel} disabled={saving}>
          Vazgeç
        </Button>
        <Button type="submit" size="sm" disabled={saving || name.trim().length < 2}>
          {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </Button>
      </div>
    </form>
  )
}

function ResourcesTab({ schoolId }) {
  const [grade, setGrade] = useState(GRADE_OPTIONS[0])
  const [subjects, setSubjects] = useState(null)
  const [subjectId, setSubjectId] = useState('')
  const [resources, setResources] = useState(null)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  useEffect(() => {
    authRequest('/api/panel-admin/subjects', { method: 'GET' })
      .then((data) => setSubjects(data.subjects || []))
      .catch((err) => setError(err.message))
  }, [])

  const canLoad = Boolean(grade && subjectId)

  useEffect(() => {
    if (!canLoad) {
      setResources(null)
      return undefined
    }
    let ignore = false
    setResources(null)
    setError('')
    authRequest(`/api/panel-admin/schools/${schoolId}/resources?grade=${grade}&subjectId=${subjectId}`, { method: 'GET' })
      .then((data) => {
        if (!ignore) setResources(data.resources)
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })
    return () => {
      ignore = true
    }
  }, [schoolId, grade, subjectId, canLoad])

  const handleCreate = async ({ name, imageUrl }) => {
    setSaving(true)
    setError('')
    try {
      const data = await authRequest(`/api/panel-admin/schools/${schoolId}/resources`, {
        method: 'POST',
        body: JSON.stringify({ grade, subjectId, name, imageUrl }),
      })
      setResources((current) => [...(current || []), data.resource])
      setAdding(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async (resourceId, { name, imageUrl }) => {
    setSaving(true)
    setError('')
    try {
      const data = await authRequest(`/api/panel-admin/schools/${schoolId}/resources/${resourceId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name, imageUrl, isActive: true }),
      })
      setResources((current) => (current || []).map((r) => (r.id === resourceId ? data.resource : r)))
      setEditingId(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    const target = deleteTarget
    setDeleteTarget(null)
    try {
      await authRequest(`/api/panel-admin/schools/${schoolId}/resources/${target.id}`, { method: 'DELETE' })
      setResources((current) => (current || []).filter((r) => r.id !== target.id))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-panel-text-muted">
        Bu okul + sınıf + ders için tanımlanan kaynaklar, veli "Okul Ödevi" eklerken resim + ad olarak listelenir.
      </p>
      <GradePills grade={grade} onChange={setGrade} />
      <select
        aria-label="Ders"
        value={subjectId}
        onChange={(e) => {
          setSubjectId(e.target.value)
          setAdding(false)
          setEditingId(null)
        }}
        className="rounded-xl border border-panel-border bg-white p-2.5 text-sm text-panel-text"
      >
        <option value="">Ders seçin</option>
        {(subjects || []).map((subject) => (
          <option key={subject.id} value={subject.id}>
            {subject.name}
          </option>
        ))}
      </select>

      {error ? <div className="rounded-xl bg-panel-accent-soft px-3 py-1.5 text-sm text-panel-warm">{error}</div> : null}

      {!canLoad ? (
        <p className="rounded-xl bg-white px-3 py-6 text-center text-sm text-panel-text-muted">
          Kaynakları görmek için sınıf ve ders seçin.
        </p>
      ) : resources === null ? (
        <LoadingState label="Kaynaklar yükleniyor..." />
      ) : (
        <div className="flex flex-col gap-2">
          {resources.length === 0 ? (
            <p className="rounded-xl bg-white px-3 py-6 text-center text-sm text-panel-text-muted">
              Bu sınıf ve derse tanımlı kaynak yok.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {resources.map((resource) =>
                editingId === resource.id ? (
                  <li key={resource.id}>
                    <ResourceForm
                      initial={resource}
                      saving={saving}
                      onSubmit={(payload) => handleUpdate(resource.id, payload)}
                      onCancel={() => setEditingId(null)}
                    />
                  </li>
                ) : (
                  <li
                    key={resource.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-panel-border bg-white px-3 py-2.5"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      {resource.imageUrl ? (
                        <img
                          src={resource.imageUrl}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-full border border-panel-border object-cover"
                        />
                      ) : (
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-panel-warm-soft text-panel-warm">
                          <Layers size={16} aria-hidden="true" />
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-panel-text">{resource.name}</span>
                        {!resource.isActive ? (
                          <span className="text-xs text-panel-text-muted">Pasif</span>
                        ) : null}
                      </span>
                    </span>
                    <span className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        aria-label="Düzenle"
                        onClick={() => {
                          setEditingId(resource.id)
                          setAdding(false)
                        }}
                        className="rounded-lg p-1.5 text-panel-text-muted hover:bg-[#f8f7fb]"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        aria-label="Sil"
                        onClick={() => setDeleteTarget(resource)}
                        className="rounded-lg p-1.5 text-panel-warm hover:bg-panel-warm/10"
                      >
                        <Trash2 size={15} />
                      </button>
                    </span>
                  </li>
                ),
              )}
            </ul>
          )}

          {adding ? (
            <ResourceForm saving={saving} onSubmit={handleCreate} onCancel={() => setAdding(false)} />
          ) : (
            <Button type="button" size="sm" variant="secondary" onClick={() => setAdding(true)} className="self-start">
              <Plus size={14} className="mr-1 inline" aria-hidden="true" />
              Kaynak Ekle
            </Button>
          )}
        </div>
      )}

      {deleteTarget ? (
        <ConfirmationDialog
          title="Kaynak silinsin mi?"
          description={deleteTarget.name}
          confirmLabel="Sil"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      ) : null}
    </div>
  )
}

export default function SchoolProfileModal({ school, onClose }) {
  const [tab, setTab] = useState('schedule')

  const headerLocation = useMemo(
    () => [school.provinceName, school.districtName].filter(Boolean).join(' / '),
    [school.provinceName, school.districtName],
  )

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <div className="flex h-full w-full flex-col bg-white shadow-panel-2 sm:h-auto sm:max-h-[92vh] sm:max-w-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4 px-4 py-3 sm:px-5 sm:py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-panel-text">{school.name}</h2>
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-panel-text-muted">
              {headerLocation}
              {school.type ? <Badge tone={school.type === 'ozel' ? 'accent' : 'sage'}>{SCHOOL_TYPE_LABELS[school.type] || school.type}</Badge> : null}
              {school.isActive === false ? <Badge tone="neutral">Pasif</Badge> : null}
            </p>
          </div>
          <button type="button" aria-label="Kapat" onClick={onClose} className="shrink-0">
            <X size={20} />
          </button>
        </div>

        <div className="flex gap-1 border-b border-[#edf0f1] px-4 sm:px-5">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              aria-pressed={tab === item.id}
              className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                tab === item.id
                  ? 'border-[#c96a1f] text-[#c96a1f]'
                  : 'border-transparent text-panel-text-muted hover:text-panel-text'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {tab === 'schedule' ? <ScheduleTab schoolId={school.id} /> : null}
          {tab === 'calendar' ? <CalendarTab schoolId={school.id} /> : null}
          {tab === 'resources' ? <ResourcesTab schoolId={school.id} /> : null}
        </div>

        <div className="flex justify-end border-t border-[#edf0f1] px-4 py-3 sm:px-5">
          <Button type="button" variant="secondary" size="md" onClick={onClose}>
            Kapat
          </Button>
        </div>
      </div>
    </div>
  )
}
