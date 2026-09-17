const { getSmsConfig, isConfigError } = require('./config')

// OTP paketi/kredisi normal SMS gönderim ("send") ürününden ayrı bir havuzdur; OTP
// mesajları bu ayrı uç noktadan gönderilmezse normal SMS kredisi (0 olabilir)
// kullanılmaya çalışılır ve "krediniz yetersiz" hatası alınır.
const NETGSM_OTP_URL = 'https://api.netgsm.com.tr/sms/rest/v2/otp'

async function sendOtpSms(phoneE164, code) {
  let config
  try {
    config = getSmsConfig()
  } catch (error) {
    if (isConfigError(error)) {
      // Netgsm kimlik bilgileri henüz tanımlanmadı: geliştirme/test sırasında akışın
      // uçtan uca denenebilmesi için kodu konsola yaz, gönderim başarılı say.
      console.warn(`[sms] NETGSM yapılandırılmadı, OTP konsola yazıldı: ${phoneE164} -> ${code}`)
      return { ok: true, simulated: true }
    }
    throw error
  }

  const gsmNo = phoneE164.replace('+', '')
  const message = `TechCoach doğrulama kodunuz: ${code}. Kod 60 saniye geçerlidir.`

  const response = await fetch(NETGSM_OTP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${config.netgsmUsercode}:${config.netgsmPassword}`).toString('base64')}`,
    },
    body: JSON.stringify({
      msgheader: config.netgsmHeader,
      encoding: 'TR',
      msg: message,
      no: gsmNo,
    }),
  })

  const result = await response.json().catch(() => null)

  if (!response.ok || result?.code !== '00') {
    console.error('sendOtpSms: Netgsm gönderim hatası', response.status, result)
    throw new Error('SMS gönderilemedi.')
  }

  return { ok: true }
}

module.exports = { sendOtpSms }
