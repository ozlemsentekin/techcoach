const { withRequest } = require('./db')
const { json } = require('./http')

// Hafif "canlılık" ucu. Dışarıdan (Application Insights availability testi ya da
// bir cron ping'i) 5 dakikada bir çağrılır; amacı SWA managed functions örneğini
// ve DB bağlantı havuzunu sıcak tutmak, böylece uzun boşluk sonrası ilk gerçek
// isteğin cold start + TLS handshake bedelini ödememesi. SELECT 1 dışında iş yapmaz,
// oturum gerektirmez, hiçbir kişisel veriye dokunmaz.
async function healthHandler() {
  try {
    const db = await withRequest({})
    await db.query('SELECT 1 AS ok;')
    return json(200, { status: 'ok', db: 'up', at: new Date().toISOString() })
  } catch (error) {
    console.error('healthHandler failed', error)
    return json(503, { status: 'degraded', db: 'down' })
  }
}

module.exports = { healthHandler }
