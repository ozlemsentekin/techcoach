const sql = require('mssql')
const { config } = require('./config')

let poolPromise

function getPool() {
  if (!poolPromise) {
    poolPromise = sql.connect(config.sqlConnectionString)
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
