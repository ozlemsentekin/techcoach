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

// "Biltest Fen Bilimleri Soru Bankası 8. Sınıf" (Bilfen Yayınları, scope = 'catalog' / Kütüphane).
// Soru metni YOK — diğer soru bankası kaynaklarındaki gibi sadece İÇERİK + TEST KONUSU/ADI +
// SAYFA NUMARASI + CEVAP ANAHTARI eklenir.
//
// İçerik (ResourceBookTopics): İÇİNDEKİLER'deki konu başlıkları, "N. Ünite · Konu" biçiminde.
//   Ünite tarama / genel değerlendirme / deneme sınavı testleri de o ünitenin altında ayrı İçerik.
//   İÇİNDEKİLER'deki mükerrer "Isınma-Soğuma Grafikleri" + "Isınma ve Soğuma Grafikleri" satırları
//   tek İçerikte ("Isınma - Soğuma Grafikleri", Test 40-41) birleştirildi.
// Test adları kitaptaki global numaralandırmayla ("Test 1" .. "Test 75").
// page: her testin sayfa başlığından okunan basılı sayfa numarası (İÇİNDEKİLER ile çapraz kontrol).
//   page_end, sayfa başına ~4 soru varsayımıyla soru sayısından hesaplanır.
// answers: kitabın "Yanıt Anahtarı" sayfalarından (s. 255-256) transkribe edildi; birden çok
//   fotoğrafla çapraz kontrol edildi. question_count = dizinin uzunluğu.
//
// İdempotent: her İçerik adı ve her test adı için ayrı ayrı — zaten varsa atlanır.
const RESOURCE_BOOK_ID = '6574B1BA-93EE-4E0F-8E58-A73D9B5CD955'

const ICERIKLER = [
  // ── ÜNİTE 1: MEVSİMLER VE İKLİM ──────────────────────────────────────────
  {
    name: '1. Ünite · Mevsimlerin Oluşumu',
    tests: [
      { no: 1, page: 8, answers: 'CDDDAB' },
      { no: 2, page: 10, answers: 'CDCADAABBCC' },
    ],
  },
  {
    name: '1. Ünite · İklim ve Hava Hareketleri',
    tests: [
      { no: 3, page: 14, answers: 'BDDACD' },
      { no: 4, page: 16, answers: 'CABADBBDCDC' },
    ],
  },
  {
    name: '1. Ünite · Ünite Tarama Testi',
    tests: [{ no: 5, page: 20, answers: 'DABACADC' }],
  },

  // ── ÜNİTE 2: DNA VE GENETİK KOD ──────────────────────────────────────────
  {
    name: '2. Ünite · DNA ve Genetik Kod',
    tests: [
      { no: 6, page: 26, answers: 'DAACBD' },
      { no: 7, page: 28, answers: 'BDBCABACBDC' },
    ],
  },
  {
    name: '2. Ünite · Kalıtım',
    tests: [
      { no: 8, page: 32, answers: 'ADDADA' },
      { no: 9, page: 34, answers: 'ADCACCBDDADC' },
    ],
  },
  {
    name: '2. Ünite · Mutasyon ve Modifikasyon',
    tests: [
      { no: 10, page: 38, answers: 'DCCCAB' },
      { no: 11, page: 40, answers: 'CDBBDACBDCAC' },
    ],
  },
  {
    name: '2. Ünite · Adaptasyon',
    tests: [
      { no: 12, page: 44, answers: 'DDCBDA' },
      { no: 13, page: 46, answers: 'CDDBBACCDADB' },
    ],
  },
  {
    name: '2. Ünite · Biyoteknoloji',
    tests: [
      { no: 14, page: 50, answers: 'DDADDC' },
      { no: 15, page: 52, answers: 'BDDDC' },
    ],
  },
  {
    name: '2. Ünite · Ünite Tarama Testi',
    tests: [
      { no: 16, page: 54, answers: 'BDCBDCBAC' },
      { no: 17, page: 58, answers: 'ABDCACA' },
    ],
  },
  {
    name: '2. Ünite · Genel Değerlendirme Testi',
    tests: [{ no: 18, page: 62, answers: 'CAADACDDCCD' }],
  },

  // ── ÜNİTE 3: BASINÇ ─────────────────────────────────────────────────────
  {
    name: '3. Ünite · Katı Basıncı',
    tests: [
      { no: 19, page: 68, answers: 'DDCACA' },
      { no: 20, page: 70, answers: 'ADBADBADBDDB' },
    ],
  },
  {
    name: '3. Ünite · Sıvı Basıncı',
    tests: [
      { no: 21, page: 74, answers: 'DBDBDC' },
      { no: 22, page: 76, answers: 'ABABABBDCDCD' },
    ],
  },
  {
    name: '3. Ünite · Gaz Basıncı',
    tests: [
      { no: 23, page: 80, answers: 'DDCAAB' },
      { no: 24, page: 82, answers: 'ACAADB' },
    ],
  },
  {
    name: '3. Ünite · Ünite Tarama Testi',
    tests: [{ no: 25, page: 84, answers: 'BABCAABCDDCC' }],
  },
  {
    name: '3. Ünite · Genel Değerlendirme Testi',
    tests: [{ no: 26, page: 90, answers: 'DAADDADDBBCA' }],
  },

  // ── ÜNİTE 4: MADDE VE ENDÜSTRİ ──────────────────────────────────────────
  {
    name: '4. Ünite · Periyodik Sistem',
    tests: [
      { no: 27, page: 96, answers: 'BDCBAD' },
      { no: 28, page: 98, answers: 'DCADBAA' },
    ],
  },
  {
    name: '4. Ünite · Elementlerin Sınıflandırılması',
    tests: [
      { no: 29, page: 100, answers: 'DABADD' },
      { no: 30, page: 102, answers: 'DAADCA' },
    ],
  },
  {
    name: '4. Ünite · Fiziksel ve Kimyasal Değişimler',
    tests: [{ no: 31, page: 104, answers: 'BDCAADC' }],
  },
  {
    name: '4. Ünite · Kimyasal Tepkimeler',
    tests: [
      { no: 32, page: 106, answers: 'DACABCD' },
      { no: 33, page: 108, answers: 'ABCCDBCCDCA' },
    ],
  },
  {
    name: '4. Ünite · Asitler ve Bazlar',
    tests: [
      { no: 34, page: 112, answers: 'DBCADB' },
      { no: 35, page: 114, answers: 'CDCBBCBDDDB' },
    ],
  },
  {
    name: '4. Ünite · Maddenin Isı ile Etkileşimi',
    tests: [
      { no: 36, page: 118, answers: 'BBDADCD' },
      { no: 37, page: 120, answers: 'AABABCDAACB' },
    ],
  },
  {
    name: '4. Ünite · Maddenin Hâl Değişimleri ve Hâl Değişim Isıları',
    tests: [
      { no: 38, page: 124, answers: 'DCADBD' },
      { no: 39, page: 126, answers: 'CADCACABCADAC' },
    ],
  },
  {
    name: '4. Ünite · Isınma - Soğuma Grafikleri',
    tests: [
      { no: 40, page: 130, answers: 'CADDBD' },
      { no: 41, page: 132, answers: 'BACDDC' },
    ],
  },
  {
    name: "4. Ünite · Türkiye'de Kimya Endüstrisi",
    tests: [{ no: 42, page: 134, answers: 'ACABBAD' }],
  },
  {
    name: '4. Ünite · Ünite Tarama Testi',
    tests: [
      { no: 43, page: 136, answers: 'AAABDDCC' },
      { no: 44, page: 140, answers: 'DCACDDCDB' },
    ],
  },
  {
    name: '4. Ünite · Deneme Sınavı',
    tests: [{ no: 45, page: 144, answers: 'BAADBBDDBACDADDCDACD' }],
  },

  // ── ÜNİTE 5: BASİT MAKİNELER ────────────────────────────────────────────
  {
    name: '5. Ünite · Makaralar',
    tests: [
      { no: 46, page: 158, answers: 'ABCDADC' },
      { no: 47, page: 160, answers: 'CDDDAB' },
    ],
  },
  {
    name: '5. Ünite · Kaldıraçlar',
    tests: [
      { no: 48, page: 162, answers: 'ABCCAD' },
      { no: 49, page: 164, answers: 'DCAABD' },
    ],
  },
  {
    name: '5. Ünite · Eğik Düzlem - Çıkrık',
    tests: [
      { no: 50, page: 166, answers: 'CDACDC' },
      { no: 51, page: 168, answers: 'DBBABCCCDAAD' },
    ],
  },
  {
    name: '5. Ünite · Dişli Çarklar, Kasnaklar, Vida',
    tests: [
      { no: 52, page: 172, answers: 'CABDDC' },
      { no: 53, page: 174, answers: 'CBCDAABAB' },
    ],
  },
  {
    name: '5. Ünite · Ünite Tarama Testi',
    tests: [{ no: 54, page: 178, answers: 'CADBCBAB' }],
  },
  {
    name: '5. Ünite · Genel Değerlendirme Testi',
    tests: [{ no: 55, page: 182, answers: 'BDCBCACCDBD' }],
  },

  // ── ÜNİTE 6: ENERJİ DÖNÜŞÜMLERİ VE ÇEVRE BİLİMİ ─────────────────────────
  {
    name: '6. Ünite · Besin Zinciri ve Enerji Akışı',
    tests: [
      { no: 56, page: 188, answers: 'DDADAC' },
      { no: 57, page: 190, answers: 'ADDBAC' },
    ],
  },
  {
    name: '6. Ünite · Fotosentez',
    tests: [
      { no: 58, page: 192, answers: 'ACBDCA' },
      { no: 59, page: 194, answers: 'ADBBCDBDDAC' },
    ],
  },
  {
    name: '6. Ünite · Hücresel Enerji Üretimi',
    tests: [
      { no: 60, page: 198, answers: 'DBACDC' },
      { no: 61, page: 200, answers: 'DDBACDCDBCAA' },
    ],
  },
  {
    name: '6. Ünite · Madde Döngüleri ve Çevre Sorunları',
    tests: [
      { no: 62, page: 204, answers: 'DABCAD' },
      { no: 63, page: 206, answers: 'ADBDC' },
    ],
  },
  {
    name: '6. Ünite · Sürdürülebilir Kalkınma',
    tests: [
      { no: 64, page: 208, answers: 'BADCDC' },
      { no: 65, page: 210, answers: 'ACCDB' },
    ],
  },
  {
    name: '6. Ünite · Ünite Tarama Testi',
    tests: [{ no: 66, page: 212, answers: 'CBDDADACB' }],
  },
  {
    name: '6. Ünite · Genel Değerlendirme Testi',
    tests: [{ no: 67, page: 216, answers: 'AADBBCDCDC' }],
  },

  // ── ÜNİTE 7: ELEKTRİK YÜKLERİ VE ELEKTRİK ENERJİSİ ─────────────────────
  {
    name: '7. Ünite · Elektrik Yükleri ve Elektriklenme',
    tests: [
      { no: 68, page: 222, answers: 'ACBDDB' },
      { no: 69, page: 224, answers: 'ADCBDA' },
    ],
  },
  {
    name: '7. Ünite · Elektrik Yüklü Cisimler',
    tests: [
      { no: 70, page: 226, answers: 'ABCCDA' },
      { no: 71, page: 228, answers: 'BDCDBB' },
    ],
  },
  {
    name: '7. Ünite · Elektrik Enerjisinin Dönüşümü',
    tests: [
      { no: 72, page: 230, answers: 'DACCAA' },
      { no: 73, page: 232, answers: 'DCDCABDDDACB' },
    ],
  },
  {
    name: '7. Ünite · Ünite Tarama Testi',
    tests: [{ no: 74, page: 236, answers: 'CACBDDACADD' }],
  },
  {
    name: '7. Ünite · Deneme Sınavı',
    tests: [{ no: 75, page: 242, answers: 'ACDDBDCDDACDBBBBDCDD' }],
  },
]

async function main() {
  loadLocalSettings()
  if (!process.env.SQL_CONNECTION_STRING) throw new Error('SQL_CONNECTION_STRING is missing.')

  // Ön doğrulama
  const seen = new Set()
  for (const ic of ICERIKLER) {
    for (const t of ic.tests) {
      if (!/^[A-D]+$/.test(t.answers)) throw new Error(`Geçersiz cevap dizisi: Test ${t.no} — ${t.answers}`)
      if (seen.has(t.no)) throw new Error(`Mükerrer test no: ${t.no}`)
      seen.add(t.no)
    }
  }
  for (let n = 1; n <= 75; n += 1) if (!seen.has(n)) throw new Error(`Eksik test no: ${n}`)

  const pool = await sql.connect(process.env.SQL_CONNECTION_STRING)
  try {
    const book = await pool
      .request()
      .input('id', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
      .query('SELECT id, name, scope, grade, resource_type FROM dbo.ResourceBooks WHERE id = @id;')
    if (!book.recordset.length) throw new Error(`ResourceBook not found: ${RESOURCE_BOOK_ID}`)
    const b = book.recordset[0]
    console.log(`Kaynak: ${b.name} (scope=${b.scope}, ${b.grade}. sınıf, ${b.resource_type}) -> ${b.id}\n`)

    let topicsCreated = 0
    let topicsSkipped = 0
    let testsCreated = 0
    let testsSkipped = 0
    let keysInserted = 0

    for (const ic of ICERIKLER) {
      let topicId
      const existing = await pool
        .request()
        .input('rbId', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
        .input('name', sql.NVarChar(200), ic.name)
        .query('SELECT id FROM dbo.ResourceBookTopics WHERE resource_book_id = @rbId AND name = @name;')
      if (existing.recordset.length) {
        topicId = existing.recordset[0].id
        console.log(`İçerik (var): ${ic.name}`)
        topicsSkipped += 1
      } else {
        const ins = await pool
          .request()
          .input('rbId', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
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
