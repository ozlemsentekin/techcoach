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

// Bilfen Yayınları — "Pro & Test Soru Bankası - Fen Bilimleri 8. Sınıf"
// (scope = 'catalog' / Kütüphane; kaynak panelde önceden oluşturuldu, bu script sadece
//  İÇERİK + TEST KONUSU/ADI + SAYFA NUMARASI + CEVAP ANAHTARI ekler — soru metni yok,
//  diğer soru bankası kaynaklarındaki gibi).
//
// İçerik (ResourceBookTopics): kitabın İÇİNDEKİLER'indeki konu başlıkları, "N. Ünite · Konu" biçiminde.
//   Ünite tarama testleri "N. Ünite · Ünite Tarama Testi", ünitelere ait olmayanlar
//   "Yarıyıl Tarama Testi" / "Yıl Sonu Tarama Testi" olarak ayrı İçerik.
// Test adları kitaptaki global numaralandırmayla ("Test 1" .. "Test 55").
// page: her testin sayfa başlığından okunan basılı sayfa numarası (İÇİNDEKİLER ile çapraz kontrol).
//   page_end, sayfa başına ~4 soru varsayımıyla soru sayısından hesaplanır (kitap düzeni 2x2).
// answers: kitabın "YANIT ANAHTARI" sayfalarından (s. 255-256) sırayla transkribe edilen harf dizisi;
//   Test 25-55 iki ayrı fotoğraftan çapraz kontrol edildi. question_count = dizinin uzunluğu.
//
// İdempotent: her İçerik adı için ayrı ayrı — zaten varsa o İçerik atlanır.
const PUBLISHER_NAME = 'Bilfen Yayınları'
const BOOK_NAME = 'Pro & Test Soru Bankası - Fen Bilimleri 8. Sınıf'

const ICERIKLER = [
  {
    name: '1. Ünite · Mevsimlerin Oluşumu',
    tests: [
      { no: 1, page: 8, answers: 'DCBCCDABBDA' },
      { no: 2, page: 12, answers: 'CDDB' },
    ],
  },
  {
    name: '1. Ünite · İklim ve Hava Hareketleri',
    tests: [
      { no: 3, page: 14, answers: 'DCABCDBADC' },
      { no: 4, page: 18, answers: 'CCBDAC' },
    ],
  },
  {
    name: '1. Ünite · Ünite Tarama Testi',
    tests: [{ no: 5, page: 20, answers: 'BDABACDADBDBCC' }],
  },
  {
    name: '2. Ünite · DNA ve Genetik Kod',
    tests: [{ no: 6, page: 26, answers: 'BBDACABDCDAA' }],
  },
  {
    name: '2. Ünite · Kalıtım',
    tests: [
      { no: 7, page: 30, answers: 'ACADCABDDBBD' },
      { no: 8, page: 34, answers: 'DDABDCACBBC' },
    ],
  },
  {
    name: '2. Ünite · Mutasyon ve Modifikasyon',
    tests: [{ no: 9, page: 38, answers: 'DBCCABACADDA' }],
  },
  {
    name: '2. Ünite · Adaptasyon',
    tests: [{ no: 10, page: 42, answers: 'CDCBAABBDDD' }],
  },
  {
    name: '2. Ünite · Biyoteknoloji',
    tests: [{ no: 11, page: 46, answers: 'DBCDCDBADA' }],
  },
  {
    name: '2. Ünite · Ünite Tarama Testi',
    tests: [{ no: 12, page: 50, answers: 'DBCCBDABCDDABACABCDBA' }],
  },
  {
    name: '3. Ünite · Katı Basıncı',
    tests: [
      { no: 13, page: 58, answers: 'CCBDACDBABBA' },
      { no: 14, page: 62, answers: 'ADCCBDBA' },
    ],
  },
  {
    name: '3. Ünite · Sıvı Basıncı',
    tests: [{ no: 15, page: 66, answers: 'BADCBDBADC' }],
  },
  {
    name: '3. Ünite · Gaz Basıncı',
    tests: [{ no: 16, page: 70, answers: 'CDDABCBCA' }],
  },
  {
    name: '3. Ünite · Ünite Tarama Testi',
    tests: [{ no: 17, page: 74, answers: 'BCDCBABADDCCB' }],
  },
  {
    name: '4. Ünite · Periyodik Sistem',
    tests: [{ no: 18, page: 80, answers: 'DDACBCDBABAB' }],
  },
  {
    name: '4. Ünite · Elementlerin Sınıflandırılması',
    tests: [{ no: 19, page: 84, answers: 'BBACDCDABDC' }],
  },
  {
    name: '4. Ünite · Fiziksel ve Kimyasal Değişimler',
    tests: [{ no: 20, page: 88, answers: 'DDCABCACBBA' }],
  },
  {
    name: '4. Ünite · Kimyasal Tepkimeler',
    tests: [{ no: 21, page: 92, answers: 'DACCDBBAB' }],
  },
  {
    name: '4. Ünite · Asitler ve Bazlar',
    tests: [
      { no: 22, page: 96, answers: 'CDBCBCACD' },
      { no: 23, page: 100, answers: 'ADCBBAABD' },
    ],
  },
  {
    name: '4. Ünite · Maddenin Isı ile Etkileşimi',
    tests: [
      { no: 24, page: 104, answers: 'BBACAADC' },
      { no: 25, page: 108, answers: 'BCCDBACDD' },
    ],
  },
  {
    name: '4. Ünite · Hâl Değişimleri ve Hâl Değişim Isıları',
    tests: [
      { no: 26, page: 112, answers: 'ADBBBACDCDA' },
      { no: 27, page: 116, answers: 'CBBBCDADAC' },
    ],
  },
  {
    name: '4. Ünite · Hâl Değişim Grafikleri',
    tests: [{ no: 28, page: 120, answers: 'CDDBAACBD' }],
  },
  {
    name: "4. Ünite · Türkiye'de Kimya Endüstrisi",
    tests: [{ no: 29, page: 124, answers: 'BDCDAB' }],
  },
  {
    name: '4. Ünite · Ünite Tarama Testi',
    tests: [
      { no: 30, page: 126, answers: 'CDBBBACDABD' },
      { no: 31, page: 130, answers: 'BACABDBDDCDADB' },
    ],
  },
  {
    name: 'Yarıyıl Tarama Testi',
    tests: [
      { no: 32, page: 136, answers: 'BCBACAADBCCCB' },
      { no: 33, page: 142, answers: 'ACBDADCBCCACAC' },
    ],
  },
  {
    name: '5. Ünite · Makaralar',
    tests: [{ no: 34, page: 150, answers: 'BADDBACDDC' }],
  },
  {
    name: '5. Ünite · Kaldıraçlar',
    tests: [{ no: 35, page: 154, answers: 'AABCDCACA' }],
  },
  {
    name: '5. Ünite · Eğik Düzlem',
    tests: [{ no: 36, page: 158, answers: 'BDADBDABCC' }],
  },
  {
    name: '5. Ünite · Çıkrık',
    tests: [{ no: 37, page: 162, answers: 'DCDACBBCCB' }],
  },
  {
    name: '5. Ünite · Dişli Çarklar, Kasnaklar ve Vida',
    tests: [{ no: 38, page: 166, answers: 'BCBDBAADAD' }],
  },
  {
    name: '5. Ünite · Ünite Tarama Testi',
    tests: [{ no: 39, page: 170, answers: 'ACCBBCBDACBBACBC' }],
  },
  {
    name: '6. Ünite · Besin Zinciri ve Enerji Akışı',
    tests: [{ no: 40, page: 178, answers: 'DCDAABADBD' }],
  },
  {
    name: '6. Ünite · Fotosentez',
    tests: [{ no: 41, page: 182, answers: 'CBDDCABBA' }],
  },
  {
    name: '6. Ünite · Solunum',
    tests: [{ no: 42, page: 186, answers: 'DBDCBBBDA' }],
  },
  {
    name: '6. Ünite · Fotosentez – Solunum',
    tests: [{ no: 43, page: 190, answers: 'DBABCCD' }],
  },
  {
    name: '6. Ünite · Madde Döngüleri ve Çevre Sorunları',
    tests: [{ no: 44, page: 194, answers: 'CDABDBCC' }],
  },
  {
    name: '6. Ünite · Sürdürülebilir Kalkınma',
    tests: [{ no: 45, page: 198, answers: 'ADBDCCDBD' }],
  },
  {
    name: '6. Ünite · Ünite Tarama Testi',
    tests: [
      { no: 46, page: 202, answers: 'BBCDBABBDCD' },
      { no: 47, page: 208, answers: 'DBABDDCBBABD' },
    ],
  },
  {
    name: '7. Ünite · Elektrik Yükleri ve Elektriklenme',
    tests: [{ no: 48, page: 214, answers: 'DBDCBCABD' }],
  },
  {
    name: '7. Ünite · Elektrik Yüklü Cisimler',
    tests: [
      { no: 49, page: 218, answers: 'ACBDBBDDA' },
      { no: 50, page: 222, answers: 'ADACCDCB' },
    ],
  },
  {
    name: '7. Ünite · Elektrik Enerjisinin Dönüşümü',
    tests: [
      { no: 51, page: 226, answers: 'DABBCBCDA' },
      { no: 52, page: 230, answers: 'DCBDACBABC' },
    ],
  },
  {
    name: '7. Ünite · Ünite Tarama Testi',
    tests: [{ no: 53, page: 234, answers: 'CCBCCDCCBAADCB' }],
  },
  {
    name: 'Yıl Sonu Tarama Testi',
    tests: [
      { no: 54, page: 242, answers: 'BCDABCCADAABD' },
      { no: 55, page: 248, answers: 'BDCCACBBDBDCCAD' },
    ],
  },
]

async function main() {
  loadLocalSettings()
  if (!process.env.SQL_CONNECTION_STRING) throw new Error('SQL_CONNECTION_STRING is missing.')

  // Ön doğrulama: cevap dizileri + test numaralarının 1..55 arası tekil olması
  const seen = new Set()
  for (const ic of ICERIKLER) {
    for (const t of ic.tests) {
      if (!/^[A-D]+$/.test(t.answers)) {
        throw new Error(`Geçersiz cevap dizisi: Test ${t.no} — ${t.answers}`)
      }
      if (seen.has(t.no)) throw new Error(`Mükerrer test no: ${t.no}`)
      seen.add(t.no)
    }
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

      for (const t of ic.tests) {
        const testName = `Test ${t.no}`
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

        const questionCount = t.answers.length
        const pages = Math.max(1, Math.ceil(questionCount / 4))
        const pageStart = t.page
        const pageEnd = pageStart + pages - 1

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
        keysInserted += t.answers.length
        console.log(`  ${testName}: ${questionCount} soru (s. ${pageStart}) — ${t.answers}`)
      }
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
