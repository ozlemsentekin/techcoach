import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Library, Plus, Users, X } from 'lucide-react'
import { cachedGet } from '../../../services/authClient'
import { addTeacherLibraryGrade, getTeacherLibraryGrades, removeTeacherLibraryGrade } from '../../../services/teacherService'
import PageHeader from '../../layout/PageHeader'
import LoadingState from '../../shared/LoadingState'
import EmptyState from '../../shared/EmptyState'
import Button from '../../ui/Button'
import { LIBRARY_GRADES } from './libraryConstants'

const MIDDLE_SCHOOL_GRADES = LIBRARY_GRADES.filter((grade) => Number(grade) <= 8)
const HIGH_SCHOOL_GRADES = LIBRARY_GRADES.filter((grade) => Number(grade) > 8)

export default function LibraryGradesPage({ role }) {
  const navigate = useNavigate()
  const isTeacher = role === 'teacher'
  const basePath = isTeacher ? '/teacher/library' : '/parent/library'

  const [grades, setGrades] = useState(null)
  const [manualGrades, setManualGrades] = useState([])
  const [error, setError] = useState('')
  const [showAddPanel, setShowAddPanel] = useState(false)
  const [savingGrade, setSavingGrade] = useState('')

  useEffect(() => {
    let ignore = false

    const request = isTeacher
      ? getTeacherLibraryGrades().then((data) => {
          if (ignore) return
          setGrades(data.grades || [])
          setManualGrades(data.manualGrades || [])
        })
      : cachedGet('/api/parent/students').then((data) => {
          if (ignore) return
          const studentGrades = new Set((data.students || []).map((student) => student.grade))
          setGrades(LIBRARY_GRADES.filter((grade) => studentGrades.has(grade)))
        })

    request.catch((err) => {
      if (!ignore) setError(err.message)
    })

    return () => {
      ignore = true
    }
  }, [isTeacher])

  const handleAddGrade = async (grade) => {
    setError('')
    setSavingGrade(grade)
    try {
      const data = await addTeacherLibraryGrade(grade)
      setGrades(data.grades || [])
      setManualGrades(data.manualGrades || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingGrade('')
    }
  }

  const handleRemoveGrade = async (event, grade) => {
    event.stopPropagation()
    setError('')
    setSavingGrade(grade)
    try {
      const data = await removeTeacherLibraryGrade(grade)
      setGrades(data.grades || [])
      setManualGrades(data.manualGrades || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingGrade('')
    }
  }

  const addableGrades = LIBRARY_GRADES.filter((grade) => !(grades || []).includes(grade))

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Kütüphane"
        subtitle="Sınıfa göre kaynakları görüntüle ve öğrencilerine ata."
        actions={
          isTeacher ? (
            <Button type="button" variant="secondary" onClick={() => setShowAddPanel((current) => !current)}>
              <Plus size={16} aria-hidden="true" />
              Sınıf Ekle
            </Button>
          ) : null
        }
      />

      {error ? <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{error}</div> : null}

      {isTeacher && showAddPanel ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-panel-border bg-panel-surface p-4">
          {addableGrades.length === 0 ? (
            <p className="text-sm text-panel-text-muted">Tüm sınıflar zaten eklendi.</p>
          ) : (
            <>
              <GradeChipGroup
                label="Ortaokul"
                candidateGrades={MIDDLE_SCHOOL_GRADES}
                addableGrades={addableGrades}
                savingGrade={savingGrade}
                onAdd={handleAddGrade}
              />
              <GradeChipGroup
                label="Lise"
                candidateGrades={HIGH_SCHOOL_GRADES}
                addableGrades={addableGrades}
                savingGrade={savingGrade}
                onAdd={handleAddGrade}
              />
            </>
          )}
        </div>
      ) : null}

      {grades === null ? (
        <LoadingState label="Yükleniyor..." />
      ) : grades.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Kütüphanede gösterilecek sınıf yok"
          description={
            isTeacher
              ? '"Sınıf Ekle" ile bir sınıf ekleyin veya sınıf bilgisi tanımlı bir öğrenci ekleyin.'
              : 'Çocuklarınızın sınıf bilgisi 5-12. sınıf aralığında değil veya henüz tanımlanmamış.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {grades.map((grade) => {
            const removable = isTeacher && manualGrades.includes(grade)
            return (
              <div
                key={grade}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`${basePath}/${grade}`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    navigate(`${basePath}/${grade}`)
                  }
                }}
                className="relative flex cursor-pointer flex-col items-center gap-3 rounded-2xl border border-panel-border bg-panel-surface p-6 text-center shadow-panel-1 transition-colors hover:border-panel-blue"
              >
                {removable ? (
                  <button
                    type="button"
                    aria-label={`${grade}. sınıfı kaldır`}
                    onClick={(event) => handleRemoveGrade(event, grade)}
                    disabled={savingGrade === grade}
                    className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full text-panel-text-muted transition-colors hover:bg-panel-accent-soft hover:text-panel-warm disabled:opacity-50"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                ) : null}
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-panel-blue-soft text-panel-blue">
                  <Library size={28} aria-hidden="true" />
                </span>
                <div>
                  <p className="text-lg font-bold text-panel-text">{grade}. Sınıf</p>
                  <p className="text-sm text-panel-text-muted">Dersler ve kaynaklar</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function GradeChipGroup({ label, candidateGrades, addableGrades, savingGrade, onAdd }) {
  const options = candidateGrades.filter((grade) => addableGrades.includes(grade))
  if (options.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-panel-text-muted">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((grade) => (
          <button
            key={grade}
            type="button"
            disabled={savingGrade === grade}
            onClick={() => onAdd(grade)}
            className="rounded-full border border-panel-border bg-white px-3 py-1.5 text-sm font-semibold text-panel-text transition-colors hover:border-panel-blue hover:bg-panel-blue-soft hover:text-panel-blue disabled:opacity-50"
          >
            {grade}. Sınıf
          </button>
        ))}
      </div>
    </div>
  )
}
