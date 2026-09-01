const fs = require('fs')
const path = require('path')
const sql = require('mssql')

// "2. Fasikül - Üslü İfadeler" (Fenomen Yayınları / Matematik / 8) kaynağının
// pasif (is_active = 0) mükerrer kopyaları. Aktif/çalışan kopya
// A3DA7443-327B-42DC-B689-779DB17431DB kullanıcı tarafından yeniden oluşturuldu ve
// bu scriptin dışında bırakıldı.
const TARGET_IDS = [
  'F7F386C5-A059-4585-BE57-8C1CA368F3D9',
  '60F02F54-80E0-480C-901F-A17780410299',
  '2D3383FD-A5B6-4DCA-9FB5-8F3ECA3AF2DD',
]
const EXPECTED_NAME = '2. Fasikül - Üslü İfadeler'

function loadLocalSettings() {
  const p = path.join(__dirname, '..', 'local.settings.json')
  const parsed = JSON.parse(fs.readFileSync(p, 'utf8'))
  Object.entries(parsed.Values || {}).forEach(([k, v]) => {
    if (!process.env[k] && typeof v === 'string') process.env[k] = v
  })
}

async function main() {
  loadLocalSettings()
  const connectionString = process.env.SQL_CONNECTION_STRING
  if (!connectionString) throw new Error('SQL_CONNECTION_STRING eksik.')

  const pool = await sql.connect(connectionString)
  const tx = new sql.Transaction(pool)
  await tx.begin()
  try {
    for (const bookId of TARGET_IDS) {
      const meta = await new sql.Request(tx).input('b', sql.UniqueIdentifier, bookId).query(`
        SELECT rb.id, rb.name, rb.is_active, p.name AS publisher_name
        FROM dbo.ResourceBooks rb
        LEFT JOIN dbo.Publishers p ON p.id = rb.publisher_id
        WHERE rb.id = @b;
      `)
      if (!meta.recordset.length) throw new Error(`ResourceBook bulunamadı: ${bookId}`)
      const b = meta.recordset[0]
      console.log(`\nResourceBook ${bookId} — "${b.name}" / ${b.publisher_name} / aktif=${b.is_active}`)

      if (b.name !== EXPECTED_NAME) throw new Error(`Beklenmeyen ad: "${b.name}" (bekleniyordu "${EXPECTED_NAME}")`)
      if (b.publisher_name !== 'Fenomen Yayınları') throw new Error(`Beklenmeyen yayın evi: ${b.publisher_name}`)
      if (b.is_active) throw new Error('Kaynak AKTİF — silme durduruldu (yalnızca pasif kopyalar silinir).')

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
      console.log('  bağımlı kayıtlar:', g)
      const blocking = Object.entries(g).filter(([, v]) => v > 0)
      if (blocking.length) {
        throw new Error(`Bağımlı kayıt var, silme durduruldu: ${blocking.map(([k, v]) => `${k}=${v}`).join(', ')}`)
      }

      const del = async (label, query) => {
        const r = await new sql.Request(tx).input('b', sql.UniqueIdentifier, bookId).query(query)
        console.log(`  - ${label}: ${r.rowsAffected[0]} satır silindi`)
      }

      await del('TestAnswerKeys',
        `DELETE ak FROM dbo.TestAnswerKeys ak
         JOIN dbo.ResourceBookTopicTests tt ON tt.id = ak.test_id
         JOIN dbo.ResourceBookTopics t ON t.id = tt.topic_id
         WHERE t.resource_book_id = @b;`)
      await del('ResourceBookTopicTests',
        `DELETE tt FROM dbo.ResourceBookTopicTests tt
         JOIN dbo.ResourceBookTopics t ON t.id = tt.topic_id
         WHERE t.resource_book_id = @b;`)
      await del('ResourceBookTopics', `DELETE FROM dbo.ResourceBookTopics WHERE resource_book_id = @b;`)
      await del('ResourceBooks', `DELETE FROM dbo.ResourceBooks WHERE id = @b;`)
    }

    await tx.commit()
    console.log('\n3 pasif kopya silindi ve commit edildi.')
  } catch (error) {
    await tx.rollback()
    console.error('\nHata — rollback yapıldı, hiçbir şey silinmedi.')
    throw error
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
