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

// "Deyimler, Atasözleri ve Özdeyişler" (Fenomen Yayınları) — "2. Bölüm - Atasözleri".
// Fotoğrafla (her cevabın yanında soru no: "1.D 2.A ...") karşılaştırıldı: 18/20 test zaten
// doğruydu, Test 10 (soru 6: D -> B) ve Test 16 (soru 8: B -> A) tek harflik hataydı.
// Hiçbir öğrenci bu iki testi çözmemiş (StudentManualTestCompletions / Tasks: 0 kayıt) —
// yeniden notlama gerekmiyor.
const ATASOZLERI_TOPIC_ID = 'DC303B57-AF1C-46C1-A90D-35D4F5D02916'

const ANSWERS = {
  10: 'BBAADBBBBDAD',
  16: 'BADBCBBAAAD',
}

async function main() {
  loadLocalSettings()
  if (!process.env.SQL_CONNECTION_STRING) throw new Error('SQL_CONNECTION_STRING is missing.')

  const pool = await sql.connect(process.env.SQL_CONNECTION_STRING)
  try {
    const rows = await pool.request().input('tid', sql.UniqueIdentifier, ATASOZLERI_TOPIC_ID).query(`
      SELECT tt.id, tt.name, tt.question_count,
        (SELECT STRING_AGG(CAST(correct_label AS NVARCHAR(2)), '') WITHIN GROUP (ORDER BY order_no)
         FROM dbo.TestAnswerKeys k WHERE k.test_id = tt.id) AS seq
      FROM dbo.ResourceBookTopicTests tt WHERE tt.topic_id = @tid AND tt.name IN ('Test 10', 'Test 16');`)
    if (rows.recordset.length !== 2) throw new Error(`Beklenen 2 test, bulunan ${rows.recordset.length}`)

    for (const row of rows.recordset) {
      const no = parseInt((row.name.match(/\d+/) || [])[0], 10)
      const want = ANSWERS[no]
      if (row.seq === want && row.question_count === want.length) {
        console.log(`${row.name}: değişiklik yok (${want})`)
        continue
      }
      console.log(`${row.name}: ${row.seq} (qc=${row.question_count})  ->  ${want} (qc=${want.length})`)

      const tx = new sql.Transaction(pool)
      await tx.begin()
      try {
        await new sql.Request(tx).input('id', sql.UniqueIdentifier, row.id).query('DELETE FROM dbo.TestAnswerKeys WHERE test_id = @id;')
        const ins = new sql.Request(tx).input('id', sql.UniqueIdentifier, row.id)
        const vals = []
        want.split('').forEach((l, i) => {
          ins.input(`o${i}`, sql.Int, i + 1)
          ins.input(`l${i}`, sql.NChar(1), l)
          vals.push(`(@id, @o${i}, @l${i})`)
        })
        await ins.query(`INSERT INTO dbo.TestAnswerKeys (test_id, order_no, correct_label) VALUES ${vals.join(', ')};`)
        await new sql.Request(tx).input('id', sql.UniqueIdentifier, row.id).input('qc', sql.Int, want.length)
          .query('UPDATE dbo.ResourceBookTopicTests SET question_count = @qc WHERE id = @id;')
        await tx.commit()
      } catch (e) {
        await tx.rollback()
        throw e
      }
    }
    console.log('\nBitti. (Bu iki testi çözen öğrenci yok, yeniden notlama gerekmedi.)')
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error('Fix failed')
  console.error(error)
  process.exit(1)
})
