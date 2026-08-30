import { useEffect, useState } from 'react'
import { cachedGet } from '../../../services/authClient'
import BookshelfPage from '../../shared/bookshelf/BookshelfPage'

export default function ParentBookshelfPage() {
  const [students, setStudents] = useState([])

  useEffect(() => {
    let ignore = false
    cachedGet('/api/parent/students')
      .then((data) => {
        if (ignore) return
        setStudents(
          (data.students || []).map((student) => ({
            id: student.id,
            fullName: student.fullName,
            grade: student.grade || null,
          })),
        )
      })
      .catch(() => {})
    return () => {
      ignore = true
    }
  }, [])

  return <BookshelfPage students={students} showAssignees />
}
