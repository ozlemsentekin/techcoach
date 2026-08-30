import { useAuth } from '../../../context/useAuth'
import BookshelfPage from '../../shared/bookshelf/BookshelfPage'

export default function StudentBookshelfPage() {
  const { authUser } = useAuth()
  const students = authUser?.id ? [{ id: authUser.id, fullName: authUser.fullName || 'Ben' }] : []

  return <BookshelfPage students={students} showAssignees={false} />
}
