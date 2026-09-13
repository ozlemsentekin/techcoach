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

// Bilfen Yayınları — "Pro & Test Soru Bankası - Din Kültürü ve Ahlak Bilgisi 8. Sınıf"
// (scope = 'catalog' / Kütüphane; kaynak panelde önceden oluşturuldu, bu script sadece
//  İÇERİK + TEST ADI + SAYFA NUMARASI + CEVAP ANAHTARI ekler — soru metni yok,
//  diğer soru bankası kaynaklarındaki gibi.)
//
// İçerik (ResourceBookTopics): kitabın İÇİNDEKİLER'indeki "Ünite N: BAŞLIK · Konu" biçiminde.
//   Ünite tarama testleri "... · Ünite Tarama Testi", ünitelere ait olmayanlar
//   "Yarıyıl Tarama Testi" / "Yıl Sonu Tarama Testi" olarak ayrı İçerik.
// Test adları kitaptaki global numaralandırmayla ("Test 1" .. "Test 51").
// page/pageEnd: İÇİNDEKİLER'den ve her testin sayfa başlığından okunan basılı sayfa numaraları
//   (bir sonraki testin başlangıç sayfası - 1); Test 51 için Yanıt Anahtarı bölümü s.158'den
//   önceki s.157'de bitiyor kabul edildi.
// answers: kitabın "YANIT ANAHTARI" sayfalarından (s. 158) fotoğraflarla transkribe edilen
//   harf dizisi. question_count = dizinin uzunluğu.
//
// ÖNEMLİ: Bu transkripsiyon telefon fotoğraflarından yapıldı (51 test / ~700 tekil cevap).
// Script prod'a yazılmadan ÖNCE kullanıcı fiziksel kitapla karşılaştırıp onaylayacak.
//
// İdempotent: her İçerik adı için ayrı ayrı — zaten varsa o İçerik atlanır.
const PUBLISHER_NAME = 'Bilfen Yayınları'
const BOOK_NAME = 'Pro & Test Soru Bankası - Din Kültürü ve Ahlak Bilgisi 8. Sınıf'

const ICERIKLER = [
  {
    name: 'Ünite 1: Kader İnancı · Kader ve Kaza İnancı',
    tests: [
      { no: 1, page: 8, pageEnd: 9, answers: 'DCBDAC' },
      { no: 2, page: 10, pageEnd: 11, answers: 'CDACBAB' },
      { no: 3, page: 12, pageEnd: 13, answers: 'DBCCAC' },
      { no: 4, page: 14, pageEnd: 15, answers: 'ADCBA' },
    ],
  },
  {
    name: 'Ünite 1: Kader İnancı · İnsanın İradesi ve Kader',
    tests: [
      { no: 5, page: 16, pageEnd: 17, answers: 'DACCAABD' },
      { no: 6, page: 18, pageEnd: 19, answers: 'DCBADB' },
    ],
  },
  {
    name: 'Ünite 1: Kader İnancı · Kaderle İlgili Kavramlar',
    tests: [
      { no: 7, page: 20, pageEnd: 21, answers: 'BCACDBADB' },
      { no: 8, page: 22, pageEnd: 23, answers: 'BCCADBA' },
      { no: 9, page: 24, pageEnd: 25, answers: 'BADDCB' },
    ],
  },
  {
    name: "Ünite 1: Kader İnancı · Bir Peygamber Tanıyorum: Hz. Musa (a.s.)",
    tests: [{ no: 10, page: 26, pageEnd: 27, answers: 'DABCBD' }],
  },
  {
    name: "Ünite 1: Kader İnancı · Bir Ayet Tanıyorum: Ayete'l-Kürsi ve Anlamı",
    tests: [{ no: 11, page: 28, pageEnd: 29, answers: 'ABBCDBCA' }],
  },
  {
    name: 'Ünite 1: Kader İnancı · Ünite Tarama Testi',
    tests: [{ no: 12, page: 30, pageEnd: 35, answers: 'CDBDCBABBCBDABAA' }],
  },

  {
    name: "Ünite 2: Zekât ve Sadaka · İslam'ın Paylaşma ve Yardımlaşmaya Verdiği Önem",
    tests: [
      { no: 13, page: 36, pageEnd: 37, answers: 'ABBCCD' },
      { no: 14, page: 38, pageEnd: 39, answers: 'BDCACBD' },
    ],
  },
  {
    name: 'Ünite 2: Zekât ve Sadaka · Zekât ve Sadaka İbadeti',
    tests: [
      { no: 15, page: 40, pageEnd: 41, answers: 'DCBDABDD' },
      { no: 16, page: 42, pageEnd: 43, answers: 'CBADBA' },
      { no: 17, page: 44, pageEnd: 45, answers: 'BDCBACCA' },
      { no: 18, page: 46, pageEnd: 47, answers: 'ABBCDBCDA' },
    ],
  },
  {
    name: 'Ünite 2: Zekât ve Sadaka · Zekât ve Sadakanın Bireysel ve Toplumsal Faydaları',
    tests: [{ no: 19, page: 48, pageEnd: 49, answers: 'DCBAABCDCB' }],
  },
  {
    name: "Ünite 2: Zekât ve Sadaka · Bir Peygamber Tanıyorum: Hz. Şuayb (a.s.)",
    tests: [{ no: 20, page: 50, pageEnd: 51, answers: 'CDDCAB' }],
  },
  {
    name: 'Ünite 2: Zekât ve Sadaka · Bir Sure Tanıyorum: Maûn Suresi ve Anlamı',
    tests: [{ no: 21, page: 52, pageEnd: 53, answers: 'BACDBDBC' }],
  },
  {
    name: 'Ünite 2: Zekât ve Sadaka · Ünite Tarama Testi',
    tests: [{ no: 22, page: 54, pageEnd: 61, answers: 'DCDBABADDBCACDADADBCADBC' }],
  },

  {
    name: 'Ünite 3: Din ve Hayat · Din, Birey ve Toplum',
    tests: [
      { no: 23, page: 62, pageEnd: 63, answers: 'CBDADADCB' },
      { no: 24, page: 64, pageEnd: 65, answers: 'BCACABB' },
    ],
  },
  {
    name: 'Ünite 3: Din ve Hayat · Dinin Temel Gayesi',
    tests: [
      { no: 25, page: 66, pageEnd: 67, answers: 'BBDCADC' },
      { no: 26, page: 68, pageEnd: 69, answers: 'CBADDCD' },
      { no: 27, page: 70, pageEnd: 71, answers: 'DCACADBB' },
      { no: 28, page: 72, pageEnd: 73, answers: 'DACBCDAB' },
    ],
  },
  {
    name: "Ünite 3: Din ve Hayat · Bir Peygamber Tanıyorum: Hz. Yusuf (a.s.) / Bir Sure Tanıyorum: Asr Suresi ve Anlamı",
    tests: [{ no: 29, page: 74, pageEnd: 75, answers: 'DCABACDAB' }],
  },
  {
    name: 'Ünite 3: Din ve Hayat · Ünite Tarama Testi',
    tests: [{ no: 30, page: 76, pageEnd: 81, answers: 'BDACAACCCBAABCABDCB' }],
  },

  {
    name: 'Yarıyıl Tarama Testi',
    tests: [
      { no: 31, page: 82, pageEnd: 87, answers: 'CADBBDCBDCADCBCDDCABDDCBD' },
      { no: 32, page: 88, pageEnd: 95, answers: 'BCBAACCABCCBBDBCBABDDCBDB' },
    ],
  },

  {
    name: "Ünite 4: Hz. Muhammed'in (s.a.v.) Örnekliği · Doğruluğu ve Güvenilir Kişiliği",
    tests: [
      { no: 33, page: 96, pageEnd: 97, answers: 'ABBCBDD' },
      { no: 34, page: 98, pageEnd: 99, answers: 'ACDCDBDC' },
    ],
  },
  {
    name: "Ünite 4: Hz. Muhammed'in (s.a.v.) Örnekliği · Merhameti ve Affedici Oluşu",
    tests: [
      { no: 35, page: 100, pageEnd: 101, answers: 'CAADAB' },
      { no: 36, page: 102, pageEnd: 103, answers: 'CBDCDA' },
    ],
  },
  {
    name: "Ünite 4: Hz. Muhammed'in (s.a.v.) Örnekliği · İstişareye Önem Vermesi",
    tests: [{ no: 37, page: 104, pageEnd: 105, answers: 'ADDCBADB' }],
  },
  {
    name: "Ünite 4: Hz. Muhammed'in (s.a.v.) Örnekliği · Davasındaki Cesaret ve Kararlılığı",
    tests: [{ no: 38, page: 106, pageEnd: 107, answers: 'DBCBDACB' }],
  },
  {
    name: "Ünite 4: Hz. Muhammed'in (s.a.v.) Örnekliği · Hakkı Gözetmedeki Hassasiyeti",
    tests: [{ no: 39, page: 108, pageEnd: 109, answers: 'AAACDCD' }],
  },
  {
    name: "Ünite 4: Hz. Muhammed'in (s.a.v.) Örnekliği · İnsanlara Değer Vermesi / Bir Sure Tanıyorum: Kureyş Suresi ve Anlamı",
    tests: [{ no: 40, page: 110, pageEnd: 111, answers: 'BACDDADCB' }],
  },
  {
    name: "Ünite 4: Hz. Muhammed'in (s.a.v.) Örnekliği · Ünite Tarama Testi",
    tests: [{ no: 41, page: 112, pageEnd: 117, answers: 'BBDAACDBDCBBDADBBC' }],
  },

  {
    name: "Ünite 5: Kur'an-ı Kerim ve Özellikleri · İslam Dininin Temel Kaynakları",
    tests: [{ no: 42, page: 118, pageEnd: 119, answers: 'BCABCACD' }],
  },
  {
    name: "Ünite 5: Kur'an-ı Kerim ve Özellikleri · Kur'an-ı Kerim'in Ana Konuları",
    tests: [
      { no: 43, page: 120, pageEnd: 121, answers: 'CDADBBC' },
      { no: 44, page: 122, pageEnd: 123, answers: 'CBABCCCD' },
      { no: 45, page: 124, pageEnd: 125, answers: 'BADDADC' },
    ],
  },
  {
    name: "Ünite 5: Kur'an-ı Kerim ve Özellikleri · Kur'an-ı Kerim'in Temel Özellikleri",
    tests: [{ no: 46, page: 126, pageEnd: 127, answers: 'CDABBADBA' }],
  },
  {
    name: "Ünite 5: Kur'an-ı Kerim ve Özellikleri · Kur'an-ı Kerim'in Temel Özellikleri / Bir Peygamber Tanıyorum: Hz. Nuh (a.s.)",
    tests: [{ no: 47, page: 128, pageEnd: 129, answers: 'BCBABAC' }],
  },
  {
    name: "Ünite 5: Kur'an-ı Kerim ve Özellikleri · Ünite Tarama Testi",
    tests: [{ no: 48, page: 130, pageEnd: 133, answers: 'DCBACACBBABABCCDACBC' }],
  },

  {
    name: 'Yıl Sonu Tarama Testi',
    tests: [
      { no: 49, page: 134, pageEnd: 141, answers: 'BDBCCABDAADDACCBDADBBCAB' },
      { no: 50, page: 142, pageEnd: 149, answers: 'DCBABADBDCBDDCADCABAACDBDCD' },
      { no: 51, page: 150, pageEnd: 157, answers: 'CDBDCADBAACADBACBBDABCBACBCDD' },
    ],
  },
]

async function main() {
  loadLocalSettings()
  if (!process.env.SQL_CONNECTION_STRING) throw new Error('SQL_CONNECTION_STRING is missing.')

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
  for (let n = 1; n <= 51; n += 1) {
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
        const pageStart = t.page
        const pageEnd = t.pageEnd
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
        t.answers.split('').forEach((label, idx) => {
          req.input(`o${idx}`, sql.Int, idx + 1)
          req.input(`l${idx}`, sql.NChar(1), label)
          valueRows.push(`(@testId, @o${idx}, @l${idx})`)
        })
        await req.query(`INSERT INTO dbo.TestAnswerKeys (test_id, order_no, correct_label) VALUES ${valueRows.join(', ')};`)
        keysInserted += t.answers.length
        console.log(`  ${testName}: ${questionCount} soru (s. ${pageStart}-${pageEnd}) — ${t.answers}`)
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
