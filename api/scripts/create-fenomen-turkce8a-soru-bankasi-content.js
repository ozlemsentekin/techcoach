// "%100 Başarı İçin Türkçe Soru Bankası - 8A" (Fenomen Yayınları) kaynağına kullanıcının
// gönderdiği İçindekiler + Cevap Anahtarı fotoğraflarından 12 Bölüm konusu + toplam 91 test
// ve tam cevap anahtarını birlikte oluşturur.
// page_start = İçindekiler'deki sayfa no; page_end = bir sonraki testin sayfası - 1 (son test
// için 303'teki "Cevap Anahtarı" bölümünden önceki sayfa). question_count = cevap
// anahtarındaki gerçek soru sayısı. Test adları İçindekiler'deki parantez ekleri olmadan
// ("Test <no>"); cevap anahtarı tablosu da testleri bölüm içinde aynı şekilde numaralıyor.
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

const RESOURCE_BOOK_ID = 'B385A138-FE2F-4380-B57E-D8D79D1EDFD0'

const TOPICS = [
  {
    name: '1. Bölüm - Sözcükte Anlam',
    tests: [
      { page: 5, answers: 'DCCABCCDCDCB' },
      { page: 7, answers: 'CAADBDCDBBAADCDBDC' },
      { page: 10, answers: 'BDCBDBBDCCDBDC' },
      { page: 12, answers: 'ADBABDDB' },
      { page: 15, answers: 'CDBCCBAADABBCBCADDAD' },
      { page: 18, answers: 'ABACDBBDDAAB' },
      { page: 20, answers: 'DBBCDDC' },
      { page: 23, answers: 'DCCBDCBCCDCCCBCCDB' },
      { page: 26, answers: 'ADDDCCCDABDDAB' },
      { page: 28, answers: 'ABBDACBBBDBBDADCC' },
      { page: 33, answers: 'ADBBBDCDBAAD' },
      { page: 35, answers: 'ABBBBCCBAAAADDA' },
      { page: 38, answers: 'DCCDBBBDDB' },
      { page: 40, answers: 'CCBCCBCD' },
    ],
  },
  {
    name: '2. Bölüm - Cümlede Anlam',
    tests: [
      { page: 43, answers: 'CCBBCDCABACA' },
      { page: 45, answers: 'ABBCACBDCCBD' },
      { page: 47, answers: 'DBCBADADADCCB' },
      { page: 49, answers: 'CBCABCDBBCD' },
      { page: 51, answers: 'BBDDCBCBCC' },
      { page: 54, answers: 'CDCCCDDACBB' },
      { page: 57, answers: 'CABDACBBBBCBA' },
      { page: 59, answers: 'DDADABBDCCCCCCCDDA' },
      { page: 62, answers: 'DCCDCABB' },
      { page: 64, answers: 'CDDBCDCDDBA' },
      { page: 66, answers: 'DDBDACCD' },
      { page: 69, answers: 'DDBABCCBDBBC' },
      { page: 71, answers: 'CADDDBCDDDABDCCAACD' },
      { page: 74, answers: 'BDDBCBCAA' },
      { page: 76, answers: 'BDCCBCCCCC' },
      { page: 79, answers: 'CCBAAACADCDC' },
      { page: 81, answers: 'BCACACCCDBDB' },
      { page: 83, answers: 'CDBCBBBDCCDCCC' },
      { page: 85, answers: 'CCCBBCCBBA' },
      { page: 87, answers: 'CBCBBCACDCACBC' },
      { page: 89, answers: 'BCBBADDDC' },
      { page: 92, answers: 'DCCDBBBDC' },
    ],
  },
  {
    name: '3. Bölüm - Paragrafta Anlam',
    tests: [
      { page: 95, answers: 'BDCBDBBCAB' },
      { page: 97, answers: 'BCCBBDCCBA' },
      { page: 99, answers: 'ABDADCCB' },
      { page: 101, answers: 'CCCBCABDD' },
      { page: 103, answers: 'ACCAADDAA' },
      { page: 105, answers: 'CABBCBACDC' },
      { page: 108, answers: 'DCDCBABCC' },
      { page: 111, answers: 'CCABBBBBADCB' },
      { page: 113, answers: 'BABACDBDCBD' },
      { page: 115, answers: 'CDCDDCDCBDAC' },
      { page: 117, answers: 'DAACCCBDACA' },
      { page: 119, answers: 'DCABBDBABC' },
      { page: 121, answers: 'CCDDCCCCACA' },
      { page: 124, answers: 'BCCDCCBCA' },
      { page: 127, answers: 'CBBDCABCDB' },
      { page: 129, answers: 'BDBCDDABACBADD' },
      { page: 132, answers: 'DCBABBACDD' },
      { page: 134, answers: 'ADACCBAB' },
      { page: 136, answers: 'BADDDADB' },
      { page: 139, answers: 'CBDDCDDCDDA' },
      { page: 141, answers: 'ABADDCACADACBCD' },
      { page: 144, answers: 'CDDDBDCD' },
      { page: 146, answers: 'DBBBADDAA' },
      { page: 148, answers: 'CDBABCDDB' },
    ],
  },
  {
    name: '4. Bölüm - Görsel Okuma / Sözel Mantık',
    tests: [
      { page: 151, answers: 'BABBCCBC' },
      { page: 153, answers: 'CACBCCDDB' },
      { page: 155, answers: 'CABDCC' },
      { page: 158, answers: 'DDACBCA' },
      { page: 160, answers: 'DBCC' },
      { page: 162, answers: 'CDADBBCA' },
      { page: 166, answers: 'CCCBABBC' },
      { page: 170, answers: 'DABDAABACDB' },
      { page: 172, answers: 'CDCDABACAB' },
      { page: 174, answers: 'DBDBDD' },
    ],
  },
  {
    name: '5. Bölüm - Fiilimsiler (Eylemsiler)',
    tests: [
      { page: 177, answers: 'ACABAAADDCABDBBA' },
      { page: 180, answers: 'CAAADBDCDBADC' },
      { page: 182, answers: 'CBCACBDCC' },
      { page: 185, answers: 'BCCACACABBAACDDADA' },
      { page: 188, answers: 'ABCABBBBAB' },
      { page: 190, answers: 'ABCBBCDBBC' },
      { page: 193, answers: 'CABADACDBCDAADAC' },
      { page: 196, answers: 'DCCBABDBADADB' },
      { page: 198, answers: 'BDCBCCCCB' },
    ],
  },
  {
    name: '6. Bölüm - Cümlenin Ögeleri',
    tests: [
      { page: 201, answers: 'BCDCADADBCACD' },
      { page: 203, answers: 'DCBDDADBBADDCDBCABAAC' },
      { page: 206, answers: 'CCCCBCDDBCADD' },
      { page: 208, answers: 'ADDDCBBBD' },
      { page: 211, answers: 'BDDBBBABCDCBB' },
      { page: 213, answers: 'DDBAACADDBBCDCCBBACDB' },
      { page: 216, answers: 'BCBCACBACDBAAB' },
      { page: 218, answers: 'CBDBCABCB' },
    ],
  },
  {
    name: '7. Bölüm - Fiilde (Eylemde) Çatı',
    tests: [
      { page: 221, answers: 'DCCDDBDAADCDCACDBB' },
      { page: 224, answers: 'ABAACBCCDDC' },
      { page: 226, answers: 'ADDBCBDDDACC' },
      { page: 230, answers: 'CBADCBDBCCBADAC' },
      { page: 233, answers: 'BDBDCACBBBBC' },
      { page: 235, answers: 'AABADD' },
    ],
  },
  {
    name: '8. Bölüm - Cümle Türleri',
    tests: [
      { page: 237, answers: 'CDDDDBCCABCDCDDBCCD' },
      { page: 240, answers: 'DDBBABCDDCD' },
      { page: 242, answers: 'CACCBCBDC' },
      { page: 245, answers: 'CDDBCCBCCBBABABADB' },
      { page: 248, answers: 'DADDADBDBCBD' },
      { page: 250, answers: 'ABBDBBDCB' },
    ],
  },
  {
    name: '9. Bölüm - Anlatım Bozuklukları',
    tests: [
      { page: 253, answers: 'BADDCCDADCDA' },
      { page: 255, answers: 'AADBCDCDCCCBCDBBCACD' },
      { page: 258, answers: 'DDBBBACDC' },
      { page: 260, answers: 'ABDBCCDC' },
    ],
  },
  {
    name: '10. Bölüm - Yazım Kuralları',
    tests: [
      { page: 263, answers: 'CDDCCDDBBAC' },
      { page: 265, answers: 'CADBBDBDDCB' },
      { page: 267, answers: 'CCADDBDDD' },
      { page: 269, answers: 'BADCACDDDBD' },
      { page: 271, answers: 'CADBBCCDCBBC' },
      { page: 273, answers: 'BCBDBCBBB' },
      { page: 276, answers: 'ABBCCDCCC' },
    ],
  },
  {
    name: '11. Bölüm - Noktalama İşaretleri',
    tests: [
      { page: 279, answers: 'CCCADABAABDC' },
      { page: 281, answers: 'DAACCDCCDCAD' },
      { page: 283, answers: 'CAACBCBCCCBBC' },
      { page: 285, answers: 'DADABCDCDD' },
      { page: 287, answers: 'DCBCBCCCB' },
      { page: 289, answers: 'DBBBBACDB' },
      { page: 292, answers: 'AAABBBCBABD' },
    ],
  },
  {
    name: '12. Bölüm - Metin Türleri',
    tests: [
      { page: 295, answers: 'CACBBBACADCADBDA' },
      { page: 298, answers: 'ACDCBCDADC' },
      { page: 300, answers: 'CBDBBBD' },
    ],
  },
]

// Cevap Anahtarı (ek) 303'te başlıyor — son testin bitişi 302.
const BOOK_END_PAGE = 303

async function main() {
  loadLocalSettings()
  const connectionString = process.env.SQL_CONNECTION_STRING
  if (!connectionString) throw new Error('SQL_CONNECTION_STRING eksik.')

  // Global sıradaki testler + bir sonrakinin sayfasına göre page_end hesapla; her bölümde
  // test numarası 1'den başlar (İçindekiler ve Cevap Anahtarı tablosuyla aynı numaralandırma).
  const flat = []
  TOPICS.forEach((topic, topicIdx) => {
    topic.tests.forEach((test, testIdxInTopic) =>
      flat.push({ ...test, topicIdx, name: `Test ${testIdxInTopic + 1}` })
    )
  })
  flat.forEach((test, idx) => {
    const nextPage = idx + 1 < flat.length ? flat[idx + 1].page : BOOK_END_PAGE
    test.pageEnd = nextPage - 1
    test.pageCount = test.pageEnd - test.page + 1
  })

  const pool = await sql.connect(connectionString)
  try {
    const existingTopics = await pool
      .request()
      .input('b', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
      .query('SELECT COUNT(*) AS cnt FROM dbo.ResourceBookTopics WHERE resource_book_id = @b;')
    if (existingTopics.recordset[0].cnt > 0) {
      throw new Error(`Bu kaynakta zaten ${existingTopics.recordset[0].cnt} konu var — script atlandı (mükerrer içerik riski).`)
    }

    let flatIdx = 0
    let topicCount = 0
    let testCount = 0
    let answerRows = 0

    for (const topic of TOPICS) {
      const topicResult = await pool
        .request()
        .input('b', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
        .input('name', sql.NVarChar(200), topic.name)
        .query('INSERT INTO dbo.ResourceBookTopics (resource_book_id, name) OUTPUT inserted.id VALUES (@b, @name);')
      const topicId = topicResult.recordset[0].id
      topicCount += 1
      console.log(`+ Konu: ${topic.name}`)

      for (const test of topic.tests) {
        const flatTest = flat[flatIdx]
        flatIdx += 1
        const answers = test.answers.split('')

        const testResult = await pool
          .request()
          .input('topicId', sql.UniqueIdentifier, topicId)
          .input('name', sql.NVarChar(200), flatTest.name)
          .input('pageStart', sql.Int, test.page)
          .input('pageEnd', sql.Int, flatTest.pageEnd)
          .input('pageCount', sql.Int, flatTest.pageCount)
          .input('questionCount', sql.Int, answers.length)
          .query(`
            INSERT INTO dbo.ResourceBookTopicTests (topic_id, name, page_start, page_end, page_count, question_count)
            OUTPUT inserted.id
            VALUES (@topicId, @name, @pageStart, @pageEnd, @pageCount, @questionCount);
          `)
        const testId = testResult.recordset[0].id
        testCount += 1

        const request = pool.request().input('testId', sql.UniqueIdentifier, testId)
        const values = []
        answers.forEach((label, idx) => {
          request.input(`order${idx}`, sql.Int, idx + 1)
          request.input(`label${idx}`, sql.NChar(1), label)
          values.push(`(@testId, @order${idx}, @label${idx})`)
        })
        await request.query(`
          INSERT INTO dbo.TestAnswerKeys (test_id, order_no, correct_label)
          VALUES ${values.join(', ')};
        `)
        answerRows += answers.length
        console.log(`   + ${flatTest.name} (s.${test.page}-${flatTest.pageEnd}): ${test.answers}`)
      }
    }

    console.log(`Bitti. ${topicCount} konu, ${testCount} test, ${answerRows} cevap satırı oluşturuldu.`)
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error('İçerik/cevap anahtarı oluşturma başarısız')
  console.error(error)
  process.exit(1)
})
