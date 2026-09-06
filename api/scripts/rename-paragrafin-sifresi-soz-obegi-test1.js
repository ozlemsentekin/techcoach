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

// "Paragrafın Şifresi" / "1. Söz Öbeği Metodu" — ilk testin adı "1.Test" olarak
// girilmiş; diğer testlerle ("Test 2" ...) tutarlı olması için "Test 1" yapılır.
const RESOURCE_BOOK_ID = 'F9639A95-BC60-4DF9-96F5-D80FC1161799'
const TEST_ID = 'CEDEB2D0-010D-4AB5-A048-FE2603AAF203'
const OLD_NAME = '1.Test'
const NEW_NAME = 'Test 1'

async function main() {
  loadLocalSettings()
  if (!process.env.SQL_CONNECTION_STRING) throw new Error('SQL_CONNECTION_STRING is missing.')

  const pool = await sql.connect(process.env.SQL_CONNECTION_STRING)
  try {
    const res = await pool
      .request()
      .input('id', sql.UniqueIdentifier, TEST_ID)
      .input('oldName', sql.NVarChar(200), OLD_NAME)
      .input('newName', sql.NVarChar(200), NEW_NAME)
      .query('UPDATE dbo.ResourceBookTopicTests SET name = @newName WHERE id = @id AND name = @oldName;')
    console.log(`"${OLD_NAME}" -> "${NEW_NAME}": ${res.rowsAffected[0]} satır`)

    const check = await pool
      .request()
      .input('rbId', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
      .query(`
        SELECT tt.name, tt.question_count AS qc,
          (SELECT COUNT(*) FROM dbo.TestAnswerKeys k WHERE k.test_id = tt.id) AS keys
        FROM dbo.ResourceBookTopicTests tt
        INNER JOIN dbo.ResourceBookTopics t ON t.id = tt.topic_id
        WHERE t.resource_book_id = @rbId AND t.name LIKE N'1.%'
        ORDER BY tt.page_start;
      `)
    console.table(check.recordset)
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error('Rename failed')
  console.error(error)
  process.exit(1)
})
