import { useEffect, useState } from 'react'
import { Check, Copy, Loader2, LogIn, UserRound, Users } from 'lucide-react'
import { authRequest, cachedGet } from '../../../services/authClient'
import { useAuth } from '../../../context/useAuth'
import { getQuarterAnalysis } from '../../../services/quarterAnalysisService'
import PageHeader from '../../layout/PageHeader'
import LoadingState from '../../shared/LoadingState'
import EmptyState from '../../shared/EmptyState'

// Veli "Çeyrek Dönem Analizi": çocuğun her dersi bir kart. Kartta öğretmen, hata / analiz edilen
// sayısı ve o öğretmene özel "Hata Analizi" linki (kopyala / WhatsApp). Öğretmen linki açınca kendi
// dersinin Hata Defteri, Kitaplık, Gelişim Analizi ve Sınav Sonuçları menüsünü görür.

const SUBJECT_TONES = [
  { bar: 'bg-panel-blue', soft: 'bg-panel-blue-soft', text: 'text-panel-blue' },
  { bar: 'bg-panel-sage', soft: 'bg-panel-sage-soft', text: 'text-panel-sage' },
  { bar: 'bg-panel-lilac', soft: 'bg-panel-lilac-soft', text: 'text-panel-lilac' },
  { bar: 'bg-panel-accent', soft: 'bg-panel-accent-soft', text: 'text-panel-accent' },
  { bar: 'bg-panel-warm', soft: 'bg-panel-warm-soft', text: 'text-panel-warm' },
  { bar: 'bg-panel-green', soft: 'bg-panel-green-soft', text: 'text-panel-green' },
]

function subjectTone(name) {
  let hash = 0
  for (let i = 0; i < String(name).length; i += 1) hash = (hash * 31 + String(name).charCodeAt(i)) | 0
  return SUBJECT_TONES[Math.abs(hash) % SUBJECT_TONES.length]
}

function analysisLink(studentTeacherId) {
  return `${window.location.origin}/teacher/students/${studentTeacherId}/hata-analizi`
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Eski tarayıcı / izin yok: geçici textarea ile kopyala.
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  }
}

function SubjectCard({ subject, onOpenAsTeacher, opening }) {
  const [copied, setCopied] = useState(false)
  const tone = subjectTone(subject.subjectName)
  const link = analysisLink(subject.studentTeacherId)
  const percent = subject.wrongCount ? Math.round((subject.analyzedCount / subject.wrongCount) * 100) : 0

  const handleCopy = async () => {
    if (await copyText(link)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-panel-border bg-panel-surface shadow-panel-1">
      <div className={`h-1.5 ${tone.bar}`} />
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="min-w-0">
          <span className={`inline-block max-w-full truncate rounded-full px-2.5 py-0.5 text-xs font-bold ${tone.soft} ${tone.text}`}>
            {subject.subjectName}
          </span>
          <p className="mt-2 flex min-w-0 items-center gap-1.5 text-sm font-semibold text-panel-text">
            <UserRound size={15} className="shrink-0 text-panel-text-muted" aria-hidden="true" />
            <span className="truncate">{subject.teacherFullName || 'Öğretmen'}</span>
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2 text-xs text-panel-text-muted">
            <span>
              <span className="text-lg font-bold text-panel-text">{subject.analyzedCount}</span> / {subject.wrongCount} hata analiz edildi
            </span>
            <span className="font-semibold text-panel-text">%{percent}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-panel-surface-soft">
            <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${percent}%` }} />
          </div>
        </div>

        {subject.canShare ? (
          <div className="mt-auto flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-panel-border bg-panel-surface px-3 py-2 text-sm font-semibold text-panel-text hover:bg-panel-surface-soft"
            >
              {copied ? <Check size={16} className="text-panel-green" /> : <Copy size={16} />}
              {copied ? 'Kopyalandı' : 'Linki kopyala'}
            </button>
            {onOpenAsTeacher && subject.teacherUserId ? (
              <button
                type="button"
                onClick={() => onOpenAsTeacher(subject)}
                disabled={opening}
                title="Yönetici olarak bu öğretmenin hesabına geçip linki açar"
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-panel-blue px-3 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
              >
                {opening ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
                Öğretmen olarak aç
              </button>
            ) : null}
          </div>
        ) : (
          <p className="mt-auto rounded-xl bg-panel-surface-soft px-3 py-2 text-xs text-panel-text-muted">
            Bu öğretmenin panel hesabı yok veya pasif; link paylaşılamaz.
          </p>
        )}
      </div>
    </div>
  )
}

export default function QuarterAnalysisPage() {
  const { authUser } = useAuth()
  const [openingId, setOpeningId] = useState('')
  const [students, setStudents] = useState(null)
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false
    cachedGet('/api/parent/students')
      .then((result) => {
        if (ignore) return
        setStudents(result.students || [])
        setSelectedStudentId((current) => current || result.students?.[0]?.id || '')
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })
    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    if (!selectedStudentId) return undefined
    let ignore = false
    getQuarterAnalysis(selectedStudentId)
      .then((result) => {
        if (!ignore) setData({ studentId: selectedStudentId, ...result })
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })
    return () => {
      ignore = true
    }
  }, [selectedStudentId])

  // Yönetici: öğretmenin hesabına geçip (impersonate) öğretmene özel Hata Analizi linkini açar;
  // üst çubuktaki "Yönetici Paneline Dön" ile geri dönülür.
  const handleOpenAsTeacher = async (subject) => {
    setOpeningId(subject.studentTeacherId)
    setError('')
    try {
      // Oturum çerezini öğretmene çevirir (admin impersonate). AuthContext'teki impersonateUser
      // kullanılmaz: oturum durumu değişince veli rotası (RequireRole) kullanıcıyı öğretmenin ana
      // sayfasına yönlendirip linki ezer. Bunun yerine link tam sayfa yüklemeyle açılır ve yeni
      // oturum çerezden okunur.
      await authRequest(`/api/panel-admin/users/${subject.teacherUserId}/impersonate`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
      window.location.assign(`/teacher/students/${subject.studentTeacherId}/hata-analizi`)
    } catch (err) {
      setError(err.message || 'Öğretmen hesabına geçilemedi.')
      setOpeningId('')
    }
  }

  if (error) {
    return <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{error}</div>
  }
  if (students === null) return <LoadingState label="Öğrenciler yükleniyor..." />
  if (!students.length) {
    return <EmptyState icon={Users} title="Bağlı öğrenci bulunamadı" description="Önce bir öğrenci profili ekleyin." />
  }

  const current = data?.studentId === selectedStudentId ? data : null

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Çeyrek Dönem Analizi"
        subtitle="Her dersin linkini kopyalayıp o dersin öğretmeniyle paylaşın; öğretmen yalnızca kendi dersinin hata defterini, kitaplığını, gelişim analizini ve sınav sonuçlarını görür."
        actions={
          students.length > 1 ? (
            <select
              value={selectedStudentId}
              onChange={(event) => setSelectedStudentId(event.target.value)}
              className="h-10 rounded-xl border border-panel-border bg-panel-surface px-3 text-sm font-medium text-panel-text"
              aria-label="Öğrenci seç"
            >
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.fullName}
                </option>
              ))}
            </select>
          ) : null
        }
      />

      {!current ? (
        <LoadingState label="Dersler yükleniyor..." />
      ) : current.subjects.length ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {current.subjects.map((subject) => (
            <SubjectCard
              key={subject.studentTeacherId}
              subject={subject}
              onOpenAsTeacher={authUser?.isAdmin ? handleOpenAsTeacher : null}
              opening={openingId === subject.studentTeacherId}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Users}
          title="Ders öğretmeni eklenmemiş"
          description="Öğretmenler sayfasından derslere öğretmen ekleyince burada kartlar görünecek."
        />
      )}
    </div>
  )
}
