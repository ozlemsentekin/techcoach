const fs = require('fs')
const path = require('path')
const sql = require('mssql')

const localSettingsPath = path.join(__dirname, '..', 'local.settings.json')

function loadLocalSettings() {
  if (!fs.existsSync(localSettingsPath)) return
  const parsed = JSON.parse(fs.readFileSync(localSettingsPath, 'utf8'))
  Object.entries(parsed.Values || {}).forEach(([key, value]) => {
    if (!process.env[key] && typeof value === 'string') {
      process.env[key] = value
    }
  })
}

const PUBLISHER_NAME = 'Hız Yayınları'
const BOOK_NAME = '8. Sınıf Fen Bilimleri Soru Bankası'

async function main() {
  loadLocalSettings()
  const connectionString = process.env.SQL_CONNECTION_STRING
  if (!connectionString) throw new Error('SQL_CONNECTION_STRING eksik.')

  const pool = await sql.connect(connectionString)
  const tx = new sql.Transaction(pool)
  await tx.begin()
  try {
    const bookResult = await new sql.Request(tx)
      .input('publisherName', sql.NVarChar(150), PUBLISHER_NAME)
      .input('bookName', sql.NVarChar(200), BOOK_NAME).query(`
        SELECT rb.id
        FROM dbo.ResourceBooks rb
        INNER JOIN dbo.Publishers p ON p.id = rb.publisher_id
        WHERE p.name = @publisherName AND rb.name = @bookName;
      `)
    if (!bookResult.recordset.length) throw new Error(`ResourceBook bulunamadı: ${BOOK_NAME}`)
    const bookId = bookResult.recordset[0].id
    console.log(`ResourceBook: ${BOOK_NAME} -> ${bookId}`)

    // Bağımlı kayıtların hiçbirinin bulunmadığını doğrula (öğrenci/öğretmen verisi).
    const guard = await new sql.Request(tx).input('b', sql.UniqueIdentifier, bookId).query(`
      SELECT
        (SELECT COUNT(*) FROM dbo.Tasks WHERE resource_book_id = @b) AS tasks,
        (SELECT COUNT(*) FROM dbo.Homeworks WHERE resource_book_id = @b) AS homeworks,
        (SELECT COUNT(*) FROM dbo.StudentResourceBooks WHERE resource_book_id = @b) AS student_books,
        (SELECT COUNT(*) FROM dbo.StudentTeacherResourceBooks WHERE resource_book_id = @b) AS teacher_books,
        (SELECT COUNT(*) FROM dbo.Questions q
           JOIN dbo.ResourceBookTopicTests tt ON tt.id = q.test_id
           JOIN dbo.ResourceBookTopics t ON t.id = tt.topic_id
           WHERE t.resource_book_id = @b) AS questions,
        (SELECT COUNT(*) FROM dbo.StudentManualTestCompletions x
           JOIN dbo.ResourceBookTopicTests tt ON tt.id = x.test_id
           JOIN dbo.ResourceBookTopics t ON t.id = tt.topic_id
           WHERE t.resource_book_id = @b) AS manual_completions,
        (SELECT COUNT(*) FROM dbo.WrongQuestions x
           JOIN dbo.ResourceBookTopicTests tt ON tt.id = x.test_id
           JOIN dbo.ResourceBookTopics t ON t.id = tt.topic_id
           WHERE t.resource_book_id = @b) AS wrong_questions;
    `)
    const g = guard.recordset[0]
    console.log('Bağımlı kayıt sayıları:', g)
    const blocking = Object.entries(g).filter(([, v]) => v > 0)
    if (blocking.length) {
      throw new Error(`Bağımlı kayıt var, silme durduruldu: ${blocking.map(([k, v]) => `${k}=${v}`).join(', ')}`)
    }

    const del = async (label, query) => {
      const r = await new sql.Request(tx).input('b', sql.UniqueIdentifier, bookId).query(query)
      console.log(`  - ${label}: ${r.rowsAffected[0]} satır silindi`)
    }

    await del(
      'TestAnswerKeys',
      `DELETE ak FROM dbo.TestAnswerKeys ak
       JOIN dbo.ResourceBookTopicTests tt ON tt.id = ak.test_id
       JOIN dbo.ResourceBookTopics t ON t.id = tt.topic_id
       WHERE t.resource_book_id = @b;`,
    )
    await del(
      'ResourceBookTopicTests',
      `DELETE tt FROM dbo.ResourceBookTopicTests tt
       JOIN dbo.ResourceBookTopics t ON t.id = tt.topic_id
       WHERE t.resource_book_id = @b;`,
    )
    await del('ResourceBookTopics', `DELETE FROM dbo.ResourceBookTopics WHERE resource_book_id = @b;`)
    await del('ResourceBooks', `DELETE FROM dbo.ResourceBooks WHERE id = @b;`)

    await tx.commit()
    console.log('Hard delete tamamlandı ve commit edildi.')
  } catch (error) {
    await tx.rollback()
    console.error('Hata — rollback yapıldı.')
    throw error
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
