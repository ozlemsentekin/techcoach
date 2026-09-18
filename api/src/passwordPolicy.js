const { defaultPasswordForPhone, verifyPassword } = require('./security')

// Bu kullanıcılar başlangıç şifresiyle (telefonun son 6 hanesi) panele girse bile
// zorunlu şifre değiştirme ekranına takılmaz — idari istisna.
const PASSWORD_CHANGE_EXEMPT_USER_IDS = new Set([
  'ee525e48-e866-4d02-b9dc-eb4c2ec758d8', // Hakan Şafak Selvi (öğretmen)
])

// The hash itself is the source of truth. Covers existing/default/reset accounts
// without a schema migration; changing the hash immediately invalidates the cache key.
const checks = new Map()
async function requiresPasswordChange(record) {
  if (!record?.password_hash || !record.phone_number) return false
  if (record.id && PASSWORD_CHANGE_EXEMPT_USER_IDS.has(String(record.id).toLowerCase())) return false
  const initial = defaultPasswordForPhone(record.phone_number)
  if (initial.length !== 6) return false
  const key = `${record.phone_number}:${record.password_hash}`
  if (!checks.has(key)) {
    if (checks.size >= 500) checks.delete(checks.keys().next().value)
    checks.set(key, verifyPassword(initial, record.password_hash).catch((error) => { checks.delete(key); throw error }))
  }
  return checks.get(key)
}

// Giriş ekranı yalnızca rakamlı şifre kabul ediyor; şifre tam 6 haneli numerik bir PIN
// olarak tasarlandı (bkz. otp.js'teki 6 haneli OTP koduyla tutarlılık).
function passwordChangeError(currentPassword, newPassword, phone) {
  if (!/^\d{6}$/.test(newPassword)) return 'Yeni şifre tam olarak 6 rakamdan oluşmalı.'
  if (newPassword === currentPassword) return 'Yeni şifreniz mevcut şifrenizden farklı olmalı.'
  if (newPassword === defaultPasswordForPhone(phone)) return 'Telefon numaranızın son 6 hanesini yeni şifre olarak kullanamazsınız.'
  return null
}

module.exports = { requiresPasswordChange, passwordChangeError }
