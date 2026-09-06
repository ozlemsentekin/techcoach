import { useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../context/useAuth'
import ParentTourContext from './parentTourContext'
import { saveOnboardingState } from './onboardingStorage'

export default function ParentTourProvider({ children }) {
  const { authUser } = useAuth()
  const navigate = useNavigate()
  const parentId = authUser?.id
  const enabled = Boolean(parentId && !authUser?.actingAdmin && !authUser?.isAdmin)
  const startTour = useCallback(() => {
    if (!enabled) return
    saveOnboardingState(parentId, 'guide-opened')
    navigate('/parent/guide')
  }, [parentId, enabled, navigate])
  const value = useMemo(() => ({ startTour, active: false, enabled }), [startTour, enabled])
  return <ParentTourContext.Provider value={value}>{children}</ParentTourContext.Provider>
}
