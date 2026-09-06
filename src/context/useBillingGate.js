import { useContext } from 'react'
import BillingGateContext, { BILLING_GATE_FALLBACK } from './billingGateObject'

// Sağlayıcı dışında (ör. panel yerleşimi kurulmadan) çağrılırsa güvenli varsayılan döner.
export function useBillingGate() {
  return useContext(BillingGateContext) || BILLING_GATE_FALLBACK
}
