const sql = require('mssql')
const { getConfig } = require('./config')

let poolPromise
let poolConnectionString

function getPool() {
  const { sqlConnectionString } = getConfig()

  if (!poolPromise || poolConnectionString !== sqlConnectionString) {
    poolConnectionString = sqlConnectionString
    poolPromise = sql.connect(sqlConnectionString).catch((error) => {
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
