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

function call(resource, method, params) {
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

module.exports = {
  Iyzipay,
  createSubscriptionProduct: (params) => call('subscriptionProduct', 'create', params),
  createSubscriptionPricingPlan: (params) => call('subscriptionPricingPlan', 'create', params),
  initializeSubscriptionCheckoutForm: (params) => call('subscriptionCheckoutForm', 'initialize', params),
  retrieveSubscriptionCheckoutForm: (params) => call('subscriptionCheckoutForm', 'retrieve', params),
  retrieveSubscription: (params) => call('subscription', 'retrieve', params),
  cancelSubscription: (params) => call('subscription', 'cancel', params),
}
