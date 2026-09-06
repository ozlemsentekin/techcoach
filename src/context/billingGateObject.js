import { createContext } from 'react'

const BillingGateContext = createContext(null)

export const BILLING_GATE_FALLBACK = {
  billingState: 'ok',
  overdueDays: null,
  restricted: false,
  grace: false,
  promptPayment: () => {},
}

export default BillingGateContext
