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

// Fenomen Yayınları "3. Fasikül - Kareköklü İfadeler ve Veri Analizi" (8. Sınıf Matematik, type=etkinlik).
const RESOURCE_BOOK_ID = '332E8C73-E296-439D-B58E-25D742913C92'

// Her "İçerik" (ResourceBookTopic) fasikülün bir bölümüdür. İçindeki her test için
// yalnızca çoktan seçmeli test cevap anahtarı saklanır; cevap anahtarı görselindeki
// numaralı açık uçlu "Etkinlik" cevapları (1-9, 1-10 ...) modelde tutulmuyor, atlanır.
// pages: [page_start, page_end] — kaynağın "İçindekiler" sayfasından. Bölümdeki son testin
// bitiş sayfası, bir sonraki bölümün başlangıcına göre tahmin edildi.
// İçerik adları ve test adları da "İçindekiler" başlıklarına hizalandı.
const SECTIONS = [
  {
    name: 'Tamkare Pozitif Tam Sayılar',
    tests: [
      { no: 1, answers: 'CDCCBBADBCCAC', pages: [3, 4] }, // 13
      { no: 2, answers: 'DBABCDCBCBDC', pages: [5, 6] }, // 12
      { no: 3, answers: 'ABCC', pages: [7, 8] }, // 4
    ],
  },
  {
    name: 'Tamkare Sayıların Karekökleri',
    tests: [
      { no: 1, answers: 'CDBBCBBDACDBCD', pages: [11, 12] }, // 14
      { no: 2, answers: 'DBCADADDABB', pages: [13, 14] }, // 11
    ],
  },
  {
    name: 'Kareköklü Bir İfadenin Farklı Gösterimi',
    tests: [
      { no: 1, answers: 'BCCBCACCCCDCBACD', pages: [23, 24] }, // 16
      { no: 2, answers: 'DBBACDBCADCC', pages: [25, 26] }, // 12
      { no: 3, answers: 'CACCACBCDCCA', pages: [27, 28] }, // 12
      { no: 4, answers: 'ADCDCACACA', pages: [29, 32] }, // 10
      { name: "Tamkare ve Yaklaşık Değer İle İlgili LGS'de Çıkmış Sorular", answers: 'BDDBCBDABCAC', pages: [33, 36] }, // 12
    ],
  },
  {
    name: 'Kareköklü Sayılarda Çarpma ve Bölme İşlemleri',
    tests: [
      { no: 1, answers: 'ACCDCCDACCCDCD', pages: [45, 46] }, // 14
      { no: 2, answers: 'CBCCDBBBADADCDB', pages: [47, 48] }, // 15
      { no: 3, answers: 'DCDAABCBBCCD', pages: [49, 50] }, // 12
      { no: 4, answers: 'CBBDDA', pages: [51, 53] }, // 6
    ],
  },
  {
    name: 'Kareköklü Sayılarda Toplama ve Çıkarma İşlemleri',
    tests: [
      { no: 1, answers: 'BACBCDDBABD', pages: [60, 61] }, // 11
      { no: 2, answers: 'ACBCCDBCD', pages: [62, 63] }, // 9
      { no: 3, answers: 'ABABBACA', pages: [64, 65] }, // 8
      { no: 4, answers: 'BCDCCCCB', pages: [66, 69] }, // 8
      { no: 5, answers: 'BBCDBDDD', pages: [70, 73] }, // 8
      { no: 6, answers: 'CCCBBB', pages: [74, 76] }, // 6
      { no: 7, answers: 'CCDACDAB', pages: [77, 79] }, // 8
      { no: 8, answers: 'BCACBAAA', pages: [80, 83] }, // 8
      { no: 9, answers: 'BDACDDAD', pages: [84, 87] }, // 8
      { name: "Kareköklü İfadelerde Dört İşlem İle İlgili LGS'de Çıkmış Sorular", answers: 'BDCDBBDDBBDB', pages: [88, 91] }, // 12 (11-12. sütun kullanıcı teyidiyle)
    ],
  },
  {
    name: 'Ondalık Gösterimlerin Karekökleri ve Gerçek Sayılar',
    tests: [
      { no: 1, answers: 'BCACBBBCCCB', pages: [96, 97] }, // 11
      { no: 2, answers: 'CBDDDBBBDADC', pages: [98, 99] }, // 12
      { no: 3, answers: 'BCBBCCBCBB', pages: [100, 103] }, // 10
      { name: "Kareköklü İfadeler İle İlgili LGS'de Çıkmış Sorular", answers: 'CDAC', pages: [104, 104] }, // 4
    ],
  },
  {
    name: 'Veri Analizi',
    tests: [
      { no: 1, answers: 'ACCCADABCA', pages: [111, 112] }, // 10
      { no: 2, answers: 'BCDCBABD', pages: [113, 114] }, // 8
      { no: 3, answers: 'DAACBDBC', pages: [115, 116] }, // 8
      { no: 4, answers: 'DCBCBDBD', pages: [117, 119] }, // 8
      { name: "Veri Analizi İle İlgili LGS'de Çıkmış Sorular", answers: 'CDBADACDDBA', pages: [120, 125] }, // 11
    ],
  },
]

async function main() {
  loadLocalSettings()
  const connectionString = process.env.SQL_CONNECTION_STRING
  if (!connectionString) throw new Error('SQL_CONNECTION_STRING is missing.')

  for (const section of SECTIONS) {
    for (const test of section.tests) {
      const label = test.name || `Test ${test.no}`
      if (!/^[A-D]+$/.test(test.answers)) {
        throw new Error(`Invalid answers for ${section.name} / ${label}: ${test.answers}`)
      }
    }
  }

  const pool = await sql.connect(connectionString)
  try {
    const book = await pool
      .request()
      .input('id', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
      .query('SELECT id, name, resource_type FROM dbo.ResourceBooks WHERE id = @id;')
    if (!book.recordset.length) throw new Error(`ResourceBook not found: ${RESOURCE_BOOK_ID}`)
    console.log(`ResourceBook: ${book.recordset[0].name} (${book.recordset[0].resource_type})`)

    let topicsCreated = 0
    let testsCreated = 0
    let answerRows = 0
    let skipped = 0

    for (const section of SECTIONS) {
      let topicId
      const existingTopic = await pool
        .request()
        .input('rbId', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
        .input('name', sql.NVarChar(200), section.name)
        .query('SELECT id FROM dbo.ResourceBookTopics WHERE resource_book_id = @rbId AND name = @name;')

      if (existingTopic.recordset.length) {
        topicId = existingTopic.recordset[0].id
        console.log(`İçerik (mevcut): ${section.name}`)
      } else {
        const inserted = await pool
          .request()
          .input('rbId', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
          .input('name', sql.NVarChar(200), section.name).query(`
            INSERT INTO dbo.ResourceBookTopics (resource_book_id, name)
            OUTPUT inserted.id
            VALUES (@rbId, @name);
          `)
        topicId = inserted.recordset[0].id
        topicsCreated += 1
        console.log(`İçerik (yeni): ${section.name}`)
      }

      for (const test of section.tests) {
        const testName = test.name || `Test ${test.no}`
        const questionCount = test.answers.length

        const existingTest = await pool
          .request()
          .input('topicId', sql.UniqueIdentifier, topicId)
          .input('topicName', sql.NVarChar(200), section.name)
          .input('name', sql.NVarChar(200), testName)
          .query(`
            SELECT id FROM dbo.ResourceBookTopicTests
            WHERE topic_id = @topicId AND topic_name = @topicName AND name = @name;
          `)
        if (existingTest.recordset.length) {
          console.log(`  ${testName} zaten var, atlanıyor.`)
          skipped += 1
          continue
        }

        const [pageStart, pageEnd] = test.pages || [null, null]
        const pageCount = pageStart && pageEnd ? pageEnd - pageStart + 1 : 1

        const testResult = await pool
          .request()
          .input('topicId', sql.UniqueIdentifier, topicId)
          .input('topicName', sql.NVarChar(200), section.name)
          .input('name', sql.NVarChar(200), testName)
          .input('pageStart', sql.Int, pageStart)
          .input('pageEnd', sql.Int, pageEnd)
          .input('pageCount', sql.Int, pageCount)
          .input('questionCount', sql.Int, questionCount).query(`
            INSERT INTO dbo.ResourceBookTopicTests (topic_id, topic_name, name, page_start, page_end, page_count, question_count)
            OUTPUT inserted.id
            VALUES (@topicId, @topicName, @name, @pageStart, @pageEnd, @pageCount, @questionCount);
          `)
        const testId = testResult.recordset[0].id
        testsCreated += 1

        const akRequest = pool.request().input('testId', sql.UniqueIdentifier, testId)
        const values = []
        test.answers.split('').forEach((label, idx) => {
          akRequest.input(`o${idx}`, sql.Int, idx + 1)
          akRequest.input(`l${idx}`, sql.NChar(1), label)
          values.push(`(@testId, @o${idx}, @l${idx})`)
        })
        await akRequest.query(`
          INSERT INTO dbo.TestAnswerKeys (test_id, order_no, correct_label)
          VALUES ${values.join(', ')};
        `)
        answerRows += questionCount
        console.log(`  ${testName}: ${questionCount} soru + cevap anahtarı eklendi.`)
      }
    }

    console.log(
      `\nBitti. İçerik: +${topicsCreated}, test: +${testsCreated} (atlanan ${skipped}), cevap anahtarı satırı: +${answerRows}`,
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
