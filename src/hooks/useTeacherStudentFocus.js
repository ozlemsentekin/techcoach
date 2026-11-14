import { useEffect, useState } from 'react'
import { matchPath, useLocation } from 'react-router-dom'
import { getTeacherStudent } from '../services/teacherService'

// Öğretmene gönderilen öğrenciye özel linklerde (Hata Analizi / öğrenci Kitaplığı) sol menü tüm
// öğretmen menüsü yerine yalnızca o öğrencinin iki sayfasını gösterir ("Aylin Hata Defteri",
// "Kitaplık", "Gelişim Analizi", "Sınav Sonuçları"). Bu hook adres o sayfalardan biriyse öğrencinin bilgisini döner, değilse null.
const FOCUS_PATTERNS = [
  '/teacher/students/:studentTeacherId/hata-analizi',
  '/teacher/students/:studentTeacherId/kitaplik',
  '/teacher/students/:studentTeacherId/gelisim',
  '/teacher/students/:studentTeacherId/sinav-sonuclari',
]

const studentCache = new Map()

function loadStudent(studentTeacherId) {
  if (!studentCache.has(studentTeacherId)) {
    studentCache.set(
      studentTeacherId,
      getTeacherStudent(studentTeacherId).catch((error) => {
        studentCache.delete(studentTeacherId)
        throw error
      }),
    )
  }
  return studentCache.get(studentTeacherId)
}

export function useTeacherStudent(studentTeacherId) {
  const [student, setStudent] = useState(null)
  useEffect(() => {
    if (!studentTeacherId) return undefined
    let ignore = false
    loadStudent(studentTeacherId)
      .then((data) => {
        if (!ignore) setStudent(data || null)
      })
      .catch(() => {
        if (!ignore) setStudent(null)
      })
    return () => {
      ignore = true
    }
  }, [studentTeacherId])
  return student && studentTeacherId ? student : null
}

export function studentFirstName(student) {
  return String(student?.studentFullName || '').trim().split(/\s+/)[0] || 'Öğrenci'
}

export function useTeacherStudentFocus() {
  const location = useLocation()
  const match = FOCUS_PATTERNS.map((pattern) => matchPath(pattern, location.pathname)).find(Boolean)
  const studentTeacherId = match?.params.studentTeacherId || null
  const student = useTeacherStudent(studentTeacherId)
  if (!studentTeacherId) return null
  return { studentTeacherId, student, firstName: student ? studentFirstName(student) : '' }
}
