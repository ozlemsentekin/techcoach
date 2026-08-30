import { useEffect, useState } from 'react'
import { getTeacherStudents } from '../../../services/teacherService'
import BookshelfPage from '../../shared/bookshelf/BookshelfPage'

export default function TeacherBookshelfPage() {
  const [students, setStudents] = useState([])

  useEffect(() => {
    let ignore = false
    getTeacherStudents('active')
      .then((list) => {
        if (ignore) return
        // Öğretmenin bir öğrenciyle birden fazla ders ilişkisi olabilir; öğrenciyi tekilleştir.
        const seen = new Map()
        list.forEach((item) => {
          if (!seen.has(item.studentId)) {
            seen.set(item.studentId, {
              id: item.studentId,
              fullName: item.studentFullName,
              grade: item.studentGrade || null,
            })
          }
        })
        setStudents([...seen.values()])
      })
      .catch(() => {})
    return () => {
      ignore = true
    }
  }, [])

  return <BookshelfPage students={students} showAssignees />
}
