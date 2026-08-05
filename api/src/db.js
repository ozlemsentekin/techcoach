const sql = require('mssql')
const { getSqlConfig } = require('./config')

let poolPromise
let poolConnectionString

// mssql defaults to pool.max: 10 / min: 0 when the connection string doesn't
// specify "Max Pool Size"/"Min Pool Size" — one shared pool per Function
// instance caps concurrency hard at 10 in-flight queries. Raise it so a
// single warm instance can serve far more concurrent requests, and keep a
// warm minimum so connections aren't torn down/rebuilt (TLS handshake cost)
// between bursts.
function buildPoolConfig(connectionString) {
  const config = sql.ConnectionPool.parseConnectionString(connectionString)
  config.pool = {
    ...config.pool,
    max: 30,
    min: 5,
    idleTimeoutMillis: 60000,
  }
  return config
}

function getPool() {
  const { sqlConnectionString } = getSqlConfig()

  if (!poolPromise || poolConnectionString !== sqlConnectionString) {
    poolConnectionString = sqlConnectionString
    poolPromise = new sql.ConnectionPool(buildPoolConfig(sqlConnectionString))
      .connect()
      .catch((error) => {
        poolPromise = undefined
        poolConnectionString = undefined
        throw error
      })
  }

  return poolPromise
}

async function withRequest(bindings = {}) {
  const pool = await getPool()
  const request = pool.request()

  Object.entries(bindings).forEach(([name, binding]) => {
    request.input(name, binding.type, binding.value)
  })

  return request
}

module.exports = { sql, withRequest }
