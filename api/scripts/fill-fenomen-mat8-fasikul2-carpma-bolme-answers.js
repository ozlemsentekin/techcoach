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

// Fenomen "2. Fasikül - Üslü İfadeler" — "Üslü İfadelerde Çarpma ve Bölme İşlemi" İçeriği
// altındaki testlerin cevap anahtarları (kaynağın cevap anahtarı görsellerinden).
const RESOURCE_BOOK_ID = 'A3DA7443-327B-42DC-B689-779DB17431DB'
const TOPIC_NAME = 'Üslü İfadelerde Çarpma ve Bölme İşlemi'

// [test adı, cevaplar] — cevap sayısı, DB'deki question_count ile karşılaştırılıp
// uyuşmazsa o test atlanır (yanlış yazımı sessizce kaydetmemek için).
const TESTS = [
  ['Test 1', 'BCADDCCDDCACBD'], // 14
  ['Test 2', 'BDBDCBBCCBDAB'], // 13
  ['Test 3', 'DCBCDDBBBDB'], // 11
  ['Test 4', 'BBDBBBCBCC'], // 10
  ['Test 5', 'CCABDABBCADA'], // 12
  ['Test 6', 'BBACCCCD'], // 8
  ['Test 7', 'BBCACAAD'], // 8
  ['Test 8', 'ABBABABA'], // 8
  ['Test 9', 'CDABDC'], // 6 — question_count kaynakta yanlış (9) idi, kullanıcı teyidiyle 6'ya çekildi.
  ['Test 10', 'CBDBCCBD'], // 8
  ['Test 11', 'ACDAADBDCCCC'], // 12
  ['Test 12', 'ABCC'], // 4
  ["Üslü İfadelerde Çarpma ve Bölme İşlemi ile İlgili LGS'de Çıkmış Sorular", 'BBBCAAB'], // 7
]

async function main() {
  loadLocalSettings()
  if (!process.env.SQL_CONNECTION_STRING) throw new Error('SQL_CONNECTION_STRING is missing.')
  const pool = await sql.connect(process.env.SQL_CONNECTION_STRING)
  try {
    const rows = await pool
      .request()
      .input('rbId', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
      .input('topicName', sql.NVarChar(200), TOPIC_NAME).query(`
        SELECT tt.id, tt.name, tt.question_count,
          (SELECT COUNT(*) FROM dbo.TestAnswerKeys ak WHERE ak.test_id = tt.id) AS ak
        FROM dbo.ResourceBookTopics t
        INNER JOIN dbo.ResourceBookTopicTests tt ON tt.topic_id = t.id
        WHERE t.resource_book_id = @rbId AND t.name = @topicName;
      `)
    const byName = new Map(rows.recordset.map((r) => [r.name, r]))

    let inserted = 0
    let answerRows = 0
    const problems = []

    for (const [testName, answers] of TESTS) {
      const row = byName.get(testName)
      if (!row) {
        problems.push(`Bulunamadı: ${testName}`)
        continue
      }
      if (!/^[A-D]+$/.test(answers)) {
        problems.push(`Geçersiz cevap dizisi: ${testName} -> ${answers}`)
        continue
      }
      if (row.question_count !== answers.length) {
        problems.push(
          `Soru sayısı uyuşmuyor: ${testName} — DB ${row.question_count}, görsel ${answers.length}`,
        )
        continue
      }
      if (row.ak > 0) {
        console.log(`  ${testName}: zaten ${row.ak} cevap var, atlanıyor.`)
        continue
      }

      const req = pool.request().input('testId', sql.UniqueIdentifier, row.id)
      const values = []
      answers.split('').forEach((label, idx) => {
        req.input(`o${idx}`, sql.Int, idx + 1)
        req.input(`l${idx}`, sql.NChar(1), label)
        values.push(`(@testId, @o${idx}, @l${idx})`)
      })
      await req.query(`INSERT INTO dbo.TestAnswerKeys (test_id, order_no, correct_label) VALUES ${values.join(', ')};`)
      inserted += 1
      answerRows += answers.length
      console.log(`  ${testName}: ${answers.length} cevap eklendi.`)
    }

    console.log(`\nBitti. ${inserted} teste cevap anahtarı eklendi (${answerRows} satır).`)
    if (problems.length) {
      console.log('Sorunlar:')
      problems.forEach((p) => console.log(`  - ${p}`))
    }
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error('Fill failed')
  console.error(error)
  process.exit(1)
})
