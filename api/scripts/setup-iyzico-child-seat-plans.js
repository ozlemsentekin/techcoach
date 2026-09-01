// One-off helper: creates the "TechCoach Ek Çocuk Paketi" iyzico subscription product and its
// monthly/yearly pricing plans (aylık 1.999 TL / yıllık 14.999 TL), then prints the reference
// codes to paste into local.settings.json / Azure App Settings as
// IYZICO_CHILD_MONTHLY_PLAN_REF / IYZICO_CHILD_YEARLY_PLAN_REF.
// Usage: node api/scripts/setup-iyzico-child-seat-plans.js
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
    conversationId: 'techcoach-setup-child-seat-product',
    name: 'TechCoach Ek Çocuk Paketi',
    description: 'Veli planının kapsadığından fazla çocuk profili için ek kota aboneliği',
  })
  console.log('Ürün oluşturuldu:', product.data.referenceCode)

  console.log('Aylık plan oluşturuluyor...')
  const monthly = await call(iyzipay, 'subscriptionPricingPlan', 'create', {
    locale: Iyzipay.LOCALE.TR,
    conversationId: 'techcoach-setup-child-seat-plan-monthly',
    productReferenceCode: product.data.referenceCode,
    name: 'Ek Çocuk Aylık',
    price: '1999',
    currencyCode: Iyzipay.CURRENCY.TRY,
    paymentInterval: 'MONTHLY',
    paymentIntervalCount: 1,
    planPaymentType: 'RECURRING',
  })
  console.log('Aylık plan oluşturuldu:', monthly.data.referenceCode)

  console.log('Yıllık plan oluşturuluyor...')
  const yearly = await call(iyzipay, 'subscriptionPricingPlan', 'create', {
    locale: Iyzipay.LOCALE.TR,
    conversationId: 'techcoach-setup-child-seat-plan-yearly',
    productReferenceCode: product.data.referenceCode,
    name: 'Ek Çocuk Yıllık',
    price: '14999',
    currencyCode: Iyzipay.CURRENCY.TRY,
    paymentInterval: 'YEARLY',
    paymentIntervalCount: 1,
    planPaymentType: 'RECURRING',
  })
  console.log('Yıllık plan oluşturuldu:', yearly.data.referenceCode)

  console.log('\nlocal.settings.json / Azure App Settings içine ekle:')
  console.log(`IYZICO_CHILD_MONTHLY_PLAN_REF=${monthly.data.referenceCode}`)
  console.log(`IYZICO_CHILD_YEARLY_PLAN_REF=${yearly.data.referenceCode}`)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
