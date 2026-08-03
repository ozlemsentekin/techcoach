import { useEffect, useState } from 'react'
import { BookOpen, CalendarDays, Clock, GraduationCap, Phone, Plus, Trash2, X } from 'lucide-react'
import { authRequest } from '../../../services/authClient'
import LoadingState from '../../shared/LoadingState'
import Button from '../../ui/Button'
import TeacherResourceBooksModal from './TeacherResourceBooksModal'

const TEACHER_TYPE_OPTIONS = [
  { value: 'okul_ogretmeni', label: 'Okul Öğretmeni' },
  { value: 'ozel_ogretmen', label: 'Özel Öğretmen' },
]

const WEEKDAY_OPTIONS = [
  { value: 'pazartesi', label: 'Pazartesi' },
  { value: 'sali', label: 'Salı' },
  { value: 'carsamba', label: 'Çarşamba' },
  { value: 'persembe', label: 'Perşembe' },
  { value: 'cuma', label: 'Cuma' },
  { value: 'cumartesi', label: 'Cumartesi' },
  { value: 'pazar', label: 'Pazar' },
]

const DEFAULT_SCHEDULE_ROW = {
  dayOfWeek: 'pazartesi',
  startTime: '17:00',
  endTime: '18:30',
}

const INITIAL_FORM = {
  subjectId: '',
  fullName: '',
  phone: '',
  type: 'okul_ogretmeni',
  schedule: [],
}

function scheduleLabel(row) {
  const day = WEEKDAY_OPTIONS.find((option) => option.value === row.dayOfWeek)?.label || row.dayOfWeek
  return `Her ${day} ${row.startTime} - ${row.endTime}`
}

function TeacherCard({ teacher, onEditResources }) {
  const isPrivateTeacher = teacher.type === 'ozel_ogretmen'

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-[#e5e8e9] bg-white p-4 shadow-[0_2px_10px_rgba(20,25,40,0.04)]">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f5f2fb] text-[#655e94]">
          <GraduationCap size={22} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-bold text-[#253d3e]">{teacher.fullName}</h3>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-[#667475]">
            <BookOpen size={14} aria-hidden="true" />
            <span className="truncate">{teacher.subjectName || 'Ders seçilmedi'}</span>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-[#eef3f3] px-2.5 py-1 text-[11px] font-semibold text-[#5f7f81]">
          {teacher.typeLabel}
        </span>
        <a
          href={`tel:${teacher.phone.replace(/\s/g, '')}`}
          className="inline-flex items-center gap-1 rounded-full bg-[#f3f5f5] px-2.5 py-1 text-[11px] font-semibold text-[#667475]"
        >
          <Phone size={12} aria-hidden="true" />
          {teacher.phone}
        </a>
      </div>

      {isPrivateTeacher && teacher.schedule?.length ? (
        <div className="flex flex-col gap-2 border-t border-[#edf0f1] pt-3">
          {teacher.schedule.map((row, index) => (
            <span
              key={`${row.dayOfWeek}-${row.startTime}-${row.endTime}-${index}`}
              className="inline-flex items-center gap-2 rounded-lg bg-[#fbf0dd] px-3 py-2 text-xs font-semibold text-[#8f6a3c]"
            >
              <Clock size={14} aria-hidden="true" />
              {scheduleLabel(row)}
            </span>
          ))}
        </div>
      ) : null}

      <Button type="button" variant="secondary" size="sm" className="mt-auto w-full" onClick={() => onEditResources(teacher)}>
        <BookOpen size={14} aria-hidden="true" />
        Kaynakları Düzenle
      </Button>
    </article>
  )
}

export default function StudentTeacherModal({ student, onSaved, onClose }) {
  const [teachers, setTeachers] = useState(null)
  const [subjects, setSubjects] = useState(null)
  const [form, setForm] = useState(INITIAL_FORM)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [resourceModalTeacher, setResourceModalTeacher] = useState(null)

  useEffect(() => {
    let ignore = false

    Promise.all([
      authRequest(`/api/parent/students/${student.id}/teachers`, { method: 'GET' }),
      authRequest('/api/panel/subjects', { method: 'GET' }),
    ])
      .then(([teachersData, subjectsData]) => {
        if (ignore) return
        setTeachers(teachersData.teachers)
        setSubjects(subjectsData.subjects)
        setForm((current) => ({
          ...current,
          subjectId: current.subjectId || subjectsData.subjects?.[0]?.id || '',
        }))
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })

    return () => {
      ignore = true
    }
  }, [student.id])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleTypeChange = (type) => {
    setForm((current) => ({
      ...current,
      type,
      schedule:
        type === 'ozel_ogretmen' && current.schedule.length === 0
          ? [{ ...DEFAULT_SCHEDULE_ROW }]
          : current.schedule,
    }))
  }

  const handleScheduleChange = (index, field, value) => {
    setForm((current) => ({
      ...current,
      schedule: current.schedule.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)),
    }))
  }

  const addScheduleRow = () => {
    setForm((current) => ({
      ...current,
      schedule: [...current.schedule, { ...DEFAULT_SCHEDULE_ROW }],
    }))
  }

  const removeScheduleRow = (index) => {
    setForm((current) => ({
      ...current,
      schedule: current.schedule.filter((_, rowIndex) => rowIndex !== index),
    }))
  }

  const validateForm = () => {
    if (!form.subjectId) return 'Ders seçin.'
    if (form.fullName.trim().length < 3) return 'Öğretmen ad soyadı en az 3 karakter olmalı.'
    if (form.phone.trim().length < 7) return 'Telefon bilgisi en az 7 karakter olmalı.'

    if (form.type === 'ozel_ogretmen') {
      const invalidSchedule = form.schedule.some((row) => !row.dayOfWeek || !row.startTime || !row.endTime || row.startTime >= row.endTime)
      if (invalidSchedule) return 'Ders günü ve saat aralığı geçerli olmalı.'
    }

    return ''
  }

  const resetForm = () => {
    setForm({
      ...INITIAL_FORM,
      subjectId: subjects?.[0]?.id || '',
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setError('')
    setSaving(true)
    try {
      const data = await authRequest(`/api/parent/students/${student.id}/teachers`, {
        method: 'POST',
        body: JSON.stringify({
          subjectId: form.subjectId,
          fullName: form.fullName,
          phone: form.phone,
          type: form.type,
          schedule: form.type === 'ozel_ogretmen' ? form.schedule : [],
        }),
      })
      setTeachers(data.teachers)
      onSaved(student.id, data.teacherCount)
      resetForm()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleTeacherResourcesSaved = (teacherId, resourceBooks, resourceCount) => {
    setTeachers((current) =>
      (current || []).map((teacher) =>
        teacher.id === teacherId
          ? { ...teacher, resourceBooks: resourceBooks.filter((book) => book.assigned), resourceCount }
          : teacher,
      ),
    )
    setResourceModalTeacher(null)
  }

  const isLoading = teachers === null || subjects === null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="flex max-h-[90vh] w-full max-w-6xl flex-col rounded-2xl bg-white shadow-panel-2">
        <div className="flex items-start justify-between gap-4 border-b border-[#edf0f1] px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-panel-text">Öğretmen Ekle</h2>
            <p className="text-sm text-panel-text-muted">{student.fullName}</p>
          </div>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error ? (
            <div className="mb-4 rounded-xl bg-panel-accent-soft px-4 py-3 text-sm text-panel-warm">{error}</div>
          ) : null}

          {isLoading ? (
            <LoadingState label="Öğretmen bilgileri yükleniyor..." />
          ) : (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_420px]">
              <section className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-bold uppercase text-[#667475]">Kayıtlı Öğretmenler</h3>
                  <span className="rounded-full bg-[#f5f2fb] px-3 py-1 text-xs font-semibold text-[#655e94]">
                    {teachers.length} öğretmen
                  </span>
                </div>

                {teachers.length === 0 ? (
                  <div className="flex min-h-[180px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[#dfe4e5] bg-[#fbfcfc] px-5 py-8 text-center">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f5f2fb] text-[#655e94]">
                      <GraduationCap size={22} aria-hidden="true" />
                    </span>
                    <div>
                      <h4 className="text-base font-semibold text-panel-text">Henüz öğretmen eklenmedi</h4>
                      <p className="mt-1 text-sm text-panel-text-muted">İlk öğretmeni sağdaki formdan ekleyebilirsiniz.</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                    {teachers.map((teacher) => (
                      <TeacherCard key={teacher.id} teacher={teacher} onEditResources={setResourceModalTeacher} />
                    ))}
                  </div>
                )}
              </section>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-xl border border-[#e5e8e9] bg-[#fbfcfc] p-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-panel-text-muted">Ders</span>
                  <select
                    name="subjectId"
                    value={form.subjectId}
                    onChange={handleChange}
                    className="rounded-xl border border-panel-border bg-white p-2.5 text-base text-panel-text"
                    disabled={!subjects.length}
                  >
                    {subjects.length ? null : <option value="">Ders yok</option>}
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-panel-text-muted">Öğretmen Ad Soyad</span>
                  <input
                    name="fullName"
                    value={form.fullName}
                    onChange={handleChange}
                    className="rounded-xl border border-panel-border bg-white p-2.5 text-base text-panel-text"
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-panel-text-muted">Telefon</span>
                  <input
                    name="phone"
                    type="tel"
                    value={form.phone}
                    onChange={handleChange}
                    className="rounded-xl border border-panel-border bg-white p-2.5 text-base text-panel-text"
                  />
                </label>

                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-panel-text-muted">Öğretmen Tipi</span>
                  <div className="grid grid-cols-2 gap-2">
                    {TEACHER_TYPE_OPTIONS.map((option) => {
                      const selected = form.type === option.value
                      return (
                        <button
                          key={option.value}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => handleTypeChange(option.value)}
                          className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                            selected
                              ? 'border-[#655e94] bg-[#f5f2fb] text-[#655e94]'
                              : 'border-panel-border bg-white text-panel-text-muted hover:bg-panel-surface-soft'
                          }`}
                        >
                          {option.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {form.type === 'ozel_ogretmen' ? (
                  <div className="flex flex-col gap-3 rounded-xl border border-[#e9edf0] bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-sm font-semibold text-panel-text">
                        <CalendarDays size={16} aria-hidden="true" />
                        Ders Programı
                      </span>
                      <Button type="button" variant="secondary" size="sm" onClick={addScheduleRow}>
                        <Plus size={14} aria-hidden="true" />
                        Saat Ekle
                      </Button>
                    </div>

                    {form.schedule.length === 0 ? (
                      <p className="rounded-lg bg-[#f8f7fb] px-3 py-2 text-sm text-panel-text-muted">Program tanımlanmadı.</p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {form.schedule.map((row, index) => (
                          <div key={index} className="grid grid-cols-1 gap-2 sm:grid-cols-[1.2fr_1fr_1fr_auto]">
                            <label className="flex flex-col gap-1">
                              <span className="text-xs font-medium text-panel-text-muted">Gün</span>
                              <select
                                value={row.dayOfWeek}
                                onChange={(event) => handleScheduleChange(index, 'dayOfWeek', event.target.value)}
                                className="h-10 rounded-lg border border-panel-border bg-white px-2 text-sm text-panel-text"
                              >
                                {WEEKDAY_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label className="flex flex-col gap-1">
                              <span className="text-xs font-medium text-panel-text-muted">Başlangıç</span>
                              <input
                                type="time"
                                value={row.startTime}
                                onChange={(event) => handleScheduleChange(index, 'startTime', event.target.value)}
                                className="h-10 rounded-lg border border-panel-border bg-white px-2 text-sm text-panel-text"
                              />
                            </label>

                            <label className="flex flex-col gap-1">
                              <span className="text-xs font-medium text-panel-text-muted">Bitiş</span>
                              <input
                                type="time"
                                value={row.endTime}
                                onChange={(event) => handleScheduleChange(index, 'endTime', event.target.value)}
                                className="h-10 rounded-lg border border-panel-border bg-white px-2 text-sm text-panel-text"
                              />
                            </label>

                            <button
                              type="button"
                              aria-label="Ders saatini sil"
                              onClick={() => removeScheduleRow(index)}
                              className="flex h-10 items-center justify-center self-end rounded-lg border border-panel-border bg-white text-panel-text-muted hover:bg-panel-red-soft hover:text-panel-red"
                            >
                              <Trash2 size={15} aria-hidden="true" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}

                <Button type="submit" disabled={saving || !subjects.length} className="mt-1 w-full">
                  {saving ? 'Kaydediliyor...' : 'Öğretmeni Kaydet'}
                </Button>
              </form>
            </div>
          )}
        </div>
      </div>
      {resourceModalTeacher ? (
        <TeacherResourceBooksModal
          student={student}
          teacher={resourceModalTeacher}
          onSaved={handleTeacherResourcesSaved}
          onClose={() => setResourceModalTeacher(null)}
        />
      ) : null}
    </div>
  )
}
