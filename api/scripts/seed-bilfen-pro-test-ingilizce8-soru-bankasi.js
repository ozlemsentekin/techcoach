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

// Bilfen Yayınları — "Pro & Test Soru Bankası - İngilizce 8. Sınıf"
// (scope = 'catalog' / Kütüphane; kaynak panelde önceden oluşturuldu, bu script sadece
//  İÇERİK + TEST ADI + SAYFA NUMARASI + CEVAP ANAHTARI ekler — soru metni yok,
//  diğer soru bankası kaynaklarındaki gibi.)
//
// İçerik (ResourceBookTopics): kitabın İÇİNDEKİLER'indeki "Unit N: BAŞLIK · Konu" biçiminde
//   (her testin kendine ait tek konusu var; tekrar eden ders başlıkları — Vocabulary, Reading
//   comprehension… — ünite adıyla birlikte yazılarak konu adları tekilleştirildi).
// Test adları kitaptaki global numaralandırmayla ("Test 1" .. "Test 55").
// page: İÇİNDEKİLER'den okunan basılı sayfa numarası. page_end: bir sonraki testin
//   page_start - 1 değeri (Test 55 için "ANSWER KEY" bölümünün başladığı s. 173'ten önce, s. 172).
// answers: kitabın "ANSWER KEY" sayfalarından (s. 174+) sırayla transkribe edilen harf dizisi;
//   Test 1-20, Test 21-40 ve Test 41-55 üç ayrı fotoğraftan çapraz kontrol edildi.
//   question_count = dizinin uzunluğu.
//
// İdempotent: her İçerik adı için ayrı ayrı — zaten varsa o İçerik atlanır.
const PUBLISHER_NAME = 'Bilfen Yayınları'
const BOOK_NAME = 'Pro & Test Soru Bankası - İngilizce 8. Sınıf'

const ICERIKLER = [
  { name: 'Unit 1: Friendship · Accepting and refusing invitations', no: 1, page: 8, pageEnd: 9, answers: 'CDADBA' },
  { name: 'Unit 1: Friendship · Refusing invitations/Apologizing by giving explanations and reasons', no: 2, page: 10, pageEnd: 11, answers: 'BDCBA' },
  { name: 'Unit 1: Friendship · Reading comprehension by making simple inquiries', no: 3, page: 12, pageEnd: 13, answers: 'DCCBADB' },
  { name: 'Unit 1: Friendship · Vocabulary', no: 4, page: 14, pageEnd: 15, answers: 'CABCDAB' },
  { name: 'Unit 1: Friendship · Revision of Unit 1', no: 5, page: 16, pageEnd: 19, answers: 'CADABBDAA' },

  { name: 'Unit 2: Teen Life · Describing the frequency of actions by making simple inquiries', no: 6, page: 20, pageEnd: 21, answers: 'CBDABC' },
  { name: 'Unit 2: Teen Life · Expressing likes-dislikes, preferences', no: 7, page: 22, pageEnd: 23, answers: 'CBBDAC' },
  { name: 'Unit 2: Teen Life · Reading comprehension by making simple inquiries', no: 8, page: 24, pageEnd: 25, answers: 'DABCDC' },
  { name: 'Unit 2: Teen Life · Vocabulary', no: 9, page: 26, pageEnd: 27, answers: 'BCADBAD' },
  { name: 'Unit 2: Teen Life · Revision of Unit 2', no: 10, page: 28, pageEnd: 31, answers: 'BDCDCAACDBBDA' },
  { name: 'Unit 2: Teen Life · Progress Test 1', no: 11, page: 32, pageEnd: 37, answers: 'ACBDACCDACACDB' },

  { name: 'Unit 3: In the Kitchen · Describing simple processes', no: 12, page: 38, pageEnd: 39, answers: 'DACADB' },
  { name: 'Unit 3: In the Kitchen · Expressing likes-dislikes, preferences', no: 13, page: 40, pageEnd: 41, answers: 'CCDABA' },
  { name: 'Unit 3: In the Kitchen · Reading comprehension by making simple inquiries', no: 14, page: 42, pageEnd: 43, answers: 'DBBACD' },
  { name: 'Unit 3: In the Kitchen · Vocabulary', no: 15, page: 44, pageEnd: 45, answers: 'DCBACB' },
  { name: 'Unit 3: In the Kitchen · Revision of Unit 3', no: 16, page: 46, pageEnd: 51, answers: 'CDABABABBACDDA' },

  { name: 'Unit 4: On the Phone · Following phone conversations', no: 17, page: 52, pageEnd: 53, answers: 'CABADBD' },
  { name: 'Unit 4: On the Phone · Expressing decisions taken at the moment of conversation', no: 18, page: 54, pageEnd: 55, answers: 'BCABD' },
  { name: 'Unit 4: On the Phone · Reading comprehension by making simple inquiries', no: 19, page: 56, pageEnd: 57, answers: 'CDBAAC' },
  { name: 'Unit 4: On the Phone · Vocabulary', no: 20, page: 58, pageEnd: 59, answers: 'DADABABD' },
  { name: 'Unit 4: On the Phone · Revision of Unit 4', no: 21, page: 60, pageEnd: 63, answers: 'DBDACBAAACDDBB' },
  { name: 'Unit 4: On the Phone · Progress Test 2', no: 22, page: 64, pageEnd: 69, answers: 'BACDBCADADCBACDB' },

  { name: 'Unit 5: The Internet · Accepting and refusing offers/Making excuses', no: 23, page: 70, pageEnd: 71, answers: 'BCAADBD' },
  { name: 'Unit 5: The Internet · Reading comprehension by making simple inquiries', no: 24, page: 72, pageEnd: 73, answers: 'DACDCA' },
  { name: 'Unit 5: The Internet · Vocabulary', no: 25, page: 74, pageEnd: 75, answers: 'BCDAADABC' },
  { name: 'Unit 5: The Internet · Revision of Unit 5', no: 26, page: 76, pageEnd: 79, answers: 'DACBABAABCDA' },
  { name: 'Unit 5: The Internet · Midterm homework', no: 27, page: 80, pageEnd: 87, answers: 'BABABCDADBCBACADBCDBAD' },

  { name: 'Unit 6: Adventures · Expressing preferences and giving explanations and reasons', no: 28, page: 88, pageEnd: 89, answers: 'ACDDAC' },
  { name: 'Unit 6: Adventures · Making simple comparisons', no: 29, page: 90, pageEnd: 91, answers: 'ACCDAB' },
  { name: 'Unit 6: Adventures · Reading comprehension by making simple inquiries', no: 30, page: 92, pageEnd: 93, answers: 'BDDAAC' },
  { name: 'Unit 6: Adventures · Vocabulary', no: 31, page: 94, pageEnd: 95, answers: 'CDDBCA' },
  { name: 'Unit 6: Adventures · Revision of Unit 6', no: 32, page: 96, pageEnd: 99, answers: 'ADDBCABABDC' },
  { name: 'Unit 6: Adventures · Progress Test 3', no: 33, page: 100, pageEnd: 105, answers: 'ACBDBCADABCD' },

  { name: 'Unit 7: Tourism · Describing favourite tourist destinations by making comparisons', no: 34, page: 106, pageEnd: 107, answers: 'CABDC' },
  { name: 'Unit 7: Tourism · Expressing preferences and giving explanations and reasons', no: 35, page: 108, pageEnd: 109, answers: 'CADAB' },
  { name: 'Unit 7: Tourism · Reading comprehension by making simple inquiries', no: 36, page: 110, pageEnd: 111, answers: 'BACDA' },
  { name: 'Unit 7: Tourism · Vocabulary', no: 37, page: 112, pageEnd: 113, answers: 'DCACBB' },
  { name: 'Unit 7: Tourism · Revision of Unit 7', no: 38, page: 114, pageEnd: 119, answers: 'CCDBCABDACBA' },

  { name: 'Unit 8: Chores · Expressing likes-dislikes', no: 39, page: 120, pageEnd: 121, answers: 'CCBCDB' },
  { name: 'Unit 8: Chores · Expressing obligations, giving explanations and reasons', no: 40, page: 122, pageEnd: 123, answers: 'CBADDA' },
  { name: 'Unit 8: Chores · Reading comprehension by making simple inquiries', no: 41, page: 124, pageEnd: 125, answers: 'BCCCDB' },
  { name: 'Unit 8: Chores · Vocabulary', no: 42, page: 126, pageEnd: 127, answers: 'BADABDC' },
  { name: 'Unit 8: Chores · Revision of Unit 8', no: 43, page: 128, pageEnd: 131, answers: 'DCBADCBACCAB' },
  { name: 'Unit 8: Chores · Progress Test 4', no: 44, page: 132, pageEnd: 137, answers: 'CABCDABBADBBC' },

  { name: 'Unit 9: Science · Describing what people are doing now', no: 45, page: 138, pageEnd: 139, answers: 'ACBD' },
  { name: 'Unit 9: Science · Talking about past events', no: 46, page: 140, pageEnd: 141, answers: 'BDCACDB' },
  { name: 'Unit 9: Science · Reading comprehension by making simple inquiries', no: 47, page: 142, pageEnd: 143, answers: 'BCAADA' },
  { name: 'Unit 9: Science · Vocabulary', no: 48, page: 144, pageEnd: 145, answers: 'ACCBDC' },
  { name: 'Unit 9: Science · Revision of Unit 9', no: 49, page: 146, pageEnd: 151, answers: 'ACBDDCBADBCACD' },

  { name: 'Unit 10: Natural Forces · Making predictions about the future, giving explanations and reasons', no: 50, page: 152, pageEnd: 153, answers: 'BCDACDA' },
  { name: 'Unit 10: Natural Forces · Reading comprehension by making simple inquiries', no: 51, page: 154, pageEnd: 155, answers: 'CBACAD' },
  { name: 'Unit 10: Natural Forces · Vocabulary', no: 52, page: 156, pageEnd: 157, answers: 'BDDBDA' },
  { name: 'Unit 10: Natural Forces · Revision of Unit 10', no: 53, page: 158, pageEnd: 161, answers: 'BBCADBDABDAAC' },
  { name: 'Unit 10: Natural Forces · Progress Test 5', no: 54, page: 162, pageEnd: 165, answers: 'BACDBCBDABDDA' },
  { name: 'Unit 10: Natural Forces · Final Homework', no: 55, page: 166, pageEnd: 172, answers: 'ABDBDACDCABADABBDACCD' },
]

async function main() {
  loadLocalSettings()
  if (!process.env.SQL_CONNECTION_STRING) throw new Error('SQL_CONNECTION_STRING is missing.')

  // Ön doğrulama: cevap dizileri + test numaralarının 1..55 arası tekil olması
  const seen = new Set()
  for (const ic of ICERIKLER) {
    if (!/^[A-D]+$/.test(ic.answers)) {
      throw new Error(`Geçersiz cevap dizisi: Test ${ic.no} — ${ic.answers}`)
    }
    if (seen.has(ic.no)) throw new Error(`Mükerrer test no: ${ic.no}`)
    seen.add(ic.no)
  }
  for (let n = 1; n <= 55; n += 1) {
    if (!seen.has(n)) throw new Error(`Eksik test no: ${n}`)
  }

  const pool = await sql.connect(process.env.SQL_CONNECTION_STRING)
  try {
    const book = await pool
      .request()
      .input('pub', sql.NVarChar(150), PUBLISHER_NAME)
      .input('name', sql.NVarChar(200), BOOK_NAME)
      .query(`
        SELECT b.id, b.name, b.scope, b.grade, b.resource_type
        FROM dbo.ResourceBooks b
        JOIN dbo.Publishers p ON p.id = b.publisher_id
        WHERE p.name = @pub AND b.name = @name;
      `)
    if (!book.recordset.length) {
      throw new Error(`Kaynak bulunamadı: "${PUBLISHER_NAME}" / "${BOOK_NAME}". Önce panelden oluşturulmalı.`)
    }
    const b = book.recordset[0]
    const resourceBookId = b.id
    console.log(`Kaynak: ${b.name} (scope=${b.scope}, ${b.grade}. sınıf, ${b.resource_type}) -> ${resourceBookId}\n`)

    let topicsCreated = 0
    let topicsSkipped = 0
    let testsCreated = 0
    let testsSkipped = 0
    let keysInserted = 0

    for (const ic of ICERIKLER) {
      let topicId
      const existing = await pool
        .request()
        .input('rbId', sql.UniqueIdentifier, resourceBookId)
        .input('name', sql.NVarChar(200), ic.name)
        .query('SELECT id FROM dbo.ResourceBookTopics WHERE resource_book_id = @rbId AND name = @name;')
      if (existing.recordset.length) {
        topicId = existing.recordset[0].id
        console.log(`İçerik (var): ${ic.name}`)
        topicsSkipped += 1
      } else {
        const ins = await pool
          .request()
          .input('rbId', sql.UniqueIdentifier, resourceBookId)
          .input('name', sql.NVarChar(200), ic.name)
          .query('INSERT INTO dbo.ResourceBookTopics (resource_book_id, name) OUTPUT inserted.id VALUES (@rbId, @name);')
        topicId = ins.recordset[0].id
        topicsCreated += 1
        console.log(`İçerik (yeni): ${ic.name}`)
      }

      const testName = `Test ${ic.no}`
      const dup = await pool
        .request()
        .input('topicId', sql.UniqueIdentifier, topicId)
        .input('name', sql.NVarChar(200), testName)
        .query('SELECT id FROM dbo.ResourceBookTopicTests WHERE topic_id = @topicId AND name = @name;')
      if (dup.recordset.length) {
        console.log(`  ${testName} (var, atlandı)`)
        testsSkipped += 1
        continue
      }

      const questionCount = ic.answers.length
      const pageStart = ic.page
      const pageEnd = ic.pageEnd
      const pageCount = pageEnd - pageStart + 1

      const insTest = await pool
        .request()
        .input('topicId', sql.UniqueIdentifier, topicId)
        .input('topicName', sql.NVarChar(200), ic.name)
        .input('name', sql.NVarChar(200), testName)
        .input('pageStart', sql.Int, pageStart)
        .input('pageEnd', sql.Int, pageEnd)
        .input('pageCount', sql.Int, pageCount)
        .input('questionCount', sql.Int, questionCount)
        .query(`
          INSERT INTO dbo.ResourceBookTopicTests (topic_id, topic_name, name, page_start, page_end, page_count, question_count)
          OUTPUT inserted.id
          VALUES (@topicId, @topicName, @name, @pageStart, @pageEnd, @pageCount, @questionCount);
        `)
      const testId = insTest.recordset[0].id
      testsCreated += 1

      const req = pool.request().input('testId', sql.UniqueIdentifier, testId)
      const valueRows = []
      ic.answers.split('').forEach((label, idx) => {
        req.input(`o${idx}`, sql.Int, idx + 1)
        req.input(`l${idx}`, sql.NChar(1), label)
        valueRows.push(`(@testId, @o${idx}, @l${idx})`)
      })
      await req.query(`INSERT INTO dbo.TestAnswerKeys (test_id, order_no, correct_label) VALUES ${valueRows.join(', ')};`)
      keysInserted += ic.answers.length
      console.log(`  ${testName}: ${questionCount} soru (s. ${pageStart}-${pageEnd}) — ${ic.answers}`)
    }

    console.log(
      `\nBitti. İçerik: +${topicsCreated} (var: ${topicsSkipped}), ` +
        `test: +${testsCreated} (var: ${testsSkipped}), cevap anahtarı satırı: +${keysInserted}`,
    )
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error('Seed failed')
  console.error(error)
  process.exit(1)
})
