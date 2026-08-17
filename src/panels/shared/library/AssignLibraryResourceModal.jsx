import { useEffect, useState } from 'react'
import { Check, GraduationCap, X } from 'lucide-react'
import { authRequest } from '../../../services/authClient'
import LoadingState from '../../shared/LoadingState'
import EmptyState from '../../shared/EmptyState'
import { libraryApiBase } from './libraryConstants'

export default function AssignLibraryResourceModal({ role, resourceBook, onClose }) {
  const apiBase = libraryApiBase(role)
  const isTeacher = role === 'teacher'

  const [students, setStudents] = useState(null)
  const [error, setError] = useState('')
  const [pendingId, setPendingId] = useState(null)

  useEffect(() => {
    let ignore = false
    authRequest(`${apiBase}/library/resource-books/${resourceBook.id}/assignable-students`, { method: 'GET' })
      .then((data) => {
        if (!ignore) setStudents(data.students)
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })
    return () => {
      ignore = true
    }
  }, [apiBase, resourceBook.id])

  const toggleAssignment = async (student) => {
    const targetId = isTeacher ? student.studentTeacherId : student.studentId
    const url = `${apiBase}/students/${targetId}/library/resource-books/${resourceBook.id}`

    setError('')
    setPendingId(targetId)
    try {
      if (student.assigned) {
        if (isTeacher) return
        await authRequest(url, { method: 'DELETE' })
      } else {
        await authRequest(url, { method: 'POST' })
      }
      setStudents((current) =>
        current.map((item) => (item === student ? { ...item, assigned: !item.assigned } : item)),
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setPendingId(null)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md panel-card p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-panel-text">Kaynağı Ata</h2>
            <p className="truncate text-xs text-panel-text-muted">{resourceBook.name}</p>
          </div>
          <button type="button" aria-label="Kapat" onClick={onClose} className="shrink-0">
            <X size={20} />
          </button>
        </div>

        {error ? (
          <div className="mb-3 rounded-xl bg-panel-accent-soft px-3 py-2 text-sm text-panel-warm">{error}</div>
        ) : null}

        {students === null ? (
          <LoadingState label="Öğrenciler yükleniyor..." />
        ) : students.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title={isTeacher ? 'Bu sınıfta öğrenciniz yok' : 'Bu sınıfta çocuğunuz yok'}
            description={`${resourceBook.grade}. sınıfa kayıtlı, bu derse ait bir ${isTeacher ? 'öğrenciniz' : 'çocuğunuz'} bulunmuyor.`}
          />
        ) : (
          <div className="flex flex-col gap-1.5">
            {students.map((student) => {
              const targetId = isTeacher ? student.studentTeacherId : student.studentId
              const disabled = pendingId === targetId || (isTeacher && student.assigned)
              return (
                <button
                  key={targetId}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggleAssignment(student)}
                  className={`flex items-center justify-between gap-3 rounded-xl border p-2.5 text-left transition-colors disabled:opacity-60 ${
                    student.assigned
                      ? 'border-[#1c2b5e] bg-[#f8f7fb]'
                      : 'border-panel-border bg-white hover:border-[#c1c8e0]'
                  }`}
                >
                  <span className="truncate text-sm font-medium text-panel-text">{student.fullName}</span>
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                      student.assigned ? 'border-[#1c2b5e] bg-[#1c2b5e] text-white' : 'border-panel-border bg-white'
                    }`}
                  >
                    {student.assigned ? <Check size={13} aria-hidden="true" /> : null}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
