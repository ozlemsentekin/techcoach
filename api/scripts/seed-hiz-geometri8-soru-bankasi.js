const fs = require('fs')
const path = require('path')
const sql = require('mssql')

const localSettingsPath = path.join(__dirname, '..', 'local.settings.json')

function loadLocalSettings() {
  if (!fs.existsSync(localSettingsPath)) return
  const parsed = JSON.parse(fs.readFileSync(localSettingsPath, 'utf8'))
  Object.entries(parsed.Values || {}).forEach(([key, value]) => {
    if (!process.env[key] && typeof value === 'string') {
      process.env[key] = value
    }
  })
}

const PUBLISHER_NAME = 'Hız Yayınları'
const BOOK_NAME = '8. Sınıf Geometri Soru Bankası'

// İçindekiler'den birebir. Her test 2 sayfa (Test 1 -> s.8, Test 2 -> s.10 ...).
// Görsellerde soru sayısı / yanıt anahtarı yok; question_count boş bırakılıyor,
// cevap anahtarı sonradan girilecek. Yanıt Anahtarı s.128'de başlıyor.
// Hız Yayınları konvansiyonu (bkz. 8. Sınıf Matematik Soru Bankası): her Ünite tek bir
// ResourceBookTopics satırı, test'in topic_name alanı alt bölüm (konu) adını tutuyor.
const UNITE_NAMES = {
  1: '1. Ünite - Çarpanlar ve Katlar, Üslü İfadeler',
  2: '2. Ünite - Kareköklü İfadeler, Veri Analizi',
  3: '3. Ünite - Basit Olayların Olma Olasılığı, Cebirsel İfadeler ve Özdeşlikler',
  4: '4. Ünite - Doğrusal Denklemler, Eşitsizlikler',
  5: '5. Ünite - Üçgenler, Eşlik ve Benzerlik',
  6: '6. Ünite - Dönüşüm Geometrisi, Geometrik Cisimler',
}

// Her bölüm: alt konu adı, ait olduğu ünite, ilk test no ve ilk testin başlangıç sayfası.
// Test numaraları kitap boyunca artıyor; her test 2 sayfa.
const SECTIONS = [
  { name: 'Çarpanlar ve Katlar', unite: 1, firstTestNo: 1, firstPage: 8, testCount: 5 },
  { name: 'Üslü İfadeler', unite: 1, firstTestNo: 6, firstPage: 18, testCount: 3 },

  { name: 'Kareköklü İfadeler', unite: 2, firstTestNo: 9, firstPage: 24, testCount: 8 },
  { name: 'Veri Analizi', unite: 2, firstTestNo: 17, firstPage: 40, testCount: 3 },

  { name: 'Basit Olayların Olma Olasılığı', unite: 3, firstTestNo: 20, firstPage: 46, testCount: 4 },
  { name: 'Cebirsel İfadeler ve Özdeşlikler', unite: 3, firstTestNo: 24, firstPage: 54, testCount: 7 },

  { name: 'Doğrusal Denklemler', unite: 4, firstTestNo: 31, firstPage: 68, testCount: 8 },
  { name: 'Eşitsizlikler', unite: 4, firstTestNo: 39, firstPage: 84, testCount: 2 },

  { name: 'Üçgenler', unite: 5, firstTestNo: 41, firstPage: 88, testCount: 6 },
  { name: 'Eşlik ve Benzerlik', unite: 5, firstTestNo: 47, firstPage: 100, testCount: 4 },

  { name: 'Dönüşüm Geometrisi', unite: 6, firstTestNo: 51, firstPage: 108, testCount: 2 },
  { name: 'Geometrik Cisimler', unite: 6, firstTestNo: 53, firstPage: 112, testCount: 8 },
]

const TOTAL_TESTS = 60

function buildTopics() {
  const topics = []
  let expectedTestNo = 1

  for (const section of SECTIONS) {
    if (section.firstTestNo !== expectedTestNo) {
      throw new Error(`Test numarası tutmuyor: ${section.name} için ${section.firstTestNo}, beklenen ${expectedTestNo}`)
    }

    const tests = []
    for (let i = 0; i < section.testCount; i += 1) {
      const testNo = section.firstTestNo + i
      const pageStart = section.firstPage + i * 2
      tests.push({
        no: testNo,
        name: `Test ${testNo}`,
        pageStart,
        pageEnd: pageStart + 1,
      })
    }

    topics.push({ subtopicName: section.name, unite: section.unite, tests })
    expectedTestNo += section.testCount
  }

  return { topics, lastTestNo: expectedTestNo - 1 }
}

async function getResourceBookId(pool) {
  const result = await pool
    .request()
    .input('publisherName', sql.NVarChar(150), PUBLISHER_NAME)
    .input('bookName', sql.NVarChar(200), BOOK_NAME).query(`
      SELECT rb.id
      FROM dbo.ResourceBooks rb
      INNER JOIN dbo.Publishers p ON p.id = rb.publisher_id
      WHERE p.name = @publisherName AND rb.name = @bookName;
    `)
  if (!result.recordset.length) throw new Error(`ResourceBook bulunamadı: ${PUBLISHER_NAME} - ${BOOK_NAME}`)
  return result.recordset[0].id
}

async function getOrCreateTopic(pool, resourceBookId, name) {
  const existing = await pool
    .request()
    .input('resourceBookId', sql.UniqueIdentifier, resourceBookId)
    .input('name', sql.NVarChar(200), name)
    .query('SELECT id FROM dbo.ResourceBookTopics WHERE resource_book_id = @resourceBookId AND name = @name;')
  if (existing.recordset.length) return existing.recordset[0].id

  const inserted = await pool
    .request()
    .input('resourceBookId', sql.UniqueIdentifier, resourceBookId)
    .input('name', sql.NVarChar(200), name).query(`
      INSERT INTO dbo.ResourceBookTopics (resource_book_id, name)
      OUTPUT inserted.id
      VALUES (@resourceBookId, @name);
    `)
  return inserted.recordset[0].id
}

async function testExists(pool, topicId, topicName, name) {
  const result = await pool
    .request()
    .input('topicId', sql.UniqueIdentifier, topicId)
    .input('topicName', sql.NVarChar(200), topicName)
    .input('name', sql.NVarChar(200), name)
    .query(
      'SELECT id FROM dbo.ResourceBookTopicTests WHERE topic_id = @topicId AND topic_name = @topicName AND name = @name;',
    )
  return result.recordset[0]?.id || null
}

async function insertTest(pool, topicId, topicName, test) {
  const pageCount = test.pageEnd - test.pageStart + 1
  await pool
    .request()
    .input('topicId', sql.UniqueIdentifier, topicId)
    .input('topicName', sql.NVarChar(200), topicName)
    .input('name', sql.NVarChar(200), test.name)
    .input('pageStart', sql.Int, test.pageStart)
    .input('pageEnd', sql.Int, test.pageEnd)
    .input('pageCount', sql.Int, pageCount)
    .input('questionCount', sql.Int, null).query(`
      INSERT INTO dbo.ResourceBookTopicTests (topic_id, topic_name, name, page_start, page_end, page_count, question_count)
      VALUES (@topicId, @topicName, @name, @pageStart, @pageEnd, @pageCount, @questionCount);
    `)
  console.log(`  + ${test.name} -> "${topicName}" (s.${test.pageStart}-${test.pageEnd})`)
}

async function main() {
  loadLocalSettings()
  const connectionString = process.env.SQL_CONNECTION_STRING
  if (!connectionString) throw new Error('SQL_CONNECTION_STRING eksik.')

  const { topics, lastTestNo } = buildTopics()
  if (lastTestNo !== TOTAL_TESTS) {
    throw new Error(`Toplam ${TOTAL_TESTS} test bekleniyordu, ${lastTestNo} hesaplandı`)
  }

  const pool = await sql.connect(connectionString)
  try {
    const resourceBookId = await getResourceBookId(pool)
    console.log(`ResourceBook: ${BOOK_NAME} -> ${resourceBookId}`)

    const uniteTopicIds = {}
    for (const uniteNo of Object.keys(UNITE_NAMES)) {
      uniteTopicIds[uniteNo] = await getOrCreateTopic(pool, resourceBookId, UNITE_NAMES[uniteNo])
      console.log(`İçerik: ${UNITE_NAMES[uniteNo]} -> ${uniteTopicIds[uniteNo]}`)
    }

    let totalTests = 0
    let skipped = 0

    for (const topic of topics) {
      const uniteTopicId = uniteTopicIds[topic.unite]
      for (const test of topic.tests) {
        const existingId = await testExists(pool, uniteTopicId, topic.subtopicName, test.name)
        if (existingId) {
          console.log(`  = ${test.name} zaten var ("${topic.subtopicName}") — atlandı`)
          skipped += 1
          continue
        }
        await insertTest(pool, uniteTopicId, topic.subtopicName, test)
        totalTests += 1
      }
    }

    console.log(
      `Bitti. Üniteler: ${Object.keys(UNITE_NAMES).length}, alt konular: ${topics.length}, ` +
        `eklenen test: ${totalTests}, atlanan: ${skipped}`,
    )
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error('Seed başarısız')
  console.error(error)
  process.exit(1)
})
