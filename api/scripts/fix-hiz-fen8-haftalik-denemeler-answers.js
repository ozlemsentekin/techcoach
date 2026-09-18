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

const PUBLISHER_NAME = 'Hız Yayınları'
const BOOK_NAME = '8. Sınıf Fen Bilimleri 36 Haftalık Kazanım Denemeleri'

// Corrections confirmed against the book's own "Yanıt Anahtarı" summary page photos.
// [deneme_no, order_no, expected_current_label, new_label]
const FIXES = [
  [1, 12, 'B', 'C'],
  [1, 13, 'A', 'B'],
  [3, 13, 'A', 'B'],
  [3, 19, 'C', 'D'],
  [3, 20, 'D', 'C'],
  [6, 17, 'C', 'B'],
  [6, 18, 'B', 'D'],
  [12, 8, 'A', 'C'],
  [12, 15, 'A', 'C'],
  [12, 16, 'C', 'A'],
  [13, 3, 'B', 'D'],
  [13, 4, 'D', 'B'],
  [13, 5, 'B', 'D'],
  [15, 17, 'B', 'C'],
  [15, 18, 'C', 'B'],
  [15, 20, 'D', 'B'],
  [16, 14, 'D', 'B'],
  [18, 12, 'A', 'B'],
  [18, 16, 'D', 'B'],
  [18, 20, 'D', 'C'],
  [21, 11, 'C', 'B'],
  [21, 13, 'D', 'C'],
  [21, 14, 'C', 'D'],
  [23, 13, 'A', 'D'],
  [23, 15, 'B', 'D'],
  [23, 16, 'D', 'B'],
  [29, 6, 'C', 'D'],
  [29, 8, 'C', 'A'],
  [34, 12, 'A', 'B'],
  [34, 20, 'D', 'B'],
  [36, 19, 'D', 'C'],
  [36, 20, 'C', 'D'],
  [41, 14, 'D', 'C'],
  [41, 20, 'C', 'D'],
]

async function main() {
  loadLocalSettings()
  const connectionString = process.env.SQL_CONNECTION_STRING
  if (!connectionString) throw new Error('SQL_CONNECTION_STRING is missing.')

  const pool = await sql.connect(connectionString)
  try {
    const bookResult = await pool
      .request()
      .input('publisherName', sql.NVarChar(150), PUBLISHER_NAME)
      .input('bookName', sql.NVarChar(200), BOOK_NAME).query(`
        SELECT rb.id FROM dbo.ResourceBooks rb
        INNER JOIN dbo.Publishers p ON p.id = rb.publisher_id
        WHERE p.name = @publisherName AND rb.name = @bookName;
      `)
    if (!bookResult.recordset.length) throw new Error('ResourceBook not found')
    const resourceBookId = bookResult.recordset[0].id

    const testsResult = await pool
      .request()
      .input('resourceBookId', sql.UniqueIdentifier, resourceBookId).query(`
        SELECT tt.id, tt.name
        FROM dbo.ResourceBookTopicTests tt
        INNER JOIN dbo.ResourceBookTopics t ON t.id = tt.topic_id
        WHERE t.resource_book_id = @resourceBookId;
      `)
    const testIdByNo = new Map()
    testsResult.recordset.forEach((r) => {
      const no = parseInt(r.name.replace(/\D/g, ''), 10)
      testIdByNo.set(no, r.id)
    })

    let updated = 0
    for (const [denemeNo, orderNo, expectedCurrent, newLabel] of FIXES) {
      const testId = testIdByNo.get(denemeNo)
      if (!testId) throw new Error(`Deneme ${denemeNo}: test not found`)

      const current = await pool
        .request()
        .input('testId', sql.UniqueIdentifier, testId)
        .input('orderNo', sql.Int, orderNo)
        .query('SELECT correct_label FROM dbo.TestAnswerKeys WHERE test_id = @testId AND order_no = @orderNo;')

      if (!current.recordset.length) {
        console.log(`Deneme ${denemeNo} soru ${orderNo}: kayıt yok, atlandı`)
        continue
      }
      const currentLabel = current.recordset[0].correct_label.trim()
      if (currentLabel !== expectedCurrent) {
        console.log(
          `Deneme ${denemeNo} soru ${orderNo}: beklenmedik mevcut değer (${currentLabel}, beklenen ${expectedCurrent}), atlandı`
        )
        continue
      }
      if (currentLabel === newLabel) {
        console.log(`Deneme ${denemeNo} soru ${orderNo}: zaten ${newLabel}, atlandı`)
        continue
      }

      await pool
        .request()
        .input('testId', sql.UniqueIdentifier, testId)
        .input('orderNo', sql.Int, orderNo)
        .input('newLabel', sql.NChar(1), newLabel)
        .query('UPDATE dbo.TestAnswerKeys SET correct_label = @newLabel WHERE test_id = @testId AND order_no = @orderNo;')
      updated += 1
      console.log(`Deneme ${denemeNo} soru ${orderNo}: ${currentLabel} -> ${newLabel}`)
    }

    console.log(`Done. Güncellenen hücre: ${updated}/${FIXES.length}`)
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error('Fix failed')
  console.error(error)
  process.exit(1)
})
