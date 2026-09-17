import { authRequest } from './authClient'

/** Oturum açmış velinin üyelik durumunu, koltuk kotasını ve iyzico hesap hareketlerini döner. */
export async function getParentMembership() {
  return authRequest('/api/parent/membership', { method: 'GET' })
}

/** Velinin kendi aboneliğini (taban plan + varsa ek çocuk koltukları) iyzico'da iptal eder. */
export async function cancelParentMembership() {
  return authRequest('/api/parent/membership/cancel', { method: 'POST' })
}

/** Oturum açmış öğretmenin üyelik durumunu, koltuk kotasını ve iyzico hesap hareketlerini döner. */
export async function getTeacherMembership() {
  return authRequest('/api/panel-teacher/membership', { method: 'GET' })
}

/** Öğretmenin ek öğrenci koltuğu aboneliklerini iyzico'da iptal eder. */
export async function cancelTeacherMembership() {
  return authRequest('/api/panel-teacher/membership/cancel', { method: 'POST' })
}
