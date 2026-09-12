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

// Bilfen Yayınları — "Pro & Test Soru Bankası - T.C. İnkilap Tarihi ve Atatürkçülük 8. Sınıf"
// (scope = 'catalog' / Kütüphane; kaynak panelde önceden oluşturuldu, bu script sadece
//  İÇERİK + TEST ADI + SAYFA NUMARASI + CEVAP ANAHTARI ekler — soru metni yok,
//  diğer soru bankası kaynaklarındaki gibi.)
//
// İçerik (ResourceBookTopics): kitabın İÇİNDEKİLER'indeki konu başlıkları, "N. Ünite · Konu" biçiminde.
//   Ünite tarama testleri "N. Ünite · Ünite Tarama Testi", ünitelere ait olmayanlar
//   "Yarıyıl Tarama Testi" / "Yıl Sonu Tarama Testi" olarak ayrı İçerik.
// Test adları kitaptaki global numaralandırmayla ("Test 1" .. "Test 50").
// page: her testin sayfa başlığından okunan basılı sayfa numarası (İÇİNDEKİLER ile çapraz kontrol).
//   page_end, sayfa başına ~4 soru varsayımıyla soru sayısından hesaplanır (kitap düzeni 2x2).
// answers: kitabın "YANIT ANAHTARI" sayfalarından (s. 207+) sırayla transkribe edilen harf dizisi;
//   Test 1-26 ve Test 27-50 iki ayrı fotoğraftan çapraz kontrol edildi. question_count = dizinin uzunluğu.
//
// İdempotent: her İçerik adı için ayrı ayrı — zaten varsa o İçerik atlanır.
const PUBLISHER_NAME = 'Bilfen Yayınları'
const BOOK_NAME = 'Pro & Test Soru Bankası - T.C. İnkilap Tarihi ve Atatürkçülük 8. Sınıf'

const ICERIKLER = [
  {
    name: '1. Ünite · Uyanan Avrupa ve Sarsılan Osmanlı',
    tests: [{ no: 1, page: 8, answers: 'DCCABDABCA' }],
  },
  {
    name: '1. Ünite · Mavi Gözlü Çocuk: Mustafa',
    tests: [{ no: 2, page: 12, answers: 'ADDBABDCBADC' }],
  },
  {
    name: '1. Ünite · Buhranlar Büyük Kahramanlar Doğurur',
    tests: [{ no: 3, page: 16, answers: 'BCDBDB' }],
  },
  {
    name: '1. Ünite · Adım Adım Liderliğe',
    tests: [{ no: 4, page: 18, answers: 'DAACBCDDAB' }],
  },
  {
    name: '1. Ünite · Ünite Tarama Testi',
    tests: [
      { no: 5, page: 22, answers: 'BDADBCA' },
      { no: 6, page: 24, answers: 'BDBDCACACDBCDACDAB' },
    ],
  },
  {
    name: "2. Ünite · I. Dünya Savaşı'nda Osmanlı Devleti",
    tests: [
      { no: 7, page: 30, answers: 'CDBAADCDAD' },
      { no: 8, page: 34, answers: 'BDDAAD' },
    ],
  },
  {
    name: '2. Ünite · İşgal Yıllarında Anadolu / Cemiyetler / Kuvayımilliye',
    tests: [
      { no: 9, page: 38, answers: 'DDCACBDA' },
      { no: 10, page: 42, answers: 'BBACBACD' },
    ],
  },
  {
    name: '2. Ünite · İstiklal Yolculuğu',
    tests: [
      { no: 11, page: 46, answers: 'CDDBABBCBAD' },
      { no: 12, page: 50, answers: 'CDBCADBBDA' },
    ],
  },
  {
    name: '2. Ünite · Bir Milletin Yemini: Misakımillî / Büyük Millet Meclisine Karşı Ayaklanmalar ve Sevr',
    tests: [{ no: 13, page: 54, answers: 'BCDACDDBDBA' }],
  },
  {
    name: '2. Ünite · Ünite Tarama Testi',
    tests: [
      { no: 14, page: 58, answers: 'ABCDAACBDDCDBA' },
      { no: 15, page: 62, answers: 'ADBCADABCDBAADDC' },
    ],
  },
  {
    name: '3. Ünite · Doğu ve Güney Cepheleri',
    tests: [{ no: 16, page: 68, answers: 'CABDADCBC' }],
  },
  {
    name: '3. Ünite · Batı Cephesi',
    tests: [{ no: 17, page: 72, answers: 'BDBCCAAD' }],
  },
  {
    name: '3. Ünite · Maarif Kongresi ve Millî Seferberlik: Tekâlifimilliye',
    tests: [{ no: 18, page: 76, answers: 'ADBCABCAD' }],
  },
  {
    name: '3. Ünite · Direnişten Dirilişe',
    tests: [{ no: 19, page: 80, answers: 'BAACDBBDCBA' }],
  },
  {
    name: "3. Ünite · Türkiye'nin Tapu Senedi: Lozan / Sanat ve Edebiyat Eserlerinde Millî Mücadele",
    tests: [{ no: 20, page: 84, answers: 'BABCADB' }],
  },
  {
    name: '3. Ünite · Ünite Tarama Testi',
    tests: [
      { no: 21, page: 88, answers: 'DCABDB' },
      { no: 22, page: 90, answers: 'DCCABADCBADAABCDDA' },
    ],
  },
  {
    name: 'Yarıyıl Tarama Testi',
    tests: [
      { no: 23, page: 96, answers: 'ACDAAADBBB' },
      { no: 24, page: 102, answers: 'ABDCABDACC' },
      { no: 25, page: 106, answers: 'ABCDCBBCAD' },
    ],
  },
  {
    name: '4. Ünite · Atatürk İlkeleri',
    tests: [
      { no: 26, page: 110, answers: 'DBCABDCDABD' },
      { no: 27, page: 114, answers: 'BCDACABDAC' },
    ],
  },
  {
    name: '4. Ünite · Siyasi Alandaki Gelişmeler',
    tests: [{ no: 28, page: 118, answers: 'CCDADBCDB' }],
  },
  {
    name: '4. Ünite · Hukuk, Eğitim ve Kültür Alanındaki Gelişmeler',
    tests: [{ no: 29, page: 122, answers: 'CDACBDA' }],
  },
  {
    name: '4. Ünite · Toplumsal, Ekonomi ve Sağlık Alanındaki Gelişmeler',
    tests: [{ no: 30, page: 124, answers: 'BCABDDDA' }],
  },
  {
    name: '4. Ünite · Atatürk İlke ve İnkılapları',
    tests: [
      { no: 31, page: 126, answers: 'CDABACBDBC' },
      { no: 32, page: 130, answers: 'BCADBCADBCDA' },
    ],
  },
  {
    name: '4. Ünite · Cumhuriyet Gençlere Emanet / İlke ve İnkılapların Esasları',
    tests: [{ no: 33, page: 134, answers: 'CDBCDA' }],
  },
  {
    name: '4. Ünite · Ünite Tarama Testi',
    tests: [
      { no: 34, page: 136, answers: 'CDCBDABB' },
      { no: 35, page: 138, answers: 'CCCDBBAADBDCAABDBAA' },
    ],
  },
  {
    name: '5. Ünite · Demokratikleşme Yolunda Atılan Adımlar',
    tests: [{ no: 36, page: 144, answers: 'BDABCAC' }],
  },
  {
    name: "5. Ünite · Mustafa Kemal'e Suikast Girişimi ve Türkiye Cumhuriyeti'ne Yönelik Tehditler",
    tests: [{ no: 37, page: 146, answers: 'DBACBABCAD' }],
  },
  {
    name: '5. Ünite · Ünite Tarama Testi',
    tests: [
      { no: 38, page: 150, answers: 'CDCBDAABAD' },
      { no: 39, page: 154, answers: 'BCDAABCDDBACB' },
    ],
  },
  {
    name: '6. Ünite · Türk Dış Politikasının Temel İlkeleri',
    tests: [{ no: 40, page: 160, answers: 'BACCDBADADC' }],
  },
  {
    name: "6. Ünite · Dış Politikada Yaşanan Temel Gelişmeler / Misakımillî'nin Son Zaferi: Hatay",
    tests: [{ no: 41, page: 164, answers: 'CADDBBCADCBA' }],
  },
  {
    name: '6. Ünite · Ünite Tarama Testi',
    tests: [
      { no: 42, page: 168, answers: 'CABDACBADA' },
      { no: 43, page: 170, answers: 'CBCADADBDDACBBA' },
    ],
  },
  {
    name: "7. Ünite · Atatürk'ün Vefatı ve Yankıları / İnsan Eserleriyle Yaşar",
    tests: [{ no: 44, page: 176, answers: 'DADCBBACAD' }],
  },
  {
    name: "7. Ünite · Yeniden Sarsılan Dünya / II. Dünya Savaşı'nın Türkiye'ye Etkileri / Demokrasi Yolunda Güçlü Adımlar",
    tests: [{ no: 45, page: 180, answers: 'ABCDCAB' }],
  },
  {
    name: '7. Ünite · Ünite Tarama Testi',
    tests: [
      { no: 46, page: 184, answers: 'ABCD' },
      { no: 47, page: 186, answers: 'DDCBADCADADB' },
    ],
  },
  {
    name: 'Yıl Sonu Tarama Testi',
    tests: [
      { no: 48, page: 192, answers: 'BDACABBCAD' },
      { no: 49, page: 196, answers: 'ADADDCDCBA' },
      { no: 50, page: 200, answers: 'AACDBCBCAD' },
    ],
  },
]

async function main() {
  loadLocalSettings()
  if (!process.env.SQL_CONNECTION_STRING) throw new Error('SQL_CONNECTION_STRING is missing.')

  // Ön doğrulama: cevap dizileri + test numaralarının 1..50 arası tekil olması
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
  for (let n = 1; n <= 50; n += 1) {
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
