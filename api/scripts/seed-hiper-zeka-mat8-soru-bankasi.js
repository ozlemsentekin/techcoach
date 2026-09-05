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

// Hiper Zeka Yayınları — "Hiper Matematik Konu Anlatımlı & Etkinlikli Soru Bankası 8. Sınıf"
// (scope = 'catalog' / Kütüphane; kaynak panelde önceden oluşturuldu, bu script sadece İÇERİK + TEST + CEVAP ANAHTARI ekler).
//
// Her "İçerik" (ResourceBookTopic) kaynağın İçindekiler'inden bir konu alanıdır. Kitabın kendi
// numaralandırması sürekli (Kazanım Testi 1..N, Yeni Nesil Test 1..N) ve cevap anahtarında testler
// üniteyle etiketlenmediği için test adları kitaptaki etiketle birebir yazılır ("Kazanım Testi 3",
// "Yeni Nesil Test 6" ...). page_start = testin kitaptaki gerçek başlangıç sayfası (başlık sayfası
// fotoğraflarından); page_end soru sayısına göre (~4 soru/sayfa) yaklaşık hesaplanır — panelde
// sıralama içindir, birebir sayfa değildir.
//
// İdempotent: aynı isimde bir İçerik zaten varsa o İçerik atlanır (kalan üniteler sonradan eklenebilir).
//
// Cevap anahtarları: Kazanım testlerinin tamamı + Yeni Nesil testlerin ilk 2 sorusu tek tek elle
// çözülerek doğrulandı. Yeni Nesil testlerin 3. sorudan sonrası (kitabın çok sayfalı test sayfaları
// panelde yok) kaynağın "CEVAP ANAHTARI" fotoğrafından okundu.

const PUBLISHER_NAME = 'Hiper Zeka Yayınları'
const BOOK_NAME = 'Hiper Matematik Konu Anlatımlı & Etkinlikli Soru Bankası 8. Sınıf'

const ICERIKLER = [
  {
    name: '1. Ünite · Çarpanlar ve Katlar',
    tests: [
      { type: 'kazanim', no: 1, page: 13, answers: 'CADDCBBAC' },
      { type: 'kazanim', no: 2, page: 15, answers: 'DCAACD' },
      { type: 'kazanim', no: 3, page: 24, answers: 'CAACBCBAD' },
      { type: 'kazanim', no: 4, page: 26, answers: 'CABDCC' },
      { type: 'kazanim', no: 5, page: 30, answers: 'CCCAABBAD' },
      { type: 'yeninesil', no: 6, page: 32, answers: 'BCDCB' },
      { type: 'yeninesil', no: 7, page: 34, answers: 'BCAD' },
      { type: 'yeninesil', no: 8, page: 36, answers: 'BCDC' },
      { type: 'yeninesil', no: 9, page: 38, answers: 'BDBCD' },
      { type: 'yeninesil', no: 10, page: 40, answers: 'CDBC' },
    ],
  },
  {
    name: '1. Ünite · Üslü İfadeler',
    tests: [
      { type: 'kazanim', no: 11, page: 44, answers: 'ACDCCDAABB' },
      { type: 'kazanim', no: 12, page: 48, answers: 'ACACADBD' },
      { type: 'kazanim', no: 13, page: 58, answers: 'CBBACCCDD' },
      { type: 'kazanim', no: 14, page: 60, answers: 'ADACDDCD' },
      { type: 'kazanim', no: 15, page: 64, answers: 'CDBACDB' },
      { type: 'kazanim', no: 16, page: 68, answers: 'DCBABCDCBC' },
      { type: 'kazanim', no: 17, page: 72, answers: 'CDBDBACB' },
      { type: 'yeninesil', no: 18, page: 76, answers: 'BAAC' },
      { type: 'yeninesil', no: 19, page: 78, answers: 'DCAC' },
      { type: 'yeninesil', no: 20, page: 80, answers: 'ACAC' },
      { type: 'yeninesil', no: 21, page: 82, answers: 'BDDC' },
      { type: 'yeninesil', no: 22, page: 84, answers: 'CABA' },
    ],
  },
  {
    name: '2. Ünite · Kareköklü İfadeler',
    tests: [
      { type: 'kazanim', no: 23, page: 90, answers: 'AADBDBCCDB' },
      { type: 'kazanim', no: 24, page: 94, answers: 'BCABDDACDC' },
      { type: 'kazanim', no: 25, page: 98, answers: 'DDACBCABCA' },
      { type: 'kazanim', no: 26, page: 102, answers: 'CBDBCDACDC' },
      { type: 'kazanim', no: 27, page: 104, answers: 'CABACABD' },
      { type: 'kazanim', no: 28, page: 110, answers: 'BACBDDBA' },
      { type: 'kazanim', no: 29, page: 114, answers: 'DBDCBDAAD' },
      { type: 'kazanim', no: 30, page: 122, answers: 'BACABDCBB' },
      { type: 'kazanim', no: 31, page: 126, answers: 'DCCCBACC' },
      { type: 'yeninesil', no: 32, page: 128, answers: 'BDBC' },
      { type: 'yeninesil', no: 33, page: 130, answers: 'BCCD' },
      { type: 'yeninesil', no: 34, page: 132, answers: 'BDDC' },
      { type: 'yeninesil', no: 35, page: 134, answers: 'CDAA' },
      { type: 'yeninesil', no: 36, page: 136, answers: 'AACB' },
    ],
  },
  {
    name: '2. Ünite · Veri Analizi',
    tests: [
      { type: 'kazanim', no: 37, page: 140, answers: 'CBCACBCB' },
      { type: 'kazanim', no: 38, page: 144, answers: 'ACBBCBCCD' },
      { type: 'yeninesil', no: 39, page: 146, answers: 'DCCD' },
      { type: 'yeninesil', no: 40, page: 148, answers: 'BBCA' },
      { type: 'yeninesil', no: 41, page: 150, answers: 'BCAB' },
      { type: 'yeninesil', no: 42, page: 152, answers: 'DBDC' },
    ],
  },
  {
    name: '3. Ünite · Olasılık',
    tests: [
      { type: 'kazanim', no: 43, page: 162, answers: 'DDCAAABBCACDCBBB' },
      { type: 'kazanim', no: 44, page: 164, answers: 'BCDDDAABCADCBBACB' },
      { type: 'kazanim', no: 45, page: 166, answers: 'DDDCABCBABCB' },
      { type: 'yeninesil', no: 46, page: 170, answers: 'DCBA' },
      { type: 'yeninesil', no: 47, page: 172, answers: 'DADD' },
      { type: 'yeninesil', no: 48, page: 174, answers: 'CACB' },
      { type: 'yeninesil', no: 49, page: 176, answers: 'CCCA' },
    ],
  },
  {
    name: '3. Ünite · Cebirsel İfadeler',
    tests: [
      { type: 'kazanim', no: 50, page: 180, answers: 'DDAACBDBCCBABCDADA' },
      { type: 'kazanim', no: 51, page: 184, answers: 'CDBABBDAACBAACD' },
      { type: 'kazanim', no: 52, page: 190, answers: 'DDBCBDDCAABDDCB' },
      { type: 'kazanim', no: 53, page: 192, answers: 'BDDDAACBDBBC' },
      { type: 'kazanim', no: 54, page: 196, answers: 'CDBCBADABDCCCDBC' },
      { type: 'yeninesil', no: 55, page: 198, answers: 'AACD' },
      { type: 'yeninesil', no: 56, page: 200, answers: 'CCAC' },
      { type: 'yeninesil', no: 57, page: 202, answers: 'AABA' },
      { type: 'yeninesil', no: 58, page: 204, answers: 'DCDD' },
    ],
  },
  {
    // İçindekiler'de "DOĞRUSAL DENKLEMLER" başlığı: Denklemler + Koordinat Sistemi + Doğrusal İlişki + Eğim
    // (hepsi tek İçerik). Eşitsizlikler kısmı (Test 75+) cevap anahtarı geldiğinde eklenecek.
    name: '4. Ünite · Doğrusal Denklemler',
    tests: [
      { type: 'kazanim', no: 59, page: 214, answers: 'CBADDABCADACCDBC' },
      { type: 'kazanim', no: 60, page: 216, answers: 'CBBADBBBDCCAC' },
      { type: 'yeninesil', no: 61, page: 218, answers: 'BBAB' },
      { type: 'yeninesil', no: 62, page: 220, answers: 'DCBD' },
      { type: 'yeninesil', no: 63, page: 222, answers: 'CBDDB' },
      { type: 'yeninesil', no: 64, page: 224, answers: 'CBCAB' },
      { type: 'yeninesil', no: 65, page: 226, answers: 'CBCA' },
      { type: 'kazanim', no: 66, page: 230, answers: 'DCABADBCCADBBD' },
      { type: 'kazanim', no: 67, page: 234, answers: 'BACCDBBABD' },
      { type: 'kazanim', no: 68, page: 240, answers: 'DCCBCDBBBDABCAA' },
      { type: 'yeninesil', no: 69, page: 242, answers: 'CABB' },
      { type: 'yeninesil', no: 70, page: 244, answers: 'CDCD' },
      { type: 'kazanim', no: 71, page: 250, answers: 'ABCCDACBDCDAC' },
      { type: 'kazanim', no: 72, page: 252, answers: 'ADBCBBDDCDACD' },
      { type: 'yeninesil', no: 73, page: 254, answers: 'CBABC' },
      { type: 'yeninesil', no: 74, page: 256, answers: 'CDBA' },
    ],
  },
  {
    name: '4. Ünite · Eşitsizlikler',
    tests: [
      { type: 'kazanim', no: 75, page: 264, answers: 'DCBDACBDBABAD' },
      { type: 'kazanim', no: 76, page: 266, answers: 'ADCBBDBDCBDAD' },
      { type: 'kazanim', no: 77, page: 268, answers: 'ADCBDABABCCCCB' },
      { type: 'yeninesil', no: 78, page: 272, answers: 'DABC' },
      { type: 'yeninesil', no: 79, page: 274, answers: 'DBAC' },
    ],
  },
  {
    // İçindekiler kapağı: "Üçgenler" (5 alt konu) + "Eşlik ve Benzerlik" (2 alt konu)
    name: '5. Ünite · Üçgenler',
    tests: [
      { type: 'kazanim', no: 80, page: 282, answers: 'CCCBBCADBADC' },
      { type: 'kazanim', no: 81, page: 284, answers: 'CABCABDCBD' },
      { type: 'kazanim', no: 82, page: 290, answers: 'ABDBCCDBBDAAC' },
      { type: 'kazanim', no: 83, page: 292, answers: 'CCABDACADBCDC' },
      { type: 'kazanim', no: 84, page: 298, answers: 'BCADBDDDBAAB' },
      { type: 'kazanim', no: 85, page: 302, answers: 'DDACBCCDBAAC' },
      { type: 'yeninesil', no: 86, page: 304, answers: 'CDBB' },
      { type: 'kazanim', no: 87, page: 312, answers: 'DCDBACABCDBB' },
      { type: 'kazanim', no: 88, page: 314, answers: 'BACCBDCDBABC' },
      { type: 'yeninesil', no: 89, page: 320, answers: 'BACC' },
      { type: 'yeninesil', no: 90, page: 322, answers: 'ABCC' },
      { type: 'yeninesil', no: 91, page: 324, answers: 'CCAD' },
      { type: 'yeninesil', no: 92, page: 326, answers: 'CDBB' },
    ],
  },
  {
    name: '5. Ünite · Eşlik ve Benzerlik',
    tests: [
      { type: 'kazanim', no: 93, page: 334, answers: 'DBDDAAABABCD' },
      { type: 'kazanim', no: 94, page: 336, answers: 'DCACBDCCBDCA' },
      { type: 'yeninesil', no: 95, page: 338, answers: 'BADB' },
      { type: 'yeninesil', no: 96, page: 340, answers: 'DDBC' },
      { type: 'yeninesil', no: 97, page: 342, answers: 'BCAA' },
    ],
  },
  {
    name: '6. Ünite · Dönüşüm Geometrisi',
    tests: [
      { type: 'kazanim', no: 98, page: 348, answers: 'ACBBBDCCBDBA' },
      { type: 'kazanim', no: 99, page: 352, answers: 'CBCCCDDAA' },
      { type: 'yeninesil', no: 100, page: 354, answers: 'BABCAD' },
      { type: 'yeninesil', no: 101, page: 356, answers: 'CBD' },
      { type: 'yeninesil', no: 102, page: 358, answers: 'CD' },
    ],
  },
  {
    name: '6. Ünite · Geometrik Cisimler',
    tests: [
      { type: 'kazanim', no: 103, page: 364, answers: 'BCADCBABADC' },
      { type: 'kazanim', no: 104, page: 368, answers: 'DBDABDBCBA' },
      { type: 'kazanim', no: 105, page: 372, answers: 'ACCAAABABDD' },
      { type: 'kazanim', no: 106, page: 376, answers: 'BACBDCCADDB' },
      { type: 'kazanim', no: 107, page: 382, answers: 'DDCBABBDDDC' },
      { type: 'kazanim', no: 108, page: 386, answers: 'DCDBBCAADBC' },
      { type: 'yeninesil', no: 109, page: 388, answers: 'DBAD' },
    ],
  },
]

function testDisplayName(t) {
  return t.type === 'kazanim' ? `Kazanım Testi ${t.no}` : `Yeni Nesil Test ${t.no}`
}

async function main() {
  loadLocalSettings()
  if (!process.env.SQL_CONNECTION_STRING) throw new Error('SQL_CONNECTION_STRING is missing.')

  // Ön doğrulama
  for (const ic of ICERIKLER) {
    for (const t of ic.tests) {
      if (!/^[A-D]+$/.test(t.answers)) {
        throw new Error(`Geçersiz cevap dizisi: ${testDisplayName(t)} — ${t.answers}`)
      }
    }
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
    let keysInserted = 0

    for (const ic of ICERIKLER) {
      const existing = await pool
        .request()
        .input('rbId', sql.UniqueIdentifier, resourceBookId)
        .input('name', sql.NVarChar(200), ic.name)
        .query('SELECT id FROM dbo.ResourceBookTopics WHERE resource_book_id = @rbId AND name = @name;')
      if (existing.recordset.length) {
        console.log(`İçerik (var, atlandı): ${ic.name}`)
        topicsSkipped += 1
        continue
      }

      const ins = await pool
        .request()
        .input('rbId', sql.UniqueIdentifier, resourceBookId)
        .input('name', sql.NVarChar(200), ic.name)
        .query('INSERT INTO dbo.ResourceBookTopics (resource_book_id, name) OUTPUT inserted.id VALUES (@rbId, @name);')
      const topicId = ins.recordset[0].id
      topicsCreated += 1
      console.log(`İçerik (yeni): ${ic.name}`)

      for (const t of ic.tests) {
        const questionCount = t.answers.length
        const pages = Math.max(1, Math.ceil(questionCount / 4))
        const pageStart = t.page
        const pageEnd = pageStart + pages - 1
        const testName = testDisplayName(t)

        const insTest = await pool
          .request()
          .input('topicId', sql.UniqueIdentifier, topicId)
          .input('topicName', sql.NVarChar(200), ic.name)
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
        t.answers.split('').forEach((label, idx) => {
          req.input(`o${idx}`, sql.Int, idx + 1)
          req.input(`l${idx}`, sql.NChar(1), label)
          valueRows.push(`(@testId, @o${idx}, @l${idx})`)
        })
        await req.query(`INSERT INTO dbo.TestAnswerKeys (test_id, order_no, correct_label) VALUES ${valueRows.join(', ')};`)
        keysInserted += 1
        console.log(`  ${testName}: ${questionCount} soru (sayfa ${pageStart}) — ${t.answers}`)
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
