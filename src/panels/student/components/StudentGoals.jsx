import { useEffect, useState } from 'react'
import { Hourglass, Pencil, Target } from 'lucide-react'
import { authRequest } from '../../../services/authClient'
import { buildTeacherLessonTasksForDate, getSchoolSchedule, getTeacherLessonSchedule, isSchoolHoliday } from '../../../services/weeklyPlanService'
import { dateToISO, getWeekdayKey } from '../../../utils/time'
import { isPrivateLessonTask } from '../../../utils/lessonTasks'
import { remainingStudyTime } from '../../../utils/remainingStudyTime'

const kinds = [['private', 'Özel lise hedefim'], ['public', 'Devlet lisesi hedefim']]
const duration = (minutes) => {
  const seconds = Math.max(0, Math.round(minutes * 60))
  return `${Math.floor(seconds / 3600)} sa ${String(Math.floor(seconds / 60) % 60).padStart(2, '0')} dk ${String(seconds % 60).padStart(2, '0')} sn`
}

export default function StudentGoals({ studentId, currentDate, tasks, renderHeader }) {
  const [data, setData] = useState(null)
  const [schedule, setSchedule] = useState(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    let ignore = false
    authRequest('/api/panel/high-school-goals').then(async (result) => {
      if (ignore) return
      setData(result)
      if (result.showStudyTime) {
        const [school, lessons] = await Promise.all([getSchoolSchedule(), getTeacherLessonSchedule()])
        if (!ignore) setSchedule({ ...school, lessons })
      }
    }).catch(() => { if (!ignore) setError('Hedefler veya çalışma takvimi yüklenemedi. Sayfayı yenileyerek tekrar deneyebilirsin.') })
    return () => { ignore = true }
  }, [studentId])
  const date = dateToISO(currentDate)
  const schoolSlots = schedule && !isSchoolHoliday(date, schedule.holidays)
    ? schedule.entries.filter((slot) => slot.dayOfWeek === getWeekdayKey(date) && (!slot.startDate || date >= slot.startDate) && (!slot.endDate || date <= slot.endDate))
    : []
  const schoolDay = schoolSlots.length > 0
  const schoolEndTime = schoolSlots.reduce((latest, slot) => slot.endTime > latest ? slot.endTime : latest, '')
  const study = schedule ? remainingStudyTime({
    nowMinutes: currentDate.getHours() * 60 + currentDate.getMinutes() + currentDate.getSeconds() / 60, schoolDay, schoolEndTime,
    lessons: [...buildTeacherLessonTasksForDate(schedule.lessons, date), ...tasks.filter((task) => task.date === date && isPrivateLessonTask(task) && !task.isTeacherLessonSlot)],
  }) : null
  const save = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const goals = Object.fromEntries(kinds.map(([kind]) => {
        const goal = draft[kind]
        return [kind, goal?.name?.trim() ? { name: goal.name, score: goal.score === '' || goal.score == null ? null : Number(String(goal.score).replace(',', '.')), year: goal.year === '' || goal.year == null ? null : Number(goal.year) } : null]
      }))
      setData(await authRequest('/api/panel/high-school-goals', { method: 'PUT', body: JSON.stringify({ goals }) }))
      setEditing(false)
    } catch (err) { setError(err.message || 'Hedefler kaydedilemedi.') }
    finally { setSaving(false) }
  }
  const studyIndicator = data?.showStudyTime ? (
    <div className="flex items-center gap-3 rounded-xl border border-panel-border bg-student-theme-soft/40 p-4 sm:col-span-2 xl:col-span-1">
      <Hourglass size={24} className="text-student-theme-text" aria-hidden="true" />
      <div>
        <p className="text-xs text-panel-text-muted">Bugün kalan çalışma süren</p>
        <p role="timer" aria-live="off" className="mt-1 whitespace-nowrap text-xl font-bold tabular-nums text-panel-text">{study ? duration(study.minutes) : 'Hesaplanıyor…'}</p>
      </div>
    </div>
  ) : null
  return <>
    {renderHeader?.()}
    <div className="border-t border-panel-border px-4 py-4 sm:px-5">
    <div className="mb-3 flex items-center justify-between gap-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-panel-text"><Target size={16} className="text-student-theme-text" />Hedeflerim</p>
      {data && <button type="button" className="flex items-center gap-1 text-xs font-medium text-student-theme-text" onClick={() => { setDraft(structuredClone(data.goals)); setEditing(!editing) }}><Pencil size={13} />{editing ? 'Vazgeç' : 'Hedeflerimi düzenle'}</button>}
    </div>
    {error && <p role="alert" className="mb-3 text-sm text-red-600">{error}</p>}
    {editing ? <form onSubmit={save} className="space-y-3">
      <p className="text-xs text-panel-text-muted">En fazla bir özel lise ve bir devlet lisesi seçebilirsin. Puan ve yıl isteğe bağlıdır. Hedefi kaldırmak için lise adını boş bırak.</p>
      <div className="grid gap-3 md:grid-cols-2">{kinds.map(([kind, label]) => <fieldset key={kind} className="rounded-xl border border-panel-border p-3"><legend className="px-1 text-xs font-semibold text-panel-text">{label}</legend>
        {[['name', 'Lise adı'], ['score', 'Taban puan'], ['year', 'Puan yılı']].map(([key, placeholder]) => <label key={key} className="mb-2 block text-xs text-panel-text-muted">{placeholder}<input aria-label={`${label} ${placeholder}`} maxLength={key === 'name' ? 150 : undefined} type={key === 'year' ? 'number' : 'text'} inputMode={key === 'score' ? 'decimal' : undefined} min={key === 'year' ? 2000 : undefined} max={key === 'year' ? 2100 : undefined} value={draft[kind]?.[key] ?? ''} onChange={(e) => setDraft({ ...draft, [kind]: { ...draft[kind], [key]: e.target.value } })} className="mt-1 w-full rounded-lg border border-panel-border bg-panel-surface p-2 text-sm text-panel-text" /></label>)}
      </fieldset>)}</div>
      <button disabled={saving} className="rounded-lg bg-student-theme-primary px-4 py-2 text-sm text-white disabled:opacity-50">{saving ? 'Kaydediliyor…' : 'Hedefleri kaydet'}</button>
    </form> : <div className={`grid gap-3 sm:grid-cols-2 ${data?.showStudyTime ? 'xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(240px,0.7fr)]' : ''}`}>
      {kinds.map(([kind]) => {
        const goal = data?.goals[kind]
        const hasRobertImage = kind === 'private' && /robert/i.test(goal?.name || '')
        const hasKabatasImage = kind === 'public' && /kabataş|kabatas/i.test(goal?.name || '')
        const photo = hasRobertImage
          ? { src: '/images/schools/robert-college-ivy-garden.jpg', alt: 'Robert Koleji Gould Hall binası ve bahçesi' }
          : hasKabatasImage
            ? { src: '/images/schools/kabatas-bosphorus.jpg', alt: 'Kabataş Erkek Lisesi sahil binası' }
            : null
        return <div key={kind} className="flex min-w-0 items-center gap-3 rounded-xl border border-panel-border bg-panel-surface p-3 sm:gap-4">
          {photo ? <img src={photo.src} alt={photo.alt} width={144} height={108} className="aspect-[4/3] w-24 shrink-0 rounded-lg object-cover object-center lg:w-36" />
            : <div className="flex aspect-[4/3] w-24 shrink-0 items-center justify-center rounded-lg bg-student-theme-soft/40 lg:w-36"><Target size={28} className="text-student-theme-text" aria-hidden="true" /></div>}
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-panel-text-muted"><Target size={13} className="shrink-0 text-student-theme-text" aria-hidden="true" />{kind === 'private' ? 'Özel lise' : 'Devlet lisesi'}</p>
            <p className="mt-1 text-lg font-bold leading-snug text-panel-text lg:text-xl">{data ? goal?.name || 'Hayalindeki liseyi ekle' : 'Yükleniyor…'}</p>
            {goal?.score != null && <p className="mt-2 flex flex-wrap items-baseline gap-x-2 text-panel-text">
              <span className="text-lg font-bold tabular-nums lg:text-xl">{goal.score.toLocaleString('tr-TR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</span>
              <span className="text-[11px] text-panel-text-muted">{goal.year ? `${goal.year} taban puanı` : 'Taban puan'}</span>
            </p>}
          </div>
        </div>
      })}
      {studyIndicator}
    </div>}
  </div>
  </>
}
