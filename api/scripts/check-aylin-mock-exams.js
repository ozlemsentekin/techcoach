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
  loadLocalSettings()
  const connectionString = process.env.SQL_CONNECTION_STRING
  if (!connectionString) throw new Error('SQL_CONNECTION_STRING is missing.')

  const pool = await sql.connect(connectionString)
  try {
    const result = await pool
      .request()
      .input('studentId', sql.UniqueIdentifier, '427246B1-A97D-4611-B393-D5F6C1AB6915')
      .query(`
        SELECT e.id, e.kind, e.exam_date, e.title, e.class_label, e.school_label, e.created_at
        FROM dbo.MockExams e
        WHERE e.student_id = @studentId
        ORDER BY e.exam_date DESC, e.created_at DESC;
      `)
    console.log(`${result.recordset.length} deneme kaydı bulundu:`)
    for (const row of result.recordset) {
      console.log(
        `  - id=${row.id} kind=${row.kind} date=${row.exam_date?.toISOString?.().slice(0, 10)} title="${row.title}" class=${row.class_label} school=${row.school_label}`,
      )
    }
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
