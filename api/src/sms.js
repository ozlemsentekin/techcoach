const { getSmsConfig, isConfigError } = require('./config')

const NETGSM_SEND_URL = 'https://api.netgsm.com.tr/sms/rest/v2/send'

// Netgsm REST v2 gönderim uç noktası; OTP ürünü aynı uç noktayı kullanır (IYS filtresi
// olmadan). Gerçek Netgsm hesap bilgileri tanımlandığında panel/dokümantasyondaki alan
// adları (msgheader, encoding vb.) ile burası teyit edilmeli.
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

  const response = await fetch(NETGSM_SEND_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${config.netgsmUsercode}:${config.netgsmPassword}`).toString('base64')}`,
    },
    body: JSON.stringify({
      msgheader: config.netgsmHeader,
      encoding: 'TR',
      iysfilter: '',
      messages: [{ msg: message, no: gsmNo }],
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
