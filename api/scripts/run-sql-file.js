// One-off helper to apply a hand-written .sql migration file (with GO batch separators)
// against SQL_CONNECTION_STRING. Usage: node api/scripts/run-sql-file.js api/sql/<file>.sql
const fs = require('fs')
const path = require('path')
const sql = require('mssql')

const localSettingsPath = path.join(__dirname, '..', 'local.settings.json')

function loadLocalSettings() {
  if (!fs.existsSync(localSettingsPath)) return
  const parsed = JSON.parse(fs.readFileSync(localSettingsPath, 'utf8'))
  Object.entries(parsed.Values || {}).forEach(([key, value]) => {
    if (!process.env[key] && typeof value === 'string') process.env[key] = value
  })
}

async function main() {
  const filePath = process.argv[2]
  if (!filePath) {
    console.error('Usage: node run-sql-file.js <path-to-sql-file>')
    process.exit(1)
  }

  loadLocalSettings()
  const connectionString = process.env.SQL_CONNECTION_STRING
  if (!connectionString) {
    throw new Error('SQL_CONNECTION_STRING is missing.')
  }

  const content = fs.readFileSync(filePath, 'utf8')
  const batches = content
    .split(/\r?\n\s*GO\s*\r?\n?/i)
    .map((batch) => batch.trim())
    .filter(Boolean)

  console.log(`Applying ${filePath} (${batches.length} batches)...`)

  const pool = await sql.connect(connectionString)
  try {
    for (let i = 0; i < batches.length; i += 1) {
      try {
        await pool.request().query(batches[i])
      } catch (error) {
        console.error(`Batch ${i + 1}/${batches.length} failed:`)
        console.error(batches[i].slice(0, 300))
        throw error
      }
    }
    console.log(`Done: ${batches.length} batches applied successfully.`)
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
