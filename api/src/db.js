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

  // techcoach-db runs on Azure SQL Serverless, which auto-pauses after an idle period.
  // The first login after a pause gets a transient "database is resuming, retry" error
  // (40613) instead of connecting; tedious's default retry budget (3 tries, 500ms apart)
  // gives up long before a resume finishes, which surfaced as "Görevler yüklenemedi."
  // Widening it here lets tedious's own transient-error retry (already built in) ride
  // out a resume instead of failing the whole request.
  config.options = {
    ...config.options,
    maxRetriesOnTransientErrors: 8,
    connectionRetryInterval: 3000,
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

// Runs `work` against a single SQL transaction so multi-step writes (e.g. creating a
// user row plus its entitlement row) either all commit or all roll back. `work` receives
// a requestInTransaction(bindings) helper that mirrors withRequest's signature but binds
// each request to the transaction instead of the shared pool.
async function withTransaction(work) {
  const pool = await getPool()
  const transaction = new sql.Transaction(pool)
  await transaction.begin()

  const requestInTransaction = (bindings = {}) => {
    const request = new sql.Request(transaction)
    Object.entries(bindings).forEach(([name, binding]) => {
      request.input(name, binding.type, binding.value)
    })
    return request
  }

  try {
    const result = await work(requestInTransaction)
    await transaction.commit()
    return result
  } catch (error) {
    await transaction.rollback().catch(() => {})
    throw error
  }
}

module.exports = { sql, withRequest, withTransaction }
