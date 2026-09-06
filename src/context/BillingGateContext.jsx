import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './useAuth'
import BillingGateContext from './billingGateObject'
import TeacherSeatPurchaseModal from '../panels/teacher/components/TeacherSeatPurchaseModal'

// Ödeme gecikmesi (grace / restricted) durumunu tek yerden dağıtır ve "Şimdi Öde" akışını yönetir:
// veli/öğrenci → /odeme sayfası; öğretmen → ek öğrenci koltuğu satın alma modalı (bu provider
// tarafından render edilir, böylece hem uyarı bandı hem de "Görev Ekle" gate'i aynı akışı tetikler).
export function BillingGateProvider({ children }) {
  const { authUser } = useAuth()
  const navigate = useNavigate()
  const [teacherModalOpen, setTeacherModalOpen] = useState(false)

  const billingState = authUser?.entitlement?.billingState || 'ok'
  const overdueDays = authUser?.entitlement?.overdueDays ?? null
  const isTeacher = authUser?.role === 'ogretmen'

  const promptPayment = useCallback(() => {
    if (isTeacher) {
      setTeacherModalOpen(true)
    } else {
      navigate('/odeme')
    }
  }, [isTeacher, navigate])

  const value = useMemo(
    () => ({
      billingState,
      overdueDays,
      restricted: billingState === 'restricted',
      grace: billingState === 'grace',
      promptPayment,
    }),
    [billingState, overdueDays, promptPayment],
  )

  return (
    <BillingGateContext.Provider value={value}>
      {children}
      {teacherModalOpen ? <TeacherSeatPurchaseModal onClose={() => setTeacherModalOpen(false)} /> : null}
    </BillingGateContext.Provider>
  )
}
