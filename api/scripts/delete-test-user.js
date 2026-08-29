// Geçici teşhis scripti: telefon numarasına göre bir test kullanıcısını (ve 1:1 entitlement
// satırlarını) siler. admin.js deleteUserHandler ile aynı silme sırasını izler.
// Usage: node api/scripts/delete-test-user.js <phone>
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
    console.error('Usage: node delete-test-user.js <phone>')
    process.exit(1)
  }

  loadLocalSettings()
  const pool = await sql.connect(process.env.SQL_CONNECTION_STRING)
  try {
    const userResult = await pool.request()
      .input('phone', sql.NVarChar(20), phone)
      .query('SELECT id, full_name FROM dbo.Users WHERE phone_number = @phone;')
    const user = userResult.recordset[0]
    if (!user) {
      console.log('Kullanıcı bulunamadı, silinecek bir şey yok.')
      return
    }

    console.log('Siliniyor:', user.full_name, user.id)
    const transaction = new sql.Transaction(pool)
    await transaction.begin()
    try {
      await transaction.request().input('id', sql.UniqueIdentifier, user.id).query('DELETE FROM dbo.Entitlements WHERE parent_id = @id;')
      await transaction.request().input('id', sql.UniqueIdentifier, user.id).query('DELETE FROM dbo.TeacherEntitlements WHERE teacher_id = @id;')
      const result = await transaction.request().input('id', sql.UniqueIdentifier, user.id).query('DELETE FROM dbo.Users WHERE id = @id;')
      await transaction.commit()
      console.log('Silindi, etkilenen satır:', result.rowsAffected[0])
    } catch (error) {
      await transaction.rollback()
      throw error
    }
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
