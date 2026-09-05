const fs = require('fs')
const path = require('path')
const sql = require('mssql')

// "Fenomen Kök" (Fenomen Yayınları / Matematik / 8. Sınıf / Soru Bankası) — 2026-09-03'te
// oluşturulmuş, pasif, içeriksiz boş katalog kaydı. Kullanıcı isteğiyle kalıcı siliniyor.
// Aynı yayın evindeki "Fenomen Kök - Kalıcı Öğretici Kazanım Soru Mankası ..." ayrı kayıt,
// bu scriptin dışında.
const TARGET_ID = '4DAAC29B-6E95-4DC0-96CA-13616252DA3F'
const EXPECTED_NAME = 'Fenomen Kök'
const EXPECTED_PUBLISHER = 'Fenomen Yayınları'

function loadLocalSettings() {
  const p = path.join(__dirname, '..', 'local.settings.json')
  const parsed = JSON.parse(fs.readFileSync(p, 'utf8'))
  Object.entries(parsed.Values || {}).forEach(([k, v]) => {
    if (!process.env[k] && typeof v === 'string') process.env[k] = v
  })
}

async function main() {
  loadLocalSettings()
  if (!process.env.SQL_CONNECTION_STRING) throw new Error('SQL_CONNECTION_STRING eksik.')

  const pool = await sql.connect(process.env.SQL_CONNECTION_STRING)
  const tx = new sql.Transaction(pool)
  await tx.begin()
  try {
    const meta = await new sql.Request(tx).input('b', sql.UniqueIdentifier, TARGET_ID).query(`
      SELECT rb.id, rb.name, rb.is_active, p.name AS publisher_name
      FROM dbo.ResourceBooks rb
      LEFT JOIN dbo.Publishers p ON p.id = rb.publisher_id
      WHERE rb.id = @b;
    `)
    if (!meta.recordset.length) throw new Error(`ResourceBook bulunamadı: ${TARGET_ID}`)
    const b = meta.recordset[0]
    console.log(`ResourceBook ${TARGET_ID} — "${b.name}" / ${b.publisher_name} / aktif=${b.is_active}`)
    if (b.name !== EXPECTED_NAME) throw new Error(`Beklenmeyen ad: "${b.name}"`)
    if (b.publisher_name !== EXPECTED_PUBLISHER) throw new Error(`Beklenmeyen yayın evi: ${b.publisher_name}`)
    if (b.is_active) throw new Error('Kaynak AKTİF — silme durduruldu.')

    const guard = await new sql.Request(tx).input('b', sql.UniqueIdentifier, TARGET_ID).query(`
      SELECT
        (SELECT COUNT(*) FROM dbo.Tasks WHERE resource_book_id = @b) AS tasks,
        (SELECT COUNT(*) FROM dbo.Homeworks WHERE resource_book_id = @b) AS homeworks,
        (SELECT COUNT(*) FROM dbo.StudentResourceBooks WHERE resource_book_id = @b) AS student_books,
        (SELECT COUNT(*) FROM dbo.StudentTeacherResourceBooks WHERE resource_book_id = @b) AS teacher_books,
        (SELECT COUNT(*) FROM dbo.ResourceBookTopics WHERE resource_book_id = @b) AS topics,
        (SELECT COUNT(*) FROM dbo.ResourceBookTopicTests tt JOIN dbo.ResourceBookTopics t ON t.id = tt.topic_id WHERE t.resource_book_id = @b) AS tests,
        (SELECT COUNT(*) FROM dbo.Questions q JOIN dbo.ResourceBookTopicTests tt ON tt.id = q.test_id JOIN dbo.ResourceBookTopics t ON t.id = tt.topic_id WHERE t.resource_book_id = @b) AS questions,
        (SELECT COUNT(*) FROM dbo.StudentManualTestCompletions x JOIN dbo.ResourceBookTopicTests tt ON tt.id = x.test_id JOIN dbo.ResourceBookTopics t ON t.id = tt.topic_id WHERE t.resource_book_id = @b) AS manual_completions,
        (SELECT COUNT(*) FROM dbo.WrongQuestions x JOIN dbo.ResourceBookTopicTests tt ON tt.id = x.test_id JOIN dbo.ResourceBookTopics t ON t.id = tt.topic_id WHERE t.resource_book_id = @b) AS wrong_questions;
    `)
    const g = guard.recordset[0]
    console.log('bağımlı kayıtlar:', g)
    const blocking = Object.entries(g).filter(([, v]) => v > 0)
    if (blocking.length) {
      throw new Error(`Bağımlı kayıt var, silme durduruldu: ${blocking.map(([k, v]) => `${k}=${v}`).join(', ')}`)
    }

    const del = async (label, query) => {
      const r = await new sql.Request(tx).input('b', sql.UniqueIdentifier, TARGET_ID).query(query)
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

    await tx.commit()
    console.log('\nHard delete tamamlandı ve commit edildi.')
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
