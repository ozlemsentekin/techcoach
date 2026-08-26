// One-off helper: creates the "TechCoach Veli Aboneliği" iyzico subscription product and its
// monthly/yearly pricing plans, then prints the reference codes to paste into
// local.settings.json / Azure App Settings as IYZICO_PARENT_MONTHLY_PLAN_REF / IYZICO_PARENT_YEARLY_PLAN_REF.
// Usage: node api/scripts/setup-iyzico-subscription-plans.js
const fs = require('fs')
const path = require('path')
const Iyzipay = require('iyzipay')

const localSettingsPath = path.join(__dirname, '..', 'local.settings.json')

function loadLocalSettings() {
  if (!fs.existsSync(localSettingsPath)) return
  const parsed = JSON.parse(fs.readFileSync(localSettingsPath, 'utf8'))
  Object.entries(parsed.Values || {}).forEach(([key, value]) => {
    if (!process.env[key] && typeof value === 'string') process.env[key] = value
  })
}

function call(iyzipay, resource, method, params) {
  return new Promise((resolve, reject) => {
    iyzipay[resource][method](params, (error, result) => {
      if (error) return reject(error)
      if (result?.status !== 'success') return reject(new Error(result?.errorMessage || `${resource}.${method} başarısız oldu.`))
      resolve(result)
    })
  })
}

async function main() {
  loadLocalSettings()

  const { IYZICO_API_KEY, IYZICO_SECRET_KEY, IYZICO_BASE_URL } = process.env
  if (!IYZICO_API_KEY || !IYZICO_SECRET_KEY || !IYZICO_BASE_URL) {
    throw new Error('IYZICO_API_KEY, IYZICO_SECRET_KEY, IYZICO_BASE_URL local.settings.json içinde tanımlı olmalı.')
  }

  const iyzipay = new Iyzipay({ apiKey: IYZICO_API_KEY, secretKey: IYZICO_SECRET_KEY, uri: IYZICO_BASE_URL })

  console.log('Ürün oluşturuluyor...')
  const product = await call(iyzipay, 'subscriptionProduct', 'create', {
    locale: Iyzipay.LOCALE.TR,
    conversationId: 'techcoach-setup-product',
    name: 'TechCoach Veli Aboneliği',
    description: 'TechCoach veli panel erişimi için aylık/yıllık abonelik',
  })
  console.log('Ürün oluşturuldu:', product.data.referenceCode)

  console.log('Aylık plan oluşturuluyor...')
  const monthly = await call(iyzipay, 'subscriptionPricingPlan', 'create', {
    locale: Iyzipay.LOCALE.TR,
    conversationId: 'techcoach-setup-plan-monthly',
    productReferenceCode: product.data.referenceCode,
    name: 'Veli Aylık',
    price: '3000',
    currencyCode: Iyzipay.CURRENCY.TRY,
    paymentInterval: 'MONTHLY',
    paymentIntervalCount: 1,
    planPaymentType: 'RECURRING',
  })
  console.log('Aylık plan oluşturuldu:', monthly.data.referenceCode)

  console.log('Yıllık plan oluşturuluyor...')
  const yearly = await call(iyzipay, 'subscriptionPricingPlan', 'create', {
    locale: Iyzipay.LOCALE.TR,
    conversationId: 'techcoach-setup-plan-yearly',
    productReferenceCode: product.data.referenceCode,
    name: 'Veli Yıllık',
    price: '24000',
    currencyCode: Iyzipay.CURRENCY.TRY,
    paymentInterval: 'YEARLY',
    paymentIntervalCount: 1,
    planPaymentType: 'RECURRING',
  })
  console.log('Yıllık plan oluşturuldu:', yearly.data.referenceCode)

  console.log('\nlocal.settings.json / Azure App Settings içine ekle:')
  console.log(`IYZICO_PARENT_MONTHLY_PLAN_REF=${monthly.data.referenceCode}`)
  console.log(`IYZICO_PARENT_YEARLY_PLAN_REF=${yearly.data.referenceCode}`)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
