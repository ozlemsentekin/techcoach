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
const BOOK_NAME = '8. Sınıf Fen Bilimleri Soru Bankası'

async function main() {
  loadLocalSettings()
  const pool = await sql.connect(process.env.SQL_CONNECTION_STRING)
  try {
    const bookResult = await new sql.Request(pool)
      .input('publisherName', sql.NVarChar(150), PUBLISHER_NAME)
      .input('bookName', sql.NVarChar(200), BOOK_NAME).query(`
        SELECT rb.id, rb.name, rb.created_at, p.name AS publisher
        FROM dbo.ResourceBooks rb
        INNER JOIN dbo.Publishers p ON p.id = rb.publisher_id
        WHERE p.name = @publisherName AND rb.name = @bookName;
      `)
    console.log('Eşleşen kitaplar:', bookResult.recordset)
    if (!bookResult.recordset.length) return
    const bookId = bookResult.recordset[0].id

    const guard = await new sql.Request(pool).input('b', sql.UniqueIdentifier, bookId).query(`
      SELECT
        (SELECT COUNT(*) FROM dbo.Tasks WHERE resource_book_id = @b) AS tasks,
        (SELECT COUNT(*) FROM dbo.Homeworks WHERE resource_book_id = @b) AS homeworks,
        (SELECT COUNT(*) FROM dbo.StudentResourceBooks WHERE resource_book_id = @b) AS student_books,
        (SELECT COUNT(*) FROM dbo.StudentTeacherResourceBooks WHERE resource_book_id = @b) AS teacher_books,
        (SELECT COUNT(*) FROM dbo.ResourceBookTopics WHERE resource_book_id = @b) AS topics,
        (SELECT COUNT(*) FROM dbo.ResourceBookTopicTests tt JOIN dbo.ResourceBookTopics t ON t.id = tt.topic_id WHERE t.resource_book_id = @b) AS tests,
        (SELECT COUNT(*) FROM dbo.TestAnswerKeys ak JOIN dbo.ResourceBookTopicTests tt ON tt.id = ak.test_id JOIN dbo.ResourceBookTopics t ON t.id = tt.topic_id WHERE t.resource_book_id = @b) AS answer_keys,
        (SELECT COUNT(*) FROM dbo.Questions q JOIN dbo.ResourceBookTopicTests tt ON tt.id = q.test_id JOIN dbo.ResourceBookTopics t ON t.id = tt.topic_id WHERE t.resource_book_id = @b) AS questions,
        (SELECT COUNT(*) FROM dbo.StudentManualTestCompletions x JOIN dbo.ResourceBookTopicTests tt ON tt.id = x.test_id JOIN dbo.ResourceBookTopics t ON t.id = tt.topic_id WHERE t.resource_book_id = @b) AS manual_completions,
        (SELECT COUNT(*) FROM dbo.WrongQuestions x JOIN dbo.ResourceBookTopicTests tt ON tt.id = x.test_id JOIN dbo.ResourceBookTopics t ON t.id = tt.topic_id WHERE t.resource_book_id = @b) AS wrong_questions;
    `)
    console.log('Bağımlı kayıt sayıları:', guard.recordset[0])

    const who = await new sql.Request(pool).input('b', sql.UniqueIdentifier, bookId).query(`
      SELECT 'student' AS kind, u.full_name, srb.created_at
      FROM dbo.StudentResourceBooks srb JOIN dbo.Users u ON u.id = srb.student_user_id
      WHERE srb.resource_book_id = @b
      UNION ALL
      SELECT 'teacher-assigned' AS kind, u.full_name, strb.created_at
      FROM dbo.StudentTeacherResourceBooks strb JOIN dbo.Users u ON u.id = strb.student_user_id
      WHERE strb.resource_book_id = @b;
    `)
    console.log('Kime atanmış:', who.recordset)
  } finally {
    await pool.close()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
