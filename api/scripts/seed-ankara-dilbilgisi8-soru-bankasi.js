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

// Ankara Yayıncılık — "Güçlendiren Soru Bankası Dilbilgisi" (8. sınıf, Türkçe, scope='catalog' / Kütüphane).
// Kaynağın kendi cevap anahtarı BÖLÜM bazında etiketli (test başlık sayfası fotoğrafına gerek kalmadı),
// bu yüzden her bölüm bir "İçerik" (ResourceBookTopic), testler o bölümde "Test 1..N" olarak sürekli
// numaralanıyor (her bölüm kendi içinde 1'den başlıyor — kitaptaki gibi).
//
// Sayfa numaraları: kaynakta test bazında sayfa yok; İçindekiler'den her bölümün alt konu başlangıç
// sayfası alınıp, soru sayısına göre (~4 soru/sayfa) ileri yürünerek testlere sıralı page_start atanır
// (panelde sıralama için — yaklaşık değerdir, birebir sayfa değildir). topic_name testin altında
// bulunduğu alt konudur (page_start'a göre otomatik atanır).
//
// İdempotent: kaynakta zaten İçerik varsa mükerrer eklememek için o İçerik atlanır.
const PUBLISHER_NAME = 'Ankara Yayıncılık'
const BOOK_NAME = 'Güçlendiren Soru Bankası Dilbilgisi 8. Sınıf'

const BOLUMLER = [
  {
    name: 'Fiilimsi (Eylemsi)',
    segments: [
      { name: 'İsim-Fiil (Ad-Eylem)', start: 11 },
      { name: 'Sıfat-Fiil (Ortaç)', start: 15 },
      { name: 'Zarf-Fiil (Bağ-Fiil/Ulaç)', start: 19 },
      { name: 'Fiilimsi (Eylemsi)', start: 23 },
    ],
    sentinel: 49,
    tests: [
      'DADCCCDDACBD',
      'CBDACABABCBB',
      'ADCDBADAAACB',
      'DDDBCBDABCAB',
      'BABCBBDDCDCB',
      'CAADCDCBDDCA',
      'DCBABADCCAAD',
      'BABADABDCDAC',
      'BDDCBCDBCACCABAADCAC',
      'DAACDDCBACCCDDABCCDB',
      'BADCCBDCBDC',
      'DBADACBCC',
      'AABCBABCDB',
    ],
  },
  {
    name: 'Cümlenin Ögeleri',
    segments: [
      { name: 'Temel ve Yardımcı Ögeler', start: 49 },
      { name: 'Cümlede Vurgu', start: 59 },
      { name: 'Ara Söz, Cümle Dışı Unsur', start: 61 },
      { name: 'Cümlenin Ögeleri', start: 63 },
    ],
    sentinel: 85,
    tests: [
      'BBDDCACBDCBC',
      'CDDDADDABDCC',
      'BADCDDCCCDBD',
      'BDADDCACCADC',
      'BDCACDDBDBBA',
      'BCBDCCADBDDD',
      'BDAACCBBBDC',
      'ABBCBCBBBCCBDDDCDBDA',
      'BCBCABCDAABAABBDAC',
      'CABCADBCCC',
      'ACCADDBBADAD',
      'BBAACADCCADB',
    ],
  },
  {
    name: 'Fiilde (Eylemde) Çatı',
    segments: [
      { name: 'Özne-Yüklem İlişkisine Göre Fiiller', start: 85 },
      { name: 'Nesne-Yüklem İlişkisine Göre Fiiller', start: 89 },
      { name: 'Fiilde (Eylemde) Çatı', start: 93 },
    ],
    sentinel: 113,
    tests: [
      'BBBDACBBACBC',
      'CCBCCBBDCDCC',
      'CACAABBBBBDB',
      'CAACCCDCCCAA',
      'DCBDBCABDAC',
      'DABBDBADBCBBBDDBCAAB',
      'CBCCBBABADDDDACCCBBA',
      'BACCDBCDBAB',
      'DADCCDBDCB',
    ],
  },
  {
    name: 'Cümle Türleri',
    segments: [
      { name: 'Yüklemin Yerine, Türüne ve Anlamına Göre Cümleler', start: 113 },
      { name: 'Yapısına Göre Cümleler', start: 119 },
      { name: 'Cümle Türleri', start: 125 },
    ],
    sentinel: 143,
    tests: [
      'ADCDDABCBBAB',
      'DAABCCCCBCDA',
      'DCCBDACABBDC',
      'BCDCCDBCBCCB',
      'DADABCADAABD',
      'ABDDCDAABBBA',
      'ABACAABCAACBACDCDCAB',
      'ADABDACAABCCCCDBDC',
      'BBADDDCCDA',
      'DCDADACDBBD',
    ],
  },
  {
    name: 'Anlatım Bozuklukları',
    segments: [
      { name: 'Yapısal Bozukluklar', start: 143 },
      { name: 'Anlatım Bozuklukları', start: 161 },
    ],
    sentinel: 171,
    tests: [
      'DCCCDCDCBBAA',
      'CACCCBCBDBAD',
      'DBCACAADBBBA',
      'BCACADACBCCB',
      'ACAABBCAADC',
      'CABDCADABCDADBCDCBAD',
      'BCACDDCBADACDCBBCADA',
      'BADDACBDACBA',
      'ADDACCDBBDCA',
    ],
  },
  {
    name: 'Yazım Kuralları',
    segments: [
      { name: 'Büyük Harflerin Yazımı', start: 171 },
      { name: 'Sayıların ve Kısaltmaların Yazımı', start: 175 },
      { name: "De, Mi, Ki'nin Yazımı", start: 179 },
      { name: 'Pekiştirmelerin, İkilemelerin ve Birleşik Sözcüklerin Yazımı', start: 183 },
      { name: 'Yazımı Karıştırılan Sözcükler, Ses Olayları ile İlgili Yanlışlıklar', start: 185 },
      { name: 'Yazım Kuralları', start: 187 },
    ],
    sentinel: 205,
    tests: [
      'ACCDBAABDAC',
      'DCBAAADDDCBB',
      'AACBDACCACCD',
      'ADCBDCBDAACC',
      'ACADDBCBCBCB',
      'BCDDCAACDBAD',
      'DAADCCBCBDBA',
      'ACCCABCACABB',
      'AABDAACCBBBCBCDDDCAD',
      'BCCDABCBADDAABDBCBCA',
      'BCCDCBACBBDD',
      'BAABDBBAABBD',
    ],
  },
  {
    name: 'Noktalama İşaretleri',
    segments: [{ name: 'Noktalama İşaretleri', start: 205 }],
    sentinel: 229,
    tests: [
      'BBACBCBBABAD',
      'ABDBBACDACAA',
      'CCBABDDCCCAA',
      'CDCDBAABBCBB',
      'DBADDACBCDDD',
      'BBDBBDBDCCBD',
      'DCDBDADACACCDCACCBCA',
      'ABDBDDCABCBA',
      'BABABCCDABDC',
    ],
  },
]

function buildTests(bolum) {
  const segments = [...bolum.segments, { name: '__SENTINEL__', start: bolum.sentinel }]
  let cursor = segments[0].start
  const built = []

  bolum.tests.forEach((answers, idx) => {
    if (!/^[A-D]+$/.test(answers)) {
      throw new Error(`${bolum.name} Test ${idx + 1}: geçersiz cevap dizisi — ${answers}`)
    }

    let topicName = segments[0].name
    for (const seg of segments) {
      if (seg.start <= cursor) topicName = seg.name === '__SENTINEL__' ? topicName : seg.name
    }

    const count = answers.length
    const pages = Math.max(1, Math.ceil(count / 4))
    const pageStart = cursor
    const pageEnd = cursor + pages - 1

    built.push({
      testNo: idx + 1,
      topicName,
      pageStart,
      pageEnd,
      answers: answers.split(''),
    })

    cursor = pageEnd + 1
  })

  return built
}

async function main() {
  loadLocalSettings()
  if (!process.env.SQL_CONNECTION_STRING) throw new Error('SQL_CONNECTION_STRING is missing.')

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
    let keysInserted = 0

    for (const bolum of BOLUMLER) {
      const existing = await pool
        .request()
        .input('rbId', sql.UniqueIdentifier, resourceBookId)
        .input('name', sql.NVarChar(200), bolum.name)
        .query('SELECT id FROM dbo.ResourceBookTopics WHERE resource_book_id = @rbId AND name = @name;')
      if (existing.recordset.length) {
        console.log(`İçerik (var, atlandı): ${bolum.name}`)
        topicsSkipped += 1
        continue
      }

      const ins = await pool
        .request()
        .input('rbId', sql.UniqueIdentifier, resourceBookId)
        .input('name', sql.NVarChar(200), bolum.name)
        .query('INSERT INTO dbo.ResourceBookTopics (resource_book_id, name) OUTPUT inserted.id VALUES (@rbId, @name);')
      const topicId = ins.recordset[0].id
      topicsCreated += 1
      console.log(`İçerik (yeni): ${bolum.name}`)

      const tests = buildTests(bolum)
      for (const t of tests) {
        const testName = `Test ${t.testNo}`
        const insTest = await pool
          .request()
          .input('topicId', sql.UniqueIdentifier, topicId)
          .input('topicName', sql.NVarChar(200), t.topicName)
          .input('name', sql.NVarChar(200), testName)
          .input('pageStart', sql.Int, t.pageStart)
          .input('pageEnd', sql.Int, t.pageEnd)
          .input('pageCount', sql.Int, t.pageEnd - t.pageStart + 1)
          .input('questionCount', sql.Int, t.answers.length)
          .query(`
            INSERT INTO dbo.ResourceBookTopicTests (topic_id, topic_name, name, page_start, page_end, page_count, question_count)
            OUTPUT inserted.id
            VALUES (@topicId, @topicName, @name, @pageStart, @pageEnd, @pageCount, @questionCount);
          `)
        const testId = insTest.recordset[0].id
        testsCreated += 1

        const req = pool.request().input('testId', sql.UniqueIdentifier, testId)
        const valueRows = []
        t.answers.forEach((label, idx) => {
          req.input(`o${idx}`, sql.Int, idx + 1)
          req.input(`l${idx}`, sql.NChar(1), label)
          valueRows.push(`(@testId, @o${idx}, @l${idx})`)
        })
        await req.query(`INSERT INTO dbo.TestAnswerKeys (test_id, order_no, correct_label) VALUES ${valueRows.join(', ')};`)
        keysInserted += 1
        console.log(`  ${testName} (${t.topicName}): ${t.answers.length} soru (sayfa ${t.pageStart}) — ${t.answers.join('')}`)
      }
    }

    console.log(
      `\nBitti. İçerik: +${topicsCreated} (atlanan ${topicsSkipped}), test: +${testsCreated}, cevap anahtarı yazılan test: +${keysInserted}`,
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
