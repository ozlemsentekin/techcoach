// MEB 2027 LGS Böyle Sorar Soru Bankası - Fen Bilimleri - 8. Sınıf
// 1. Ünite testleri zaten admin panelinden eklenmişti; 2. ve 3. ünitelerin testleri
// bu script ile oluşturuldu (sayfa no'ları içindekiler ekranındaki ünite başlangıç
// sayfalarına göre orantılı dağıtıldı). Ardından her 3 ünitenin cevap anahtarı,
// kitabın kendi "Cevap Anahtarı" sayfalarından transkribe edilerek eklendi.
const fs = require('fs')
const path = require('path')
const sql = require('mssql')

function loadLocalSettings() {
  const p = path.join(__dirname, '..', 'local.settings.json')
  const parsed = JSON.parse(fs.readFileSync(p, 'utf8'))
  Object.entries(parsed.Values || {}).forEach(([k, v]) => {
    if (!process.env[k] && typeof v === 'string') process.env[k] = v
  })
}

// Yeni test kayıtları oluşturulacak üniteler (1. ünitenin 5 testi zaten mevcut).
const NEW_TESTS_BY_TOPIC = {
  'A8F68FC2-ADEE-45D4-B90E-3E14EF9B2A3C': [
    // 2. Ünite - DNA ve Genetik Kod (sayfa 47-96 arası, 3. ünite 97'de başlıyor)
    { name: 'Test1', pageStart: 47, pageEnd: 53 },
    { name: 'Test2', pageStart: 54, pageEnd: 60 },
    { name: 'Test3', pageStart: 61, pageEnd: 67 },
    { name: 'Test4', pageStart: 68, pageEnd: 74 },
    { name: 'Test5', pageStart: 75, pageEnd: 81 },
    { name: 'Test6', pageStart: 82, pageEnd: 88 },
    { name: 'Test7', pageStart: 89, pageEnd: 96 },
  ],
  'F7098DCF-38C9-4B34-AC69-A7DEE2C35932': [
    // 3. Ünite - Basınç (sayfa 97-140 arası, 4. ünite 141'de başlıyor)
    { name: 'Test1', pageStart: 97, pageEnd: 103 },
    { name: 'Test2', pageStart: 104, pageEnd: 110 },
    { name: 'Test3', pageStart: 111, pageEnd: 117 },
    { name: 'Test4', pageStart: 118, pageEnd: 124 },
    { name: 'Test5', pageStart: 125, pageEnd: 131 },
    { name: 'Test6', pageStart: 132, pageEnd: 140 },
  ],
}

// Kitabın kendi cevap anahtarı sayfalarından transkribe edildi (20 soru/test).
const ANSWERS_BY_TOPIC = {
  'E0F4C57B-6840-4CEE-B408-F24F2FE4E8C6': {
    // 1. Ünite - Mevsimler ve İklim
    1: 'AAABCDDADDDCBDCADABA',
    2: 'ADCCBABABCDDDBADDBAA',
    3: 'BBBDCDCCACDBBBAABABA',
    4: 'DCDDCDABBDCCACCCAACB',
    5: 'ADDDDDBDCCCDDBDADDDC',
  },
  'A8F68FC2-ADEE-45D4-B90E-3E14EF9B2A3C': {
    // 2. Ünite - DNA ve Genetik Kod
    1: 'DDBDAACCDDDDBBBDCDCD',
    2: 'DACACDBBBCBCCBCCADCC',
    3: 'DCDDACDABDBBADDCCCBA',
    4: 'DADAAACBADDCDCABDDAC',
    5: 'DACCDCADABBDBDCBDDDD',
    6: 'AADCBBBCABDBDBBDBBAC',
    7: 'DDCBDCBABDCCDDDACBAC',
  },
  'F7098DCF-38C9-4B34-AC69-A7DEE2C35932': {
    // 3. Ünite - Basınç
    1: 'DDBCCBBDAACBDBADDAAB',
    2: 'BDACABCBBBDBACDCBBDC',
    3: 'CADCDDDABBBDCAADBADD',
    4: 'BCAAACACBBDDDDBCBDBB',
    5: 'DBCDDCDBBACDDADDCAAD',
    6: 'CDDBACDBACCBADDDCBBA',
  },
}

async function main() {
  loadLocalSettings()
  const pool = await sql.connect(process.env.SQL_CONNECTION_STRING)
  try {
    let testsCreated = 0
    for (const [topicId, tests] of Object.entries(NEW_TESTS_BY_TOPIC)) {
      const existing = await pool
        .request()
        .input('topicId', sql.UniqueIdentifier, topicId)
        .query('SELECT COUNT(*) AS cnt FROM dbo.ResourceBookTopicTests WHERE topic_id = @topicId;')
      if (existing.recordset[0].cnt > 0) {
        console.log(`Skip (testler zaten var): topic ${topicId}`)
        continue
      }
      for (const test of tests) {
        const pageCount = test.pageEnd - test.pageStart + 1
        await pool
          .request()
          .input('topicId', sql.UniqueIdentifier, topicId)
          .input('name', sql.NVarChar(200), test.name)
          .input('pageStart', sql.Int, test.pageStart)
          .input('pageEnd', sql.Int, test.pageEnd)
          .input('pageCount', sql.Int, pageCount)
          .query(`
            INSERT INTO dbo.ResourceBookTopicTests (topic_id, name, page_start, page_end, page_count)
            VALUES (@topicId, @name, @pageStart, @pageEnd, @pageCount);
          `)
        testsCreated += 1
        console.log(`+ Test oluşturuldu: ${test.name} (s.${test.pageStart}-${test.pageEnd})`)
      }
    }
    console.log(`Oluşturulan test sayısı: ${testsCreated}`)

    let answersInserted = 0
    for (const [topicId, answers] of Object.entries(ANSWERS_BY_TOPIC)) {
      const testsResult = await pool
        .request()
        .input('topicId', sql.UniqueIdentifier, topicId)
        .query('SELECT id, name FROM dbo.ResourceBookTopicTests WHERE topic_id = @topicId;')
      const testIdByName = new Map(testsResult.recordset.map((r) => [r.name, r.id]))

      for (const [testNo, letters] of Object.entries(answers)) {
        const testName = `Test${testNo}`
        const testId = testIdByName.get(testName)
        if (!testId) throw new Error(`Test not found: topic ${topicId} / ${testName}`)

        const existingKeys = await pool
          .request()
          .input('testId', sql.UniqueIdentifier, testId)
          .query('SELECT COUNT(*) AS cnt FROM dbo.TestAnswerKeys WHERE test_id = @testId;')
        if (existingKeys.recordset[0].cnt > 0) {
          console.log(`Skip (cevap anahtarı zaten var): ${testName}`)
          continue
        }

        const labels = letters.split('')
        const values = []
        const request = pool.request().input('testId', sql.UniqueIdentifier, testId)
        labels.forEach((label, idx) => {
          request.input(`order${idx}`, sql.Int, idx + 1)
          request.input(`label${idx}`, sql.NChar(1), label)
          values.push(`(@testId, @order${idx}, @label${idx})`)
        })
        await request.query(`
          INSERT INTO dbo.TestAnswerKeys (test_id, order_no, correct_label)
          VALUES ${values.join(', ')};
        `)

        await pool
          .request()
          .input('testId', sql.UniqueIdentifier, testId)
          .input('questionCount', sql.Int, labels.length)
          .query('UPDATE dbo.ResourceBookTopicTests SET question_count = @questionCount WHERE id = @testId;')

        answersInserted += 1
        console.log(`${testName}: ${labels.length} cevap eklendi`)
      }
    }
    console.log(`Cevap anahtarı eklenen test sayısı: ${answersInserted}`)
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error('Seed failed')
  console.error(error)
  process.exit(1)
})
