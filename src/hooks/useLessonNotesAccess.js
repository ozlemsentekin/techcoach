import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { cachedGet } from '../services/authClient'

export function useLessonNotesAccess() {
  const { authUser } = useAuth()
  const { pathname } = useLocation()
  const [access, setAccess] = useState(null)
  useEffect(() => {
    let ignore = false
    cachedGet(`/api/panel/lesson-notes?access=1&user=${encodeURIComponent(authUser?.id || '')}`).then(data => {
      if (!ignore) setAccess({ userId: authUser?.id, enabled: data.enabled })
    }).catch(() => { if (!ignore) setAccess(null) })
    return () => { ignore = true }
  }, [authUser?.id, pathname])
  return access?.userId === authUser?.id && Boolean(access?.enabled)
}
