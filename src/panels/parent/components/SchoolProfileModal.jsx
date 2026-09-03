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

// Sınıf seçici 8 → 1 sıralı; varsayılan seçili sınıf 8.
const GRADES_DESC = [...GRADE_OPTIONS].reverse()
const DEFAULT_GRADE = GRADES_DESC[0]

const TABS = [
  { id: 'schedule', label: 'Ders Saatleri' },
  { id: 'calendar', label: 'Tatil Takvimi' },
  { id: 'resources', label: 'Kaynaklar' },
]

function GradePills({ grade, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {GRADES_DESC.map((option) => (
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
  const [grade, setGrade] = useState(DEFAULT_GRADE)
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
      className="flex flex-col gap-3"
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
      <div className="flex justify-end gap-2 pt-1">
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

// Kaynak ekle/düzenle formunu, kaynak listesinin uzunluğundan bağımsız olarak butonları
// (görsel yükle / kaydet) her zaman tam görünür kılmak için ayrı bir merkezî dialog'da açar.
function ResourceFormDialog({ title, initial, onSubmit, onCancel, saving }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-lg sm:max-w-md sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-[#edf0f1] px-4 py-3">
          <h3 className="text-base font-semibold text-panel-text">{title}</h3>
          <button type="button" aria-label="Kapat" onClick={onCancel} className="shrink-0">
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <ResourceForm initial={initial} onSubmit={onSubmit} onCancel={onCancel} saving={saving} />
        </div>
      </div>
    </div>
  )
}

// Küçük "ad gir" dialog'u (yeni ders eklemek için).
function NameDialog({ title, label, placeholder, saving, onSubmit, onCancel }) {
  const [value, setValue] = useState('')
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit(value.trim())
        }}
        className="w-full rounded-t-2xl bg-white p-4 shadow-lg sm:max-w-sm sm:rounded-2xl sm:p-5"
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-panel-text">{title}</h3>
          <button type="button" aria-label="Kapat" onClick={onCancel} className="shrink-0">
            <X size={18} />
          </button>
        </div>
        <label className="flex flex-col gap-1 text-xs font-medium text-panel-text-muted">
          {label}
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="rounded-lg border border-panel-border bg-white p-2 text-sm text-panel-text"
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={onCancel} disabled={saving}>
            Vazgeç
          </Button>
          <Button type="submit" size="sm" disabled={saving || value.trim().length < 2}>
            {saving ? 'Ekleniyor...' : 'Ekle'}
          </Button>
        </div>
      </form>
    </div>
  )
}

function ResourcesTab({ schoolId }) {
  const [grade, setGrade] = useState(DEFAULT_GRADE)
  const [subjects, setSubjects] = useState(null)
  const [subjectId, setSubjectId] = useState('')
  const [resources, setResources] = useState(null)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [subjectDialogOpen, setSubjectDialogOpen] = useState(false)
  const [subjectSaving, setSubjectSaving] = useState(false)

  useEffect(() => {
    authRequest('/api/panel-admin/subjects', { method: 'GET' })
      .then((data) => setSubjects((data.subjects || []).filter((s) => s.isActive !== false)))
      .catch((err) => setError(err.message))
  }, [])

  const handleCreateSubject = async (name) => {
    setSubjectSaving(true)
    setError('')
    try {
      const data = await authRequest('/api/panel-admin/subjects', {
        method: 'POST',
        body: JSON.stringify({ name }),
      })
      const created = data.subject
      setSubjects((current) => {
        const rest = (current || []).filter((s) => s.id !== created.id)
        return [...rest, created].sort((a, b) => a.name.localeCompare(b.name, 'tr'))
      })
      setSubjectId(created.id)
      setAdding(false)
      setEditingId(null)
      setSubjectDialogOpen(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubjectSaving(false)
    }
  }

  const canLoad = Boolean(grade && subjectId)
  const editingResource = editingId ? (resources || []).find((r) => r.id === editingId) || null : null

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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex w-full items-center gap-2 sm:flex-1">
          <select
            aria-label="Ders"
            value={subjectId}
            onChange={(e) => {
              setSubjectId(e.target.value)
              setAdding(false)
              setEditingId(null)
            }}
            className="w-full rounded-xl border border-panel-border bg-white p-2.5 text-sm text-panel-text"
          >
            <option value="">Ders seçin</option>
            {(subjects || []).map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="md"
            variant="secondary"
            onClick={() => setSubjectDialogOpen(true)}
            className="shrink-0"
          >
            <Plus size={15} className="mr-1 inline" aria-hidden="true" />
            Ders
          </Button>
        </div>
        {canLoad ? (
          <Button type="button" size="md" onClick={() => setAdding(true)} className="shrink-0 sm:self-auto">
            <Plus size={15} className="mr-1.5 inline" aria-hidden="true" />
            Kaynak Ekle
          </Button>
        ) : null}
      </div>

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
              {[...resources]
                .sort((a, b) => a.name.localeCompare(b.name, 'tr', { numeric: true }))
                .map((resource) => (
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
                ))}
            </ul>
          )}
        </div>
      )}

      {adding ? (
        <ResourceFormDialog
          title="Kaynak Ekle"
          saving={saving}
          onSubmit={handleCreate}
          onCancel={() => setAdding(false)}
        />
      ) : null}

      {editingResource ? (
        <ResourceFormDialog
          key={editingResource.id}
          title="Kaynağı Düzenle"
          initial={editingResource}
          saving={saving}
          onSubmit={(payload) => handleUpdate(editingResource.id, payload)}
          onCancel={() => setEditingId(null)}
        />
      ) : null}

      {deleteTarget ? (
        <ConfirmationDialog
          title="Kaynak silinsin mi?"
          description={deleteTarget.name}
          confirmLabel="Sil"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      ) : null}

      {subjectDialogOpen ? (
        <NameDialog
          title="Yeni Ders Ekle"
          label="Ders adı"
          placeholder="Örn. Geometri"
          saving={subjectSaving}
          onSubmit={(name) => handleCreateSubject(name)}
          onCancel={() => setSubjectDialogOpen(false)}
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
      <div className="flex h-full w-full flex-col bg-white shadow-panel-2 sm:h-[88vh] sm:w-full sm:max-w-4xl sm:rounded-2xl">
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
      </div>
    </div>
  )
}
