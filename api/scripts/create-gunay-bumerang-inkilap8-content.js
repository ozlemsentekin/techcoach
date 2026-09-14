// "Bumerang Serisi - T.C. İnkılap Tarihi ve Atatürkçülük - 8. Sınıf" (Günay Yayınları) kaynağına
// kullanıcının gönderdiği içindekiler fotoğraflarından (7 Ünite) konu + test yapısını oluşturur.
// Cevap anahtarı henüz girilmiyor (kullanıcı ayrıca gönderecek) — question_count bilinçli olarak null bırakıldı.
// page_start/page_end, içindekiler'de bir sonraki kaydın başlangıç sayfasından hesaplandı.
// NOT: 7. Ünite'nin son testi "Beceri Testleri-1" (s.231) için içindekiler görüntüsü sayfa 231'de
// kesiliyor — bir sonraki kaydın (varsa) sayfası bilinmiyor. page_count NOT NULL olduğundan
// geçici olarak 1 yazıldı; gerçek bitiş sayfası öğrenilince düzeltilmeli.
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

const RESOURCE_BOOK_ID = '3184F4E4-E4CF-4CEB-91B3-56FF04765B82'

const TOPICS = [
  {
    name: "1. Ünite - Bir Kahraman Doğuyor",
    tests: [
      { name: 'Kavratan Testler-1', pageStart: 11, pageEnd: 12 },
      { name: 'Kavratan Testler-2', pageStart: 13, pageEnd: 14 },
      { name: 'Kavratan Testler-3', pageStart: 19, pageEnd: 20 },
      { name: 'Kavratan Testler-4', pageStart: 25, pageEnd: 26 },
      { name: 'Kavratan Testler-5', pageStart: 31, pageEnd: 32 },
      { name: 'Kavratan Testler-6', pageStart: 33, pageEnd: 34 },
      { name: 'Bumerang Testler-1', pageStart: 35, pageEnd: 38 },
      { name: 'Beceri Testleri-1', pageStart: 39, pageEnd: 41 },
      { name: 'Beceri Testleri-2', pageStart: 42, pageEnd: 44 },
    ],
  },
  {
    name: "2. Ünite - Milli Uyanış: Bağımsızlık Yolunda Atılan Adımlar",
    tests: [
      { name: 'Kavratan Testler-1', pageStart: 49, pageEnd: 50 },
      { name: 'Kavratan Testler-2', pageStart: 57, pageEnd: 58 },
      { name: 'Kavratan Testler-3', pageStart: 65, pageEnd: 66 },
      { name: 'Kavratan Testler-4', pageStart: 71, pageEnd: 72 },
      { name: 'Kavratan Testler-5', pageStart: 79, pageEnd: 80 },
      { name: 'Bumerang Testler-1', pageStart: 81, pageEnd: 85 },
      { name: 'Beceri Testleri-1', pageStart: 86, pageEnd: 89 },
      { name: 'Beceri Testleri-2', pageStart: 90, pageEnd: 94 },
    ],
  },
  {
    name: '3. Ünite - Milli Bir Destan: Ya İstiklal Ya Ölüm',
    tests: [
      { name: 'Kavratan Testler-1', pageStart: 100, pageEnd: 101 },
      { name: 'Kavratan Testler-2', pageStart: 108, pageEnd: 109 },
      { name: 'Kavratan Testler-3', pageStart: 110, pageEnd: 111 },
      { name: 'Kavratan Testler-4', pageStart: 112, pageEnd: 113 },
      { name: 'Kavratan Testler-5', pageStart: 121, pageEnd: 122 },
      { name: 'Bumerang Testler-1', pageStart: 123, pageEnd: 125 },
      { name: 'Beceri Testleri-1', pageStart: 126, pageEnd: 130 },
      { name: 'Beceri Testleri-2', pageStart: 131, pageEnd: 134 },
    ],
  },
  {
    name: '4. Ünite - Atatürkçülük ve Çağdaşlaşan Türkiye',
    tests: [
      { name: 'Kavratan Testler-1', pageStart: 140, pageEnd: 141 },
      { name: 'Kavratan Testler-2', pageStart: 145, pageEnd: 146 },
      { name: 'Kavratan Testler-3', pageStart: 151, pageEnd: 152 },
      { name: 'Kavratan Testler-4', pageStart: 156, pageEnd: 157 },
      { name: 'Kavratan Testler-5', pageStart: 162, pageEnd: 163 },
      { name: 'Bumerang Testler-1', pageStart: 164, pageEnd: 167 },
      { name: 'Beceri Testleri-1', pageStart: 168, pageEnd: 171 },
      { name: 'Beceri Testleri-2', pageStart: 172, pageEnd: 174 },
    ],
  },
  {
    name: '5. Ünite - Demokratikleşme Çabaları',
    tests: [
      { name: 'Kavratan Testler-1', pageStart: 180, pageEnd: 181 },
      { name: 'Kavratan Testler-2', pageStart: 185, pageEnd: 186 },
      { name: 'Bumerang Testler-1', pageStart: 187, pageEnd: 188 },
      { name: 'Beceri Testleri-1', pageStart: 189, pageEnd: 192 },
    ],
  },
  {
    name: '6. Ünite - Atatürk Dönemi Türk Dış Politikası',
    tests: [
      { name: 'Kavratan Testler-1', pageStart: 200, pageEnd: 201 },
      { name: 'Bumerang Testler-1', pageStart: 202, pageEnd: 205 },
      { name: 'Beceri Testleri-1', pageStart: 206, pageEnd: 208 },
      { name: 'Beceri Testleri-2', pageStart: 209, pageEnd: 212 },
    ],
  },
  {
    name: "7. Ünite - Atatürk'ün Ölümü ve Sonrası",
    tests: [
      { name: 'Kavratan Testler-1', pageStart: 219, pageEnd: 220 },
      { name: 'Kavratan Testler-2', pageStart: 226, pageEnd: 227 },
      { name: 'Bumerang Testler-1', pageStart: 228, pageEnd: 230 },
      // Sayfa 231'de başlıyor, bitişi içindekiler görüntüsünde yok — geçici page_count=1.
      { name: 'Beceri Testleri-1', pageStart: 231, pageEnd: null },
    ],
  },
]

async function main() {
  loadLocalSettings()
  const connectionString = process.env.SQL_CONNECTION_STRING
  if (!connectionString) throw new Error('SQL_CONNECTION_STRING eksik.')

  const pool = await sql.connect(connectionString)
  try {
    const existingTopics = await pool
      .request()
      .input('b', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
      .query('SELECT COUNT(*) AS cnt FROM dbo.ResourceBookTopics WHERE resource_book_id = @b;')
    if (existingTopics.recordset[0].cnt > 0) {
      throw new Error(`Bu kaynakta zaten ${existingTopics.recordset[0].cnt} konu var — script atlandı (mükerrer içerik riski).`)
    }

    let topicCount = 0
    let testCount = 0

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
        const pageEnd = test.pageEnd == null ? test.pageStart : test.pageEnd
        const pageCount = pageEnd - test.pageStart + 1
        await pool
          .request()
          .input('topicId', sql.UniqueIdentifier, topicId)
          .input('name', sql.NVarChar(200), test.name)
          .input('pageStart', sql.Int, test.pageStart)
          .input('pageEnd', sql.Int, pageEnd)
          .input('pageCount', sql.Int, pageCount)
          .query(`
            INSERT INTO dbo.ResourceBookTopicTests (topic_id, name, page_start, page_end, page_count)
            VALUES (@topicId, @name, @pageStart, @pageEnd, @pageCount);
          `)
        testCount += 1
        console.log(`   + ${test.name} (s.${test.pageStart}-${pageEnd})`)
      }
    }

    console.log(`Bitti. ${topicCount} konu, ${testCount} test oluşturuldu.`)
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error('İçerik oluşturma başarısız')
  console.error(error)
  process.exit(1)
})
