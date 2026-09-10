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

// "Görsel, Grafik, Tablo Okuma ve Sözel Mantık Soru Bankası - Türkçe 8. Sınıf"
// (kaynak DB'de: publisher "Bilfen Yayınları", scope = 'catalog' / Kütüphane; kapakta FENOMEN).
//
// Soru metni YOK — diğer soru bankalarındaki gibi sadece İÇERİK (bölüm) + TEST ADI + SAYFA +
// cevap anahtarı eklenir.
//
// Kitap 3 bölümden oluşuyor ve her bölüm test numaralandırmasını 1'den başlatıyor
// (İÇİNDEKİLER: 1. Bölüm Test 1-11, 2. Bölüm Test 1-19, 3. Bölüm Test 1-20).
// Bu yüzden her bölüm bir "İçerik" (ResourceBookTopic), test adları bölüm içinde "Test 1..N".
//
// page      : İÇİNDEKİLER'den her testin başlangıç sayfası.
// page_end  : bir sonraki testin sayfası - 1; bölümün son testi için page + tipik aralık.
// answers   : kitabın "Cevap Anahtarı" sayfasından (s. 239) satır = test no, sütun = soru no.
//             question_count = dizinin uzunluğu.
//
// İdempotent: var olan İçerik/test/cevap anahtarını atlar; eksik cevap anahtarını tamamlar.
const RESOURCE_BOOK_ID = 'D990BC8A-49B1-4E54-A2D9-9F7A6EADE75B'

// Kaynak kaydında iki düzeltme: yayınevi Bilfen -> Fenomen, ad "Tükçe" -> "Türkçe".
const FENOMEN_PUBLISHER_ID = '77FF133A-2FC8-43BE-B364-A9A24B0FA1A1'
const CORRECT_BOOK_NAME = 'Görsel, Grafik, Tablo Okuma ve Sözel Mantık Soru Bankası - Türkçe 8. Sınıf'

const BOLUMLER = [
  {
    name: '1. Bölüm · Görsel Okuma',
    lastPageGap: 4,
    tests: [
      { no: 1, page: 3, answers: 'BCCBDBCDDCC' },
      { no: 2, page: 7, answers: 'DCCBCACDB' },
      { no: 3, page: 11, answers: 'CCCCDACDDAA' },
      { no: 4, page: 15, answers: 'CBDBDAADACC' },
      { no: 5, page: 19, answers: 'CADBADCADD' },
      { no: 6, page: 23, answers: 'ACAADBCBBBC' },
      { no: 7, page: 27, answers: 'CBDDCDDDBDD' },
      { no: 8, page: 31, answers: 'DCBCDCCDACC' },
      { no: 9, page: 35, answers: 'DCCBCDBCCC' },
      { no: 10, page: 39, answers: 'ABBBBDDDBCB' },
      { no: 11, page: 43, answers: 'CACCBDCCDDD' },
    ],
  },
  {
    name: '2. Bölüm · Grafik - Tablo Yorumlama',
    lastPageGap: 6,
    tests: [
      { no: 1, page: 47, answers: 'CBADBDBDCAD' },
      { no: 2, page: 53, answers: 'BDBBCCABDBDC' },
      { no: 3, page: 59, answers: 'CACBBDCACDAD' },
      { no: 4, page: 65, answers: 'ADCBDDCBCD' },
      { no: 5, page: 71, answers: 'BCACDCBDCB' },
      { no: 6, page: 77, answers: 'ADBDBCCCDB' },
      { no: 7, page: 83, answers: 'ABCBCCBDAB' },
      { no: 8, page: 89, answers: 'BBCBBCCCDC' },
      { no: 9, page: 95, answers: 'CABDBACCB' },
      { no: 10, page: 101, answers: 'CDBDBCCCAAC' },
      { no: 11, page: 107, answers: 'BBCACBCDBD' },
      { no: 12, page: 113, answers: 'CCBDCBABBA' },
      { no: 13, page: 119, answers: 'BDDBBDCCB' },
      { no: 14, page: 125, answers: 'BCCBDCADBD' },
      { no: 15, page: 131, answers: 'ABCCCCADCAA' },
      { no: 16, page: 137, answers: 'CDCBCABCCD' },
      { no: 17, page: 143, answers: 'BDBDCBDBA' },
      { no: 18, page: 149, answers: 'BCCDCCBDBC' },
      { no: 19, page: 155, answers: 'DCCABCAAAD' },
    ],
  },
  {
    name: '3. Bölüm · Sözel Mantık - Muhakeme',
    lastPageGap: 4,
    tests: [
      { no: 1, page: 161, answers: 'ADDCDDCCDBBB' },
      { no: 2, page: 165, answers: 'CCABADCCDCB' },
      { no: 3, page: 169, answers: 'CBDBCBACAAC' },
      { no: 4, page: 173, answers: 'ABDAAABDCBC' },
      { no: 5, page: 177, answers: 'ACDBDCD' },
      { no: 6, page: 180, answers: 'CCCAABADDBB' },
      { no: 7, page: 184, answers: 'BDCDCDDCCCA' },
      { no: 8, page: 188, answers: 'CCABACDCA' },
      { no: 9, page: 192, answers: 'DDDBDCDDBAA' },
      { no: 10, page: 196, answers: 'ACCBBADDCD' },
      { no: 11, page: 200, answers: 'ABADBCBCDDC' },
      { no: 12, page: 204, answers: 'DDBBABDDD' },
      { no: 13, page: 208, answers: 'CBCCBBDBC' },
      { no: 14, page: 212, answers: 'DCADCCCBAC' },
      { no: 15, page: 216, answers: 'DCAAACBDAC' },
      { no: 16, page: 220, answers: 'CCDCDDDBBB' },
      { no: 17, page: 224, answers: 'BCDABACCAB' },
      { no: 18, page: 228, answers: 'BCCDABCDBBB' },
      { no: 19, page: 232, answers: 'BCDDDBBDDB' },
      { no: 20, page: 236, answers: 'DBBADCD' },
    ],
  },
]

async function main() {
  loadLocalSettings()
  if (!process.env.SQL_CONNECTION_STRING) throw new Error('SQL_CONNECTION_STRING is missing.')

  // Ön doğrulama
  for (const bolum of BOLUMLER) {
    const seen = new Set()
    for (const t of bolum.tests) {
      if (seen.has(t.no)) throw new Error(`${bolum.name}: mükerrer test no ${t.no}`)
      seen.add(t.no)
      if (!/^[A-D]+$/.test(t.answers)) throw new Error(`${bolum.name} / Test ${t.no}: geçersiz cevap dizisi "${t.answers}"`)
      if (!Number.isInteger(t.page) || t.page <= 0) throw new Error(`${bolum.name} / Test ${t.no}: geçersiz sayfa`)
    }
    // page_end: sıralı sonraki testin sayfası - 1; son test için lastPageGap
    const sorted = [...bolum.tests].sort((a, b) => a.no - b.no)
    sorted.forEach((t, i) => {
      const next = sorted[i + 1]
      t.pageEnd = next ? Math.max(t.page, next.page - 1) : t.page + bolum.lastPageGap - 1
    })
  }

  const pool = await sql.connect(process.env.SQL_CONNECTION_STRING)
  try {
    const book = await pool
      .request()
      .input('id', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
      .query('SELECT id, name, scope, grade FROM dbo.ResourceBooks WHERE id = @id;')
    if (!book.recordset.length) throw new Error(`ResourceBook not found: ${RESOURCE_BOOK_ID}`)
    const b = book.recordset[0]
    console.log(`Kaynak: ${b.name} (scope=${b.scope}, ${b.grade}. sınıf)\n`)

    // Yayınevi + ad düzeltmesi (idempotent)
    const fix = await pool
      .request()
      .input('id', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
      .input('pub', sql.UniqueIdentifier, FENOMEN_PUBLISHER_ID)
      .input('name', sql.NVarChar(300), CORRECT_BOOK_NAME)
      .query(`
        UPDATE dbo.ResourceBooks
        SET publisher_id = @pub, name = @name
        WHERE id = @id AND (publisher_id <> @pub OR name <> @name);
      `)
    if (fix.rowsAffected[0] > 0) console.log(`Kaynak kaydı düzeltildi: yayınevi -> Fenomen Yayınları, ad -> "${CORRECT_BOOK_NAME}"\n`)

    let topicsCreated = 0
    let topicsSkipped = 0
    let testsCreated = 0
    let testsSkipped = 0
    let keysInserted = 0

    for (const bolum of BOLUMLER) {
      let topicId
      const existingTopic = await pool
        .request()
        .input('rbId', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
        .input('name', sql.NVarChar(200), bolum.name)
        .query('SELECT id FROM dbo.ResourceBookTopics WHERE resource_book_id = @rbId AND name = @name;')
      if (existingTopic.recordset.length > 1) throw new Error(`Aynı adlı birden fazla İçerik: ${bolum.name}`)
      if (existingTopic.recordset.length === 1) {
        topicId = existingTopic.recordset[0].id
        topicsSkipped += 1
        console.log(`İçerik (var): ${bolum.name}`)
      } else {
        const ins = await pool
          .request()
          .input('rbId', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
          .input('name', sql.NVarChar(200), bolum.name)
          .query('INSERT INTO dbo.ResourceBookTopics (resource_book_id, name) OUTPUT inserted.id VALUES (@rbId, @name);')
        topicId = ins.recordset[0].id
        topicsCreated += 1
        console.log(`İçerik (yeni): ${bolum.name}`)
      }

      for (const t of bolum.tests) {
        const testName = `Test ${t.no}`
        const questionCount = t.answers.length

        const existingTest = await pool
          .request()
          .input('topicId', sql.UniqueIdentifier, topicId)
          .input('name', sql.NVarChar(200), testName)
          .query(`
            SELECT tt.id,
              (SELECT COUNT(*) FROM dbo.TestAnswerKeys k WHERE k.test_id = tt.id) AS answer_count
            FROM dbo.ResourceBookTopicTests tt
            WHERE tt.topic_id = @topicId AND tt.name = @name;
          `)
        if (existingTest.recordset.length > 1) throw new Error(`Aynı adlı birden fazla test: ${bolum.name} / ${testName}`)

        let testId
        if (existingTest.recordset.length === 1) {
          const row = existingTest.recordset[0]
          testId = row.id
          await pool
            .request()
            .input('id', sql.UniqueIdentifier, testId)
            .input('qc', sql.Int, questionCount)
            .input('ps', sql.Int, t.page)
            .input('pe', sql.Int, t.pageEnd)
            .input('pc', sql.Int, t.pageEnd - t.page + 1)
            .query('UPDATE dbo.ResourceBookTopicTests SET question_count = @qc, page_start = @ps, page_end = @pe, page_count = @pc WHERE id = @id;')
          if (row.answer_count > 0) {
            testsSkipped += 1
            console.log(`  ${testName}: var (cevap anahtarı zaten yazılı), atlandı`)
            continue
          }
          console.log(`  ${testName}: test var, cevap anahtarı ekleniyor`)
        } else {
          const ins = await pool
            .request()
            .input('topicId', sql.UniqueIdentifier, topicId)
            .input('topicName', sql.NVarChar(200), bolum.name)
            .input('name', sql.NVarChar(200), testName)
            .input('ps', sql.Int, t.page)
            .input('pe', sql.Int, t.pageEnd)
            .input('pc', sql.Int, t.pageEnd - t.page + 1)
            .input('qc', sql.Int, questionCount)
            .query(`
              INSERT INTO dbo.ResourceBookTopicTests (topic_id, topic_name, name, page_start, page_end, page_count, question_count)
              OUTPUT inserted.id
              VALUES (@topicId, @topicName, @name, @ps, @pe, @pc, @qc);
            `)
          testId = ins.recordset[0].id
          testsCreated += 1
          console.log(`  ${testName}: oluşturuldu (${questionCount} soru, s. ${t.page}-${t.pageEnd})`)
        }

        const req = pool.request().input('testId', sql.UniqueIdentifier, testId)
        const valueRows = []
        t.answers.split('').forEach((label, i) => {
          req.input(`o${i}`, sql.Int, i + 1)
          req.input(`l${i}`, sql.NChar(1), label)
          valueRows.push(`(@testId, @o${i}, @l${i})`)
        })
        await req.query(`INSERT INTO dbo.TestAnswerKeys (test_id, order_no, correct_label) VALUES ${valueRows.join(', ')};`)
        keysInserted += 1
        console.log(`    cevap anahtarı: ${t.answers}`)
      }
    }

    console.log(
      `\nBitti. Yeni İçerik: +${topicsCreated} (var: ${topicsSkipped}), ` +
        `yeni test: +${testsCreated} (cevap anahtarı zaten olan: ${testsSkipped}), cevap anahtarı yazılan: +${keysInserted}`,
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
