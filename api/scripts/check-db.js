const fs = require('fs')
const path = require('path')
const sql = require('mssql')

const localSettingsPath = path.join(__dirname, '..', 'local.settings.json')

function loadLocalSettings() {
  if (!fs.existsSync(localSettingsPath)) {
    return
  }

  const parsed = JSON.parse(fs.readFileSync(localSettingsPath, 'utf8'))

  Object.entries(parsed.Values || {}).forEach(([key, value]) => {
    if (!process.env[key] && typeof value === 'string') {
      process.env[key] = value
    }
  })
}

function assertConnectionString(connectionString) {
  if (!connectionString) {
    throw new Error('SQL_CONNECTION_STRING is missing. Fill api/local.settings.json or export it in your shell.')
  }

  const placeholders = [
    'REPLACE_WITH_SQL_ADMIN_PASSWORD',
    '<server>',
    '<database>',
    '<user>',
    '<password>',
  ]

  if (placeholders.some((placeholder) => connectionString.includes(placeholder))) {
    throw new Error('SQL_CONNECTION_STRING still contains placeholder values.')
  }
}

async function main() {
  loadLocalSettings()

  const connectionString = process.env.SQL_CONNECTION_STRING
  assertConnectionString(connectionString)

  const pool = await sql.connect(connectionString)

  try {
    const result = await pool.request().query(`
      SELECT
        DB_NAME() AS database_name,
        @@SERVERNAME AS server_name,
        CASE WHEN OBJECT_ID('dbo.Users', 'U') IS NOT NULL THEN 1 ELSE 0 END AS users_table_exists,
        SYSUTCDATETIME() AS utc_now;
    `)

    const row = result.recordset[0]
    console.log('SQL connection OK')
    console.log(`Server: ${row.server_name}`)
    console.log(`Database: ${row.database_name}`)
    console.log(`Users table: ${row.users_table_exists ? 'present' : 'missing'}`)
    console.log(`UTC time: ${row.utc_now.toISOString()}`)
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error('SQL connection check failed')
  console.error(error.message)
  process.exit(1)
})
