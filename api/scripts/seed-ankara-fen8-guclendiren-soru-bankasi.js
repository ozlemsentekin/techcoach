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

// Ankara Yayıncılık — "Fen Bilimleri Güçlendiren Soru Bankası" (8. sınıf, scope = 'catalog' / Kütüphane).
// Kaynağın İçindekiler'i ve kendi "CEVAP ANAHTARI" sayfaları temel alınarak her ünite bir "İçerik"
// (ResourceBookTopic) olarak eklenir, ardından o ünitenin testleri + çoktan seçmeli cevap anahtarı yazılır.
// Cevap anahtarı kaynakta ünite bazında (Test 1..N) verildiği için testler de ünite altında numaralanır.
//
// Sayfa numaraları: kaynakta test bazında sayfa yok; İçindekiler'den her ünitenin başlangıç sayfası
// alınıp, soru sayısına göre (~4 soru/sayfa) ileri yürünerek testlere sıralı page_start atanır
// (panelde sıralama için — yaklaşık değerdir, birebir sayfa değil).
//
// İdempotent: kaynakta zaten İçerik varsa mükerrer eklememek için durur.
const RESOURCE_BOOK_ID = 'F9DF5A97-F6BB-4F93-9A4B-4C28DC0D04D7'

// answers: cevap anahtarındaki sırayla harf dizisi. question_count = dizinin uzunluğu.
const UNITES = [
  {
    no: 1,
    name: 'Mevsimler ve İklim',
    // İçindekiler: Mevsimlerin Oluşumu (11), İklim ve Hava Hareketleri (25)
    startPage: 11,
    tests: [
      'CACBDCDB',
      'BBADDACC',
      'CBBBDDA',
      'CACBADDC',
      'BCAADDDBC',
      'BCADBDCA',
      'BBCDDCAB',
      'DDCCBACA',
    ],
  },
  {
    no: 2,
    name: 'DNA ve Genetik Kod',
    // İçindekiler: DNA ve Genetik Kod (39), Kalıtım (51), Mutasyon ve Modifikasyon (69),
    // Adaptasyon (79), Biyoteknoloji (89)
    startPage: 39,
    tests: [
      'CBDACABCDB',
      'BAACBACDD',
      'DCCAABBD',
      'BCDBAACD',
      'ACDCDBBCBA',
      'BCACABDDB',
      'ADCACBADBD',
      'DBCACCAB',
      'CADDBDBA',
      'DDCBCCBD',
      'CADDCBBCDA',
      'DBBCCAAC',
      'CABCCDDB',
      'ABDACCBDC',
      'ADDCBBDBD',
      'CADCDBD',
      'BDACABDCD',
      'DABCCAAD',
    ],
  },
  {
    no: 3,
    name: 'Basınç',
    // İçindekiler: Katılarda Basınç (97), Sıvı ve Gazlarda Basınç (109)
    startPage: 97,
    tests: [
      'CAABBCDBD',
      'ADBCDACB',
      'DDCAABBC',
      'CBDCDAB',
      'ACBABBDDD',
      'CDBCBACD',
      'ABCADCDB',
      'DCBBDDAC',
    ],
  },
  {
    no: 4,
    name: 'Madde ve Endüstri',
    // İçindekiler: Periyodik Sistem (123), Fiziksel ve Kimyasal Değişimler (135),
    // Kimyasal Tepkimeler (143), Asitler ve Bazlar (149), Maddenin Isı ile Etkileşimi (163),
    // Maddenin Isı ile Etkileşimi - Türkiye'de Kimya Endüstrisi (167)
    startPage: 123,
    tests: [
      'DBBACCCAD',
      'CADDBDCAAB',
      'DCADDBAC',
      'BBABDCCD',
      'CABCDBCDD',
      'ABCDADCBCDCB',
      'BDCACBAD',
      'BDACDBDC',
      'CADBADBCCD',
      'CDCAACCDB',
      'BDCAABAB',
      'BDADCBDCDC',
      'BCADABCDD',
      'BACBABDD',
      'CCBBCACBDA',
      'BBDBDCACDA',
      'BDCDACCB',
      'CCDDCBBA',
    ],
  },
  {
    no: 5,
    name: 'Basit Makineler',
    // İçindekiler: Makaralar - Kaldıraçlar (183), Eğik Düzlem - Çıkrık - Diğer Basit Makineler (195)
    startPage: 183,
    tests: [
      'CBADCBADCB',
      'DCBDDBAC',
      'BCABADCB',
      'BACDCDD',
      'CBCDBABADD',
      'CBABDDDC',
      'BABADCDA',
      'DCADCBBA',
    ],
  },
  {
    no: 6,
    name: 'Enerji Dönüşümleri ve Çevre Bilimi',
    // İçindekiler: Besin Zinciri ve Enerji Akışı (209), Enerji Dönüşümleri (217),
    // Madde Döngüleri ve Çevre Sorunları - Sürdürülebilir Kalkınma (233)
    startPage: 209,
    tests: [
      'ACADBDDABCB',
      'CCDCDABB',
      'DBCACBDA',
      'CCDAABCDB',
      'CDDBAABC',
      'DABCCDAD',
      'AACCBDD',
      'BCDABA',
      'ACDBACDB',
      'CCABADBD',
      'DDACCDADDCBD',
    ],
  },
  {
    no: 7,
    name: 'Elektrik Yükleri ve Elektrik Enerjisi',
    // İçindekiler: Elektrik Yükleri ve Elektriklenme (245), Elektrik Yüklü Cisimler (253),
    // Elektrik Enerjisinin Dönüşümü (261)
    startPage: 245,
    tests: [
      'ABCACBDBDCA',
      'CDDAACBBC',
      'BBDDABDA',
      'CCCADBBDA',
      'CBABCDAD',
      'ABCCADDB',
      'BBAACADDDCB',
      'CACBDBDA',
      'BDCDCAB',
    ],
  },
]

function icerikDbName(no, name) {
  return `${no}. Ünite · ${name}`
}

async function main() {
  loadLocalSettings()
  if (!process.env.SQL_CONNECTION_STRING) throw new Error('SQL_CONNECTION_STRING is missing.')

  // Ön doğrulama
  for (const u of UNITES) {
    u.tests.forEach((answers, i) => {
      if (!/^[A-D]+$/.test(answers)) {
        throw new Error(`Geçersiz cevap dizisi: Ü${u.no} Test ${i + 1} — ${answers}`)
      }
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
    console.log(`ResourceBook: ${b.name} (scope=${b.scope}, ${b.grade}. sınıf)\n`)

    const existingTopics = await pool
      .request()
      .input('rbId', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
      .query('SELECT COUNT(*) AS cnt FROM dbo.ResourceBookTopics WHERE resource_book_id = @rbId;')
    if (existingTopics.recordset[0].cnt > 0) {
      console.log('Kaynakta zaten İçerik var — mükerrer eklememek için çıkılıyor.')
      return
    }

    let topicsCreated = 0
    let testsCreated = 0
    let keysInserted = 0

    for (const u of UNITES) {
      const name = icerikDbName(u.no, u.name)
      const ins = await pool
        .request()
        .input('rbId', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
        .input('name', sql.NVarChar(200), name)
        .query('INSERT INTO dbo.ResourceBookTopics (resource_book_id, name) OUTPUT inserted.id VALUES (@rbId, @name);')
      const topicId = ins.recordset[0].id
      topicsCreated += 1
      console.log(`İçerik (yeni): ${name}`)

      let cursor = u.startPage
      for (let i = 0; i < u.tests.length; i += 1) {
        const answers = u.tests[i]
        const questionCount = answers.length
        const pages = Math.max(1, Math.ceil(questionCount / 4))
        const pageStart = cursor
        const pageEnd = cursor + pages - 1
        cursor = pageEnd + 1

        const testName = `Test ${i + 1}`
        const insTest = await pool
          .request()
          .input('topicId', sql.UniqueIdentifier, topicId)
          .input('topicName', sql.NVarChar(200), name)
          .input('name', sql.NVarChar(200), testName)
          .input('pageStart', sql.Int, pageStart)
          .input('pageEnd', sql.Int, pageEnd)
          .input('pageCount', sql.Int, pageEnd - pageStart + 1)
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
        answers.split('').forEach((label, idx) => {
          req.input(`o${idx}`, sql.Int, idx + 1)
          req.input(`l${idx}`, sql.NChar(1), label)
          valueRows.push(`(@testId, @o${idx}, @l${idx})`)
        })
        await req.query(`INSERT INTO dbo.TestAnswerKeys (test_id, order_no, correct_label) VALUES ${valueRows.join(', ')};`)
        keysInserted += 1
        console.log(`  ${testName}: ${questionCount} soru (sayfa ${pageStart}) — ${answers}`)
      }
    }

    console.log(
      `\nBitti. İçerik: +${topicsCreated}, test: +${testsCreated}, cevap anahtarı yazılan test: +${keysInserted}`,
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
