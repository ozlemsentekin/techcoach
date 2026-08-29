// Geçici teşhis scripti: telefon numarasına göre kullanıcıyı ve bağlı kayıtları listeler.
// Usage: node api/scripts/lookup-test-user.js <phone>
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
  const phone = process.argv[2]
  if (!phone) {
    console.error('Usage: node lookup-test-user.js <phone>')
    process.exit(1)
  }

  loadLocalSettings()
  const pool = await sql.connect(process.env.SQL_CONNECTION_STRING)
  try {
    const users = await pool.request()
      .input('phone', sql.NVarChar(20), phone)
      .query('SELECT id, full_name, phone_number, email, role, created_at FROM dbo.Users WHERE phone_number = @phone;')
    console.log('Users:', JSON.stringify(users.recordset, null, 2))

    if (users.recordset[0]) {
      const id = users.recordset[0].id
      const ent = await pool.request()
        .input('id', sql.UniqueIdentifier, id)
        .query('SELECT * FROM dbo.Entitlements WHERE parent_id = @id;')
      console.log('Entitlements:', JSON.stringify(ent.recordset, null, 2))

      const students = await pool.request()
        .input('id', sql.UniqueIdentifier, id)
        .query('SELECT id, full_name FROM dbo.Users WHERE parent_id = @id;')
      console.log('Students (children):', JSON.stringify(students.recordset, null, 2))
    }
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
