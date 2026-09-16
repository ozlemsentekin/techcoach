const Iyzipay = require('iyzipay')
const { getIyzicoConfig } = require('./config')

let client = null

function getClient() {
  if (!client) {
    const { apiKey, secretKey, baseUrl } = getIyzicoConfig()
    client = new Iyzipay({ apiKey, secretKey, uri: baseUrl })
  }
  return client
}

function callOnce(resource, method, params) {
  return new Promise((resolve, reject) => {
    getClient()[resource][method](params, (error, result) => {
      if (error) {
        reject(error)
        return
      }
      if (result?.status !== 'success') {
        reject(new Error(result?.errorMessage || `iyzico ${resource}.${method} başarısız oldu.`))
        return
      }
      resolve(result)
    })
  })
}

const RETRYABLE_NETWORK_CODES = new Set(['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EPIPE', 'EAI_AGAIN'])
const NETWORK_RETRY_ATTEMPTS = 2
const NETWORK_RETRY_DELAY_MS = 500

function isRetryableNetworkError(error) {
  return Boolean(error?.code && RETRYABLE_NETWORK_CODES.has(error.code))
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// iyzico'nun REST API'sine giden bağlantı zaman zaman ECONNRESET ile kopabiliyor
// (SDK seviyesinde retry yok) — bu tür geçici ağ hatalarında isteği birkaç kez
// tekrar deniyoruz; iyzico kaynaklı iş hatalarında (result.status !== 'success') retry yapmıyoruz.
async function call(resource, method, params) {
  let lastError
  for (let attempt = 0; attempt <= NETWORK_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await callOnce(resource, method, params)
    } catch (error) {
      lastError = error
      if (!isRetryableNetworkError(error) || attempt === NETWORK_RETRY_ATTEMPTS) {
        throw error
      }
      await delay(NETWORK_RETRY_DELAY_MS * (attempt + 1))
    }
  }
  throw lastError
}

module.exports = {
  Iyzipay,
  createSubscriptionProduct: (params) => call('subscriptionProduct', 'create', params),
  createSubscriptionPricingPlan: (params) => call('subscriptionPricingPlan', 'create', params),
  initializeSubscriptionCheckoutForm: (params) => call('subscriptionCheckoutForm', 'initialize', params),
  retrieveSubscriptionCheckoutForm: (params) => call('subscriptionCheckoutForm', 'retrieve', params),
  retrieveSubscription: (params) => call('subscription', 'retrieve', params),
  cancelSubscription: (params) => call('subscription', 'cancel', params),
}
